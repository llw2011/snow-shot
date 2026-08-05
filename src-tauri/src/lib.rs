pub mod core;
pub mod file;
pub mod global_state;
pub mod hot_load_page;
pub mod listen_key;
pub mod native_action;
pub mod plugin;
pub mod screenshot;
pub mod scroll_screenshot;
pub mod video_record;
pub mod webview;
#[cfg(target_os = "windows")]
mod windows_session;

use snow_shot_app_services::listen_mouse_service;
use snow_shot_tauri_commands_core::{FullScreenDrawWindowLabels, VideoRecordWindowLabels};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

use tauri::Manager;

use snow_shot_app_os::ui_automation::UIElements;
use snow_shot_app_scroll_screenshot_service::scroll_screenshot_capture_service;
use snow_shot_app_scroll_screenshot_service::scroll_screenshot_image_service;
use snow_shot_app_scroll_screenshot_service::scroll_screenshot_service;
use snow_shot_app_services::file_cache_service;
use snow_shot_app_services::free_drag_window_service;
use snow_shot_app_services::hot_load_page_service;
use snow_shot_app_services::listen_key_service;
use snow_shot_app_services::ocr_service::OcrService;
use snow_shot_app_services::resize_window_service;
use snow_shot_app_services::video_record_service;
use snow_shot_app_shared::EnigoManager;
use snow_shot_global_state::{CaptureState, ReadClipboardState, WebViewSharedBufferState};
use snow_shot_plugin_service::plugin_service;

#[cfg(not(debug_assertions))]
const RECOVERY_LOG_RECORD_LIMIT: usize = 1024;

pub(crate) fn configure_main_window(main_window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    windows_session::install(main_window);

    let window_clone = main_window.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();

            #[cfg(any(target_os = "windows", target_os = "macos"))]
            if let Err(error) = window_clone.hide() {
                log::error!("[configure_main_window] hide window error: {error:?}");
            }

            if let Err(error) = window_clone.emit("on-hide-main-window", ()) {
                log::error!("[configure_main_window] emit hide event error: {error}");
            }
        }
    });
}

#[cfg(feature = "dhat-heap")]
pub static PROFILER: std::sync::LazyLock<Mutex<Option<dhat::Profiler>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ocr_instance = Mutex::new(OcrService::new());
    let video_record_service = Mutex::new(video_record_service::VideoRecordService::new());
    let hot_load_page_service = Arc::new(hot_load_page_service::HotLoadPageService::new());
    let enigo_instance = Mutex::new(EnigoManager::new());

    let ui_elements = Mutex::new(UIElements::new());

    let scroll_screenshot_service =
        Mutex::new(scroll_screenshot_service::ScrollScreenshotService::new());
    let scroll_screenshot_image_service =
        Mutex::new(scroll_screenshot_image_service::ScrollScreenshotImageService::new());
    let scroll_screenshot_capture_service =
        Mutex::new(scroll_screenshot_capture_service::ScrollScreenshotCaptureService::new());
    #[cfg(target_os = "windows")]
    let shared_buffer_service = Arc::new(snow_shot_webview::SharedBufferService::new());

    let free_drag_window_service =
        Mutex::new(free_drag_window_service::FreeDragWindowService::new());
    let resize_window_service = Mutex::new(resize_window_service::ResizeWindowService::new());

    let listen_key_service = Mutex::new(listen_key_service::ListenKeyService::new());
    let listen_mouse_service = Mutex::new(listen_mouse_service::ListenMouseService::new());

    let file_cache_service = Arc::new(file_cache_service::FileCacheService::new());

    let enable_run_log = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let enable_run_log_clone = enable_run_log.clone();
    #[cfg(not(debug_assertions))]
    let recovery_log_records = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

    let plugin_service = Arc::new(plugin_service::PluginService::new());

    let capture_state = Mutex::new(CaptureState { capturing: false });

    let full_screen_draw_window_labels = Mutex::new(Option::<FullScreenDrawWindowLabels>::None);
    let video_record_window_label = Mutex::new(Option::<VideoRecordWindowLabels>::None);

    let webview_shared_buffer_state = WebViewSharedBufferState::new(false);

    let read_clipboard_state = Mutex::new(ReadClipboardState { reading: false });
    let draw_window_ready_state =
        snow_shot_tauri_commands_screenshot::commands::DrawWindowReadyState::default();

    use tauri_plugin_log::{Target, TargetKind};

    // let current_date = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Release 默认只保留不含用户内容的恢复诊断；详细日志仍由用户开关控制。
    // 日志文件必须有界，避免异常循环持续占用磁盘。
    let log_targets: Vec<Target> = if cfg!(debug_assertions) {
        vec![
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ]
    } else {
        vec![Target::new(TargetKind::LogDir { file_name: None })]
    };
    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    #[allow(unused_mut)]
    let mut app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION,
                )
                .with_filter(|label| label == "main")
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            native_action::handle_single_instance(app);
        }))
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--auto_start"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(native_action::handle_shortcut_event)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .max_file_size(128 * 1024)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .targets(log_targets)
                .level(log_level)
                .filter(move |_metadata| {
                    #[cfg(debug_assertions)]
                    {
                        return true;
                    }

                    #[cfg(not(debug_assertions))]
                    {
                        if enable_run_log.load(std::sync::atomic::Ordering::Relaxed) {
                            return true;
                        }
                        return _metadata.target() == "snow-shot-recovery"
                            && recovery_log_records
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
                                < RECOVERY_LOG_RECORD_LIMIT;
                    }
                })
                .build(),
        )
        .setup(|app| {
            let main_window = app
                .get_webview_window("main")
                .expect("[lib::setup] no main window");

            #[cfg(target_os = "macos")]
            {
                // macOS 下不在 dock 显示
                app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
            }

            configure_main_window(&main_window);
            if let Err(error) = native_action::ensure_main_tray_during_setup(app.handle()) {
                log::error!(target: "snow-shot-recovery", "[lib::setup] failed to create native fallback tray: {error}");
            }

            // 如果是调试模式，则显示窗口
            #[cfg(debug_assertions)]
            {
                main_window.show().unwrap();
            }

            Ok(())
        })
        .manage(ui_elements)
        .manage(ocr_instance)
        .manage(enigo_instance)
        .manage(scroll_screenshot_service)
        .manage(scroll_screenshot_image_service)
        .manage(scroll_screenshot_capture_service)
        .manage(video_record_service)
        .manage(free_drag_window_service)
        .manage(resize_window_service)
        .manage(listen_key_service)
        .manage(listen_mouse_service)
        .manage(file_cache_service)
        .manage(enable_run_log_clone)
        .manage(plugin_service)
        .manage(full_screen_draw_window_labels)
        .manage(webview_shared_buffer_state)
        .manage(hot_load_page_service)
        .manage(video_record_window_label)
        .manage(capture_state)
        .manage(read_clipboard_state)
        .manage(draw_window_ready_state)
        .manage(native_action::NativeActionState::default())
        .invoke_handler(tauri::generate_handler![
            snow_shot_tauri_commands_screenshot::commands::capture_current_monitor,
            snow_shot_tauri_commands_screenshot::commands::capture_all_monitors,
            screenshot::capture_focused_window,
            snow_shot_tauri_commands_screenshot::commands::get_window_elements,
            snow_shot_tauri_commands_screenshot::commands::init_ui_elements,
            snow_shot_tauri_commands_screenshot::commands::get_element_from_position,
            snow_shot_tauri_commands_screenshot::commands::init_ui_elements_cache,
            snow_shot_tauri_commands_screenshot::commands::get_mouse_position,
            snow_shot_tauri_commands_screenshot::commands::create_draw_window,
            snow_shot_tauri_commands_screenshot::commands::draw_window_ready,
            snow_shot_tauri_commands_screenshot::commands::switch_always_on_top,
            snow_shot_tauri_commands_screenshot::commands::set_draw_window_style,
            screenshot::capture_full_screen,
            snow_shot_tauri_commands_file::commands::save_file,
            snow_shot_tauri_commands_file::commands::write_file,
            snow_shot_tauri_commands_file::commands::copy_file,
            snow_shot_tauri_commands_file::commands::remove_file,
            file::create_dir,
            file::remove_dir,
            file::get_app_config_dir,
            file::get_app_config_base_dir,
            file::create_local_config_dir,
            snow_shot_tauri_commands_ocr::commands::ocr_detect,
            #[cfg(target_os = "windows")]
            snow_shot_tauri_commands_ocr::commands::ocr_detect_with_shared_buffer,
            snow_shot_tauri_commands_ocr::commands::ocr_init,
            snow_shot_tauri_commands_ocr::commands::ocr_release,
            core::exit_app,
            snow_shot_tauri_commands_core::commands::start_free_drag,
            snow_shot_tauri_commands_core::commands::start_resize_window,
            snow_shot_tauri_commands_core::commands::close_window_after_delay,
            core::get_selected_text,
            snow_shot_tauri_commands_core::commands::set_enable_proxy,
            snow_shot_tauri_commands_core::commands::scroll_through,
            snow_shot_tauri_commands_core::commands::auto_scroll_through,
            snow_shot_tauri_commands_core::commands::click_through,
            snow_shot_tauri_commands_core::commands::create_fixed_content_window,
            core::read_image_from_clipboard,
            snow_shot_tauri_commands_core::commands::create_full_screen_draw_window,
            snow_shot_tauri_commands_core::commands::close_full_screen_draw_window,
            snow_shot_tauri_commands_core::commands::get_current_monitor_info,
            core::get_monitors_bounding_box,
            snow_shot_tauri_commands_core::commands::send_new_version_notification,
            core::create_video_record_window,
            snow_shot_tauri_commands_core::commands::close_video_record_window,
            snow_shot_tauri_commands_core::commands::has_video_record_window,
            snow_shot_tauri_commands_core::commands::has_focused_full_screen_window,
            snow_shot_tauri_commands_core::commands::set_current_window_always_on_top,
            core::auto_start_enable,
            core::auto_start_disable,
            snow_shot_tauri_commands_core::commands::restart_with_admin,
            snow_shot_tauri_commands_core::commands::write_bitmap_image_to_clipboard,
            #[cfg(target_os = "windows")]
            snow_shot_tauri_commands_core::commands::write_bitmap_image_to_clipboard_with_shared_buffer,
            snow_shot_tauri_commands_core::commands::retain_dir_files,
            snow_shot_tauri_commands_core::commands::is_admin,
            core::set_run_log,
            snow_shot_tauri_commands_core::commands::set_exclude_from_capture,
            snow_shot_tauri_commands_core::commands::show_main_window,
            core::set_window_rect,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_get_image_data,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_init,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_capture,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_handle_image,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_save_to_file,
            scroll_screenshot::scroll_screenshot_save_to_clipboard,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_get_size,
            snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_clear,
            video_record::video_record_start,
            video_record::video_record_stop,
            video_record::video_record_pause,
            video_record::video_record_resume,
            video_record::video_record_kill,
            video_record::video_record_get_microphone_device_names,
            video_record::video_record_init,
            listen_key::listen_key_start,
            listen_key::listen_key_stop,
            listen_key::listen_key_stop_by_window_label,
            listen_key::listen_mouse_start,
            listen_key::listen_mouse_stop,
            listen_key::listen_mouse_stop_by_window_label,
            file::text_file_read,
            file::text_file_write,
            file::text_file_clear,
            file::is_portable_app,
            plugin::plugin_init,
            plugin::plugin_get_plugins_status,
            plugin::plugin_register_plugin,
            plugin::plugin_install_plugin,
            plugin::plugin_install_local_plugin,
            plugin::plugin_uninstall_plugin,
            webview::create_webview_shared_buffer,
            webview::set_support_webview_shared_buffer,
            #[cfg(target_os = "windows")]
            webview::create_webview_shared_buffer_channel,
            #[cfg(target_os = "windows")]
            snow_shot_tauri_commands_core::commands::write_image_pixels_to_clipboard_with_shared_buffer,
            hot_load_page::hot_load_page_init,
            hot_load_page::hot_load_page_add_page,
            global_state::set_capture_state,
            global_state::get_capture_state,
            global_state::set_read_clipboard_state,
            global_state::get_read_clipboard_state,
            native_action::native_shortcut_register_action,
            native_action::native_shortcut_reset_actions,
            native_action::native_shortcut_set_disabled,
            native_action::native_shortcut_set_input_active,
            native_action::native_shortcut_set_full_screen_policy,
            native_action::native_tray_set_click_action,
            native_action::native_tray_set_enabled,
            native_action::native_runtime_start,
            native_action::native_runtime_ready,
            native_action::native_main_runtime_probe_ack,
            native_action::native_draw_runtime_ready,
            native_action::native_draw_runtime_probe_ack,
            native_action::native_runtime_bind_draw,
            native_action::native_action_ack,
        ])
        .on_menu_event(native_action::handle_menu_event)
        .on_tray_icon_event(native_action::handle_tray_icon_event)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                native_action::handle_window_destroyed(window.app_handle(), window.label());
            }
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let window_label = window.label().to_owned();

                // 用 tokio 异步进程实现清除有异步所有权问题，通知前端清理，简单处理
                match window
                    .app_handle()
                    .emit("listen-key-service:stop", window_label.clone())
                {
                    Ok(_) => (),
                    Err(e) => {
                        log::error!("[listen_key_service:stop] Failed to emit event: {}", e);
                    }
                }
                match window
                    .app_handle()
                    .emit("listen-mouse-service:stop", window_label.clone())
                {
                    Ok(_) => (),
                    Err(e) => {
                        log::error!("[listen_mouse_service:stop] Failed to emit event: {}", e);
                    }
                }
            }
        });

    #[cfg(target_os = "windows")]
    {
        app_builder = app_builder.manage(shared_buffer_service);
    }

    let app = app_builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { code, api, .. } = event
            && code.is_none()
            && app
                .state::<native_action::NativeActionState>()
                .main_rebuild_active()
        {
            log::warn!(target: "snow-shot-recovery", "[native_action] prevented exit while rebuilding the main window");
            api.prevent_exit();
        }
    });
}
