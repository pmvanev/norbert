fn main() {
    // tauri-build does not watch icon files for changes, so declare them explicitly.
    // Without this, `cargo build --release` skips re-embedding the icon when icon.ico changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");

    // NOTE: VERSIONINFO for the norbert-hook-receiver sidecar is emitted by
    // its own build script in the `hook-receiver/` workspace member. A prior
    // incarnation of this file attempted to dispatch per-binary via
    // CARGO_BIN_NAME, but that env var is not set in build scripts, so the
    // code was dead. See ADR-039 for the full story.

    tauri_build::build()
}
