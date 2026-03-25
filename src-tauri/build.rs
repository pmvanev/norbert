/// VERSIONINFO metadata for a binary target.
///
/// Pure value type: no IO, no side effects. Tested independently of the build script.
struct VersionInfoMetadata {
    file_description: &'static str,
    product_name: &'static str,
}

/// Determine VERSIONINFO metadata for a given binary name.
///
/// Returns `Some(metadata)` when the binary should receive a custom VERSIONINFO
/// resource emitted via `tauri-winres`. Returns `None` when the binary's
/// VERSIONINFO is handled elsewhere (e.g. by `tauri_build::build()`).
fn versioninfo_for_binary(bin_name: &str) -> Option<VersionInfoMetadata> {
    match bin_name {
        "norbert-hook-receiver" => Some(VersionInfoMetadata {
            file_description: "Norbert Hook Receiver",
            product_name: "Norbert",
        }),
        _ => None,
    }
}

fn main() {
    // tauri-build does not watch icon files for changes, so declare them explicitly.
    // Without this, `cargo build --release` skips re-embedding the icon when icon.ico changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");

    // Emit per-binary VERSIONINFO when building the hook receiver.
    // The guard ensures tauri_build::build() remains the sole resource
    // emitter for the main norbert binary (and any future binaries that
    // don't need custom metadata).
    if let Ok(bin_name) = std::env::var("CARGO_BIN_NAME") {
        if let Some(metadata) = versioninfo_for_binary(&bin_name) {
            let mut res = tauri_winres::WindowsResource::new();
            res.set("FileDescription", metadata.file_description);
            res.set("ProductName", metadata.product_name);
            res.set(
                "FileVersion",
                &format!(
                    "{}.{}.{}.0",
                    env!("CARGO_PKG_VERSION_MAJOR"),
                    env!("CARGO_PKG_VERSION_MINOR"),
                    env!("CARGO_PKG_VERSION_PATCH"),
                ),
            );
            res.set(
                "ProductVersion",
                &format!(
                    "{}.{}.{}.0",
                    env!("CARGO_PKG_VERSION_MAJOR"),
                    env!("CARGO_PKG_VERSION_MINOR"),
                    env!("CARGO_PKG_VERSION_PATCH"),
                ),
            );
            res.compile().expect("failed to compile VERSIONINFO resource for hook receiver");
        }
    }

    tauri_build::build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hook_receiver_gets_custom_file_description() {
        let metadata = versioninfo_for_binary("norbert-hook-receiver");
        assert!(metadata.is_some(), "norbert-hook-receiver must receive custom VERSIONINFO");
        let metadata = metadata.unwrap();
        assert_eq!(metadata.file_description, "Norbert Hook Receiver");
    }

    #[test]
    fn hook_receiver_product_name_is_norbert() {
        let metadata = versioninfo_for_binary("norbert-hook-receiver")
            .expect("norbert-hook-receiver must have metadata");
        assert_eq!(metadata.product_name, "Norbert");
    }

    #[test]
    fn norbert_binary_defers_to_tauri_build() {
        let metadata = versioninfo_for_binary("norbert");
        assert!(
            metadata.is_none(),
            "norbert binary must NOT receive custom VERSIONINFO -- tauri_build handles it"
        );
    }

    #[test]
    fn unknown_binary_defers_to_tauri_build() {
        let metadata = versioninfo_for_binary("some-other-binary");
        assert!(
            metadata.is_none(),
            "Unknown binaries must NOT receive custom VERSIONINFO"
        );
    }
}
