# ADR-008: Hook Receiver Startup Mechanism

## Status

Superseded (updated 2026-03-12: switched from Task Scheduler to Startup folder shortcut)

## Context

The hook receiver must start independently of the GUI so that Claude Code hook events are captured even when the GUI is not running. On Windows 11, multiple OS-level mechanisms exist for launching processes at user logon. The mechanism must be idempotent, non-elevated (no admin privileges), and manageable from the JavaScript/PowerShell install scripts.

**Quality attribute priorities**: Reliability (no data loss) > Installability (zero manual config) > Operational simplicity.

**Constraint**: Windows 11 only for now. Design should not prevent future macOS/Linux support.

## Decision

~~Use Windows Task Scheduler with a user logon trigger.~~ **Updated**: Use a Windows Startup folder shortcut. The install scripts create `NorbertHookReceiver.lnk` in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`, targeting `norbert-hook-receiver.exe` with `WindowStyle = 7` (minimized/hidden). Additionally, the install scripts start the receiver immediately after shortcut creation (no reboot needed).

### Why the change

Task Scheduler's `Register-ScheduledTask` requires admin elevation in practice, which silently failed during install — the task was never registered and the receiver would not auto-start after reboot. The Startup folder approach requires no special privileges and achieves the same auto-start-at-logon behavior.

## Alternatives Considered

### Windows Task Scheduler (originally chosen, then rejected)

- **What**: Register a scheduled task named `NorbertHookReceiver` via `Register-ScheduledTask` with an `-AtLogOn` trigger.
- **Evaluation**: Rich API, idempotent via `-Force`, programmatic query via `Get-ScheduledTask`. However: requires admin elevation to register tasks, which silently fails during non-elevated installs.
- **Rejection**: Admin elevation requirement contradicts zero-friction install story. Silent failure means users don't know the task wasn't registered.

### Windows Service (NSSM or native)

- **What**: Register `norbert-hook-receiver.exe` as a Windows service using NSSM or `sc.exe`.
- **Evaluation**: Services run before user logon, provide restart-on-crash, and are managed via `services.msc`. However: services run in session 0 (no user desktop access), require admin privileges to register, and NSSM is a third-party dependency.
- **Rejection**: Over-engineered for a user-level background process. Admin elevation contradicts the zero-friction install story. Session 0 isolation may cause issues with user-directory database path resolution.

### Registry Run key (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)

- **What**: Add a registry entry pointing to `norbert-hook-receiver.exe`.
- **Evaluation**: Simple, user-level, no admin required. However: harder to make idempotent (must check registry before writing), and some security tools flag registry run keys.
- **Rejection**: Startup folder is simpler, more transparent to users, and equally effective.

## Consequences

**Positive**:
- No admin elevation needed — works in all install contexts
- Idempotent (shortcut overwrite is safe)
- Survives system restarts automatically
- Transparent to users (visible in `shell:startup` folder)
- Simple PowerShell WScript.Shell pattern for shortcut creation

**Negative**:
- User can accidentally delete the shortcut (mitigated: re-running install recreates it)
- Some cleanup tools may remove startup folder entries
- No programmatic query to check if shortcut exists (mitigated: overwrite is idempotent)
