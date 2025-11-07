use crate::os::ElementRect;
use crate::os::TryGetElementByFocus;

pub struct UIElements {}

impl UIElements {
    pub fn new() -> Self {
        Self {}
    }

    pub fn init(&mut self) -> Result<(), ()> {
        log::warn!("[os::ui_automation::linux::init] not implemented");
        Ok(())
    }

    pub fn init_cache(
        &mut self,
        monitor_rect: ElementRect,
        try_get_element_by_focus: TryGetElementByFocus,
    ) -> Result<(), ()> {
        log::warn!("[os::ui_automation::linux::init_cache] not implemented");
        Ok(())
    }

    pub fn recovery_window_z_order(&self) {
        log::warn!("[os::ui_automation::linux::recovery_window_z_order] not implemented");
    }

    pub fn get_element_from_point_walker<F>(
        &mut self,
        mouse_x: i32,
        mouse_y: i32,
        on_try_focus: &F,
    ) -> Result<Vec<ElementRect>, ()>
    where
        F: Fn(),
    {
        log::warn!("[os::ui_automation::linux::get_element_from_point_walker] not implemented");
        Ok(vec![])
    }
}
