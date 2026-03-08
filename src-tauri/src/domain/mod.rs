/// Core domain types and pure functions for Norbert.
///
/// This module contains no IO or framework imports.
/// All functions are pure and testable in isolation.

/// Application name used in UI labels and tooltips.
pub const APP_NAME: &str = "Norbert";

/// Application version, sourced from Cargo.toml at compile time.
/// Single source of truth -- no other module should hardcode the version.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Build the tray icon tooltip string from app name and version.
///
/// Pure function: no side effects, no IO.
pub fn format_tooltip(app_name: &str, version: &str) -> String {
    format!("{} v{}", app_name, version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_tooltip_combines_name_and_version() {
        let result = format_tooltip("Norbert", "0.1.0");
        assert_eq!(result, "Norbert v0.1.0");
    }

    #[test]
    fn format_tooltip_uses_provided_values() {
        let result = format_tooltip("TestApp", "2.3.4");
        assert_eq!(result, "TestApp v2.3.4");
    }

    #[test]
    fn app_name_constant_is_norbert() {
        assert_eq!(APP_NAME, "Norbert");
    }

    #[test]
    fn version_constant_matches_cargo_version() {
        // VERSION is pulled from Cargo.toml via env!("CARGO_PKG_VERSION")
        assert_eq!(VERSION, "0.1.0");
    }

    #[test]
    fn tooltip_for_current_app_matches_expected() {
        let tooltip = format_tooltip(APP_NAME, VERSION);
        assert_eq!(tooltip, "Norbert v0.1.0");
    }
}
