/// File-based adapter implementing the SettingsManager port.
///
/// Reads ~/.claude/settings.json, creates byte-identical backups,
/// and surgically merges Norbert hook entries using pure domain functions.
/// All merge logic lives in the domain module; this adapter handles only IO.

use std::fs;
use std::path::PathBuf;

use crate::domain::{self, MergeOutcome, HOOK_PORT};
use crate::ports::SettingsManager;

/// File-based settings manager for Claude Code configuration.
///
/// Owns the paths to the settings file and backup location.
/// Delegates all merge logic to pure domain functions.
pub struct SettingsMergeAdapter {
    /// Path to Claude Code settings.json (e.g., ~/.claude/settings.json).
    settings_path: PathBuf,
    /// Path for the backup file (e.g., ~/.norbert/settings.json.bak).
    backup_path: PathBuf,
    /// Port for hook URLs.
    port: u16,
}

impl SettingsMergeAdapter {
    /// Create a new adapter with explicit paths.
    ///
    /// Paths are injected to enable testing with temporary directories.
    pub fn new(settings_path: PathBuf, backup_path: PathBuf, port: u16) -> Self {
        SettingsMergeAdapter {
            settings_path,
            backup_path,
            port,
        }
    }

    /// Create an adapter using default paths derived from the user's home directory.
    pub fn with_default_paths() -> Result<Self, String> {
        let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

        let settings_path = home.join(".claude").join("settings.json");
        let backup_path = home.join(".norbert").join("settings.json.bak");

        Ok(SettingsMergeAdapter::new(settings_path, backup_path, HOOK_PORT))
    }

    /// Read the settings file contents, returning None if the file does not exist.
    fn read_settings_file(&self) -> Result<Option<String>, String> {
        if !self.settings_path.exists() {
            return Ok(None);
        }
        let contents = fs::read_to_string(&self.settings_path)
            .map_err(|e| format!("Failed to read settings file {}: {}", self.settings_path.display(), e))?;
        Ok(Some(contents))
    }

    /// Create a byte-identical backup of the settings file.
    ///
    /// Copies raw bytes to ensure the backup is identical to the original.
    fn create_backup(&self) -> Result<(), String> {
        // Ensure parent directory exists
        if let Some(parent) = self.backup_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create backup directory: {}", e))?;
        }
        fs::copy(&self.settings_path, &self.backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        Ok(())
    }

    /// Write the merged configuration to the settings file.
    fn write_settings(&self, config: &serde_json::Value) -> Result<(), String> {
        // Ensure parent directory exists
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create settings directory: {}", e))?;
        }
        let json_string = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&self.settings_path, &json_string)
            .map_err(|e| format!("Failed to write settings file {}: {}", self.settings_path.display(), e))?;
        Ok(())
    }
}

impl SettingsManager for SettingsMergeAdapter {
    /// Merge Norbert hook entries into the Claude Code configuration.
    ///
    /// Follows the backup-first surgical merge pattern (ADR-006):
    /// 1. Read existing file (or handle missing file)
    /// 2. Parse JSON (or handle malformed JSON)
    /// 3. Create byte-identical backup (only if file existed)
    /// 4. Merge hooks using pure domain function
    /// 5. Write merged configuration
    fn merge_settings(&self) -> Result<(), String> {
        let file_contents = self.read_settings_file()?;

        match file_contents {
            None => {
                // No existing file: create new config with hooks only, no backup
                let new_config = domain::build_hooks_only_config(self.port);
                self.write_settings(&new_config)?;
                Ok(())
            }
            Some(contents) => {
                // Parse JSON -- malformed JSON skips merge with warning
                let config: serde_json::Value = serde_json::from_str(&contents)
                    .map_err(|e| format!("Malformed JSON in settings file {}, hooks not registered: {}", self.settings_path.display(), e))?;

                // Merge hooks using pure domain function
                match domain::merge_hooks_into_config(&config, self.port) {
                    MergeOutcome::AlreadyMerged => Ok(()),
                    MergeOutcome::Merged(merged_config) => {
                        // Backup first, then write
                        self.create_backup()?;
                        self.write_settings(&merged_config)?;
                        Ok(())
                    }
                }
            }
        }
    }

    /// Check whether all Norbert hook entries are present in the configuration.
    fn is_merged(&self) -> Result<bool, String> {
        let file_contents = self.read_settings_file()?;

        match file_contents {
            None => Ok(false),
            Some(contents) => {
                let config: serde_json::Value = serde_json::from_str(&contents)
                    .map_err(|e| format!("Failed to parse settings file {}: {}", self.settings_path.display(), e))?;
                Ok(domain::hooks_are_merged(&config, self.port))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    /// Helper: create a SettingsMergeAdapter with paths in a temporary directory.
    fn create_test_adapter(temp_dir: &Path) -> SettingsMergeAdapter {
        let settings_path = temp_dir.join("settings.json");
        let backup_path = temp_dir.join("backup").join("settings.json.bak");
        SettingsMergeAdapter::new(settings_path, backup_path, HOOK_PORT)
    }

    /// Helper: write a settings file with the given content.
    fn write_test_settings(adapter: &SettingsMergeAdapter, content: &str) {
        if let Some(parent) = adapter.settings_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&adapter.settings_path, content).unwrap();
    }

    // --- Missing file ---

    #[test]
    fn merge_creates_new_config_when_no_file_exists() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());

        adapter.merge_settings().unwrap();

        assert!(adapter.settings_path.exists(), "Settings file should be created");
        let contents = fs::read_to_string(&adapter.settings_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&contents).unwrap();
        assert!(config.get("hooks").is_some());
    }

    #[test]
    fn merge_creates_no_backup_when_no_file_exists() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());

        adapter.merge_settings().unwrap();

        assert!(!adapter.backup_path.exists(), "No backup should be created");
    }

    // --- Existing file with valid JSON ---

    #[test]
    fn merge_creates_byte_identical_backup() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        let original_content = r#"{"permissions":{"allow":["Read","Write"]}}"#;
        write_test_settings(&adapter, original_content);

        adapter.merge_settings().unwrap();

        assert!(adapter.backup_path.exists(), "Backup should be created");
        let backup_content = fs::read(&adapter.backup_path).unwrap();
        assert_eq!(
            backup_content,
            original_content.as_bytes(),
            "Backup should be byte-identical to original"
        );
    }

    #[test]
    fn merge_preserves_existing_settings() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        let original = serde_json::json!({
            "permissions": {"allow": ["Read", "Write"]},
            "mcpServers": {"github": {"command": "mcp-github", "type": "stdio"}}
        });
        write_test_settings(&adapter, &serde_json::to_string_pretty(&original).unwrap());

        adapter.merge_settings().unwrap();

        let contents = fs::read_to_string(&adapter.settings_path).unwrap();
        let merged: serde_json::Value = serde_json::from_str(&contents).unwrap();
        assert_eq!(merged["permissions"], original["permissions"]);
        assert_eq!(merged["mcpServers"], original["mcpServers"]);
    }

    #[test]
    fn merge_adds_six_hook_entries() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "{}");

        adapter.merge_settings().unwrap();

        let contents = fs::read_to_string(&adapter.settings_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&contents).unwrap();
        let hooks = config.get("hooks").expect("hooks should exist");
        for name in &domain::HOOK_EVENT_NAMES {
            assert!(hooks.get(name).is_some(), "Missing hook: {}", name);
        }
    }

    // --- Malformed JSON ---

    #[test]
    fn merge_returns_error_on_malformed_json() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "not valid json {{{");

        let result = adapter.merge_settings();
        assert!(result.is_err(), "Should error on malformed JSON");
        let err = result.unwrap_err();
        assert!(
            err.contains("Malformed JSON"),
            "Error should mention malformed JSON: {}",
            err
        );
    }

    #[test]
    fn merge_does_not_modify_malformed_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        let malformed = "not valid json {{{";
        write_test_settings(&adapter, malformed);

        let _ = adapter.merge_settings();

        let contents = fs::read_to_string(&adapter.settings_path).unwrap();
        assert_eq!(contents, malformed, "Malformed file should not be modified");
    }

    #[test]
    fn merge_creates_no_backup_on_malformed_json() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "not valid json");

        let _ = adapter.merge_settings();

        assert!(!adapter.backup_path.exists(), "No backup on malformed JSON");
    }

    // --- Idempotency ---

    #[test]
    fn merge_is_idempotent_no_changes_on_rerun() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "{}");

        adapter.merge_settings().unwrap();
        let after_first = fs::read_to_string(&adapter.settings_path).unwrap();

        adapter.merge_settings().unwrap();
        let after_second = fs::read_to_string(&adapter.settings_path).unwrap();

        assert_eq!(after_first, after_second, "Second merge should not change file");
    }

    #[test]
    fn is_merged_returns_false_when_no_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        assert!(!adapter.is_merged().unwrap());
    }

    #[test]
    fn is_merged_returns_true_after_merge() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "{}");

        adapter.merge_settings().unwrap();
        assert!(adapter.is_merged().unwrap());
    }

    #[test]
    fn merge_does_not_duplicate_entries_on_rerun() {
        let temp_dir = tempfile::tempdir().unwrap();
        let adapter = create_test_adapter(temp_dir.path());
        write_test_settings(&adapter, "{}");

        adapter.merge_settings().unwrap();
        adapter.merge_settings().unwrap();

        let contents = fs::read_to_string(&adapter.settings_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&contents).unwrap();
        for name in &domain::HOOK_EVENT_NAMES {
            let entries = config["hooks"][name].as_array().unwrap();
            assert_eq!(entries.len(), 1, "Should have exactly 1 entry for {}", name);
        }
    }
}
