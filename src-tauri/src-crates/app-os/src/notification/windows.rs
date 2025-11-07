use windows::{
    Data::Xml::Dom::*, UI::Notifications::*, Win32::System::Com::*, Win32::System::WinRT::*,
    core::*,
};

const PUBLIC_RELEASES_URL: &str = "https://github.com/llw2011/snow-shot/releases/latest";

pub fn send_new_version_notification(title: String, body: String) {
    // 首先尝试 Toast 通知，失败时使用备用方案
    if let Err(e) = send_toast_notification(&title, &body, PUBLIC_RELEASES_URL) {
        log::warn!("Toast 通知发送失败: {}，使用备用方案", e);
        send_notification_with_url_fallback(&title, &body, PUBLIC_RELEASES_URL);
    }
}

fn send_toast_notification(title: &str, body: &str, url: &str) -> Result<()> {
    unsafe {
        // 初始化 COM
        let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        if hr.is_err() && hr != windows::Win32::Foundation::RPC_E_CHANGED_MODE {
            return Err(Error::from_hresult(hr));
        }

        // 初始化 Windows Runtime
        RoInitialize(RO_INIT_SINGLETHREADED).ok();

        // 创建 Toast 通知管理器，使用应用程序标识符
        let app_id = HSTRING::from("Snow Shot");
        let toast_manager = ToastNotificationManager::CreateToastNotifierWithId(&app_id)?;

        // 创建 Toast XML 模板
        let toast_xml = create_toast_xml(title, body, url)?;

        // 创建 Toast 通知
        let toast = ToastNotification::CreateToastNotification(&toast_xml)?;

        // 发送通知
        toast_manager.Show(&toast)?;

        // 清理 COM
        CoUninitialize();
    }

    Ok(())
}

fn create_toast_xml(title: &str, body: &str, url: &str) -> Result<XmlDocument> {
    let xml_content = format!(
        r#"<toast activationType="protocol" launch="{}">
            <visual>
                <binding template="ToastGeneric">
                    <text>{}</text>
                    <text>{}</text>
                </binding>
            </visual>
        </toast>"#,
        url, title, body
    );

    let xml_doc = XmlDocument::new()?;
    xml_doc.LoadXml(&HSTRING::from(xml_content))?;

    Ok(xml_doc)
}

// 备用方案：使用简单的系统通知
pub fn send_simple_notification(title: &str, body: &str) -> Result<()> {
    use std::process::Command;

    // 使用 PowerShell 发送简单通知
    let script = format!(
        r#"Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.NotifyIcon]::new() | % {{
    $_.Icon = [System.Drawing.SystemIcons]::Information
    $_.BalloonTipTitle = '{}'
    $_.BalloonTipText = '{}'
    $_.BalloonTipIcon = 'Info'
    $_.Visible = $true
    $_.ShowBalloonTip(5000)
    Start-Sleep -Seconds 6
    $_.Dispose()
}}"#,
        title.replace("'", "''"),
        body.replace("'", "''")
    );

    Command::new("powershell")
        .args(&["-Command", &script])
        .output()
        .map_err(|_| Error::from_hresult(windows::Win32::Foundation::E_FAIL))?;

    Ok(())
}

// 带 URL 的备用通知函数
pub fn send_notification_with_url_fallback(title: &str, body: &str, url: &str) {
    // 使用 PowerShell 创建可点击的通知气球
    let script = format!(
        r#"Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipTitle = '{}'
$notify.BalloonTipText = '{} (点击打开网站)'
$notify.BalloonTipIcon = 'Info'
$notify.Visible = $true

# 添加点击事件
$notify.add_BalloonTipClicked({{
    Start-Process '{}'
}})

$notify.ShowBalloonTip(10000)
Start-Sleep -Seconds 12
$notify.Dispose()"#,
        title.replace("'", "''"),
        body.replace("'", "''"),
        url
    );

    if let Err(e) = std::process::Command::new("powershell")
        .args(&["-WindowStyle", "Hidden", "-Command", &script])
        .output()
    {
        log::error!("备用通知发送失败: {:?}", e);
    }
}

// 公共函数：尝试发送 Toast 通知，失败时使用备用方案
pub fn send_notification_with_fallback(title: &str, body: &str) {
    if send_toast_notification(title, body, PUBLIC_RELEASES_URL).is_err() {
        log::warn!("Toast 通知发送失败，使用备用方案");
        if let Err(e) = send_simple_notification(title, body) {
            log::error!("备用通知也发送失败: {:?}", e);
        }
    }
}
