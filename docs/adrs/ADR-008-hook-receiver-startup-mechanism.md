# ADR-008: Hook Receiver Startup Mechanism

## Status

Accepted

## Context

The hook receiver must start independently of the GUI so that Claude Code hook events are captured even when the GUI is not running. On Windows 11, multiple OS-level mechanisms exist for launching processes at user logon. The mechanism must be idempotent, non-elevated (no admin privileges), and manageable from the JavaScript/PowerShell install scripts.

**Quality attribute priorities**: Reliability (no data loss) > Installability (zero manual config) > Operational simplicity.

**Constraint**: Windows 11 only for now. Design should not prevent future macOS/Linux support.

## Decision

Use Windows Task Scheduler with a user logon trigger. The install scripts register a scheduled task named `NorbertHookReceiver` targeting `norbert-hook-receiver.exe`. The task runs at current user logon with no elevation required. Additionally, the install scripts start the receiver immediately after registration (no reboot needed).

Task Scheduler registration uses PowerShell `Register-ScheduledTask` / `Set-ScheduledTask`, following the same pattern already used for Start Menu shortcut creation.

The task is configured with "Run only when user is logged on" logon type (no stored credentials). The task name `NorbertHookReceiver` is defined as a constant in `postinstall-core.js` for use across all install scripts.

## Alternatives Considered

### Windows Startup Folder shortcut

- **What**: Place a `.lnk` shortcut in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
- **Evaluation**: Simple, no PowerShell cmdlets needed. However: user can accidentally delete it, antivirus tools sometimes flag startup folder entries, and there is no built-in mechanism to check if the task is already registered (harder idempotency).
- **Rejection**: Less robust than Task Scheduler. No programmatic query capability for idempotency checks. Startup folder items are more visible to cleanup tools that may remove them.

### Windows Service (NSSM or native)

- **What**: Register `norbert-hook-receiver.exe` as a Windows service using NSSM or `sc.exe`.
- **Evaluation**: Services run before user logon, provide restart-on-crash, and are managed via `services.msc`. However: services run in session 0 (no user desktop access), require admin privileges to register, and NSSM is a third-party dependency.
- **Rejection**: Over-engineered for a user-level background process. Admin elevation contradicts the zero-friction install story. Session 0 isolation may cause issues with user-directory database path resolution.

### Registry Run key (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)

- **What**: Add a registry entry pointing to `norbert-hook-receiver.exe`.
- **Evaluation**: Simple, user-level, no admin required. However: harder to make idempotent (must check registry before writing), and some security tools flag registry run keys.
- **Rejection**: Task Scheduler provides richer semantics (trigger types, conditions, idempotent task update) and is the recommended modern approach for user-level scheduled processes on Windows.

## Consequences

**Positive**:
- User-level task, no elevation needed
- Idempotent via `Get-ScheduledTask` check before create/update
- Survives system restarts automatically
- Task Scheduler UI provides visibility (`taskschd.msc`)
- PowerShell management pattern already established in codebase

**Negative**:
- Requires PowerShell availability (present on all Windows 10+ systems)
- Task Scheduler registration can fail on heavily locked-down corporate machines (mitigated by non-fatal fallback)
- Task name becomes a cross-script shared artifact that must stay consistent
