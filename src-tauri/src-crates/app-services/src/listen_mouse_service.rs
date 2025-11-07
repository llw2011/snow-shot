use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};

use device_query::MouseButton;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Window};

use crate::device_event_handler_service::DeviceEventHandlerService;

pub struct ListenMouseService {
    _mouse_down_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    _mouse_up_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    window_label_set: Arc<Mutex<HashSet<String>>>,
    device_event_handler: Arc<Mutex<DeviceEventHandlerService>>,
}

#[derive(Serialize, Clone)]
pub struct ListenMouseDownEvent {
    button: usize,
}

#[derive(Serialize, Clone)]
pub struct ListenMouseUpEvent {
    button: usize,
}

impl ListenMouseService {
    pub fn new() -> Self {
        return Self {
            _mouse_down_guard: Arc::new(Mutex::new(None)),
            _mouse_up_guard: Arc::new(Mutex::new(None)),
            window_label_set: Arc::new(Mutex::new(HashSet::new())),
            device_event_handler: Arc::new(Mutex::new(DeviceEventHandlerService::new())),
        };
    }

    pub fn start(&mut self, app_handle: AppHandle, window: Window) -> Result<(), String> {
        let mut window_label_set_lock = match self.window_label_set.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::start] Failed to lock window_label_set: {}",
                    err
                ));
            }
        };
        window_label_set_lock.insert(window.label().to_owned());

        let mut mouse_down_guard_lock = match self._mouse_down_guard.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::start] Failed to lock mouse_down_guard: {}",
                    err
                ));
            }
        };

        let mut device_event_handler = self.device_event_handler.lock().unwrap();
        if mouse_down_guard_lock.is_none() {
            let mouse_down_app_handle = app_handle.clone();
            *mouse_down_guard_lock = Some(Box::new(device_event_handler.on_mouse_down(
                move |button: &MouseButton| {
                    match mouse_down_app_handle.emit(
                            "listen-mouse-service:mouse-down",
                        ListenMouseDownEvent { button: *button as usize },
                    ) {
                        Ok(_) => {}
                        Err(_) => {
                            log::error!(
                                "[ListenMouseService::on_mouse_down] Failed to emit listen-mouse-service"
                            );
                        }
                    };
                },
            )?));
        }

        let mut mouse_up_guard_lock = match self._mouse_up_guard.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::start] Failed to lock mouse_up_guard: {}",
                    err
                ));
            }
        };

        if mouse_up_guard_lock.is_none() {
            let mouse_up_app_handle = app_handle.clone();
            *mouse_up_guard_lock = Some(Box::new(device_event_handler.on_mouse_up(
                move |button: &MouseButton| {
                    match mouse_up_app_handle.emit(
                        "listen-mouse-service:mouse-up",
                        ListenMouseUpEvent { button: *button as usize },
                    ) {
                        Ok(_) => {}
                        Err(_) => {
                            log::error!(
                                "[ListenMouseService::on_mouse_up] Failed to emit listen-mouse-service"
                            );
                        }
                    };
                },
            )?));
        }

        Ok(())
    }

    pub fn stop_core(
        mouse_down_guard: &Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
        mouse_up_guard: &Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
        device_event_handler: &Arc<Mutex<DeviceEventHandlerService>>,
        window_label_set: &Arc<Mutex<HashSet<String>>>,
        window_label: &str,
    ) -> Result<(), String> {
        let mut window_label_set_lock = match window_label_set.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::stop_core] Failed to lock window_label_set: {}",
                    err
                ));
            }
        };
        window_label_set_lock.remove(window_label);

        if !window_label_set_lock.is_empty() {
            return Ok(());
        }

        // 没有窗口监听了，清除监听
        let mut mouse_down_guard_lock = match mouse_down_guard.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::stop_core] Failed to lock mouse_down_guard: {}",
                    err
                ));
            }
        };
        *mouse_down_guard_lock = None;

        let mut mouse_up_guard_lock = match mouse_up_guard.lock() {
            Ok(guard) => guard,
            Err(err) => {
                return Err(format!(
                    "[ListenMouseService::stop_core] Failed to lock mouse_up_guard: {}",
                    err
                ));
            }
        };
        *mouse_up_guard_lock = None;

        let mut device_event_handler_lock = match device_event_handler.lock() {
            Ok(handler) => handler,
            Err(_) => {
                return Err(String::from(
                    "[ListenMouseService::stop_core] Failed to lock device_event_handler",
                ));
            }
        };
        device_event_handler_lock.release();

        Ok(())
    }

    pub fn stop_by_window_label(&mut self, window_label: &str) -> Result<(), String> {
        Self::stop_core(
            &self._mouse_down_guard,
            &self._mouse_up_guard,
            &self.device_event_handler,
            &self.window_label_set,
            window_label,
        )
    }
}
