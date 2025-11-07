use device_query::{DeviceQuery, MouseButton, MousePosition};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, PhysicalPosition, PhysicalSize};

use crate::device_event_handler_service::DeviceEventHandlerService;

#[derive(Serialize, Deserialize, Clone)]
pub enum ResizeWindowSide {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Serialize, Clone)]
pub struct ResizeWindowEvent {
    pub size: PhysicalSize<u32>,
    pub label: String,
}

pub struct ResizeWindowService {
    /* 目标窗口 */
    target_window: Arc<Mutex<Option<tauri::Window>>>,
    _mouse_move_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    _mouse_up_guard: Arc<Mutex<Option<Box<dyn std::any::Any + Send>>>>,
    device_event_handler: Arc<Mutex<DeviceEventHandlerService>>,
}

impl ResizeWindowService {
    pub fn new() -> Self {
        let mut device_event_handler = DeviceEventHandlerService::new();
        device_event_handler.set_fps(30);

        return Self {
            target_window: Arc::new(Mutex::new(None)),
            _mouse_move_guard: Arc::new(Mutex::new(None)),
            _mouse_up_guard: Arc::new(Mutex::new(None)),
            device_event_handler: Arc::new(Mutex::new(device_event_handler)),
        };
    }

    pub fn start_resize(
        &mut self,
        window: tauri::Window,
        side: ResizeWindowSide,
        aspect_ratio: f64,
        min_width: f64,
        max_width: f64,
    ) -> Result<(), String> {
        self.stop_resize();

        // 计算当前鼠标相对窗口的位置
        // windows 下获取的是物理像素，macOS 下获取的是逻辑像素
        // 为了方便处理，计算时 windows 下用物理像素，macOS 下用逻辑像素
        let (mouse_x, mouse_y) = snow_shot_app_utils::get_device_state()?.get_mouse().coords;
        let (mouse_x, mouse_y) = (mouse_x as f64, mouse_y as f64);

        let window_position = match window.outer_position() {
            Ok(position) => position,
            Err(_) => {
                return Err(String::from(
                    "[ResizeWindowService] Could not get window position",
                ));
            }
        };
        let window_size = match window.outer_size() {
            Ok(size) => size,
            Err(_) => {
                return Err(String::from(
                    "[ResizeWindowService] Could not get window size",
                ));
            }
        };
        let window_label = window.label().to_owned();

        #[cfg(target_os = "macos")]
        let window_x;
        #[cfg(target_os = "macos")]
        let window_y;
        #[cfg(target_os = "macos")]
        let window_width;
        #[cfg(target_os = "macos")]
        let window_height;

        #[cfg(not(target_os = "macos"))]
        let window_x = window_position.x as f64;
        #[cfg(not(target_os = "macos"))]
        let window_y = window_position.y as f64;
        #[cfg(not(target_os = "macos"))]
        let window_width = window_size.width as f64;
        #[cfg(not(target_os = "macos"))]
        let window_height = window_size.height as f64;

        #[cfg(target_os = "macos")]
        {
            let scale_factor = window.scale_factor().unwrap_or(1.0);
            let logical_window_positon: tauri::LogicalPosition<f64> =
                window_position.to_logical(scale_factor);
            let logical_window_size: tauri::LogicalSize<f64> = window_size.to_logical(scale_factor);
            window_x = logical_window_positon.x as f64;
            window_y = logical_window_positon.y as f64;
            window_width = logical_window_size.width as f64;
            window_height = logical_window_size.height as f64;
        }

        self.target_window = Arc::new(Mutex::new(Some(window)));

        // 监听鼠标移动事件
        // 克隆需要在闭包中使用的变量
        let target_window = Arc::clone(&self.target_window);
        let origin_mouse_position = Arc::new((mouse_x, mouse_y));
        let origin_window_position = Arc::new((window_x, window_y));
        let origin_window_size = Arc::new((window_width, window_height));
        let window_label = Arc::new(window_label);

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

                let delta_mouse_position = (
                    position.0 as f64 - origin_mouse_position.0,
                    position.1 as f64 - origin_mouse_position.1,
                );

                let (new_size, new_position): (PhysicalSize<u32>, Option<PhysicalPosition<f64>>) =
                    match side {
                        ResizeWindowSide::Right => {
                            // 固定点：左上角
                            // 此时窗口位置保持不变，只改变窗口宽高
                            let delta_width = delta_mouse_position.0;
                            let new_width = (origin_window_size.0 + delta_width)
                                .max(min_width)
                                .min(max_width);
                            let new_height = new_width * aspect_ratio;

                            (
                                PhysicalSize::new(
                                    new_width.round() as u32,
                                    new_height.round() as u32,
                                ),
                                None,
                            )
                        }
                        ResizeWindowSide::Bottom => {
                            // 固定点：左上角
                            // 此时窗口位置保持不变，只改变窗口宽高
                            let delta_height = delta_mouse_position.1;
                            let new_height = (origin_window_size.1 + delta_height)
                                .max(min_width * aspect_ratio)
                                .min(max_width * aspect_ratio);
                            let new_width = new_height / aspect_ratio;

                            (
                                PhysicalSize::new(
                                    new_width.round() as u32,
                                    new_height.round() as u32,
                                ),
                                None,
                            )
                        }
                        ResizeWindowSide::Left => {
                            // 固定点：右上角
                            // 先计算新的宽高
                            let delta_width = -delta_mouse_position.0; // 向左拖动为正
                            let new_width = (origin_window_size.0 + delta_width)
                                .max(min_width)
                                .min(max_width);
                            let new_height = new_width * aspect_ratio;

                            // 再计算新的位置，保持右上角固定
                            let width_delta = origin_window_size.0 - new_width;
                            let new_x = origin_window_position.0 + width_delta;
                            let new_y = origin_window_position.1;

                            (
                                PhysicalSize::new(
                                    new_width.round() as u32,
                                    new_height.round() as u32,
                                ),
                                Some(PhysicalPosition::new(new_x, new_y)),
                            )
                        }
                        ResizeWindowSide::Top => {
                            // 固定点：左下角
                            // 先计算新的宽高
                            let delta_height = -delta_mouse_position.1; // 向上拖动为正
                            let new_height = (origin_window_size.1 + delta_height)
                                .max(min_width * aspect_ratio)
                                .min(max_width * aspect_ratio);
                            let new_width = new_height / aspect_ratio;

                            // 再计算新的位置，保持左下角固定
                            let height_delta = origin_window_size.1 - new_height;
                            let new_x = origin_window_position.0;
                            let new_y = origin_window_position.1 + height_delta;

                            (
                                PhysicalSize::new(
                                    new_width.round() as u32,
                                    new_height.round() as u32,
                                ),
                                Some(PhysicalPosition::new(new_x, new_y)),
                            )
                        }
                    };

                #[cfg(target_os = "macos")]
                {
                    if let Some(new_position) = new_position {
                        match target_window.set_position(tauri::LogicalPosition::new(
                            new_position.x,
                            new_position.y,
                        )) {
                            Ok(_) => {}
                            Err(_) => {
                                log::error!(
                                    "[ResizeWindowService] Failed to set window position: {:?}",
                                    new_position
                                );
                            }
                        }
                    }
                    match target_window
                        .set_size(tauri::LogicalSize::new(new_size.width, new_size.height))
                    {
                        Ok(_) => {}
                        Err(_) => {
                            log::error!(
                                "[ResizeWindowService] Failed to set window size: {:?}",
                                new_size
                            );
                        }
                    }
                }

                #[cfg(not(target_os = "macos"))]
                {
                    if let Some(new_position) = new_position {
                        match target_window.set_position(new_position) {
                            Ok(_) => {}
                            Err(_) => {
                                log::error!(
                                    "[ResizeWindowService] Failed to set window position: {:?}",
                                    new_position
                                );
                            }
                        }
                    }
                    match target_window.set_size(new_size) {
                        Ok(_) => {}
                        Err(_) => {
                            log::error!(
                                "[ResizeWindowService] Failed to set window size: {:?}",
                                new_size
                            );
                        }
                    }
                }

                target_window
                    .emit(
                        "resize-window-service:resize-window",
                        ResizeWindowEvent {
                            size: new_size,
                            label: window_label.to_string(),
                        },
                    )
                    .unwrap();
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
                        Self::stop_resize_core(
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

    fn stop_resize_core(
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

    pub fn stop_resize(&mut self) {
        Self::stop_resize_core(
            &self.target_window,
            &self._mouse_move_guard,
            &self._mouse_up_guard,
            &self.device_event_handler,
        );
    }
}
