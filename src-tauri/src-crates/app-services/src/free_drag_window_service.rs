use device_query::{DeviceQuery, MouseButton, MousePosition};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use crate::device_event_handler_service::DeviceEventHandlerService;

pub struct FreeDragWindowService {
    /* 目标窗口 */
    target_window: Arc<Mutex<Option<tauri::Window>>>,
    _mouse_move_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    _mouse_up_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    device_event_handler: Arc<Mutex<DeviceEventHandlerService>>,
}

#[derive(Serialize, Clone)]
pub struct FreeDragWindowStopEvent {
    pub label: String,
}

impl FreeDragWindowService {
    pub fn new() -> Self {
        return Self {
            target_window: Arc::new(Mutex::new(None)),
            _mouse_move_guard: Arc::new(Mutex::new(None)),
            _mouse_up_guard: Arc::new(Mutex::new(None)),
            device_event_handler: Arc::new(Mutex::new(DeviceEventHandlerService::new())),
        };
    }

    pub fn start_drag(&mut self, window: tauri::Window) -> Result<(), String> {
        self.stop_drag();

        // 计算当前鼠标相对窗口的位置
        // windows 下获取的是物理像素，macOS 下获取的是逻辑像素
        // 为了方便处理，计算时 windows 下用物理像素，macOS 下用逻辑像素
        let (mouse_x, mouse_y) = snow_shot_app_utils::get_device_state()?.get_mouse().coords;
        let (mouse_x, mouse_y) = (mouse_x as f64, mouse_y as f64);

        let window_position = match window.outer_position() {
            Ok(position) => position,
            Err(_) => {
                return Err(String::from(
                    "[FreeDragWindowService] Could not get window position",
                ));
            }
        };

        #[cfg(target_os = "macos")]
        let window_x;
        #[cfg(target_os = "macos")]
        let window_y;

        #[cfg(not(target_os = "macos"))]
        let window_x = window_position.x as f64;
        #[cfg(not(target_os = "macos"))]
        let window_y = window_position.y as f64;

        #[cfg(target_os = "macos")]
        {
            let logical_window_positon: tauri::LogicalPosition<f64> =
                window_position.to_logical(window.scale_factor().unwrap_or(1.0));
            window_x = logical_window_positon.x as f64;
            window_y = logical_window_positon.y as f64;
        }

        self.target_window = Arc::new(Mutex::new(Some(window)));

        // 监听鼠标移动事件
        // 克隆需要在闭包中使用的变量
        let target_window = Arc::clone(&self.target_window);
        let relative_position = Arc::new(Mutex::new((mouse_x - window_x, mouse_y - window_y)));

        let mut device_event_handler = self.device_event_handler.lock().unwrap();
        self._mouse_move_guard.lock().unwrap().replace(Box::new(
            device_event_handler.on_mouse_move(move |position: &MousePosition| {
                let target_window = match target_window.lock() {
                    Ok(window) => window,
                    Err(_) => return,
                };
                let target_window = match target_window.as_ref() {
                    Some(window) => window,
                    None => return,
                };

                let relative_position = match relative_position.lock() {
                    Ok(position) => position,
                    Err(_) => return,
                };

                let (mouse_x, mouse_y) = (position.0 as f64, position.1 as f64);

                let (window_x, window_y) =
                    (mouse_x - relative_position.0, mouse_y - relative_position.1);

                #[cfg(target_os = "macos")]
                {
                    let _ =
                        target_window.set_position(tauri::LogicalPosition::new(window_x, window_y));
                }

                #[cfg(not(target_os = "macos"))]
                {
                    let _ = target_window.set_position(tauri::PhysicalPosition::new(
                        window_x as i32,
                        window_y as i32,
                    ));
                }
            })?,
        ));

        // 监听鼠标按钮事件 - 抬起时结束拖动
        let target_window_for_button = Arc::clone(&self.target_window);

        let _mouse_up_guard_clone = Arc::clone(&self._mouse_up_guard);
        let _mouse_move_guard_clone = Arc::clone(&self._mouse_move_guard);
        let device_event_handler_clone = Arc::clone(&self.device_event_handler);
        self._mouse_up_guard
            .lock()
            .unwrap()
            .replace(Box::new(device_event_handler.on_mouse_up(
                move |button: &MouseButton| {
                    // 当鼠标左键抬起时完全停止拖动，清除所有相关状态
                    if *button == 1 {
                        if let Ok(target_window) = target_window_for_button.lock() {
                            if let Some(target_window) = target_window.as_ref() {
                                target_window
                                    .emit(
                                        "free-drag-window-service:stop",
                                        FreeDragWindowStopEvent {
                                            label: target_window.label().to_owned(),
                                        },
                                    )
                                    .unwrap();
                            }
                        }

                        Self::stop_drag_core(
                            &target_window_for_button,
                            &_mouse_move_guard_clone,
                            &_mouse_up_guard_clone,
                            &device_event_handler_clone,
                        );
                    }
                },
            )?));

        Ok(())
    }

    fn stop_drag_core(
        target_window: &Arc<Mutex<Option<tauri::Window>>>,
        mouse_move_guard: &Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
        mouse_up_guard: &Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
        device_event_handler: &Arc<Mutex<DeviceEventHandlerService>>,
    ) {
        let mut target_window_lock = match target_window.lock() {
            Ok(window) => window,
            Err(_) => return,
        };
        *target_window_lock = None;

        let mut mouse_move_guard_lock = match mouse_move_guard.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        *mouse_move_guard_lock = None;
        let mut mouse_up_guard_lock = match mouse_up_guard.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        *mouse_up_guard_lock = None;

        let mut device_event_handler_lock = match device_event_handler.lock() {
            Ok(handler) => handler,
            Err(_) => return,
        };
        device_event_handler_lock.release();
    }

    pub fn stop_drag(&mut self) {
        Self::stop_drag_core(
            &self.target_window,
            &self._mouse_move_guard,
            &self._mouse_up_guard,
            &self.device_event_handler,
        );
    }
}
