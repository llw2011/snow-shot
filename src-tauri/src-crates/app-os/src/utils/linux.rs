pub fn get_focused_window() -> () {
    log::warn!("[os::utils::linux::get_focused_window] not implemented");

    ()
}

pub fn switch_always_on_top() -> () {
    log::warn!("[os::utils::linux::switch_always_on_top] not implemented");

    ()
}

pub fn set_draw_window_style(window: tauri::Window) {
    log::warn!("[os::utils::linux::set_draw_window_style] not implemented");

    ()
}

pub fn create_admin_auto_start_task() -> Result<(), String> {
    Ok(())
}

pub fn delete_admin_auto_start_task() -> Result<(), String> {
    Ok(())
}

pub fn restart_with_admin() -> Result<(), String> {
    Ok(())
}

pub fn is_admin() -> bool {
    false
}
