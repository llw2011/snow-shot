use std::{
    collections::HashMap,
    sync::{
        Mutex as StdMutex, RwLock,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

use serde::Serialize;
use snow_shot_app_services::{
    listen_key_service::ListenKeyService, listen_mouse_service::ListenMouseService,
};
use tauri::{
    AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder,
    menu::MenuEvent,
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};
use tokio::sync::{Mutex as AsyncMutex, oneshot};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ICON_ID: &str = "main-trayIcon";
const DRAW_WINDOW_LABEL_PREFIX: &str = "draw-";

const ACTION_SCREENSHOT: &str = "screenshot";
const ACTION_SCREENSHOT_FIXED: &str = "screenshotFixed";
const ACTION_SCREENSHOT_OCR: &str = "screenshotOcr";
const ACTION_SCREENSHOT_DELAY: &str = "screenshotDelay";
const ACTION_SCREENSHOT_FOCUSED_WINDOW: &str = "screenshotFocusedWindow";
const ACTION_SCREENSHOT_FULL_SCREEN: &str = "screenshotFullScreen";
const ACTION_SCREENSHOT_COPY: &str = "screenshotCopy";
const ACTION_SCREENSHOT_OCR_TRANSLATE: &str = "screenshotOcrTranslate";
const ACTION_CHAT: &str = "chat";
const ACTION_CHAT_SELECT_TEXT: &str = "chatSelectText";
const ACTION_TRANSLATION: &str = "translation";
const ACTION_TRANSLATION_SELECT_TEXT: &str = "translationSelectText";
const ACTION_FIXED_CONTENT: &str = "fixedContent";
const ACTION_VIDEO_RECORD: &str = "videoRecord";
const ACTION_VIDEO_RECORD_COPY: &str = "videoRecordCopy";
const ACTION_TOP_WINDOW: &str = "topWindow";
const ACTION_FULL_SCREEN_DRAW: &str = "fullScreenDraw";
const ACTION_SHOW_OR_HIDE_MAIN_WINDOW: &str = "showOrHideMainWindow";
const ACTION_OPEN_IMAGE_SAVE_FOLDER: &str = "openImageSaveFolder";
const ACTION_OPEN_CAPTURE_HISTORY: &str = "openCaptureHistory";

const ACTION_SHOW_MAIN_WINDOW: &str = "showMainWindow";
const ACTION_EXIT: &str = "exit";

const TRAY_CLICK_SCREENSHOT: &str = "screenshot";
const TRAY_CLICK_SHOW_MAIN_WINDOW: &str = "showMainWindow";

const HEARTBEAT_FRESH_FOR: Duration = Duration::from_secs(20);
const WAKE_GRACE_PERIOD: Duration = Duration::from_millis(900);
const ACTION_ACK_TIMEOUT: Duration = Duration::from_millis(1500);
const RELOAD_MAIN_READY_TIMEOUT: Duration = Duration::from_secs(8);
const RELOAD_DRAW_READY_TIMEOUT: Duration = Duration::from_secs(15);
const REBUILD_MAIN_READY_TIMEOUT: Duration = Duration::from_secs(12);
const REBUILD_DRAW_READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RuntimeRequirement {
    Main,
    Draw,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeActionRequest {
    request_id: u64,
    document_id: String,
    action: String,
    source: String,
}

pub struct NativeActionState {
    shortcut_actions: RwLock<HashMap<u32, String>>,
    shortcuts_disabled: AtomicBool,
    shortcut_input_active: AtomicBool,
    disable_on_focused_full_screen: AtomicBool,
    tray_click_action: RwLock<String>,
    main_runtime: RwLock<Option<MainRuntimeStatus>>,
    draw_runtimes: RwLock<HashMap<String, DrawRuntimeStatus>>,
    pending_acks: StdMutex<HashMap<u64, PendingActionAck>>,
    next_request_id: AtomicU64,
    next_draw_generation: AtomicU64,
    main_rebuild_active: AtomicBool,
    action_dispatch_lock: AsyncMutex<()>,
    main_recovery_lock: AsyncMutex<()>,
}

struct MainRuntimeStatus {
    document_id: String,
    last_seen: Instant,
    ready: bool,
    draw_runtime: Option<DrawRuntimeIdentity>,
}

#[derive(Clone)]
struct DrawRuntimeIdentity {
    window_label: String,
    document_id: String,
    generation: u64,
}

struct DrawRuntimeStatus {
    document_id: String,
    generation: u64,
    ready: bool,
}

struct PendingActionAck {
    document_id: String,
    sender: oneshot::Sender<()>,
}

struct MainRebuildFlagGuard<'a> {
    state: &'a NativeActionState,
    active: bool,
}

impl<'a> MainRebuildFlagGuard<'a> {
    fn new(state: &'a NativeActionState) -> Self {
        state.set_main_rebuild_active(true);
        Self {
            state,
            active: true,
        }
    }

    fn finish(mut self) {
        self.state.set_main_rebuild_active(false);
        self.active = false;
    }
}

impl Drop for MainRebuildFlagGuard<'_> {
    fn drop(&mut self) {
        if self.active {
            self.state.set_main_rebuild_active(false);
        }
    }
}

impl Default for NativeActionState {
    fn default() -> Self {
        Self {
            shortcut_actions: RwLock::new(HashMap::new()),
            shortcuts_disabled: AtomicBool::new(false),
            shortcut_input_active: AtomicBool::new(false),
            disable_on_focused_full_screen: AtomicBool::new(false),
            tray_click_action: RwLock::new(TRAY_CLICK_SCREENSHOT.to_owned()),
            main_runtime: RwLock::new(None),
            draw_runtimes: RwLock::new(HashMap::new()),
            pending_acks: StdMutex::new(HashMap::new()),
            next_request_id: AtomicU64::new(1),
            next_draw_generation: AtomicU64::new(1),
            main_rebuild_active: AtomicBool::new(false),
            action_dispatch_lock: AsyncMutex::new(()),
            main_recovery_lock: AsyncMutex::new(()),
        }
    }
}

impl NativeActionState {
    fn shortcut_action(&self, shortcut: &Shortcut) -> Option<String> {
        self.shortcut_actions
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .get(&shortcut.id())
            .cloned()
    }

    fn tray_click_action(&self) -> String {
        self.tray_click_action
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    fn start_main_runtime(&self, document_id: String) {
        self.shortcut_input_active.store(false, Ordering::Relaxed);
        *self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner()) = Some(MainRuntimeStatus {
            document_id,
            last_seen: Instant::now(),
            ready: false,
            draw_runtime: None,
        });
        self.clear_pending_acks();
    }

    fn start_draw_runtime(&self, window_label: String, document_id: String) {
        let generation = self.next_draw_generation.fetch_add(1, Ordering::Relaxed);
        self.draw_runtimes
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                window_label,
                DrawRuntimeStatus {
                    document_id,
                    generation,
                    ready: false,
                },
            );
    }

    fn mark_main_runtime_alive(&self, document_id: &str) {
        let mut runtime = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(runtime) = runtime.as_mut()
            && runtime.document_id == document_id
        {
            runtime.last_seen = Instant::now();
        }
    }

    fn mark_main_runtime_ready(&self, document_id: &str) -> bool {
        let mut runtime = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner());
        let Some(runtime) = runtime.as_mut() else {
            return false;
        };
        if runtime.document_id != document_id {
            return false;
        }

        runtime.last_seen = Instant::now();
        runtime.ready = true;
        true
    }

    fn mark_draw_runtime_ready(&self, window_label: &str, document_id: &str) -> bool {
        let identity = {
            let mut runtimes = self
                .draw_runtimes
                .write()
                .unwrap_or_else(|error| error.into_inner());
            let Some(runtime) = runtimes.get_mut(window_label) else {
                return false;
            };
            if runtime.document_id != document_id {
                return false;
            }
            runtime.ready = true;
            DrawRuntimeIdentity {
                window_label: window_label.to_owned(),
                document_id: document_id.to_owned(),
                generation: runtime.generation,
            }
        };

        let mut main_runtime = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(main_runtime) = main_runtime.as_mut()
            && main_runtime
                .draw_runtime
                .as_ref()
                .is_some_and(|current| identity.generation > current.generation)
        {
            main_runtime.draw_runtime = Some(identity);
        }
        true
    }

    fn bind_draw_runtime(&self, main_document_id: &str, draw_window_label: &str) -> bool {
        let identity = {
            let runtimes = self
                .draw_runtimes
                .read()
                .unwrap_or_else(|error| error.into_inner());
            let Some(runtime) = runtimes.get(draw_window_label) else {
                return false;
            };
            if !runtime.ready {
                return false;
            }
            DrawRuntimeIdentity {
                window_label: draw_window_label.to_owned(),
                document_id: runtime.document_id.clone(),
                generation: runtime.generation,
            }
        };

        let mut runtime = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner());
        let Some(runtime) = runtime.as_mut() else {
            return false;
        };
        if runtime.document_id != main_document_id {
            return false;
        }
        runtime.draw_runtime = Some(identity);
        true
    }

    fn remove_window_runtime(&self, window_label: &str) {
        if window_label == MAIN_WINDOW_LABEL {
            self.clear_main_runtime();
        } else {
            self.draw_runtimes
                .write()
                .unwrap_or_else(|error| error.into_inner())
                .remove(window_label);
        }
    }

    pub fn main_rebuild_active(&self) -> bool {
        self.main_rebuild_active.load(Ordering::Acquire)
    }

    fn set_main_rebuild_active(&self, active: bool) {
        self.main_rebuild_active.store(active, Ordering::Release);
    }

    fn clear_main_runtime(&self) {
        *self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner()) = None;
        self.clear_pending_acks();
    }

    fn clear_pending_acks(&self) {
        self.pending_acks
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
    }

    fn ready_main_runtime_id(&self, requirement: RuntimeRequirement) -> Option<String> {
        let (document_id, draw_runtime) = {
            let runtime = self
                .main_runtime
                .read()
                .unwrap_or_else(|error| error.into_inner());
            let runtime = runtime.as_ref().filter(|runtime| {
                runtime.ready && runtime.last_seen.elapsed() <= HEARTBEAT_FRESH_FOR
            })?;
            (runtime.document_id.clone(), runtime.draw_runtime.clone())
        };

        if requirement == RuntimeRequirement::Draw {
            let draw_runtime = draw_runtime?;
            let draw_runtimes = self
                .draw_runtimes
                .read()
                .unwrap_or_else(|error| error.into_inner());
            let current = draw_runtimes.get(&draw_runtime.window_label)?;
            if !current.ready
                || current.document_id != draw_runtime.document_id
                || current.generation != draw_runtime.generation
            {
                return None;
            }
        }

        Some(document_id)
    }

    fn next_request_id(&self) -> u64 {
        self.next_request_id.fetch_add(1, Ordering::Relaxed)
    }

    fn insert_pending_ack(
        &self,
        request_id: u64,
        document_id: &str,
        sender: oneshot::Sender<()>,
    ) -> bool {
        let runtime = self
            .main_runtime
            .read()
            .unwrap_or_else(|error| error.into_inner());
        if !runtime
            .as_ref()
            .is_some_and(|runtime| runtime.ready && runtime.document_id == document_id)
        {
            return false;
        }

        self.pending_acks
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                request_id,
                PendingActionAck {
                    document_id: document_id.to_owned(),
                    sender,
                },
            );
        true
    }

    fn acknowledge_action(&self, request_id: u64, document_id: &str) -> bool {
        let runtime = self
            .main_runtime
            .read()
            .unwrap_or_else(|error| error.into_inner());
        if !runtime
            .as_ref()
            .is_some_and(|runtime| runtime.document_id == document_id)
        {
            return false;
        }

        let mut pending_acks = self
            .pending_acks
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !pending_acks
            .get(&request_id)
            .is_some_and(|pending| pending.document_id == document_id)
        {
            return false;
        }
        pending_acks
            .remove(&request_id)
            .is_some_and(|pending| pending.sender.send(()).is_ok())
    }

    fn shortcuts_blocked(&self) -> bool {
        self.shortcuts_disabled.load(Ordering::Relaxed)
            || self.shortcut_input_active.load(Ordering::Relaxed)
    }
}

fn is_supported_app_action(action: &str) -> bool {
    matches!(
        action,
        ACTION_SCREENSHOT
            | ACTION_SCREENSHOT_FIXED
            | ACTION_SCREENSHOT_OCR
            | ACTION_SCREENSHOT_DELAY
            | ACTION_SCREENSHOT_FOCUSED_WINDOW
            | ACTION_SCREENSHOT_FULL_SCREEN
            | ACTION_SCREENSHOT_COPY
            | ACTION_SCREENSHOT_OCR_TRANSLATE
            | ACTION_CHAT
            | ACTION_CHAT_SELECT_TEXT
            | ACTION_TRANSLATION
            | ACTION_TRANSLATION_SELECT_TEXT
            | ACTION_FIXED_CONTENT
            | ACTION_VIDEO_RECORD
            | ACTION_VIDEO_RECORD_COPY
            | ACTION_TOP_WINDOW
            | ACTION_FULL_SCREEN_DRAW
            | ACTION_SHOW_OR_HIDE_MAIN_WINDOW
            | ACTION_OPEN_IMAGE_SAVE_FOLDER
            | ACTION_OPEN_CAPTURE_HISTORY
    )
}

fn action_opens_main_window(action: &str) -> bool {
    matches!(
        action,
        ACTION_CHAT | ACTION_TRANSLATION | ACTION_OPEN_CAPTURE_HISTORY
    )
}

fn action_runtime_requirement(action: &str) -> RuntimeRequirement {
    if matches!(
        action,
        ACTION_SCREENSHOT
            | ACTION_SCREENSHOT_FIXED
            | ACTION_SCREENSHOT_OCR
            | ACTION_SCREENSHOT_DELAY
            | ACTION_SCREENSHOT_FULL_SCREEN
            | ACTION_SCREENSHOT_COPY
            | ACTION_SCREENSHOT_OCR_TRANSLATE
            | ACTION_VIDEO_RECORD
            | ACTION_TOP_WINDOW
    ) {
        RuntimeRequirement::Draw
    } else {
        RuntimeRequirement::Main
    }
}

fn runtime_ready_timeout(requirement: RuntimeRequirement, rebuild: bool) -> Duration {
    match (requirement, rebuild) {
        (RuntimeRequirement::Main, false) => RELOAD_MAIN_READY_TIMEOUT,
        (RuntimeRequirement::Draw, false) => RELOAD_DRAW_READY_TIMEOUT,
        (RuntimeRequirement::Main, true) => REBUILD_MAIN_READY_TIMEOUT,
        (RuntimeRequirement::Draw, true) => REBUILD_DRAW_READY_TIMEOUT,
    }
}

fn can_reuse_ready_runtime(
    failed_runtime_id: Option<&str>,
    current_runtime_id: Option<&str>,
) -> bool {
    match failed_runtime_id {
        Some(failed_runtime_id) => current_runtime_id
            .is_some_and(|current_runtime_id| current_runtime_id != failed_runtime_id),
        None => current_runtime_id.is_some(),
    }
}

fn menu_id_to_action(menu_id: &str) -> Option<&'static str> {
    let menu_id = menu_id.strip_prefix("main-")?;
    match menu_id {
        "screenshot" => Some(ACTION_SCREENSHOT),
        "screenshot-delay" => Some(ACTION_SCREENSHOT_DELAY),
        "screenshot-fixedTool" => Some(ACTION_SCREENSHOT_FIXED),
        "screenshot-ocr" => Some(ACTION_SCREENSHOT_OCR),
        "screenshot-ocr-translate" => Some(ACTION_SCREENSHOT_OCR_TRANSLATE),
        "screenshot-copy" => Some(ACTION_SCREENSHOT_COPY),
        "screenshot-focused-window" => Some(ACTION_SCREENSHOT_FOCUSED_WINDOW),
        "screenshot-fullScreen" => Some(ACTION_SCREENSHOT_FULL_SCREEN),
        "chat" => Some(ACTION_CHAT),
        "chat-selectText" => Some(ACTION_CHAT_SELECT_TEXT),
        "translation" => Some(ACTION_TRANSLATION),
        "translation-selectText" => Some(ACTION_TRANSLATION_SELECT_TEXT),
        "screenshot-videoRecord" => Some(ACTION_VIDEO_RECORD),
        "screenshot-videoRecord-copy" => Some(ACTION_VIDEO_RECORD_COPY),
        "screenshot-fixedContent" => Some(ACTION_FIXED_CONTENT),
        "screenshot-topWindow" => Some(ACTION_TOP_WINDOW),
        "screenshot-fullScreenDraw" => Some(ACTION_FULL_SCREEN_DRAW),
        "open-image-save-folder" => Some(ACTION_OPEN_IMAGE_SAVE_FOLDER),
        "open-capture-history" => Some(ACTION_OPEN_CAPTURE_HISTORY),
        "show-main-window" => Some(ACTION_SHOW_MAIN_WINDOW),
        "exit" => Some(ACTION_EXIT),
        _ => None,
    }
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state != ShortcutState::Released {
        return;
    }

    let state = app.state::<NativeActionState>();
    if state.shortcuts_blocked() {
        return;
    }

    let Some(action) = state.shortcut_action(shortcut) else {
        return;
    };
    let check_focused_full_screen = state.disable_on_focused_full_screen.load(Ordering::Relaxed);
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        if check_focused_full_screen {
            match snow_shot_tauri_commands_core::commands::has_focused_full_screen_window().await {
                Ok(true) => return,
                Ok(false) => {}
                Err(error) => {
                    log::warn!(
                        "[native_action] failed to evaluate focused full-screen window: {error}"
                    );
                }
            }
        }

        if let Err(error) = dispatch_action(&app, &action, "shortcut").await {
            log::error!("[native_action] shortcut action {action} failed: {error}");
        }
    });
}

pub fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let Some(action) = menu_id_to_action(event.id().as_ref()) else {
        return;
    };
    queue_action(app, action.to_owned(), "trayMenu");
}

pub fn handle_tray_icon_event(app: &AppHandle, event: TrayIconEvent) {
    let TrayIconEvent::Click {
        id,
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    else {
        return;
    };

    if id.as_ref() != TRAY_ICON_ID {
        return;
    }

    let action = app.state::<NativeActionState>().tray_click_action();
    queue_action(app, action, "trayIcon");
}

fn queue_action(app: &AppHandle, action: String, source: &'static str) {
    if action == ACTION_EXIT {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            crate::core::exit_app(app).await;
        });
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = dispatch_action(&app, &action, source).await {
            log::error!("[native_action] {source} action {action} failed: {error}");
        }
    });
}

fn remove_main_tray_icon(app: &AppHandle) {
    if app.remove_tray_by_id(TRAY_ICON_ID).is_some() {
        log::info!("[native_action] removed stale main tray icon before runtime recovery");
    }
}

async fn dispatch_action(app: &AppHandle, action: &str, source: &str) -> Result<(), String> {
    let state = app.state::<NativeActionState>();
    let _dispatch_guard = state.action_dispatch_lock.lock().await;

    match action {
        ACTION_SHOW_MAIN_WINDOW => return show_main_window(app, false).await,
        ACTION_SHOW_OR_HIDE_MAIN_WINDOW => return show_main_window(app, true).await,
        ACTION_EXIT => {
            crate::core::exit_app(app.clone()).await;
            return Ok(());
        }
        _ if !is_supported_app_action(action) => {
            return Err(format!("unsupported native action: {action}"));
        }
        _ => {}
    }

    let show_main = action_opens_main_window(action);
    let requirement = action_runtime_requirement(action);
    ensure_main_runtime(app, show_main, requirement).await?;
    let failed_runtime_id = app
        .state::<NativeActionState>()
        .ready_main_runtime_id(requirement)
        .ok_or_else(|| "main WebView action channel is not ready".to_owned())?;

    match emit_action_and_wait_for_ack(app, action, source, &failed_runtime_id, requirement).await {
        Ok(true) => return Ok(()),
        Ok(false) => {}
        Err(error) => {
            log::warn!("[native_action] failed to deliver {action} before recovery: {error}");
        }
    }

    log::warn!("[native_action] main WebView did not acknowledge {action}; recovering it");
    recover_main_runtime(app, show_main, Some(&failed_runtime_id), requirement).await?;
    let recovered_runtime_id = app
        .state::<NativeActionState>()
        .ready_main_runtime_id(requirement)
        .ok_or_else(|| "recovered main WebView action channel is not ready".to_owned())?;

    if emit_action_and_wait_for_ack(app, action, source, &recovered_runtime_id, requirement).await?
    {
        Ok(())
    } else {
        Err(format!(
            "main WebView did not acknowledge {action} after recovery"
        ))
    }
}

async fn show_main_window(app: &AppHandle, toggle: bool) -> Result<(), String> {
    let requirement = RuntimeRequirement::Main;
    let window = ensure_main_window_exists(app, requirement).await?;
    if toggle {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);
        if is_visible && !is_minimized {
            return window
                .hide()
                .map_err(|error| format!("failed to hide main window: {error}"));
        }
    }

    wake_main_window(&window)?;
    if wait_for_runtime_ready(app, WAKE_GRACE_PERIOD, requirement).await {
        return Ok(());
    }

    recover_main_runtime(app, true, None, requirement).await
}

async fn ensure_main_runtime(
    app: &AppHandle,
    show_main: bool,
    requirement: RuntimeRequirement,
) -> Result<(), String> {
    let window = ensure_main_window_exists(app, requirement).await?;
    if show_main {
        wake_main_window(&window)?;
    }

    if app
        .state::<NativeActionState>()
        .ready_main_runtime_id(requirement)
        .is_some()
    {
        return Ok(());
    }

    if show_main && wait_for_runtime_ready(app, WAKE_GRACE_PERIOD, requirement).await {
        return Ok(());
    }

    recover_main_runtime(app, show_main, None, requirement).await
}

async fn ensure_main_window_exists(
    app: &AppHandle,
    requirement: RuntimeRequirement,
) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        return Ok(window);
    }

    let state = app.state::<NativeActionState>();
    let _recovery_guard = state.main_recovery_lock.lock().await;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        return Ok(window);
    }

    rebuild_main_window(app, false, requirement).await
}

fn wake_main_window(window: &WebviewWindow) -> Result<(), String> {
    window
        .show()
        .map_err(|error| format!("failed to show main window: {error}"))?;
    window
        .unminimize()
        .map_err(|error| format!("failed to unminimize main window: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("failed to focus main window: {error}"))
}

async fn recover_main_runtime(
    app: &AppHandle,
    show_main: bool,
    failed_runtime_id: Option<&str>,
    requirement: RuntimeRequirement,
) -> Result<(), String> {
    let state = app.state::<NativeActionState>();
    let _recovery_guard = state.main_recovery_lock.lock().await;

    let current_runtime_id = state.ready_main_runtime_id(requirement);
    if can_reuse_ready_runtime(failed_runtime_id, current_runtime_id.as_deref())
        && let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL)
    {
        if show_main {
            wake_main_window(&window)?;
        }
        return Ok(());
    }

    state.clear_main_runtime();
    remove_main_tray_icon(app);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        stop_window_input_services(app, MAIN_WINDOW_LABEL).await;
        if show_main {
            let _ = wake_main_window(&window);
        }
        if window.reload().is_ok()
            && wait_for_runtime_ready(app, runtime_ready_timeout(requirement, false), requirement)
                .await
        {
            if show_main {
                wake_main_window(&window)?;
            }
            return Ok(());
        }
    }

    rebuild_main_window(app, show_main, requirement).await?;
    Ok(())
}

async fn stop_window_input_services(app: &AppHandle, window_label: &str) {
    {
        let service = app.state::<AsyncMutex<ListenKeyService>>();
        let mut service = service.lock().await;
        if let Err(error) = service.stop_by_window_label(window_label) {
            log::warn!("[native_action] failed to stop key listener for {window_label}: {error}");
        }
    }
    {
        let service = app.state::<AsyncMutex<ListenMouseService>>();
        let mut service = service.lock().await;
        if let Err(error) = service.stop_by_window_label(window_label) {
            log::warn!("[native_action] failed to stop mouse listener for {window_label}: {error}");
        }
    }
}

pub fn handle_window_destroyed(app: &AppHandle, window_label: &str) {
    app.state::<NativeActionState>()
        .remove_window_runtime(window_label);
    let app = app.clone();
    let window_label = window_label.to_owned();
    tauri::async_runtime::spawn(async move {
        stop_window_input_services(&app, &window_label).await;
    });
}

async fn rebuild_main_window(
    app: &AppHandle,
    show_main: bool,
    requirement: RuntimeRequirement,
) -> Result<WebviewWindow, String> {
    let state = app.state::<NativeActionState>();
    state.clear_main_runtime();
    remove_main_tray_icon(app);

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW_LABEL)
        .cloned()
        .ok_or_else(|| "main window config not found".to_owned())?;
    let rebuild_flag = MainRebuildFlagGuard::new(&state);

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        stop_window_input_services(app, MAIN_WINDOW_LABEL).await;
        if let Err(error) = window.destroy() {
            return Err(format!("failed to destroy unhealthy main window: {error}"));
        }

        let deadline = Instant::now() + Duration::from_secs(2);
        while app.get_webview_window(MAIN_WINDOW_LABEL).is_some() && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
            return Err("unhealthy main window did not close in time".to_owned());
        }
    }

    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| format!("failed to create main window builder: {error}"))?
        .build()
        .map_err(|error| format!("failed to rebuild main window: {error}"))?;
    rebuild_flag.finish();
    crate::configure_main_window(&window);

    if show_main {
        wake_main_window(&window)?;
    }
    if !wait_for_runtime_ready(app, runtime_ready_timeout(requirement, true), requirement).await {
        return Err("rebuilt main WebView did not become ready in time".to_owned());
    }

    Ok(window)
}

async fn wait_for_runtime_ready(
    app: &AppHandle,
    timeout: Duration,
    requirement: RuntimeRequirement,
) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if app
            .state::<NativeActionState>()
            .ready_main_runtime_id(requirement)
            .is_some()
        {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    false
}

async fn emit_action_and_wait_for_ack(
    app: &AppHandle,
    action: &str,
    source: &str,
    expected_document_id: &str,
    requirement: RuntimeRequirement,
) -> Result<bool, String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window not found".to_owned())?;
    let state = app.state::<NativeActionState>();
    if state.ready_main_runtime_id(requirement).as_deref() != Some(expected_document_id) {
        return Ok(false);
    }
    let request_id = state.next_request_id();
    let (sender, receiver) = oneshot::channel();
    if !state.insert_pending_ack(request_id, expected_document_id, sender) {
        return Ok(false);
    }

    let request = NativeActionRequest {
        request_id,
        document_id: expected_document_id.to_owned(),
        action: action.to_owned(),
        source: source.to_owned(),
    };
    let emit_result = window
        .emit("execute-native-action", request)
        .map_err(|error| format!("failed to emit native action: {error}"));
    if let Err(error) = emit_result {
        state
            .pending_acks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&request_id);
        return Err(error);
    }

    let acknowledged = matches!(
        tokio::time::timeout(ACTION_ACK_TIMEOUT, receiver).await,
        Ok(Ok(()))
    );
    state
        .pending_acks
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&request_id);
    Ok(acknowledged)
}

#[tauri::command]
pub fn native_shortcut_register_action(
    app: AppHandle,
    state: State<'_, NativeActionState>,
    shortcut: String,
    action: String,
) -> Result<bool, String> {
    if !is_supported_app_action(&action) {
        return Err(format!("unsupported shortcut action: {action}"));
    }
    let shortcut = shortcut
        .parse::<Shortcut>()
        .map_err(|error| format!("invalid shortcut: {error}"))?;

    let global_shortcut = app.global_shortcut();
    if global_shortcut.is_registered(shortcut) {
        return Ok(false);
    }

    let shortcut_id = shortcut.id();
    state
        .shortcut_actions
        .write()
        .unwrap_or_else(|error| error.into_inner())
        .insert(shortcut_id, action);

    if let Err(error) = global_shortcut.register(shortcut) {
        state
            .shortcut_actions
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&shortcut_id);
        return Err(format!("failed to register shortcut: {error}"));
    }

    Ok(true)
}

#[tauri::command]
pub fn native_shortcut_reset_actions(
    app: AppHandle,
    state: State<'_, NativeActionState>,
) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|error| format!("failed to unregister shortcuts: {error}"))?;
    state
        .shortcut_actions
        .write()
        .unwrap_or_else(|error| error.into_inner())
        .clear();
    Ok(())
}

#[tauri::command]
pub fn native_shortcut_set_disabled(state: State<'_, NativeActionState>, disabled: bool) {
    state.shortcuts_disabled.store(disabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn native_shortcut_set_input_active(state: State<'_, NativeActionState>, active: bool) {
    state.shortcut_input_active.store(active, Ordering::Relaxed);
}

#[tauri::command]
pub fn native_shortcut_set_full_screen_policy(
    state: State<'_, NativeActionState>,
    disabled_on_focused_full_screen: bool,
) {
    state
        .disable_on_focused_full_screen
        .store(disabled_on_focused_full_screen, Ordering::Relaxed);
}

#[tauri::command]
pub fn native_tray_set_click_action(
    state: State<'_, NativeActionState>,
    action: String,
) -> Result<(), String> {
    if !matches!(
        action.as_str(),
        TRAY_CLICK_SCREENSHOT | TRAY_CLICK_SHOW_MAIN_WINDOW
    ) {
        return Err(format!("unsupported tray click action: {action}"));
    }
    *state
        .tray_click_action
        .write()
        .unwrap_or_else(|error| error.into_inner()) = action;
    Ok(())
}

#[tauri::command]
pub fn native_runtime_start(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    document_id: String,
) {
    if window.label() == MAIN_WINDOW_LABEL {
        state.start_main_runtime(document_id);
    } else if window.label().starts_with(DRAW_WINDOW_LABEL_PREFIX) {
        state.start_draw_runtime(window.label().to_owned(), document_id);
    }
}

#[tauri::command]
pub fn native_runtime_heartbeat(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    document_id: String,
) {
    if window.label() == MAIN_WINDOW_LABEL {
        state.mark_main_runtime_alive(&document_id);
    }
}

#[tauri::command]
pub fn native_runtime_ready(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    document_id: String,
) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err("only the main window has a native action channel".to_owned());
    }
    if !state.mark_main_runtime_ready(&document_id) {
        return Err("native runtime document is no longer current".to_owned());
    }
    Ok(())
}

#[tauri::command]
pub fn native_draw_runtime_ready(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    document_id: String,
) -> Result<(), String> {
    if !window.label().starts_with(DRAW_WINDOW_LABEL_PREFIX) {
        return Err("only draw windows can report draw runtime readiness".to_owned());
    }
    if !state.mark_draw_runtime_ready(window.label(), &document_id) {
        return Err("draw runtime document is no longer current".to_owned());
    }
    Ok(())
}

#[tauri::command]
pub fn native_runtime_bind_draw(
    app: AppHandle,
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    document_id: String,
    draw_window_label: String,
) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err("only the main window can bind a draw runtime".to_owned());
    }
    if !draw_window_label.starts_with(DRAW_WINDOW_LABEL_PREFIX)
        || app.get_webview_window(&draw_window_label).is_none()
    {
        return Err("draw runtime window is no longer available".to_owned());
    }
    if !state.bind_draw_runtime(&document_id, &draw_window_label) {
        return Err("draw runtime is not ready for the current main document".to_owned());
    }
    Ok(())
}

#[tauri::command]
pub fn native_action_ack(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    request_id: u64,
    document_id: String,
) -> Result<bool, String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err("native action acknowledgements must come from the main window".to_owned());
    }

    Ok(state.acknowledge_action(request_id, &document_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_critical_tray_menu_items_to_app_actions() {
        assert_eq!(
            menu_id_to_action("main-screenshot"),
            Some(ACTION_SCREENSHOT)
        );
        assert_eq!(
            menu_id_to_action("main-translation"),
            Some(ACTION_TRANSLATION)
        );
        assert_eq!(
            menu_id_to_action("main-screenshot-ocr-translate"),
            Some(ACTION_SCREENSHOT_OCR_TRANSLATE)
        );
        assert_eq!(
            menu_id_to_action("main-show-main-window"),
            Some(ACTION_SHOW_MAIN_WINDOW)
        );
    }

    #[test]
    fn ignores_non_native_and_other_window_menu_items() {
        assert_eq!(menu_id_to_action("main-disableShortcut"), None);
        assert_eq!(menu_id_to_action("other-screenshot"), None);
        assert_eq!(menu_id_to_action("main-unknown"), None);
    }

    #[test]
    fn only_navigation_actions_force_the_main_window_visible() {
        assert!(action_opens_main_window(ACTION_TRANSLATION));
        assert!(action_opens_main_window(ACTION_CHAT));
        assert!(action_opens_main_window(ACTION_OPEN_CAPTURE_HISTORY));
        assert!(!action_opens_main_window(ACTION_TRANSLATION_SELECT_TEXT));
        assert!(!action_opens_main_window(ACTION_CHAT_SELECT_TEXT));
        assert!(!action_opens_main_window(ACTION_OPEN_IMAGE_SAVE_FOLDER));
        assert!(!action_opens_main_window(ACTION_SCREENSHOT));
        assert!(!action_opens_main_window(ACTION_FIXED_CONTENT));
    }

    #[test]
    fn only_draw_backed_actions_wait_for_draw_runtime() {
        assert_eq!(
            action_runtime_requirement(ACTION_SCREENSHOT),
            RuntimeRequirement::Draw
        );
        assert_eq!(
            action_runtime_requirement(ACTION_SCREENSHOT_OCR_TRANSLATE),
            RuntimeRequirement::Draw
        );
        assert_eq!(
            action_runtime_requirement(ACTION_VIDEO_RECORD),
            RuntimeRequirement::Draw
        );
        assert_eq!(
            action_runtime_requirement(ACTION_SCREENSHOT_FOCUSED_WINDOW),
            RuntimeRequirement::Main
        );
        assert_eq!(
            action_runtime_requirement(ACTION_TRANSLATION),
            RuntimeRequirement::Main
        );
        assert_eq!(
            action_runtime_requirement(ACTION_VIDEO_RECORD_COPY),
            RuntimeRequirement::Main
        );
    }

    #[test]
    fn runtime_ready_is_scoped_to_the_current_document() {
        let state = NativeActionState::default();
        state.start_main_runtime("first".to_owned());
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Main), None);
        assert!(state.mark_main_runtime_ready("first"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Main)
                .as_deref(),
            Some("first")
        );

        state.clear_main_runtime();
        state.mark_main_runtime_alive("first");
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Main), None);

        state.start_main_runtime("second".to_owned());
        assert!(!state.mark_main_runtime_ready("first"));
        assert!(state.mark_main_runtime_ready("second"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Main)
                .as_deref(),
            Some("second")
        );
    }

    #[test]
    fn draw_actions_require_the_bound_current_draw_document() {
        let state = NativeActionState::default();
        state.start_main_runtime("main".to_owned());
        assert!(state.mark_main_runtime_ready("main"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Main)
                .as_deref(),
            Some("main")
        );
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Draw), None);

        state.start_draw_runtime("draw-1".to_owned(), "draw-doc-1".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-1", "draw-doc-1"));
        assert!(state.bind_draw_runtime("main", "draw-1"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Draw)
                .as_deref(),
            Some("main")
        );

        state.start_draw_runtime("draw-1".to_owned(), "draw-doc-2".to_owned());
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Draw), None);
        assert!(!state.mark_draw_runtime_ready("draw-1", "draw-doc-1"));
        assert!(state.mark_draw_runtime_ready("draw-1", "draw-doc-2"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Draw)
                .as_deref(),
            Some("main")
        );
    }

    #[test]
    fn ready_draw_can_bind_before_main_readiness_finishes() {
        let state = NativeActionState::default();
        state.start_main_runtime("main".to_owned());
        state.start_draw_runtime("draw-1".to_owned(), "draw-doc".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-1", "draw-doc"));
        assert!(state.bind_draw_runtime("main", "draw-1"));
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Draw), None);

        assert!(state.mark_main_runtime_ready("main"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Draw)
                .as_deref(),
            Some("main")
        );
    }

    #[test]
    fn ack_failure_only_reuses_a_different_ready_runtime() {
        assert!(!can_reuse_ready_runtime(Some("old"), Some("old")));
        assert!(can_reuse_ready_runtime(Some("old"), Some("new")));
        assert!(!can_reuse_ready_runtime(Some("old"), None));
        assert!(can_reuse_ready_runtime(None, Some("ready")));
        assert!(!can_reuse_ready_runtime(None, None));
    }

    #[test]
    fn rebuild_flag_guard_clears_the_flag_on_success_and_early_return() {
        let state = NativeActionState::default();
        {
            let _guard = MainRebuildFlagGuard::new(&state);
            assert!(state.main_rebuild_active());
        }
        assert!(!state.main_rebuild_active());

        let guard = MainRebuildFlagGuard::new(&state);
        assert!(state.main_rebuild_active());
        guard.finish();
        assert!(!state.main_rebuild_active());
    }

    #[test]
    fn acknowledgements_only_accept_live_pending_requests_once() {
        let state = NativeActionState::default();
        state.start_main_runtime("current".to_owned());
        assert!(state.mark_main_runtime_ready("current"));
        let (sender, _receiver) = oneshot::channel();
        assert!(state.insert_pending_ack(7, "current", sender));

        assert!(!state.acknowledge_action(7, "stale"));
        assert!(state.acknowledge_action(7, "current"));
        assert!(!state.acknowledge_action(7, "current"));

        let (sender, receiver) = oneshot::channel();
        drop(receiver);
        assert!(state.insert_pending_ack(8, "current", sender));
        assert!(!state.acknowledge_action(8, "current"));

        let (sender, _receiver) = oneshot::channel();
        assert!(state.insert_pending_ack(9, "current", sender));
        state.start_main_runtime("replacement".to_owned());
        assert!(!state.acknowledge_action(9, "current"));
    }

    #[test]
    fn tray_and_shortcut_input_disable_sources_do_not_overwrite_each_other() {
        let state = NativeActionState::default();
        assert!(!state.shortcuts_blocked());

        state.shortcuts_disabled.store(true, Ordering::Relaxed);
        state.shortcut_input_active.store(true, Ordering::Relaxed);
        state.shortcuts_disabled.store(false, Ordering::Relaxed);
        assert!(state.shortcuts_blocked());

        state.shortcuts_disabled.store(true, Ordering::Relaxed);
        state.start_main_runtime("reloaded".to_owned());
        assert!(state.shortcuts_blocked());
        state.shortcuts_disabled.store(false, Ordering::Relaxed);
        assert!(!state.shortcuts_blocked());
    }
}
