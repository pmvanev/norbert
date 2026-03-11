# Quality Validation: Hook Receiver Independent Lifecycle

## Quality Gates Checklist

- [x] Requirements traced to components
  - US-HRIL-01 -> postinstall-core.js, postinstall.js, install.ps1, install.sh
  - US-HRIL-02 -> Validated by existing hook_receiver.rs (no changes needed)
  - US-HRIL-03 -> lib.rs, Cargo.toml, tauri.conf.json, capabilities/default.json
- [x] Component boundaries with clear responsibilities
  - Install scripts: registration + immediate start
  - GUI: pure viewer (sidecar spawn removed)
  - Hook receiver: unchanged (singleton via port binding)
- [x] Technology choices in ADRs with alternatives
  - ADR-008: Task Scheduler (3 alternatives evaluated)
  - ADR-009: Shell plugin removal (2 alternatives evaluated)
- [x] Quality attributes addressed
  - Reliability: independent lifecycle, singleton guarantee, immediate start
  - Installability: automatic registration, non-fatal failure path
  - Operational simplicity: zero configuration
  - Maintainability: dependency removal, single source of truth for task name
- [x] Dependency-inversion compliance
  - No new ports/adapters needed -- change is at infrastructure/install layer
  - Existing domain/ports/adapters boundaries unchanged
- [x] C4 diagrams (L1 System Context + L2 Container in Mermaid)
- [x] Integration patterns specified (shared artifacts table, data flow diagram)
- [x] OSS preference validated
  - No new dependencies introduced
  - One dependency removed (tauri-plugin-shell)
  - All tools used are OS-native (PowerShell, Task Scheduler)
- [x] Roadmap step count efficient
  - 4 steps / 6 production files = 0.67 ratio (well under 2.5 threshold)
- [x] AC behavioral, not implementation-coupled
  - All AC describe observable outcomes
- [x] Peer review: pending (Phase 6)

## Simplest Solution Gate

### Rejected Simple Alternatives

#### Alternative 1: Only remove sidecar spawn, no startup registration
- **What**: Remove `spawn_hook_receiver_sidecar()` and document manual receiver start
- **Expected Impact**: 30% of problem solved (sidecar conflict eliminated, but data loss on GUI close remains unless user manually starts receiver)
- **Why Insufficient**: Primary job story (JS-1) requires always-on data collection. Manual start contradicts the "zero configuration" installability requirement.

#### Alternative 2: Keep sidecar spawn as fallback, add Task Scheduler as supplement
- **What**: Register Task Scheduler but also keep sidecar spawn in GUI as fallback
- **Expected Impact**: 90% of problem solved (receiver usually started at boot, GUI spawn covers edge case)
- **Why Insufficient**: Creates complexity -- two mechanisms starting the receiver means duplicate-instance scenarios, confusing diagnostics, and the sidecar conflict issue (US-HRIL-02) persists for multi-GUI-instance cases. The singleton port binding handles the safety, but the UX of "second GUI crashes on start" remains.

### Why Current Solution is Necessary
1. Simple alternatives fail because they either don't solve the data loss problem (Alt 1) or introduce dual-mechanism complexity (Alt 2)
2. The proposed approach is already minimal: 4 steps, 6 production files, one dependency removal, one constant addition, and reuse of existing PowerShell patterns
