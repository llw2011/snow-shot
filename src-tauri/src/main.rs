// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "dhat-heap")]
use app_lib::PROFILER;

#[cfg(feature = "dhat-heap")]
#[global_allocator]
static ALLOC: dhat::Alloc = dhat::Alloc;

#[cfg(feature = "dhat-heap")]
#[tokio::main]
async fn main() {
    #[cfg(feature = "dhat-heap")]
    PROFILER.lock().await.replace(dhat::Profiler::new_heap());

    snow_shot_lib::run();
}

#[cfg(target_os = "windows")]
const DELAY_SECONDS: u64 = 10;

#[cfg(target_os = "macos")]
const DELAY_SECONDS: u64 = 3;

#[cfg(not(feature = "dhat-heap"))]
fn main() {
    let default_panic = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        use std::backtrace::Backtrace;

        let backtrace = Backtrace::force_capture();
        log::error!("Panic: {info}\n{backtrace}");
        default_panic(info);
    }));

    // 检测命令行参数是否包含 --auto_start
    // 如果是自动启动可能会失败，尝试延迟一段时间再启动
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--auto_start".to_string()) {
        println!(
            "[main] --auto_start parameter detected, delaying {} seconds before starting",
            DELAY_SECONDS
        );
        std::thread::sleep(std::time::Duration::from_secs(DELAY_SECONDS));
    }

    snow_shot_lib::run();
}
