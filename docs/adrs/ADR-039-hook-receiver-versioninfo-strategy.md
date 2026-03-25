# ADR-039: VERSIONINFO Embedding Strategy for Hook Receiver Binary

## Status
Accepted

## Context

`norbert-hook-receiver.exe` currently shows "Norbert" in Windows Task Manager's Description column — identical to `norbert.exe`. The two binaries are indistinguishable without inspecting the Command Line column.

The Cargo package produces two binaries from one `build.rs`. The existing `build.rs` calls `tauri_build::build()`, which embeds VERSIONINFO for the default binary (`norbert`) only. There is no supported `tauri_build` API to set `FileDescription` per-binary.

`tauri-winres 0.3.5` is already in `Cargo.lock` as a transitive build dependency via `tauri-build`. It exposes `WindowsResource` for direct VERSIONINFO construction.

## Decision

Extend `build.rs` with a `CARGO_BIN_NAME` guard. When building the `norbert-hook-receiver` binary, emit a `tauri_winres::WindowsResource` block with:

- `FileDescription` = `"Norbert Hook Receiver"`
- `ProductName` = `"Norbert"`
- `FileVersion` / `ProductVersion` derived from `CARGO_PKG_VERSION`

When building the `norbert` binary (or any other), `tauri_build::build()` runs as today — no change.

## Alternatives Considered

### Alternative 1: Separate `build.rs` per binary via a second Cargo package
- Split hook receiver into its own `[[package]]` with its own `build.rs`
- Would give full per-binary `build.rs` control with no `CARGO_BIN_NAME` guard
- Rejected: requires Cargo workspace restructuring (new `Cargo.toml`, moving `hook_receiver.rs` to a new crate, updating all import paths in `norbert_lib`). Scope is disproportionate to the problem. The `CARGO_BIN_NAME` guard in the existing `build.rs` is simpler and equally correct.

### Alternative 2: Manually author a `.rc` file committed to VCS
- Hand-write `hook-receiver.rc` and link it via `println!("cargo:rustc-link-arg-bins=...")`
- Gives full Windows VERSIONINFO control without any Rust crate
- Rejected: `tauri-winres` is already in the dep graph; duplicating VERSIONINFO authoring in raw `.rc` format introduces a second maintenance surface. Version string would need manual sync with `Cargo.toml`. The `WindowsResource` API handles version sync automatically.

### Alternative 3: Leave VERSIONINFO unset; use executable filename for identity
- `norbert-hook-receiver.exe` filename already differs from `norbert.exe`
- Rejected: Windows Task Manager's Name column shows the filename by default, but the **Description column** — which is the standard process identity signal — reads `FileDescription` from VERSIONINFO. Many power users sort/filter by Description. Without VERSIONINFO, Description is blank or falls back to filename with no guarantee of display.

## Consequences

**Positive**:
- Zero new Cargo dependencies (tauri-winres already present)
- Task Manager Description column correctly distinguishes the two binaries
- File Properties > Details "File description" field is self-documenting on disk
- Version string stays in sync with `CARGO_PKG_VERSION` automatically
- No runtime changes — compile-time only

**Negative**:
- `build.rs` now contains branching logic; requires care when adding future binaries to the package
- Windows-only: has no effect on Linux/macOS builds (acceptable — Windows-first requirement)
