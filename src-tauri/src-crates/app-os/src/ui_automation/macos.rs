use snow_shot_app_shared::ElementRect;

pub struct UIElements {}

#[allow(unused)]
impl UIElements {
    pub fn new() -> Self {
        Self {}
    }

    pub fn init(&mut self) -> Result<(), ()> {
        Ok(())
    }

    pub fn init_cache(&mut self) -> Result<(), ()> {
        Ok(())
    }

    pub fn recovery_window_z_order(&self) {}

    pub fn get_element_from_point_walker(
        &mut self,
        mouse_x: i32,
        mouse_y: i32,
    ) -> Result<Vec<ElementRect>, ()> {
        log::warn!("[os::ui_automation::macos::get_element_from_point_walker] not implemented");
        Ok(vec![])
    }
}
