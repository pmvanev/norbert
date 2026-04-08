/// Build script for the norbert-hook-receiver sidecar.
///
/// Emits a Windows VERSIONINFO resource so Task Manager and Explorer show
/// the process with a distinct, human-readable identity:
///   FileDescription = "Norbert Hook Receiver"
///   ProductName     = "Norbert"
///
/// Living in its own workspace member (as opposed to a sibling `[[bin]]`
/// of the main `norbert` crate) is what makes this work -- `tauri_winres`
/// links its compiled resource into every binary in the crate it runs for,
/// so the sidecar must be its own crate to avoid clobbering the main GUI's
/// tauri-build-emitted VERSIONINFO. See ADR-039.
fn main() {
    #[cfg(target_os = "windows")]
    {
        let version = format!(
            "{}.{}.{}.0",
            env!("CARGO_PKG_VERSION_MAJOR"),
            env!("CARGO_PKG_VERSION_MINOR"),
            env!("CARGO_PKG_VERSION_PATCH"),
        );
        // Embed a Windows application manifest that declares a dependency on
        // Common Controls v6. Without this, the loader resolves comctl32.dll v5
        // and TaskDialogIndirect (used transitively by tray-icon / muda menu
        // machinery) is missing, producing a fatal "Entry Point Not Found"
        // dialog at process start. The main norbert.exe gets an equivalent
        // manifest from tauri_build::build(); this subcrate has to emit its
        // own because it does not depend on tauri-build.
        const COMMON_CONTROLS_V6_MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#;

        let mut res = tauri_winres::WindowsResource::new();
        res.set("FileDescription", "Norbert Hook Receiver");
        res.set("ProductName", "Norbert");
        res.set("FileVersion", &version);
        res.set("ProductVersion", &version);
        res.set_manifest(COMMON_CONTROLS_V6_MANIFEST);
        res.compile()
            .expect("failed to compile VERSIONINFO resource for norbert-hook-receiver");
    }
}
