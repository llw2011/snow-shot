use std::{fs, path::Path, sync::Arc};

use serde::Deserialize;
use snow_shot_app_services::file_cache_service::FileCacheService;
use tauri::{AppHandle, Manager, Theme, WebviewWindow, image::Image};

const COMMON_CONFIG_FILE: &str = "common.json";
const TRAY_ICON_CONFIG_FILE: &str = "commonTrayIcon.json";
const MAX_CUSTOM_ICON_SIZE: u32 = 128;

#[derive(Debug, Deserialize)]
#[serde(default)]
struct CommonConfig {
    theme: String,
}

impl Default for CommonConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_owned(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct TrayIconConfig {
    icon_path: String,
    icon_path_dark: String,
    default_icons: String,
    default_icons_dark: String,
    enable_tray_icon: bool,
}

impl Default for TrayIconConfig {
    fn default() -> Self {
        Self {
            icon_path: String::new(),
            icon_path_dark: String::new(),
            default_icons: BundledIcon::Default.setting_value().to_owned(),
            default_icons_dark: BundledIcon::Default.setting_value().to_owned(),
            enable_tray_icon: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BundledIcon {
    Default,
    Light,
    Dark,
    SnowDefault,
    SnowLight,
    SnowDark,
}

impl BundledIcon {
    fn from_setting(value: &str) -> Self {
        match value {
            "light" => Self::Light,
            "dark" => Self::Dark,
            "snow-default" => Self::SnowDefault,
            "snow-light" => Self::SnowLight,
            "snow-dark" => Self::SnowDark,
            _ => Self::Default,
        }
    }

    const fn setting_value(self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::Light => "light",
            Self::Dark => "dark",
            Self::SnowDefault => "snow-default",
            Self::SnowLight => "snow-light",
            Self::SnowDark => "snow-dark",
        }
    }

    fn load(self) -> Result<Image<'static>, String> {
        let bytes = match self {
            Self::Default => include_bytes!("../app-icons/snow-shot-tray-default.png").as_slice(),
            Self::Light => include_bytes!("../app-icons/snow-shot-tray-light.png").as_slice(),
            Self::Dark => include_bytes!("../app-icons/snow-shot-tray-dark.png").as_slice(),
            Self::SnowDefault => {
                include_bytes!("../app-icons/snow-shot-tray-snow-default.png").as_slice()
            }
            Self::SnowLight => {
                include_bytes!("../app-icons/snow-shot-tray-snow-light.png").as_slice()
            }
            Self::SnowDark => {
                include_bytes!("../app-icons/snow-shot-tray-snow-dark.png").as_slice()
            }
        };
        Image::from_bytes(bytes).map_err(|error| {
            format!(
                "failed to decode bundled startup icon {}: {error}",
                self.setting_value()
            )
        })
    }
}

pub(crate) struct StartupIcon {
    pub(crate) image: Image<'static>,
    pub(crate) tray_enabled: bool,
}

fn read_config<T: serde::de::DeserializeOwned + Default>(path: &Path) -> T {
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return T::default(),
        Err(error) => {
            log::warn!(
                "[startup_icon] failed to read {}: {error}; using defaults",
                path.display()
            );
            return T::default();
        }
    };

    serde_json::from_str(&contents).unwrap_or_else(|error| {
        log::warn!(
            "[startup_icon] failed to parse {}: {error}; using defaults",
            path.display()
        );
        T::default()
    })
}

fn uses_dark_theme(configured_theme: &str, system_theme: Option<Theme>) -> bool {
    match configured_theme {
        "light" => false,
        "system" => matches!(system_theme, Some(Theme::Dark)),
        // The frontend defaults missing or invalid values to its dark theme.
        _ => true,
    }
}

fn selected_custom_icon_path(config: &TrayIconConfig, dark: bool) -> Option<&Path> {
    let path = if dark && !config.icon_path_dark.is_empty() {
        &config.icon_path_dark
    } else {
        &config.icon_path
    };
    (!path.is_empty()).then(|| Path::new(path))
}

fn selected_bundled_icon(config: &TrayIconConfig, dark: bool) -> BundledIcon {
    let setting = if dark && !config.default_icons_dark.is_empty() {
        &config.default_icons_dark
    } else {
        &config.default_icons
    };
    BundledIcon::from_setting(setting)
}

fn load_custom_icon(path: &Path) -> Result<Image<'static>, String> {
    let icon = Image::from_path(path)
        .map_err(|error| format!("failed to load custom icon {}: {error}", path.display()))?;
    if icon.width() > MAX_CUSTOM_ICON_SIZE || icon.height() > MAX_CUSTOM_ICON_SIZE {
        return Err(format!(
            "custom icon {} is {}x{}, maximum is {MAX_CUSTOM_ICON_SIZE}x{MAX_CUSTOM_ICON_SIZE}",
            path.display(),
            icon.width(),
            icon.height()
        ));
    }
    Ok(icon)
}

fn with_app_default(
    selected: Result<Image<'static>, String>,
    app_default: Option<Image<'static>>,
) -> Result<Image<'static>, String> {
    selected.or_else(|error| {
        if let Some(image) = app_default {
            log::warn!("[startup_icon] {error}; using app default icon");
            Ok(image)
        } else {
            Err(error)
        }
    })
}

fn load_selected_icon(
    config: &TrayIconConfig,
    dark: bool,
    app_default: Option<Image<'static>>,
) -> Result<Image<'static>, String> {
    let bundled_icon = selected_bundled_icon(config, dark);
    let selected = selected_custom_icon_path(config, dark)
        .and_then(|path| match load_custom_icon(path) {
            Ok(icon) => Some(icon),
            Err(error) => {
                log::warn!(
                    "[startup_icon] {error}; using bundled icon {}",
                    bundled_icon.setting_value()
                );
                None
            }
        })
        .map(Ok)
        .unwrap_or_else(|| bundled_icon.load());
    with_app_default(selected, app_default)
}

pub(crate) fn load(app: &AppHandle, main_window: &WebviewWindow) -> Result<StartupIcon, String> {
    let file_cache = app.state::<Arc<FileCacheService>>();
    let config_dir = file_cache.get_app_config_dir(app)?;
    let common: CommonConfig = read_config(&config_dir.join(COMMON_CONFIG_FILE));
    let tray: TrayIconConfig = read_config(&config_dir.join(TRAY_ICON_CONFIG_FILE));
    let dark = uses_dark_theme(&common.theme, main_window.theme().ok());
    let app_default = app.default_window_icon().cloned().map(Image::to_owned);
    let image = load_selected_icon(&tray, dark, app_default)?;

    Ok(StartupIcon {
        image,
        tray_enabled: tray.enable_tray_icon,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> TrayIconConfig {
        TrayIconConfig {
            icon_path: "light-custom.png".to_owned(),
            icon_path_dark: "dark-custom.png".to_owned(),
            default_icons: "light".to_owned(),
            default_icons_dark: "dark".to_owned(),
            enable_tray_icon: false,
        }
    }

    #[test]
    fn explicit_theme_overrides_system_theme() {
        assert!(uses_dark_theme("dark", Some(Theme::Light)));
        assert!(!uses_dark_theme("light", Some(Theme::Dark)));
        assert!(uses_dark_theme("system", Some(Theme::Dark)));
        assert!(!uses_dark_theme("system", Some(Theme::Light)));
        assert!(uses_dark_theme("invalid", Some(Theme::Light)));
    }

    #[test]
    fn dark_custom_icon_falls_back_to_light_custom_icon() {
        let mut config = config();
        config.icon_path_dark.clear();
        assert_eq!(
            selected_custom_icon_path(&config, true),
            Some(Path::new("light-custom.png"))
        );
        assert_eq!(
            selected_custom_icon_path(&config, false),
            Some(Path::new("light-custom.png"))
        );
    }

    #[test]
    fn bundled_icon_matches_the_active_theme() {
        let config = config();
        assert_eq!(selected_bundled_icon(&config, true), BundledIcon::Dark);
        assert_eq!(selected_bundled_icon(&config, false), BundledIcon::Light);
    }

    #[test]
    fn missing_settings_keep_frontend_defaults() {
        let common: CommonConfig = serde_json::from_str("{}").unwrap();
        let tray: TrayIconConfig = serde_json::from_str("{}").unwrap();
        assert_eq!(common.theme, "dark");
        assert!(tray.enable_tray_icon);
        assert_eq!(selected_bundled_icon(&tray, true), BundledIcon::Default);
    }

    #[test]
    fn explicit_tray_disable_is_preserved() {
        let tray: TrayIconConfig = serde_json::from_str(r#"{"enableTrayIcon":false}"#).unwrap();
        assert!(!tray.enable_tray_icon);
    }

    #[test]
    fn unreadable_custom_icon_falls_back_to_selected_bundle() {
        let mut config = config();
        config.icon_path_dark = "path-that-does-not-exist.png".to_owned();
        let actual = load_selected_icon(&config, true, None).unwrap();
        let expected = BundledIcon::Dark.load().unwrap();
        assert_eq!(actual.width(), expected.width());
        assert_eq!(actual.height(), expected.height());
        assert_eq!(actual.rgba(), expected.rgba());
    }

    #[test]
    fn every_bundled_icon_decodes() {
        for icon in [
            BundledIcon::Default,
            BundledIcon::Light,
            BundledIcon::Dark,
            BundledIcon::SnowDefault,
            BundledIcon::SnowLight,
            BundledIcon::SnowDark,
        ] {
            let image = icon.load().unwrap();
            assert!(image.width() > 0);
            assert!(image.height() > 0);
        }
    }

    #[test]
    fn invalid_bundled_icon_names_are_restricted_to_default() {
        let mut config = config();
        config.default_icons = "../../outside".to_owned();
        config.default_icons_dark = "not-a-bundled-icon".to_owned();
        assert_eq!(selected_bundled_icon(&config, false), BundledIcon::Default);
        assert_eq!(selected_bundled_icon(&config, true), BundledIcon::Default);
    }

    #[test]
    fn app_default_is_the_final_image_fallback() {
        let app_default = BundledIcon::SnowLight.load().unwrap();
        let expected = app_default.clone();
        let actual =
            with_app_default(Err("bundled decode failed".to_owned()), Some(app_default)).unwrap();
        assert_eq!(actual.rgba(), expected.rgba());
        assert_eq!(actual.width(), expected.width());
        assert_eq!(actual.height(), expected.height());
    }
}
