use std::{
    collections::HashMap,
    sync::{
        Mutex as StdMutex, RwLock,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};

use serde::Serialize;
use snow_shot_app_services::{
    listen_key_service::ListenKeyService, listen_mouse_service::ListenMouseService,
};
use tauri::{
    AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder,
    menu::{MenuBuilder, MenuEvent},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
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

const FALLBACK_TRAY_MENU_ITEMS: [(&str, &str); 3] = [
    ("main-screenshot", "Screenshot"),
    ("main-show-main-window", "Show Snow Shot"),
    ("main-exit", "Exit"),
];

const WAKE_GRACE_PERIOD: Duration = Duration::from_millis(900);
const MAIN_RUNTIME_PROBE_TIMEOUT: Duration = Duration::from_secs(1);
const DRAW_RUNTIME_PROBE_TIMEOUT: Duration = Duration::from_secs(1);
const ACTION_ACK_TIMEOUT: Duration = Duration::from_millis(1500);
const TRAY_MUTATION_TIMEOUT: Duration = Duration::from_secs(2);
const RELOAD_MAIN_READY_TIMEOUT: Duration = Duration::from_secs(8);
const RELOAD_DRAW_READY_TIMEOUT: Duration = Duration::from_secs(15);
const REBUILD_MAIN_READY_TIMEOUT: Duration = Duration::from_secs(12);
const REBUILD_DRAW_READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RuntimeRequirement {
    Main,
    Draw,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RuntimeSessionEvent {
    ConsoleConnect,
    RemoteConnect,
    SessionUnlock,
    PowerResume,
    DisplayChange,
}

impl RuntimeSessionEvent {
    fn as_str(self) -> &'static str {
        match self {
            Self::ConsoleConnect => "console-connect",
            Self::RemoteConnect => "remote-connect",
            Self::SessionUnlock => "session-unlock",
            Self::PowerResume => "power-resume",
            Self::DisplayChange => "display-change",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
struct RuntimeSessionTransition {
    previous_generation: u64,
    current_generation: u64,
    invalidated_draw_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeActionRequest {
    request_id: u64,
    document_id: String,
    action: String,
    source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    draw_window_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeDrawRuntimeProbe {
    probe_id: u64,
    document_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeMainRuntimeProbe {
    probe_id: u64,
    document_id: String,
}

pub struct NativeActionState {
    shortcut_actions: RwLock<HashMap<u32, String>>,
    shortcuts_disabled: AtomicBool,
    shortcut_input_active: AtomicBool,
    disable_on_focused_full_screen: AtomicBool,
    tray_click_action: RwLock<String>,
    tray_enabled: AtomicBool,
    tray_mutation_lock: AsyncMutex<()>,
    main_runtime: RwLock<Option<MainRuntimeStatus>>,
    draw_runtimes: RwLock<HashMap<String, DrawRuntimeStatus>>,
    pending_acks: StdMutex<HashMap<u64, PendingActionAck>>,
    pending_main_probes: StdMutex<HashMap<u64, PendingMainProbe>>,
    pending_draw_probes: StdMutex<HashMap<u64, PendingDrawProbe>>,
    runtime_ready_waiters: StdMutex<HashMap<u64, PendingRuntimeReadyWaiter>>,
    pending_window_destroyed: StdMutex<HashMap<String, oneshot::Sender<()>>>,
    pending_draw_cleanup: StdMutex<Vec<String>>,
    system_recovery_pending: AtomicBool,
    system_recovery_active: AtomicBool,
    system_recovery_dirty: AtomicBool,
    next_request_id: AtomicU64,
    next_probe_id: AtomicU64,
    next_ready_waiter_id: AtomicU64,
    next_draw_generation: AtomicU64,
    session_generation: AtomicU64,
    main_rebuild_active: AtomicBool,
    terminal_process_recovery_started: AtomicBool,
    shutdown_requested: AtomicBool,
    action_dispatch_lock: AsyncMutex<()>,
    main_recovery_lock: AsyncMutex<()>,
}

struct MainRuntimeStatus {
    document_id: String,
    session_generation: u64,
    ready: bool,
    draw_runtime: Option<DrawRuntimeIdentity>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DrawRuntimeIdentity {
    window_label: String,
    document_id: String,
    generation: u64,
    session_generation: u64,
}

struct DrawRuntimeStatus {
    document_id: String,
    generation: u64,
    session_generation: u64,
    ready: bool,
}

struct PendingActionAck {
    document_id: String,
    sender: oneshot::Sender<()>,
}

struct PendingMainProbe {
    document_id: String,
    session_generation: u64,
    sender: oneshot::Sender<()>,
}

struct PendingDrawProbe {
    identity: DrawRuntimeIdentity,
    sender: oneshot::Sender<()>,
}

struct PendingRuntimeReadyWaiter {
    requirement: RuntimeRequirement,
    session_generation: u64,
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
            tray_enabled: AtomicBool::new(true),
            tray_mutation_lock: AsyncMutex::new(()),
            main_runtime: RwLock::new(None),
            draw_runtimes: RwLock::new(HashMap::new()),
            pending_acks: StdMutex::new(HashMap::new()),
            pending_main_probes: StdMutex::new(HashMap::new()),
            pending_draw_probes: StdMutex::new(HashMap::new()),
            runtime_ready_waiters: StdMutex::new(HashMap::new()),
            pending_window_destroyed: StdMutex::new(HashMap::new()),
            pending_draw_cleanup: StdMutex::new(Vec::new()),
            system_recovery_pending: AtomicBool::new(false),
            system_recovery_active: AtomicBool::new(false),
            system_recovery_dirty: AtomicBool::new(false),
            next_request_id: AtomicU64::new(1),
            next_probe_id: AtomicU64::new(1),
            next_ready_waiter_id: AtomicU64::new(1),
            next_draw_generation: AtomicU64::new(1),
            session_generation: AtomicU64::new(1),
            main_rebuild_active: AtomicBool::new(false),
            terminal_process_recovery_started: AtomicBool::new(false),
            shutdown_requested: AtomicBool::new(false),
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
        let session_generation = self.current_session_generation();
        self.shortcut_input_active.store(false, Ordering::Relaxed);
        *self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner()) = Some(MainRuntimeStatus {
            document_id,
            session_generation,
            ready: false,
            draw_runtime: None,
        });
        self.clear_pending_runtime_claims();
    }

    fn start_draw_runtime(&self, window_label: String, document_id: String) {
        self.remove_pending_draw_probes(&window_label);
        let generation = self.next_draw_generation.fetch_add(1, Ordering::Relaxed);
        let session_generation = self.current_session_generation();
        self.draw_runtimes
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                window_label,
                DrawRuntimeStatus {
                    document_id,
                    generation,
                    session_generation,
                    ready: false,
                },
            );
    }

    fn mark_main_runtime_ready(&self, document_id: &str) -> bool {
        {
            let mut runtime_guard = self
                .main_runtime
                .write()
                .unwrap_or_else(|error| error.into_inner());
            let Some(runtime) = runtime_guard.as_mut() else {
                return false;
            };
            if runtime.document_id != document_id {
                return false;
            }
            if runtime.session_generation != self.current_session_generation() {
                return false;
            }

            runtime.ready = true;
        }
        self.notify_runtime_ready_waiters();
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
            if runtime.session_generation != self.current_session_generation() {
                return false;
            }
            runtime.ready = true;
            DrawRuntimeIdentity {
                window_label: window_label.to_owned(),
                document_id: document_id.to_owned(),
                generation: runtime.generation,
                session_generation: runtime.session_generation,
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
        drop(main_runtime);
        self.notify_runtime_ready_waiters();
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
            if runtime.session_generation != self.current_session_generation() {
                return false;
            }
            DrawRuntimeIdentity {
                window_label: draw_window_label.to_owned(),
                document_id: runtime.document_id.clone(),
                generation: runtime.generation,
                session_generation: runtime.session_generation,
            }
        };

        {
            let mut runtime_guard = self
                .main_runtime
                .write()
                .unwrap_or_else(|error| error.into_inner());
            let Some(runtime) = runtime_guard.as_mut() else {
                return false;
            };
            if runtime.document_id != main_document_id {
                return false;
            }
            if runtime.session_generation != self.current_session_generation() {
                return false;
            }
            runtime.draw_runtime = Some(identity);
        }
        self.notify_runtime_ready_waiters();
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
            self.remove_pending_draw_probes(window_label);
        }
        self.notify_window_destroyed(window_label);
    }

    pub fn main_rebuild_active(&self) -> bool {
        self.main_rebuild_active.load(Ordering::Acquire)
    }

    fn set_main_rebuild_active(&self, active: bool) {
        self.main_rebuild_active.store(active, Ordering::Release);
    }

    /// Opens the one-way circuit breaker for a host event-loop failure.
    ///
    /// Once a main-thread roundtrip or window destruction has timed out, further
    /// actions must not enqueue more work on the same Tao loop while a recovery
    /// child is taking over.
    fn begin_terminal_process_recovery(&self) -> bool {
        self.terminal_process_recovery_started
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn terminal_process_recovery_started(&self) -> bool {
        self.terminal_process_recovery_started
            .load(Ordering::Acquire)
    }

    pub(crate) fn request_shutdown(&self) {
        self.shutdown_requested.store(true, Ordering::Release);
    }

    fn shutdown_requested(&self) -> bool {
        self.shutdown_requested.load(Ordering::Acquire)
    }

    fn clear_main_runtime(&self) {
        *self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner()) = None;
        self.clear_pending_runtime_claims();
    }

    fn invalidate_main_action_channel(&self, document_id: &str) {
        let mut runtime = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(runtime) = runtime.as_mut()
            && runtime.document_id == document_id
            && runtime.session_generation == self.current_session_generation()
        {
            runtime.ready = false;
            runtime.draw_runtime = None;
        }
        drop(runtime);
        self.clear_pending_runtime_claims();
    }

    fn current_session_generation(&self) -> u64 {
        self.session_generation.load(Ordering::Acquire)
    }

    fn begin_runtime_session_recovery(
        &self,
        event: RuntimeSessionEvent,
    ) -> Option<RuntimeSessionTransition> {
        self.system_recovery_dirty.store(true, Ordering::Release);
        if self
            .system_recovery_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return None;
        }

        // Events racing before the first invalidation are covered by that same
        // invalidation. Later events set this flag again and are probed at the
        // recovery boundary instead of forcing overlapping reloads.
        self.system_recovery_dirty.store(false, Ordering::Release);
        Some(self.invalidate_runtime_session(event))
    }

    fn take_runtime_session_dirty(&self) -> bool {
        self.system_recovery_dirty.swap(false, Ordering::AcqRel)
    }

    fn finish_or_reclaim_runtime_session_recovery(&self) -> bool {
        self.system_recovery_active.store(false, Ordering::Release);
        if !self.system_recovery_dirty.swap(false, Ordering::AcqRel) {
            return false;
        }

        self.system_recovery_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn invalidate_runtime_session(&self, _event: RuntimeSessionEvent) -> RuntimeSessionTransition {
        let previous_generation = self.session_generation.fetch_add(1, Ordering::AcqRel);
        let current_generation = previous_generation.wrapping_add(1);
        self.shortcut_input_active.store(false, Ordering::Relaxed);

        *self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner()) = None;
        let invalidated_draw_labels = self.drain_draw_runtime_labels();
        self.clear_pending_runtime_claims();

        if !invalidated_draw_labels.is_empty() {
            let mut pending = self
                .pending_draw_cleanup
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            pending.extend(invalidated_draw_labels.iter().cloned());
            pending.sort_unstable();
            pending.dedup();
        }
        self.system_recovery_pending.store(true, Ordering::Release);
        self.notify_runtime_ready_waiters();

        RuntimeSessionTransition {
            previous_generation,
            current_generation,
            invalidated_draw_count: invalidated_draw_labels.len(),
        }
    }

    fn drain_draw_runtime_labels(&self) -> Vec<String> {
        if let Some(runtime) = self
            .main_runtime
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .as_mut()
        {
            runtime.draw_runtime = None;
        }

        let window_labels = self
            .draw_runtimes
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .drain()
            .map(|(window_label, _)| window_label)
            .collect();
        self.clear_pending_draw_probes();
        window_labels
    }

    fn take_pending_system_recovery(&self) -> Option<Vec<String>> {
        if !self.system_recovery_pending.swap(false, Ordering::AcqRel) {
            return None;
        }

        Some(std::mem::take(
            &mut *self
                .pending_draw_cleanup
                .lock()
                .unwrap_or_else(|error| error.into_inner()),
        ))
    }

    fn clear_pending_acks(&self) {
        self.pending_acks
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
    }

    fn clear_pending_draw_probes(&self) {
        self.pending_draw_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
    }

    fn clear_pending_main_probes(&self) {
        self.pending_main_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
    }

    fn clear_pending_runtime_claims(&self) {
        self.clear_pending_acks();
        self.clear_pending_main_probes();
        self.clear_pending_draw_probes();
    }

    fn remove_pending_draw_probes(&self, window_label: &str) {
        self.pending_draw_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .retain(|_, pending| pending.identity.window_label != window_label);
    }

    fn ready_main_runtime_id(&self, requirement: RuntimeRequirement) -> Option<String> {
        let (document_id, draw_runtime) = {
            let runtime = self
                .main_runtime
                .read()
                .unwrap_or_else(|error| error.into_inner());
            let runtime = runtime.as_ref().filter(|runtime| {
                runtime.ready && runtime.session_generation == self.current_session_generation()
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
                || current.session_generation != draw_runtime.session_generation
                || current.session_generation != self.current_session_generation()
            {
                return None;
            }
        }

        Some(document_id)
    }

    fn ready_main_runtime_identity(&self) -> Option<(String, u64)> {
        let runtime = self
            .main_runtime
            .read()
            .unwrap_or_else(|error| error.into_inner());
        let runtime = runtime.as_ref().filter(|runtime| {
            runtime.ready && runtime.session_generation == self.current_session_generation()
        })?;
        Some((runtime.document_id.clone(), runtime.session_generation))
    }

    fn ready_draw_runtime_identity(&self) -> Option<DrawRuntimeIdentity> {
        let identity = {
            let runtime = self
                .main_runtime
                .read()
                .unwrap_or_else(|error| error.into_inner());
            let runtime = runtime.as_ref().filter(|runtime| {
                runtime.ready && runtime.session_generation == self.current_session_generation()
            })?;
            runtime.draw_runtime.clone()?
        };

        let draw_runtimes = self
            .draw_runtimes
            .read()
            .unwrap_or_else(|error| error.into_inner());
        let current = draw_runtimes.get(&identity.window_label)?;
        if !current.ready
            || current.document_id != identity.document_id
            || current.generation != identity.generation
            || current.session_generation != identity.session_generation
            || current.session_generation != self.current_session_generation()
        {
            return None;
        }
        Some(identity)
    }

    fn next_request_id(&self) -> u64 {
        self.next_request_id.fetch_add(1, Ordering::Relaxed)
    }

    fn next_probe_id(&self) -> u64 {
        self.next_probe_id.fetch_add(1, Ordering::Relaxed)
    }

    fn insert_pending_main_probe(
        &self,
        probe_id: u64,
        document_id: &str,
        session_generation: u64,
        sender: oneshot::Sender<()>,
    ) -> bool {
        if self.ready_main_runtime_identity().as_ref()
            != Some(&(document_id.to_owned(), session_generation))
        {
            return false;
        }

        self.pending_main_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                probe_id,
                PendingMainProbe {
                    document_id: document_id.to_owned(),
                    session_generation,
                    sender,
                },
            );

        if self.ready_main_runtime_identity().as_ref()
            == Some(&(document_id.to_owned(), session_generation))
        {
            true
        } else {
            self.pending_main_probes
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .remove(&probe_id);
            false
        }
    }

    fn acknowledge_main_probe(&self, probe_id: u64, document_id: &str) -> bool {
        let Some((current_document_id, current_session_generation)) =
            self.ready_main_runtime_identity()
        else {
            return false;
        };
        if current_document_id != document_id {
            return false;
        }

        let mut pending_probes = self
            .pending_main_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !pending_probes.get(&probe_id).is_some_and(|pending| {
            pending.document_id == document_id
                && pending.session_generation == current_session_generation
                && pending.session_generation == self.current_session_generation()
        }) {
            return false;
        }

        pending_probes
            .remove(&probe_id)
            .is_some_and(|pending| pending.sender.send(()).is_ok())
    }

    fn register_runtime_ready_waiter(
        &self,
        requirement: RuntimeRequirement,
    ) -> (u64, oneshot::Receiver<()>) {
        let waiter_id = self.next_ready_waiter_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();
        self.runtime_ready_waiters
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                waiter_id,
                PendingRuntimeReadyWaiter {
                    requirement,
                    session_generation: self.current_session_generation(),
                    sender,
                },
            );
        self.notify_runtime_ready_waiters();
        (waiter_id, receiver)
    }

    fn notify_runtime_ready_waiters(&self) {
        let current_session_generation = self.current_session_generation();
        let main_ready = self
            .ready_main_runtime_id(RuntimeRequirement::Main)
            .is_some();
        let draw_ready = self
            .ready_main_runtime_id(RuntimeRequirement::Draw)
            .is_some();
        let mut waiters = self
            .runtime_ready_waiters
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut retained = HashMap::with_capacity(waiters.len());
        for (waiter_id, waiter) in waiters.drain() {
            let ready = match waiter.requirement {
                RuntimeRequirement::Main => main_ready,
                RuntimeRequirement::Draw => draw_ready,
            };
            if waiter.session_generation != current_session_generation || ready {
                let _ = waiter.sender.send(());
            } else {
                retained.insert(waiter_id, waiter);
            }
        }
        *waiters = retained;
    }

    fn remove_runtime_ready_waiter(&self, waiter_id: u64) {
        self.runtime_ready_waiters
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&waiter_id);
    }

    fn register_window_destroyed_waiter(&self, window_label: &str) -> oneshot::Receiver<()> {
        let (sender, receiver) = oneshot::channel();
        self.pending_window_destroyed
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(window_label.to_owned(), sender);
        receiver
    }

    fn notify_window_destroyed(&self, window_label: &str) {
        if let Some(sender) = self
            .pending_window_destroyed
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(window_label)
        {
            let _ = sender.send(());
        }
    }

    fn remove_window_destroyed_waiter(&self, window_label: &str) {
        self.pending_window_destroyed
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(window_label);
    }

    fn insert_pending_draw_probe(
        &self,
        probe_id: u64,
        identity: &DrawRuntimeIdentity,
        sender: oneshot::Sender<()>,
    ) -> bool {
        if self.ready_draw_runtime_identity().as_ref() != Some(identity) {
            return false;
        }

        self.pending_draw_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                probe_id,
                PendingDrawProbe {
                    identity: identity.clone(),
                    sender,
                },
            );

        if self.ready_draw_runtime_identity().as_ref() == Some(identity) {
            true
        } else {
            self.pending_draw_probes
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .remove(&probe_id);
            false
        }
    }

    fn acknowledge_draw_probe(&self, window_label: &str, probe_id: u64, document_id: &str) -> bool {
        let Some(current_identity) = self.ready_draw_runtime_identity() else {
            return false;
        };
        if current_identity.window_label != window_label
            || current_identity.document_id != document_id
        {
            return false;
        }

        let mut pending_probes = self
            .pending_draw_probes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !pending_probes.get(&probe_id).is_some_and(|pending| {
            pending.identity == current_identity
                && pending.identity.window_label == window_label
                && pending.identity.document_id == document_id
                && pending.identity.session_generation == self.current_session_generation()
        }) {
            return false;
        }

        pending_probes
            .remove(&probe_id)
            .is_some_and(|pending| pending.sender.send(()).is_ok())
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
        if !runtime.as_ref().is_some_and(|runtime| {
            runtime.ready
                && runtime.document_id == document_id
                && runtime.session_generation == self.current_session_generation()
        }) {
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
        if !runtime.as_ref().is_some_and(|runtime| {
            runtime.document_id == document_id
                && runtime.session_generation == self.current_session_generation()
        }) {
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
    if state.shortcuts_blocked()
        || state.terminal_process_recovery_started()
        || state.shutdown_requested()
    {
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
                    log::warn!(target: "snow-shot-recovery",
                        "[native_action] failed to evaluate focused full-screen window: {error}"
                    );
                }
            }
        }

        if let Err(error) = dispatch_action(&app, &action, "shortcut").await {
            log::error!(target: "snow-shot-recovery", "[native_action] shortcut action {action} failed: {error}");
        }
    });
}

pub fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    if app
        .state::<NativeActionState>()
        .terminal_process_recovery_started()
    {
        return;
    }
    let Some(action) = menu_id_to_action(event.id().as_ref()) else {
        return;
    };
    queue_action(app, action.to_owned(), "trayMenu");
}

pub fn handle_tray_icon_event(app: &AppHandle, event: TrayIconEvent) {
    if app
        .state::<NativeActionState>()
        .terminal_process_recovery_started()
    {
        return;
    }
    let TrayIconEvent::Click {
        id,
        button,
        button_state,
        ..
    } = event
    else {
        return;
    };

    if id.as_ref() != TRAY_ICON_ID {
        return;
    }

    match (button, button_state) {
        (MouseButton::Left, MouseButtonState::Up) => {
            let action = app.state::<NativeActionState>().tray_click_action();
            queue_action(app, action, "trayIcon");
        }
        // tray-icon opens the Windows popup from the right-button-down
        // callback and returns from TrackPopupMenu before right-button-up.
        // Probe only after that nested menu loop has returned, otherwise a
        // healthy app with a menu left open would look hung.
        #[cfg(target_os = "windows")]
        (MouseButton::Right, MouseButtonState::Up) => {
            if app
                .state::<NativeActionState>()
                .tray_enabled
                .load(Ordering::Acquire)
            {
                queue_tray_host_probe(app);
            }
        }
        _ => {}
    }
}

#[cfg(target_os = "windows")]
fn queue_tray_host_probe(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) =
            ensure_host_event_loop_for_recovery(&app, "tray-menu-host-loop-timeout").await
        {
            log::warn!(
                target: "snow-shot-recovery",
                "[native_action] tray menu host probe failed: {error}"
            );
        }
    });
}

pub fn handle_single_instance(app: &AppHandle) {
    queue_action(app, ACTION_SHOW_MAIN_WINDOW.to_owned(), "singleInstance");
}

pub(crate) fn handle_runtime_session_event(app: &AppHandle, event: RuntimeSessionEvent) {
    let state = app.state::<NativeActionState>();
    if state.shutdown_requested() {
        return;
    }
    let Some(transition) = state.begin_runtime_session_recovery(event) else {
        log::info!(target: "snow-shot-recovery", "[native_action] coalesced {} into the active session recovery", event.as_str());
        return;
    };
    log_runtime_session_transition(event, transition);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        run_runtime_session_recovery(&app, event).await;
    });
}

fn log_runtime_session_transition(
    event: RuntimeSessionEvent,
    transition: RuntimeSessionTransition,
) {
    log::warn!(target: "snow-shot-recovery",
        "[native_action] invalidated runtime session on {} (generation {} -> {}, {} draw runtime(s))",
        event.as_str(),
        transition.previous_generation,
        transition.current_generation,
        transition.invalidated_draw_count
    );
}

async fn run_runtime_session_recovery(app: &AppHandle, event: RuntimeSessionEvent) {
    let state = app.state::<NativeActionState>();
    let _dispatch_guard = state.action_dispatch_lock.lock().await;
    loop {
        if let Err(error) = settle_pending_system_recovery(&app).await {
            log::error!(target: "snow-shot-recovery",
                "[native_action] runtime recovery after {} failed: {error}",
                event.as_str()
            );
        }

        if state.take_runtime_session_dirty() {
            if !runtime_session_is_healthy(app).await {
                log_runtime_session_transition(event, state.invalidate_runtime_session(event));
            }
            continue;
        }

        if state.finish_or_reclaim_runtime_session_recovery() {
            if !runtime_session_is_healthy(app).await {
                log_runtime_session_transition(event, state.invalidate_runtime_session(event));
            }
            continue;
        }
        break;
    }
}

async fn runtime_session_is_healthy(app: &AppHandle) -> bool {
    let requirement = if app
        .state::<NativeActionState>()
        .ready_draw_runtime_identity()
        .is_some()
    {
        RuntimeRequirement::Draw
    } else {
        RuntimeRequirement::Main
    };
    matches!(claim_runtime(app, requirement).await, Ok(true))
}

fn queue_action(app: &AppHandle, action: String, source: &'static str) {
    let state = app.state::<NativeActionState>();
    if state.terminal_process_recovery_started() || state.shutdown_requested() {
        return;
    }
    if action == ACTION_EXIT {
        // Mark shutdown only from the actual ExitRequested callback.  Setting
        // it here would strand a still-running process if the host event loop
        // is the very thing that failed to deliver app.exit(0).
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            crate::core::exit_app(app).await;
        });
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = dispatch_action(&app, &action, source).await {
            log::error!(target: "snow-shot-recovery", "[native_action] {source} action {action} failed: {error}");
        }
    });
}

fn sync_main_tray_on_main_thread(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<NativeActionState>();
    if !state.tray_enabled.load(Ordering::Acquire) {
        if app.remove_tray_by_id(TRAY_ICON_ID).is_some() {
            log::info!(target: "snow-shot-recovery", "[native_action] removed native tray after intentional disable");
        }
        return Ok(());
    }

    if app.tray_by_id(TRAY_ICON_ID).is_some() {
        return Ok(());
    }

    let mut menu_builder = MenuBuilder::new(app);
    for (id, text) in FALLBACK_TRAY_MENU_ITEMS {
        menu_builder = menu_builder.text(id, text);
    }
    let menu = menu_builder
        .build()
        .map_err(|error| format!("failed to build fallback tray menu: {error}"))?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "default window icon is unavailable for the tray".to_owned())?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Snow Shot")
        .build(app)
        .map_err(|error| format!("failed to create native fallback tray icon: {error}"))?;
    log::info!(target: "snow-shot-recovery", "[native_action] created persistent native fallback tray icon");
    Ok(())
}

pub fn ensure_main_tray_during_setup(app: &AppHandle) -> Result<(), String> {
    sync_main_tray_on_main_thread(app)
}

pub async fn ensure_main_tray(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<NativeActionState>();
    let _tray_guard = state.tray_mutation_lock.lock().await;
    let app_for_mutation = app.clone();
    let (sender, receiver) = oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(sync_main_tray_on_main_thread(&app_for_mutation));
    })
    .map_err(|error| format!("failed to schedule tray mutation: {error}"))?;

    match tokio::time::timeout(TRAY_MUTATION_TIMEOUT, receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("main-thread tray mutation was cancelled".to_owned()),
        Err(_) => Err(format!(
            "main-thread tray mutation timed out after {} ms",
            TRAY_MUTATION_TIMEOUT.as_millis()
        )),
    }
}

async fn ensure_main_tray_for_recovery(
    app: &AppHandle,
    context: &'static str,
) -> Result<(), String> {
    let mut last_error = None;
    for attempt in 1..=2 {
        match ensure_main_tray(app).await {
            Ok(()) => return Ok(()),
            Err(error) => {
                log::warn!(target: "snow-shot-recovery", "[native_action] {context} (host check {attempt}/2): {error}");
                if !is_host_tray_roundtrip_failure(&error) {
                    return Err(error);
                }
                last_error = Some(error);
            }
        }
    }

    trigger_terminal_process_recovery(app, context);
    Err(last_error.unwrap_or_else(|| "main-thread tray mutation failed".to_owned()))
}

fn is_host_tray_roundtrip_failure(error: &str) -> bool {
    error.starts_with("failed to schedule tray mutation:")
        || error.starts_with("main-thread tray mutation timed out")
        || error == "main-thread tray mutation was cancelled"
}

fn trigger_terminal_process_recovery(app: &AppHandle, reason: &'static str) {
    let state = app.state::<NativeActionState>();
    if !state.shutdown_requested() && state.begin_terminal_process_recovery() {
        crate::process_recovery::restart_after_terminal_failure(reason);
    }
}

async fn settle_pending_system_recovery(app: &AppHandle) -> Result<bool, String> {
    let mut settled = false;
    loop {
        let pending_draw_labels = {
            app.state::<NativeActionState>()
                .take_pending_system_recovery()
        };
        let Some(pending_draw_labels) = pending_draw_labels else {
            return Ok(settled);
        };

        destroy_draw_runtime_windows(app, pending_draw_labels).await;
        ensure_main_tray_for_recovery(app, "session-recovery-tray-main-thread-timeout").await?;
        recover_main_runtime(app, false, None, RuntimeRequirement::Main).await?;
        settled = true;
    }
}

async fn dispatch_action(app: &AppHandle, action: &str, source: &str) -> Result<(), String> {
    let state = app.state::<NativeActionState>();
    let _dispatch_guard = state.action_dispatch_lock.lock().await;
    if state.terminal_process_recovery_started() || state.shutdown_requested() {
        return Err("terminal process recovery is already in progress".to_owned());
    }
    settle_pending_system_recovery(app).await?;

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
    let mut delivery_runtime_id =
        ensure_action_runtime_claim(app, show_main, requirement, action).await?;
    if settle_pending_system_recovery(app).await? {
        delivery_runtime_id =
            ensure_action_runtime_claim(app, show_main, requirement, action).await?;
    }

    match emit_action_and_wait_for_ack(app, action, source, &delivery_runtime_id, requirement).await
    {
        Ok(true) => Ok(()),
        Ok(false) => {
            app.state::<NativeActionState>()
                .invalidate_main_action_channel(&delivery_runtime_id);
            // A stale ready/claim handshake can otherwise leave a process
            // looking alive when the host queue is the part that stopped
            // dispatching.  Probe the host after the bounded ACK wait; a
            // healthy host simply leaves the runtime invalidated for the next
            // action, while a dead host enters terminal process recovery.
            let _ = ensure_host_event_loop_for_recovery(app, "native-action-ack-host-loop-timeout")
                .await;
            Err(format!(
                "main WebView did not acknowledge {action}; the action was not retried"
            ))
        }
        Err(error) => {
            app.state::<NativeActionState>()
                .invalidate_main_action_channel(&delivery_runtime_id);
            let _ = ensure_host_event_loop_for_recovery(
                app,
                "native-action-delivery-host-loop-timeout",
            )
            .await;
            Err(format!(
                "failed to deliver {action}; the action was not retried: {error}"
            ))
        }
    }
}

async fn ensure_action_runtime_claim(
    app: &AppHandle,
    show_main: bool,
    requirement: RuntimeRequirement,
    action: &str,
) -> Result<String, String> {
    ensure_main_runtime(app, show_main, requirement).await?;
    let runtime_id = app
        .state::<NativeActionState>()
        .ready_main_runtime_id(requirement)
        .ok_or_else(|| "main WebView action channel is not ready".to_owned())?;

    let claimed = match claim_runtime(app, requirement).await {
        Ok(claimed) => claimed,
        Err(error) => {
            log::warn!(target: "snow-shot-recovery",
                "[native_action] runtime preflight for {action} failed before recovery: {error}"
            );
            false
        }
    };
    if claimed {
        return Ok(runtime_id);
    }

    log::warn!(target: "snow-shot-recovery", "[native_action] runtime preflight for {action} was not acknowledged; recovering");
    recover_main_runtime(app, show_main, Some(&runtime_id), requirement).await?;
    app.state::<NativeActionState>()
        .ready_main_runtime_id(requirement)
        .ok_or_else(|| "recovered WebView action channel is not ready".to_owned())
}

async fn show_main_window(app: &AppHandle, toggle: bool) -> Result<(), String> {
    ensure_host_event_loop_for_recovery(app, "show-main-window-host-loop-timeout").await?;
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
    let state = app.state::<NativeActionState>();
    if state.ready_main_runtime_id(requirement).is_none() {
        let _ = wait_for_runtime_ready(app, WAKE_GRACE_PERIOD, requirement).await;
    }
    let failed_runtime_id = state.ready_main_runtime_id(requirement);
    if failed_runtime_id.is_some() {
        match probe_main_runtime(app).await {
            Ok(true) => return Ok(()),
            Ok(false) => {
                log::warn!(target: "snow-shot-recovery", "[native_action] shown main runtime did not acknowledge preflight");
            }
            Err(error) => {
                log::warn!(target: "snow-shot-recovery", "[native_action] shown main runtime preflight failed: {error}");
            }
        }
    }

    recover_main_runtime(app, true, failed_runtime_id.as_deref(), requirement).await
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

async fn ensure_host_event_loop_for_recovery(
    app: &AppHandle,
    reason: &'static str,
) -> Result<(), String> {
    let mut last_error = None;
    for attempt in 1..=2 {
        let (sender, receiver) = oneshot::channel();
        if let Err(error) = app.run_on_main_thread(move || {
            let _ = sender.send(());
        }) {
            last_error = Some(format!("failed to schedule host probe: {error}"));
        } else if tokio::time::timeout(TRAY_MUTATION_TIMEOUT, receiver)
            .await
            .is_ok()
        {
            return Ok(());
        } else {
            last_error = Some(format!(
                "host event-loop probe timed out after {} ms",
                TRAY_MUTATION_TIMEOUT.as_millis()
            ));
        }

        log::warn!(
            target: "snow-shot-recovery",
            "[native_action] {reason} (host probe {attempt}/2): {}",
            last_error.as_deref().unwrap_or("host probe failed")
        );
    }

    trigger_terminal_process_recovery(app, reason);
    Err(last_error.unwrap_or_else(|| "host event-loop probe failed".to_owned()))
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
        match claim_runtime(app, requirement).await {
            Ok(true) => return Ok(()),
            Ok(false) => {
                log::warn!(target: "snow-shot-recovery", "[native_action] ready runtime did not acknowledge recovery preflight");
            }
            Err(error) => {
                log::warn!(target: "snow-shot-recovery", "[native_action] ready runtime recovery preflight failed: {error}");
            }
        }
    }

    destroy_draw_runtime_windows(app, Vec::new()).await;
    state.clear_main_runtime();
    ensure_main_tray_for_recovery(app, "runtime-recovery-tray-main-thread-timeout").await?;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        stop_window_input_services(app, MAIN_WINDOW_LABEL).await;
        if show_main {
            let _ = wake_main_window(&window);
        }
        let reloaded = window.reload().is_ok()
            && wait_for_runtime_ready(app, runtime_ready_timeout(requirement, false), requirement)
                .await;
        if reloaded && matches!(claim_runtime(app, requirement).await, Ok(true)) {
            if show_main {
                wake_main_window(&window)?;
            }
            return Ok(());
        }
        log::warn!(target: "snow-shot-recovery", "[native_action] reload did not restore a claimable runtime; rebuilding main");
    }

    rebuild_main_window(app, show_main, requirement).await?;
    if claim_runtime(app, requirement).await? {
        Ok(())
    } else {
        Err("rebuilt WebView runtime did not acknowledge recovery preflight".to_owned())
    }
}

async fn stop_window_input_services(app: &AppHandle, window_label: &str) {
    {
        let service = app.state::<AsyncMutex<ListenKeyService>>();
        let mut service = service.lock().await;
        if let Err(error) = service.stop_by_window_label(window_label) {
            log::warn!(target: "snow-shot-recovery", "[native_action] failed to stop key listener for {window_label}: {error}");
        }
    }
    {
        let service = app.state::<AsyncMutex<ListenMouseService>>();
        let mut service = service.lock().await;
        if let Err(error) = service.stop_by_window_label(window_label) {
            log::warn!(target: "snow-shot-recovery", "[native_action] failed to stop mouse listener for {window_label}: {error}");
        }
    }
}

async fn destroy_draw_runtime_windows(app: &AppHandle, mut window_labels: Vec<String>) {
    window_labels.extend(app.state::<NativeActionState>().drain_draw_runtime_labels());
    window_labels.extend(
        app.webview_windows()
            .into_keys()
            .filter(|label| label.starts_with(DRAW_WINDOW_LABEL_PREFIX)),
    );
    window_labels.sort_unstable();
    window_labels.dedup();

    for window_label in window_labels {
        stop_window_input_services(app, &window_label).await;
        if let Some(window) = app.get_webview_window(&window_label)
            && let Err(error) = window.destroy()
        {
            log::warn!(target: "snow-shot-recovery",
                "[native_action] failed to destroy stale draw window {window_label}: {error}"
            );
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
    let rebuild_flag = MainRebuildFlagGuard::new(&state);
    destroy_draw_runtime_windows(app, Vec::new()).await;
    state.clear_main_runtime();
    ensure_main_tray_for_recovery(app, "main-rebuild-tray-main-thread-timeout").await?;

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW_LABEL)
        .cloned()
        .ok_or_else(|| "main window config not found".to_owned())?;

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        stop_window_input_services(app, MAIN_WINDOW_LABEL).await;
        let destroyed = state.register_window_destroyed_waiter(MAIN_WINDOW_LABEL);
        if let Err(error) = window.destroy() {
            state.remove_window_destroyed_waiter(MAIN_WINDOW_LABEL);
            if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
                trigger_terminal_process_recovery(app, "main-window-destroy-failed");
            }
            return Err(format!("failed to destroy unhealthy main window: {error}"));
        }
        let destroyed_event = matches!(
            tokio::time::timeout(Duration::from_secs(2), destroyed).await,
            Ok(Ok(()))
        );
        state.remove_window_destroyed_waiter(MAIN_WINDOW_LABEL);
        if !destroyed_event && app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
            trigger_terminal_process_recovery(app, "main-window-destroy-timeout");
            return Err("unhealthy main window did not close in time".to_owned());
        }
    }

    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| format!("failed to create main window builder: {error}"))?
        .build()
        .map_err(|error| format!("failed to rebuild main window: {error}"))?;
    crate::configure_main_window(&window);

    if show_main {
        wake_main_window(&window)?;
    }
    if !wait_for_runtime_ready(app, runtime_ready_timeout(requirement, true), requirement).await {
        return Err("rebuilt main WebView did not become ready in time".to_owned());
    }
    rebuild_flag.finish();

    Ok(window)
}

async fn wait_for_runtime_ready(
    app: &AppHandle,
    timeout: Duration,
    requirement: RuntimeRequirement,
) -> bool {
    let state = app.state::<NativeActionState>();
    if state.ready_main_runtime_id(requirement).is_some() {
        return true;
    }

    let (waiter_id, receiver) = state.register_runtime_ready_waiter(requirement);
    let _ = tokio::time::timeout(timeout, receiver).await;
    state.remove_runtime_ready_waiter(waiter_id);
    state.ready_main_runtime_id(requirement).is_some()
}

async fn claim_runtime(app: &AppHandle, requirement: RuntimeRequirement) -> Result<bool, String> {
    if !probe_main_runtime(app).await? {
        return Ok(false);
    }
    if requirement == RuntimeRequirement::Draw && !probe_draw_runtime(app).await? {
        return Ok(false);
    }
    Ok(true)
}

async fn probe_main_runtime(app: &AppHandle) -> Result<bool, String> {
    let state = app.state::<NativeActionState>();
    let Some((document_id, session_generation)) = state.ready_main_runtime_identity() else {
        return Ok(false);
    };
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(false);
    };

    let probe_id = state.next_probe_id();
    let (sender, receiver) = oneshot::channel();
    if !state.insert_pending_main_probe(probe_id, &document_id, session_generation, sender) {
        return Ok(false);
    }

    let probe = NativeMainRuntimeProbe {
        probe_id,
        document_id,
    };
    if let Err(error) = window.emit("native-main-runtime-probe", probe) {
        state
            .pending_main_probes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&probe_id);
        return Err(format!("failed to emit main runtime probe: {error}"));
    }

    let acknowledged = matches!(
        tokio::time::timeout(MAIN_RUNTIME_PROBE_TIMEOUT, receiver).await,
        Ok(Ok(()))
    );
    state
        .pending_main_probes
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&probe_id);
    Ok(acknowledged)
}

async fn probe_draw_runtime(app: &AppHandle) -> Result<bool, String> {
    let state = app.state::<NativeActionState>();
    let Some(identity) = state.ready_draw_runtime_identity() else {
        return Ok(false);
    };
    let Some(window) = app.get_webview_window(&identity.window_label) else {
        return Ok(false);
    };

    let probe_id = state.next_probe_id();
    let (sender, receiver) = oneshot::channel();
    if !state.insert_pending_draw_probe(probe_id, &identity, sender) {
        return Ok(false);
    }

    let probe = NativeDrawRuntimeProbe {
        probe_id,
        document_id: identity.document_id,
    };
    if let Err(error) = window.emit("native-draw-runtime-probe", probe) {
        state
            .pending_draw_probes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&probe_id);
        return Err(format!("failed to emit draw runtime probe: {error}"));
    }

    let acknowledged = matches!(
        tokio::time::timeout(DRAW_RUNTIME_PROBE_TIMEOUT, receiver).await,
        Ok(Ok(()))
    );
    state
        .pending_draw_probes
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&probe_id);
    Ok(acknowledged)
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
        draw_window_label: match requirement {
            RuntimeRequirement::Main => None,
            RuntimeRequirement::Draw => {
                let Some(identity) = state.ready_draw_runtime_identity() else {
                    state
                        .pending_acks
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .remove(&request_id);
                    return Ok(false);
                };
                Some(identity.window_label)
            }
        },
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
pub async fn native_tray_set_enabled(
    app: AppHandle,
    state: State<'_, NativeActionState>,
    enabled: bool,
) -> Result<(), String> {
    state.tray_enabled.store(enabled, Ordering::Release);
    ensure_main_tray(&app).await
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
pub fn native_main_runtime_probe_ack(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    probe_id: u64,
    document_id: String,
) -> Result<bool, String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err(
            "main runtime probe acknowledgements must come from the main window".to_owned(),
        );
    }

    Ok(state.acknowledge_main_probe(probe_id, &document_id))
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
pub fn native_draw_runtime_probe_ack(
    state: State<'_, NativeActionState>,
    window: WebviewWindow,
    probe_id: u64,
    document_id: String,
) -> Result<bool, String> {
    if !window.label().starts_with(DRAW_WINDOW_LABEL_PREFIX) {
        return Err("draw runtime probe acknowledgements must come from a draw window".to_owned());
    }

    Ok(state.acknowledge_draw_probe(window.label(), probe_id, &document_id))
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
        assert_eq!(menu_id_to_action("main-exit"), Some(ACTION_EXIT));
        assert!(
            FALLBACK_TRAY_MENU_ITEMS
                .iter()
                .all(|(menu_id, _)| menu_id_to_action(menu_id).is_some())
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
    fn recovery_only_reuses_a_different_ready_runtime_after_a_failed_claim() {
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
    fn terminal_process_recovery_is_a_one_way_circuit_breaker() {
        let state = NativeActionState::default();
        assert!(state.begin_terminal_process_recovery());
        assert!(!state.begin_terminal_process_recovery());
        assert!(state.terminal_process_recovery_started());
    }

    #[test]
    fn tray_recovery_only_escalates_host_roundtrip_failures() {
        assert!(is_host_tray_roundtrip_failure(
            "main-thread tray mutation timed out after 2000 ms"
        ));
        assert!(is_host_tray_roundtrip_failure(
            "failed to schedule tray mutation: event loop closed"
        ));
        assert!(is_host_tray_roundtrip_failure(
            "main-thread tray mutation was cancelled"
        ));
        assert!(!is_host_tray_roundtrip_failure(
            "failed to build fallback tray menu: invalid item"
        ));
        assert!(!is_host_tray_roundtrip_failure(
            "default window icon is unavailable for the tray"
        ));
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

    #[test]
    fn system_session_transition_invalidates_main_draw_and_pending_ack_state() {
        let state = NativeActionState::default();
        state.start_main_runtime("main-before-resume".to_owned());
        assert!(state.mark_main_runtime_ready("main-before-resume"));
        state.start_draw_runtime("draw-7".to_owned(), "draw-before-resume".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-7", "draw-before-resume"));
        assert!(state.bind_draw_runtime("main-before-resume", "draw-7"));

        let (sender, mut receiver) = oneshot::channel();
        assert!(state.insert_pending_ack(41, "main-before-resume", sender));

        let transition = state.invalidate_runtime_session(RuntimeSessionEvent::SessionUnlock);
        assert_eq!(
            transition,
            RuntimeSessionTransition {
                previous_generation: 1,
                current_generation: 2,
                invalidated_draw_count: 1,
            }
        );
        assert_eq!(state.current_session_generation(), 2);
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Main), None);
        assert_eq!(state.ready_main_runtime_id(RuntimeRequirement::Draw), None);
        assert!(!state.mark_main_runtime_ready("main-before-resume"));
        assert!(receiver.try_recv().is_err());
        assert_eq!(
            state.take_pending_system_recovery(),
            Some(vec!["draw-7".to_owned()])
        );
        assert_eq!(state.take_pending_system_recovery(), None);

        state.start_main_runtime("main-after-resume".to_owned());
        assert!(state.mark_main_runtime_ready("main-after-resume"));
        state.start_draw_runtime("draw-8".to_owned(), "draw-after-resume".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-8", "draw-after-resume"));
        assert!(state.bind_draw_runtime("main-after-resume", "draw-8"));
        assert_eq!(
            state
                .ready_main_runtime_id(RuntimeRequirement::Draw)
                .as_deref(),
            Some("main-after-resume")
        );
    }

    #[test]
    fn session_transition_preserves_intentional_tray_setting() {
        let state = NativeActionState::default();
        assert!(state.tray_enabled.load(Ordering::Acquire));
        state.tray_enabled.store(false, Ordering::Release);
        state.invalidate_runtime_session(RuntimeSessionEvent::PowerResume);
        assert!(!state.tray_enabled.load(Ordering::Acquire));
    }

    #[test]
    fn session_event_burst_coalesces_without_repeated_generation_bumps() {
        let state = NativeActionState::default();
        assert!(
            state
                .begin_runtime_session_recovery(RuntimeSessionEvent::SessionUnlock)
                .is_some()
        );
        assert_eq!(state.current_session_generation(), 2);

        assert!(
            state
                .begin_runtime_session_recovery(RuntimeSessionEvent::DisplayChange)
                .is_none()
        );
        assert_eq!(state.current_session_generation(), 2);
        assert!(state.take_runtime_session_dirty());
        assert!(!state.take_runtime_session_dirty());

        assert!(
            state
                .begin_runtime_session_recovery(RuntimeSessionEvent::RemoteConnect)
                .is_none()
        );
        assert_eq!(state.current_session_generation(), 2);
        assert!(state.finish_or_reclaim_runtime_session_recovery());
        assert!(!state.finish_or_reclaim_runtime_session_recovery());
    }

    #[test]
    fn draw_probe_ack_is_bound_to_current_window_document_and_generation() {
        let state = NativeActionState::default();
        state.start_main_runtime("main".to_owned());
        assert!(state.mark_main_runtime_ready("main"));
        state.start_draw_runtime("draw-3".to_owned(), "draw-document".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-3", "draw-document"));
        assert!(state.bind_draw_runtime("main", "draw-3"));
        let identity = state.ready_draw_runtime_identity().unwrap();

        let (sender, _receiver) = oneshot::channel();
        assert!(state.insert_pending_draw_probe(71, &identity, sender));
        assert!(!state.acknowledge_draw_probe("draw-other", 71, "draw-document"));
        assert!(!state.acknowledge_draw_probe("draw-3", 71, "document-other"));
        assert!(state.acknowledge_draw_probe("draw-3", 71, "draw-document"));
        assert!(!state.acknowledge_draw_probe("draw-3", 71, "draw-document"));

        let (sender, mut receiver) = oneshot::channel();
        assert!(state.insert_pending_draw_probe(72, &identity, sender));
        state.start_draw_runtime("draw-3".to_owned(), "replacement-document".to_owned());
        assert!(receiver.try_recv().is_err());
        assert!(!state.acknowledge_draw_probe("draw-3", 72, "draw-document"));
    }

    #[test]
    fn main_probe_ack_is_bound_to_current_document_and_session_generation() {
        let state = NativeActionState::default();
        state.start_main_runtime("main-document".to_owned());
        assert!(state.mark_main_runtime_ready("main-document"));
        let (document_id, session_generation) = state.ready_main_runtime_identity().unwrap();

        let (sender, _receiver) = oneshot::channel();
        assert!(state.insert_pending_main_probe(81, &document_id, session_generation, sender,));
        assert!(!state.acknowledge_main_probe(81, "other-document"));
        assert!(state.acknowledge_main_probe(81, "main-document"));
        assert!(!state.acknowledge_main_probe(81, "main-document"));

        let (sender, mut receiver) = oneshot::channel();
        assert!(state.insert_pending_main_probe(82, &document_id, session_generation, sender,));
        state.invalidate_runtime_session(RuntimeSessionEvent::RemoteConnect);
        assert!(receiver.try_recv().is_err());
        assert!(!state.acknowledge_main_probe(82, "main-document"));
    }

    #[test]
    fn runtime_ready_waiters_are_driven_by_matching_state_transitions() {
        let state = NativeActionState::default();
        let (main_waiter_id, mut main_ready) =
            state.register_runtime_ready_waiter(RuntimeRequirement::Main);
        state.start_main_runtime("main".to_owned());
        assert!(state.mark_main_runtime_ready("main"));
        assert!(matches!(main_ready.try_recv(), Ok(())));
        state.remove_runtime_ready_waiter(main_waiter_id);

        let (draw_waiter_id, mut draw_ready) =
            state.register_runtime_ready_waiter(RuntimeRequirement::Draw);
        state.start_draw_runtime("draw-9".to_owned(), "draw".to_owned());
        assert!(state.mark_draw_runtime_ready("draw-9", "draw"));
        assert!(draw_ready.try_recv().is_err());
        assert!(state.bind_draw_runtime("main", "draw-9"));
        assert!(matches!(draw_ready.try_recv(), Ok(())));
        state.remove_runtime_ready_waiter(draw_waiter_id);
    }

    #[test]
    fn destroyed_window_transition_notifies_registered_waiter() {
        let state = NativeActionState::default();
        let mut destroyed = state.register_window_destroyed_waiter(MAIN_WINDOW_LABEL);
        state.remove_window_runtime(MAIN_WINDOW_LABEL);
        assert!(matches!(destroyed.try_recv(), Ok(())));
    }
}
