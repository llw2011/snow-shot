//! Process-level recovery for a host UI thread that can no longer service the
//! Tauri/Tao event queue.
//!
//! Reloading a WebView is not sufficient when the host event loop is stalled:
//! the reload, destroy and tray APIs all enqueue work on that same loop.  A
//! recovery child therefore waits for the old process to exit before it
//! initializes Tauri.  This ordering is important on Windows because the
//! single-instance plugin uses a synchronous `SendMessageW` handshake.

use std::{
    ffi::OsString,
    sync::OnceLock,
    time::{Duration, Instant},
};

#[cfg(any(target_os = "windows", test))]
use std::ffi::OsStr;

#[cfg(target_os = "windows")]
use std::process::Command;

pub const RECOVERY_PARENT_PID_ARG: &str = "--snow-shot-recovery-parent-pid";
pub const RECOVERY_ATTEMPT_ARG: &str = "--snow-shot-recovery-attempt";
const RECOVERY_RESTART_GUARD: Duration = Duration::from_secs(5 * 60);

static RECOVERY_ATTEMPT_STARTED: OnceLock<Instant> = OnceLock::new();

/// Returns whether this process was launched as the one allowed recovery
/// attempt.  A failed recovery child exits instead of spawning another child,
/// which prevents an install or WebView failure from becoming a restart loop.
pub fn is_recovery_attempt() -> bool {
    std::env::args_os().any(|argument| {
        argument
            .to_str()
            .is_some_and(|argument| argument == RECOVERY_ATTEMPT_ARG)
    })
}

/// Waits for the process named by the internal recovery argument before
/// creating the Tauri application.  This function is intentionally a single
/// OS wait, not a polling loop.
pub fn wait_for_recovery_parent() {
    if is_recovery_attempt() {
        let _ = RECOVERY_ATTEMPT_STARTED.set(Instant::now());
    }

    let Some(parent_pid) = recovery_parent_pid(std::env::args_os()) else {
        return;
    };

    if parent_pid == std::process::id() {
        return;
    }

    #[cfg(target_os = "windows")]
    {
        if let Err(error) = wait_for_windows_process(parent_pid) {
            // The parent may already have exited, in which case OpenProcess can
            // legitimately fail with ERROR_INVALID_PARAMETER.  Proceeding is
            // safer than leaving the recovery child permanently unavailable.
            eprintln!("[snow-shot-recovery] parent wait skipped: {error}");
        }
    }
}

/// Starts a recovery child and terminates this process.  The function never
/// returns so callers cannot continue using a known-bad Tauri runtime.
pub fn restart_after_terminal_failure(reason: &'static str) -> ! {
    #[cfg(not(target_os = "windows"))]
    {
        log::error!(
            target: "snow-shot-recovery",
            "[process_recovery] terminal runtime failure ({reason}); exiting without cross-process restart"
        );
        std::process::exit(1);
    }

    #[cfg(target_os = "windows")]
    {
        if recovery_restart_guard_active() {
            log::error!(
                target: "snow-shot-recovery",
                "[process_recovery] recovery child reached terminal failure ({reason}); exiting without another restart"
            );
            std::process::exit(1);
        }

        match spawn_recovery_child() {
            Ok(()) => {
                log::warn!(
                    target: "snow-shot-recovery",
                    "[process_recovery] restarting after terminal runtime failure ({reason})"
                );
                std::process::exit(0);
            }
            Err(error) => {
                log::error!(
                    target: "snow-shot-recovery",
                    "[process_recovery] failed to start recovery child ({reason}): {error}"
                );
                std::process::exit(1);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn recovery_restart_guard_active() -> bool {
    if !is_recovery_attempt() {
        return false;
    }
    RECOVERY_ATTEMPT_STARTED
        .get()
        .is_none_or(|started| started.elapsed() < RECOVERY_RESTART_GUARD)
}

#[cfg(target_os = "windows")]
fn spawn_recovery_child() -> Result<(), String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("failed to resolve current executable: {error}"))?;
    let parent_pid_argument = format!("{RECOVERY_PARENT_PID_ARG}={}", std::process::id());

    let arguments = std::env::args_os()
        .skip(1)
        .filter(|argument| !is_restart_argument(argument))
        .collect::<Vec<_>>();

    Command::new(executable)
        .args(arguments)
        .arg(parent_pid_argument)
        .arg(RECOVERY_ATTEMPT_ARG)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("spawn failed: {error}"))
}

#[cfg(any(target_os = "windows", test))]
fn is_restart_argument(argument: &OsStr) -> bool {
    argument.to_str().is_some_and(|argument| {
        argument == "--auto_start"
            || argument == RECOVERY_ATTEMPT_ARG
            || argument.starts_with(&format!("{RECOVERY_PARENT_PID_ARG}="))
    })
}

fn recovery_parent_pid<I>(arguments: I) -> Option<u32>
where
    I: IntoIterator<Item = OsString>,
{
    arguments.into_iter().find_map(|argument| {
        argument
            .to_str()
            .and_then(|argument| argument.strip_prefix(&format!("{RECOVERY_PARENT_PID_ARG}=")))
            .and_then(|pid| pid.parse::<u32>().ok())
            .filter(|pid| *pid != 0)
    })
}

#[cfg(target_os = "windows")]
fn wait_for_windows_process(parent_pid: u32) -> Result<(), String> {
    use windows::{
        Win32::{
            Foundation::{WAIT_FAILED, WAIT_OBJECT_0},
            System::Threading::{INFINITE, OpenProcess, PROCESS_SYNCHRONIZE, WaitForSingleObject},
        },
        core::Owned,
    };

    let process = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, parent_pid) }
        .map_err(|error| format!("OpenProcess({parent_pid}) failed: {error}"))?;
    // `OpenProcess` transfers ownership of the returned handle to this
    // function. `Owned` closes it after the wait.
    let process = unsafe { Owned::new(process) };
    let result = unsafe { WaitForSingleObject(*process, INFINITE) };
    if result == WAIT_OBJECT_0 {
        return Ok(());
    }
    if result == WAIT_FAILED {
        let error = windows::core::Error::from_win32();
        return Err(format!("WaitForSingleObject failed: {error}"));
    }

    Err(format!(
        "WaitForSingleObject returned unexpected status: {result:?}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_parent_pid_is_parsed_only_from_internal_argument() {
        let arguments = [
            OsString::from("snowshot.exe"),
            OsString::from("--other=value"),
            OsString::from("--snow-shot-recovery-parent-pid=3492"),
        ];
        assert_eq!(recovery_parent_pid(arguments), Some(3492));
    }

    #[test]
    fn malformed_or_zero_parent_pid_is_ignored() {
        let malformed = [OsString::from("--snow-shot-recovery-parent-pid=not-a-pid")];
        assert_eq!(recovery_parent_pid(malformed), None);

        let zero = [OsString::from("--snow-shot-recovery-parent-pid=0")];
        assert_eq!(recovery_parent_pid(zero), None);
    }

    #[test]
    fn restart_arguments_drop_startup_delay_and_stale_recovery_values() {
        assert!(is_restart_argument(OsStr::new("--auto_start")));
        assert!(is_restart_argument(OsStr::new(RECOVERY_ATTEMPT_ARG)));
        assert!(is_restart_argument(OsStr::new(
            "--snow-shot-recovery-parent-pid=3492"
        )));
        assert!(!is_restart_argument(OsStr::new("--some-user-flag")));
    }
}
