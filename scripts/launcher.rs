#![windows_subsystem = "windows"]

use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let exe_path = env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let base_dir = exe_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let target_exe = base_dir
        .join("openide-win32-x64")
        .join("openide.exe");

    let args: Vec<String> = env::args().skip(1).collect();
    if target_exe.exists() {
        let _ = Command::new(target_exe)
            .args(&args)
            .current_dir(base_dir)
            .spawn();
    }
}
