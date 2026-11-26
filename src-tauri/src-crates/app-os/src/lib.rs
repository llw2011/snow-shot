use thiserror::Error;

#[cfg(target_os = "windows")]
#[path = "./notification/windows.rs"]
pub mod notification;
#[cfg(target_os = "linux")]
#[path = "./notification/linux.rs"]
pub mod notification;

#[cfg(target_os = "macos")]
#[path = "./notification/macos.rs"]
pub mod notification;

#[cfg(target_os = "windows")]
#[path = "./ui_automation/windows.rs"]
pub mod ui_automation;
#[cfg(target_os = "linux")]
#[path = "./ui_automation/linux.rs"]
pub mod ui_automation;

#[cfg(target_os = "macos")]
#[path = "./ui_automation/macos.rs"]
pub mod ui_automation;

#[cfg(target_os = "windows")]
#[path = "./utils/windows.rs"]
pub mod utils;

#[cfg(target_os = "linux")]
#[path = "./utils/linux.rs"]
pub mod utils;

#[cfg(target_os = "macos")]
#[path = "./utils/macos.rs"]
pub mod utils;

// #[cfg(target_os = "linux")]
// #[path = "./linux.rs"]
// pub mod ui_automation;

// #[cfg(target_os = "macos")]
// #[path = "./macos.rs"]
// pub mod ui_automation;

use std::{cmp::Ordering, hash::Hash};

/**
 * 元素层级
 */
#[derive(Debug, Clone, PartialEq, Eq, Hash, Copy)]
pub struct ElementLevel {
    /**
     * 遍历时，首先获得层级最高的元素
     * 同级元素，index 越高，层级越低
     */
    pub element_index: i32,
    /**
     * 元素层级
     */
    pub element_level: i32,
    /**
     * 父元素索引
     */
    pub parent_index: i32,
    /**
     * 窗口索引
     */
    pub window_index: i32,
    /**
     * 单调递增节点标识，防止深层多分支节点在 HashMap 中发生键冲突
     */
    pub node_id: u64,
}

impl ElementLevel {
    pub fn root() -> Self {
        Self {
            element_index: 0,
            element_level: 0,
            parent_index: i32::MAX,
            window_index: i32::MAX,
            node_id: 0,
        }
    }

    pub fn next_level(&mut self) {
        self.element_level += 1;
        let current_element_index = self.element_index;
        self.element_index = 0;
        self.parent_index = current_element_index;
    }

    pub fn next_element(&mut self) {
        self.element_index += 1;
    }

    pub fn with_node_id(mut self, node_id: u64) -> Self {
        self.node_id = node_id;
        self
    }
}

impl PartialOrd for ElementLevel {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ElementLevel {
    fn cmp(&self, other: &Self) -> Ordering {
        // 先窗口索引排序，窗口索引小的优先级越高
        if self.window_index != other.window_index {
            return other.window_index.cmp(&self.window_index);
        }

        // 元素层级排序，层级高的优先级越高
        if self.element_level != other.element_level {
            return self.element_level.cmp(&other.element_level);
        }

        // 元素索引排序，索引小的优先级越高
        if self.element_index != other.element_index {
            return other.element_index.cmp(&self.element_index);
        }

        // 父元素索引排序，索引小的优先级越高
        if self.parent_index != other.parent_index {
            return other.parent_index.cmp(&self.parent_index);
        }

        other.node_id.cmp(&self.node_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn element_level_distinguishes_deep_branches_and_orders_consistently() {
        let mut win = ElementLevel::root();
        win.window_index = 1;
        win.next_level();
        win.next_element();
        win.node_id = 1;

        // Branch A: level 2 index 1 -> level 3 index 1 -> level 4 index 1
        let mut a_l4 = win;
        a_l4.next_level();
        a_l4.next_element();
        a_l4.next_level();
        a_l4.next_element();
        a_l4.next_level();
        a_l4.next_element();
        a_l4 = a_l4.with_node_id(10);

        // Branch B: level 2 index 2 -> level 3 index 1 -> level 4 index 1
        let mut b_l4 = win;
        b_l4.next_level();
        b_l4.next_element();
        b_l4.next_element();
        b_l4.next_level();
        b_l4.next_element();
        b_l4.next_level();
        b_l4.next_element();
        b_l4 = b_l4.with_node_id(20);

        assert_ne!(a_l4, b_l4);
        assert_eq!(a_l4.partial_cmp(&b_l4), Some(a_l4.cmp(&b_l4)));
        assert!(win > ElementLevel::root());
        assert!(a_l4 > win);
    }
}

#[derive(Error, Debug)]
pub enum UIAutomationError {
    #[error("Capture error")]
    Capture(#[from] xcap::XCapError),

    #[cfg(target_os = "windows")]
    #[error("Windows error")]
    Windows(#[from] windows::core::Error),
    #[cfg(target_os = "windows")]
    #[error("UIAutomation error")]
    UIAError(#[from] uiautomation::errors::Error),
}
