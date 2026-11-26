use std::cmp::Ordering;
use std::collections::HashMap;
use std::ffi::c_void;
use std::mem;
use std::time::{Duration, Instant};

use atree::Arena;
use atree::Token;
use rtree_rs::{RTree, Rect};
use uiautomation::UIAutomation;
use uiautomation::UIElement;
use uiautomation::UITreeWalker;
use uiautomation::core::UICacheRequest;
use uiautomation::types::Point;
use uiautomation::types::TreeScope;
use uiautomation::types::UIProperty;

use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use snow_shot_app_shared::ElementRect;
use snow_shot_app_utils::monitor_info::MonitorList;
use std::sync::Arc;
use windows::Win32::Foundation::{COLORREF, HWND, RECT};
use windows::Win32::Graphics::Dwm::{
    DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GWL_EXSTYLE, GetLayeredWindowAttributes, GetWindowLongW, LAYERED_WINDOW_ATTRIBUTES_FLAGS,
    LWA_ALPHA, WS_EX_LAYERED,
};
use xcap::ImplWindow;
use xcap::Window;

use super::ElementLevel;
use super::UIAutomationError;

const NEGATIVE_CHILD_CACHE_RETRY_INTERVAL: Duration = Duration::from_millis(250);

fn is_excluded_window_title(title: &str) -> bool {
    matches!(
        title,
        "Shell Handwriting Canvas"
            | "Snow Shot - Draw"
            | "Snow Shot - Video Record"
            | "Snow Shot - Video Record - Toolbar"
    ) || title.ends_with("-siw")
}

fn is_window_cloaked_or_transparent(hwnd: HWND) -> bool {
    let mut cloaked: u32 = 0;
    let cloaked_ok = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            mem::size_of::<u32>() as u32,
        )
    }
    .is_ok();
    if cloaked_ok && cloaked != 0 {
        return true;
    }

    let ex_style = unsafe { GetWindowLongW(hwnd, GWL_EXSTYLE) } as u32;
    if (ex_style & WS_EX_LAYERED.0) != 0 {
        let mut color_key = COLORREF(0);
        let mut alpha: u8 = 255;
        let mut flags = LAYERED_WINDOW_ATTRIBUTES_FLAGS(0);
        if unsafe {
            GetLayeredWindowAttributes(
                hwnd,
                Some(&mut color_key),
                Some(&mut alpha),
                Some(&mut flags),
            )
        }
        .is_ok()
            && (flags.0 & LWA_ALPHA.0) != 0
            && alpha == 0
        {
            return true;
        }
    }

    false
}

fn get_visible_window_rect(
    hwnd: HWND,
    fallback: uiautomation::types::Rect,
) -> uiautomation::types::Rect {
    let mut visible_rect = RECT::default();
    let has_visible_rect = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut visible_rect as *mut RECT as *mut c_void,
            mem::size_of::<RECT>() as u32,
        )
    }
    .is_ok()
        && visible_rect.left < visible_rect.right
        && visible_rect.top < visible_rect.bottom
        && visible_rect.left >= fallback.get_left()
        && visible_rect.top >= fallback.get_top()
        && visible_rect.right <= fallback.get_right()
        && visible_rect.bottom <= fallback.get_bottom();

    if has_visible_rect {
        uiautomation::types::Rect::new(
            visible_rect.left,
            visible_rect.top,
            visible_rect.right,
            visible_rect.bottom,
        )
    } else {
        fallback
    }
}

enum ElementChildrenNextSiblingCacheItem {
    Element(UIElement, ElementLevel),
    /**
     * 叶子节点
     */
    Leaf(Instant),
    /**
     * 没有下一个兄弟节点
     */
    NoNext,
}

pub struct UIElements {
    automation: Option<Arc<UIAutomationWrapper>>,
    automation_walker: Option<UITreeWalker>,
    root_element: Option<UIElement>,
    cache_request: Option<UICacheRequest>,
    element_cache: RTree<2, i32, ElementLevel>,
    element_level_map: HashMap<ElementLevel, (UIElement, Token)>,
    element_rect_tree: Arena<uiautomation::types::Rect>,
    element_children_next_sibling_cache: HashMap<ElementLevel, ElementChildrenNextSiblingCacheItem>,
    window_rect_map: HashMap<ElementLevel, uiautomation::types::Rect>,
    window_index_level_map: HashMap<i32, ElementLevel>,
    next_node_id: u64,
}

unsafe impl Send for UIElements {}
unsafe impl Sync for UIElements {}

struct UIElementWrapper {
    element: UIElement,
}

unsafe impl Send for UIElementWrapper {}
unsafe impl Sync for UIElementWrapper {}

struct UIAutomationWrapper {
    automation: UIAutomation,
}

unsafe impl Send for UIAutomationWrapper {}
unsafe impl Sync for UIAutomationWrapper {}

impl UIElements {
    pub fn new() -> Self {
        Self {
            automation: None,
            automation_walker: None,
            root_element: None,
            cache_request: None,
            element_rect_tree: Arena::new(),
            element_cache: RTree::new(),
            element_level_map: HashMap::new(),
            element_children_next_sibling_cache: HashMap::new(),
            window_rect_map: HashMap::new(),
            window_index_level_map: HashMap::new(),
            next_node_id: 1,
        }
    }

    fn alloc_node_id(&mut self) -> u64 {
        let id = self.next_node_id;
        self.next_node_id = self.next_node_id.wrapping_add(1).max(1);
        id
    }

    pub fn init(&mut self) -> Result<(), UIAutomationError> {
        if self.automation.is_some() {
            return Ok(());
        }

        let automation = UIAutomation::new()?;
        let automation_walker = automation.get_content_view_walker()?;

        // 创建缓存请求，预先缓存常用属性
        let cache_request = automation.create_cache_request()?;

        // 缓存边界矩形属性（最重要的性能优化点）
        cache_request.add_property(UIProperty::BoundingRectangle)?;

        // 缓存其他常用属性
        cache_request.add_property(UIProperty::ControlType)?;
        cache_request.add_property(UIProperty::IsOffscreen)?;

        // 设置缓存范围：缓存元素本身
        cache_request.set_tree_scope(TreeScope::Element)?;

        self.automation = Some(Arc::new(UIAutomationWrapper { automation }));
        self.automation_walker = Some(automation_walker);
        self.cache_request = Some(cache_request);

        Ok(())
    }

    pub fn convert_element_rect_to_rtree_rect(rect: uiautomation::types::Rect) -> Rect<2, i32> {
        Rect::new(
            [rect.get_left(), rect.get_top()],
            [rect.get_right(), rect.get_bottom()],
        )
    }

    fn normalize_rect(rect: uiautomation::types::Rect) -> uiautomation::types::Rect {
        // 当前矩形的数据不可信，做个纠正
        let mut rect_left = rect.get_left();
        let mut rect_top = rect.get_top();
        let mut rect_right = rect.get_right();
        let mut rect_bottom = rect.get_bottom();

        if rect_left > rect_right {
            mem::swap(&mut rect_left, &mut rect_right);
        }

        if rect_top > rect_bottom {
            mem::swap(&mut rect_top, &mut rect_bottom);
        }

        uiautomation::types::Rect::new(rect_left, rect_top, rect_right, rect_bottom)
    }

    fn beyond_rect(
        rect: uiautomation::types::Rect,
        parent_rect: uiautomation::types::Rect,
    ) -> bool {
        if rect.get_left() < parent_rect.get_left() {
            return true;
        }

        if rect.get_right() > parent_rect.get_right() {
            return true;
        }

        if rect.get_top() < parent_rect.get_top() {
            return true;
        }

        if rect.get_bottom() > parent_rect.get_bottom() {
            return true;
        }

        false
    }

    pub fn clip_rect(
        rect: uiautomation::types::Rect,
        parent_rect: uiautomation::types::Rect,
    ) -> uiautomation::types::Rect {
        uiautomation::types::Rect::new(
            rect.get_left().max(parent_rect.get_left()),
            rect.get_top().max(parent_rect.get_top()),
            rect.get_right().min(parent_rect.get_right()),
            rect.get_bottom().min(parent_rect.get_bottom()),
        )
    }

    /**
     * 初始化窗口元素缓存
     */
    pub fn init_cache(&mut self, exclude_hwnd: Option<usize>) -> Result<(), UIAutomationError> {
        self.root_element.replace(
            self.automation
                .as_ref()
                .unwrap()
                .automation
                .get_root_element()?,
        );

        let root_element = self.root_element.as_ref().unwrap();

        self.element_rect_tree = Arena::new();
        self.element_cache = RTree::new();
        self.element_level_map.clear();
        self.element_children_next_sibling_cache.clear();
        self.window_rect_map.clear();
        self.window_index_level_map.clear();
        self.next_node_id = 1;

        // 桌面的窗口索引应该是最高，因为其优先级最低
        let mut current_level = ElementLevel::root();
        let monitors_bounding_box = MonitorList::all(true).get_monitors_bounding_box();
        let root_element_rect = uiautomation::types::Rect::new(
            monitors_bounding_box.min_x,
            monitors_bounding_box.min_y,
            monitors_bounding_box.max_x,
            monitors_bounding_box.max_y,
        );

        let mut root_tree_token = self.element_rect_tree.new_node(root_element_rect);
        let (_, mut parent_tree_token) = self.insert_element_cache(
            &mut root_tree_token,
            root_element.clone(),
            root_element_rect,
            current_level,
        );

        // 遍历所有窗口
        let windows = Window::all()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|window| {
                let hwnd = window.hwnd().ok()? as usize;
                (Some(hwnd) != exclude_hwnd).then_some(hwnd)
            })
            .collect::<Vec<usize>>();

        let automation = self.automation.clone();
        let children_list = windows
            .par_iter()
            .filter_map(|window_hwnd| {
                let raw_hwnd = HWND(*window_hwnd as *mut c_void);
                let window = ImplWindow::new(raw_hwnd);

                if window.is_minimized().unwrap_or(true) {
                    return None;
                }

                if is_window_cloaked_or_transparent(raw_hwnd) {
                    return None;
                }

                match window.title() {
                    Ok(title) => {
                        if is_excluded_window_title(&title) {
                            return None;
                        }

                        title
                    }
                    Err(_) => return None,
                };

                let window_hwnd = match window.hwnd() {
                    Ok(hwnd) => hwnd,
                    Err(_) => return None,
                };

                let window_info = match window.get_window_info() {
                    Ok(window_info) => window_info,
                    Err(_) => return None,
                };

                let element_rect = get_visible_window_rect(
                    raw_hwnd,
                    uiautomation::types::Rect::new(
                        window_info.rcWindow.left,
                        window_info.rcWindow.top,
                        window_info.rcWindow.right,
                        window_info.rcWindow.bottom,
                    ),
                );
                if element_rect.get_left() >= element_rect.get_right()
                    || element_rect.get_top() >= element_rect.get_bottom()
                {
                    return None;
                }

                if let Ok(element) =
                    automation.as_ref().unwrap().automation.element_from_handle(
                        uiautomation::types::Handle::from(window_hwnd as isize),
                    )
                {
                    Some((UIElementWrapper { element }, element_rect))
                } else {
                    None
                }
            })
            .collect::<Vec<(UIElementWrapper, uiautomation::types::Rect)>>();

        // 窗口层级
        current_level.window_index = 0;
        current_level.next_level();

        for current_child in children_list {
            current_level.window_index += 1;
            current_level.next_element();
            current_level.node_id = self.alloc_node_id();

            let current_child_rect = current_child.1;

            let (current_child_rect, _) = self.insert_element_cache(
                &mut parent_tree_token,
                current_child.0.element.clone(),
                current_child_rect,
                current_level,
            );

            self.window_rect_map
                .insert(current_level.clone(), current_child_rect);
            self.window_index_level_map
                .insert(current_level.window_index, current_level.clone());
        }

        Ok(())
    }

    pub fn get_element_from_point(
        &self,
        mouse_x: i32,
        mouse_y: i32,
    ) -> Result<Option<ElementRect>, UIAutomationError> {
        let automation = match self.automation.as_ref() {
            Some(automation) => automation,
            None => return Ok(None),
        };

        // 使用带缓存的版本获取元素
        let element = if let Some(cache_request) = &self.cache_request {
            automation
                .automation
                .element_from_point_build_cache(Point::new(mouse_x, mouse_y), cache_request)?
        } else {
            automation
                .automation
                .element_from_point(Point::new(mouse_x, mouse_y))?
        };

        // 优先使用缓存的边界矩形
        let rect = if self.cache_request.is_some() {
            // 缓存模式下只能调用缓存方法，不能fallback到实时查询
            element.get_cached_bounding_rectangle().unwrap_or_default() // 如果缓存失败，返回默认值
        } else {
            element.get_bounding_rectangle()?
        };

        Ok(Some(ElementRect {
            min_x: rect.get_left(),
            min_y: rect.get_top(),
            max_x: rect.get_right(),
            max_y: rect.get_bottom(),
        }))
    }

    pub fn insert_element_cache(
        &mut self,
        parent_tree_token: &mut Token,
        element: UIElement,
        element_rect: uiautomation::types::Rect,
        element_level: ElementLevel,
    ) -> (uiautomation::types::Rect, Token) {
        let element_rect = uiautomation::types::Rect::new(
            element_rect.get_left(),
            element_rect.get_top(),
            element_rect.get_right(),
            element_rect.get_bottom(),
        );

        let mut element_rect = Self::normalize_rect(element_rect);

        let window_rect = self
            .window_rect_map
            .get(
                &self
                    .window_index_level_map
                    .get(&element_level.window_index)
                    .unwrap_or(&element_level),
            )
            .unwrap_or(&element_rect)
            .clone();

        if Self::beyond_rect(element_rect, window_rect) {
            element_rect = Self::clip_rect(element_rect, window_rect);
        }

        self.element_cache.insert(
            Self::convert_element_rect_to_rtree_rect(element_rect),
            element_level,
        );

        let current_node = self.element_rect_tree.new_node(element_rect);
        parent_tree_token
            .append_node(&mut self.element_rect_tree, current_node)
            .unwrap();
        self.element_level_map
            .insert(element_level, (element, current_node));

        (element_rect, current_node)
    }

    fn get_element_from_cache(
        &self,
        mouse_x: i32,
        mouse_y: i32,
    ) -> Option<(UIElement, ElementLevel, uiautomation::types::Rect, Token)> {
        let element_rect = self
            .element_cache
            .search(Rect::new_point([mouse_x, mouse_y]));

        // 获取层级最高的元素
        let mut max_level = ElementLevel::root();
        let mut max_level_rect = None;
        for rect in element_rect {
            if max_level.cmp(&rect.data) == Ordering::Less {
                max_level = rect.data.clone();
                max_level_rect = Some(rect.rect);
            }
        }
        let element_rtree_rect = match max_level_rect {
            Some(rect) => {
                uiautomation::types::Rect::new(rect.min[0], rect.min[1], rect.max[0], rect.max[1])
            }
            None => return None,
        };

        match self.element_level_map.get(&max_level) {
            Some((element, token)) => {
                Some((element.clone(), max_level, element_rtree_rect, *token))
            }
            None => None,
        }
    }

    // fn skip_invalid_window(
    //     &self,
    //     automation_walker: &UITreeWalker,
    //     current_element: &mut uiautomation::Result<UIElement>,
    //     parent_level: &ElementLevel,
    // ) {
    //     // 跳过 Snow Shot 窗口
    //     if parent_level.is_root() {
    //         if let Ok(element) = current_element.as_ref() {
    //             if let Ok(name) = element.get_name() {
    //                 if name == "Snow Shot - Draw" {
    //                     *current_element = automation_walker.get_next_sibling(element);
    //                     return;
    //                 }
    //             }

    //             unsafe {
    //                 if let Ok(handle) = element.get_native_window_handle() {
    //                     let window_hwnd: HWND = handle.into();
    //                     if !IsWindow(Some(window_hwnd)).as_bool()
    //                         || !IsWindowVisible(window_hwnd).as_bool()
    //                         || IsIconic(window_hwnd).as_bool()
    //                     {
    //                         *current_element = automation_walker.get_next_sibling(element);
    //                         return;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }

    /**
     * 获取所有可选区域
     */
    pub fn get_element_from_point_walker(
        &mut self,
        mouse_x: i32,
        mouse_y: i32,
    ) -> Result<Vec<ElementRect>, UIAutomationError> {
        let automation_walker = self.automation_walker.clone().unwrap();
        let (parent_element, mut parent_level, parent_rect, mut parent_tree_token) =
            match self.get_element_from_cache(mouse_x, mouse_y) {
                Some(element) => element,
                None => (
                    self.root_element.clone().unwrap(),
                    ElementLevel::root(),
                    uiautomation::types::Rect::new(0, 0, i32::MAX, i32::MAX),
                    self.element_rect_tree
                        .new_node(uiautomation::types::Rect::new(0, 0, i32::MAX, i32::MAX)),
                ),
            };

        // 父元素必然命中了 mouse position，所以直接取第一个元素
        let mut current_level = ElementLevel::root();

        let mut queue = Option::<UIElement>::None;

        let mut try_get_first_child = false;
        // let mut cache_level = Option::<ElementLevel>::None;
        match self.element_children_next_sibling_cache.get(&parent_level) {
            Some(element) => match element {
                ElementChildrenNextSiblingCacheItem::Element(element, level) => {
                    queue = Some(element.clone());
                    current_level = level.clone();
                }
                ElementChildrenNextSiblingCacheItem::Leaf(last_checked) => {
                    try_get_first_child =
                        last_checked.elapsed() >= NEGATIVE_CHILD_CACHE_RETRY_INTERVAL;
                }
                // 没有下一个节点说明遍历结束了
                ElementChildrenNextSiblingCacheItem::NoNext => {}
            },
            None => {
                try_get_first_child = true;
            }
        };

        if try_get_first_child {
            // 没有命中缓存，说明是第一次获取
            // 使用带缓存的版本获取第一个子元素
            let first_child = if let Some(cache_request) = &self.cache_request {
                automation_walker.get_first_child_build_cache(&parent_element, cache_request)
            } else {
                automation_walker.get_first_child(&parent_element)
            };

            match first_child {
                Ok(element) => {
                    queue = Some(element.clone());
                    current_level = parent_level.clone();
                    current_level.next_level();
                    current_level.node_id = self.alloc_node_id();

                    self.element_children_next_sibling_cache.insert(
                        parent_level,
                        ElementChildrenNextSiblingCacheItem::Element(element, current_level),
                    );
                }
                Err(_) => {
                    // WebView providers may expose children shortly after their top-level
                    // element. Throttle negative lookups without making them permanent.
                    self.element_children_next_sibling_cache.insert(
                        parent_level,
                        ElementChildrenNextSiblingCacheItem::Leaf(Instant::now()),
                    );
                }
            }
        }

        let mut current_element_rect = parent_rect;
        let mut current_element_token = parent_tree_token;
        let mut result_token = current_element_token;
        let mut result_rect = current_element_rect;

        while let Some(current_element) = queue.take() {
            queue = None;

            // 优先使用缓存的属性
            let is_offscreen = if self.cache_request.is_some() {
                current_element.is_cached_offscreen().unwrap_or(true)
            } else {
                current_element.is_offscreen().unwrap_or(true)
            };

            if !is_offscreen {
                current_element_rect = if self.cache_request.is_some() {
                    match current_element.get_cached_bounding_rectangle() {
                        Ok(rect) => rect,
                        Err(_) => continue,
                    }
                } else {
                    match current_element.get_bounding_rectangle() {
                        Ok(rect) => rect,
                        Err(_) => continue,
                    }
                };

                let current_element_left = current_element_rect.get_left();
                let current_element_right = current_element_rect.get_right();
                let current_element_top = current_element_rect.get_top();
                let current_element_bottom = current_element_rect.get_bottom();

                if current_element_left < current_element_right
                    && current_element_top < current_element_bottom
                {
                    (current_element_rect, current_element_token) = self.insert_element_cache(
                        &mut parent_tree_token,
                        current_element.clone(),
                        current_element_rect,
                        current_level,
                    );

                    if current_element_left <= mouse_x
                        && current_element_right >= mouse_x
                        && current_element_top <= mouse_y
                        && current_element_bottom >= mouse_y
                    {
                        result_token = current_element_token;
                        result_rect = current_element_rect;

                        // Advance the old parent's next-sibling cursor BEFORE descending
                        // into `current_element`, so subsequent mouse moves over siblings
                        // never re-insert `current_element` or corrupt its Arena token.
                        let next_sibling_for_old_parent =
                            if let Some(cache_request) = &self.cache_request {
                                automation_walker
                                    .get_next_sibling_build_cache(&current_element, cache_request)
                            } else {
                                automation_walker.get_next_sibling(&current_element)
                            };
                        match next_sibling_for_old_parent {
                            Ok(sibling) => {
                                let mut sibling_level = current_level;
                                sibling_level.next_element();
                                sibling_level.node_id = self.alloc_node_id();
                                self.element_children_next_sibling_cache.insert(
                                    parent_level,
                                    ElementChildrenNextSiblingCacheItem::Element(
                                        sibling,
                                        sibling_level,
                                    ),
                                );
                            }
                            Err(_) => {
                                self.element_children_next_sibling_cache.insert(
                                    parent_level,
                                    ElementChildrenNextSiblingCacheItem::NoNext,
                                );
                            }
                        }

                        // 使用带缓存的版本获取第一个子元素
                        let first_child = if let Some(cache_request) = &self.cache_request {
                            automation_walker
                                .get_first_child_build_cache(&current_element, cache_request)
                        } else {
                            automation_walker.get_first_child(&current_element)
                        };

                        if let Ok(child) = first_child {
                            queue = Some(child.clone());
                            parent_tree_token = current_element_token;
                            parent_level = current_level;

                            current_level.next_level();
                            current_level.node_id = self.alloc_node_id();

                            self.element_children_next_sibling_cache.insert(
                                parent_level,
                                ElementChildrenNextSiblingCacheItem::Element(child, current_level),
                            );

                            continue;
                        } else {
                            self.element_children_next_sibling_cache.insert(
                                current_level,
                                ElementChildrenNextSiblingCacheItem::Leaf(Instant::now()),
                            );
                            break;
                        }
                    }
                }
            }

            // 使用带缓存的版本获取下一个兄弟元素
            let next_sibling = if let Some(cache_request) = &self.cache_request {
                automation_walker.get_next_sibling_build_cache(&current_element, cache_request)
            } else {
                automation_walker.get_next_sibling(&current_element)
            };

            match next_sibling {
                Ok(sibling) => {
                    queue = Some(sibling.clone());
                    current_level.next_element();
                    current_level.node_id = self.alloc_node_id();

                    self.element_children_next_sibling_cache.insert(
                        parent_level,
                        ElementChildrenNextSiblingCacheItem::Element(sibling, current_level),
                    );
                }
                Err(_) => {
                    // 如果当前层级遍历结束了，标记已经遍历结束
                    self.element_children_next_sibling_cache
                        .insert(parent_level, ElementChildrenNextSiblingCacheItem::NoNext);
                }
            }
        }

        let element_ancestors = result_token.ancestors(&self.element_rect_tree);
        let mut result_rect_list = Vec::with_capacity(16);
        let mut previous_rect = ElementRect::from(result_rect);
        if previous_rect.min_x < previous_rect.max_x && previous_rect.min_y < previous_rect.max_y {
            result_rect_list.push(previous_rect);
        }
        for node in element_ancestors {
            let current_rect = ElementRect::from(node.data);
            if current_rect.min_x >= current_rect.max_x || current_rect.min_y >= current_rect.max_y
            {
                continue;
            }
            if current_rect == previous_rect {
                continue;
            }

            if current_rect.min_x == previous_rect.max_x
                || current_rect.min_y == previous_rect.max_y
                || current_rect.min_x > previous_rect.max_x
                || current_rect.min_y > previous_rect.max_y
            {
                continue;
            }

            result_rect_list.push(current_rect);
            previous_rect = current_rect;
        }

        return Ok(result_rect_list);
    }
}

impl Drop for UIElements {
    fn drop(&mut self) {
        // 清理资源
        self.automation = None;
        self.automation_walker = None;
        self.root_element = None;
    }
}
