use std::ffi::c_void;

use tauri::{AppHandle, Manager, WebviewWindow};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    System::RemoteDesktop::{
        NOTIFY_FOR_THIS_SESSION, WTSRegisterSessionNotification, WTSUnRegisterSessionNotification,
    },
    UI::{
        Shell::{DefSubclassProc, SetWindowSubclass},
        WindowsAndMessaging::{
            PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMECRITICAL, PBT_APMRESUMESUSPEND, WM_DISPLAYCHANGE,
            WM_NCDESTROY, WM_POWERBROADCAST, WM_WTSSESSION_CHANGE, WTS_CONSOLE_CONNECT,
            WTS_REMOTE_CONNECT, WTS_SESSION_UNLOCK,
        },
    },
};

use crate::native_action::{self, RuntimeSessionEvent};

const SESSION_SUBCLASS_ID: usize = 0x534E_4F57;

struct SessionHookContext {
    app: AppHandle,
    session_notifications_registered: bool,
}

pub fn install(window: &WebviewWindow) {
    let hwnd = match window.hwnd() {
        Ok(hwnd) => hwnd.0 as isize,
        Err(error) => {
            log::warn!(target: "snow-shot-recovery", "[windows_session] failed to get main window handle: {error}");
            return;
        }
    };
    let app = window.app_handle().clone();
    let app_for_install = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        // The handle is converted through an integer because HWND itself is not Send.
        let hwnd = HWND(hwnd as *mut c_void);
        install_on_main_thread(hwnd, app_for_install);
    }) {
        log::warn!(target: "snow-shot-recovery", "[windows_session] failed to schedule Windows session hook: {error}");
    }
}

fn install_on_main_thread(hwnd: HWND, app: AppHandle) {
    let session_notifications_registered = match unsafe {
        WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION)
    } {
        Ok(()) => true,
        Err(error) => {
            log::warn!(target: "snow-shot-recovery",
                "[windows_session] WTS session notifications are unavailable; power/display recovery remains active: {error}"
            );
            false
        }
    };

    let context = Box::new(SessionHookContext {
        app,
        session_notifications_registered,
    });
    let context = Box::into_raw(context);
    let installed = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(session_subclass_proc),
            SESSION_SUBCLASS_ID,
            context as usize,
        )
    }
    .as_bool();
    if installed {
        log::info!(target: "snow-shot-recovery", "[windows_session] installed event-driven main window recovery hook");
        return;
    }

    let context = unsafe { Box::from_raw(context) };
    if context.session_notifications_registered
        && let Err(error) = unsafe { WTSUnRegisterSessionNotification(hwnd) }
    {
        log::warn!(target: "snow-shot-recovery", "[windows_session] failed to undo WTS notification registration: {error}");
    }
    log::warn!(target: "snow-shot-recovery", "[windows_session] failed to subclass the main window for recovery events");
}

unsafe extern "system" fn session_subclass_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _subclass_id: usize,
    reference_data: usize,
) -> LRESULT {
    if message == WM_NCDESTROY {
        let context = unsafe { Box::from_raw(reference_data as *mut SessionHookContext) };
        if context.session_notifications_registered
            && let Err(error) = unsafe { WTSUnRegisterSessionNotification(hwnd) }
        {
            log::warn!(target: "snow-shot-recovery", "[windows_session] failed to unregister WTS notifications: {error}");
        }
        return unsafe { DefSubclassProc(hwnd, message, wparam, lparam) };
    }

    if let Some(event) = runtime_event_from_message(message, wparam.0) {
        let context = unsafe { &*(reference_data as *const SessionHookContext) };
        native_action::handle_runtime_session_event(&context.app, event);
    }

    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn runtime_event_from_message(message: u32, event_code: usize) -> Option<RuntimeSessionEvent> {
    match (message, event_code as u32) {
        (WM_WTSSESSION_CHANGE, WTS_CONSOLE_CONNECT) => Some(RuntimeSessionEvent::ConsoleConnect),
        (WM_WTSSESSION_CHANGE, WTS_REMOTE_CONNECT) => Some(RuntimeSessionEvent::RemoteConnect),
        (WM_WTSSESSION_CHANGE, WTS_SESSION_UNLOCK) => Some(RuntimeSessionEvent::SessionUnlock),
        (
            WM_POWERBROADCAST,
            PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMECRITICAL | PBT_APMRESUMESUSPEND,
        ) => Some(RuntimeSessionEvent::PowerResume),
        (WM_DISPLAYCHANGE, _) => Some(RuntimeSessionEvent::DisplayChange),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_only_resume_reconnect_unlock_and_display_messages() {
        assert_eq!(
            runtime_event_from_message(WM_WTSSESSION_CHANGE, WTS_REMOTE_CONNECT as usize),
            Some(RuntimeSessionEvent::RemoteConnect)
        );
        assert_eq!(
            runtime_event_from_message(WM_WTSSESSION_CHANGE, WTS_CONSOLE_CONNECT as usize),
            Some(RuntimeSessionEvent::ConsoleConnect)
        );
        assert_eq!(
            runtime_event_from_message(WM_WTSSESSION_CHANGE, WTS_SESSION_UNLOCK as usize),
            Some(RuntimeSessionEvent::SessionUnlock)
        );
        assert_eq!(
            runtime_event_from_message(WM_POWERBROADCAST, PBT_APMRESUMEAUTOMATIC as usize),
            Some(RuntimeSessionEvent::PowerResume)
        );
        assert_eq!(
            runtime_event_from_message(WM_DISPLAYCHANGE, 32),
            Some(RuntimeSessionEvent::DisplayChange)
        );
        assert_eq!(runtime_event_from_message(WM_WTSSESSION_CHANGE, 7), None);
        assert_eq!(runtime_event_from_message(WM_POWERBROADCAST, 4), None);
    }
}
