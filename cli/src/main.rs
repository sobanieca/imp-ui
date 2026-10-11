mod audit;
#[path = "base-path.rs"]
mod base_path;
#[path = "browser-script.rs"]
mod browser_script;
mod build;
mod deps;
#[path = "dependency-manifest.rs"]
mod dependency_manifest;
mod integrity;
#[path = "license-policy.rs"]
mod license_policy;
mod bundler;
mod npm;
#[path = "cache-dir.rs"]
mod cache_dir;
mod cli;
mod colors;
mod config;
#[path = "dev-log.rs"]
mod dev_log;
mod embedded;
mod environments;
#[path = "file-size.rs"]
mod file_size;
mod flags;
mod fmt;
#[path = "http-client.rs"]
mod http_client;
mod init;
mod install;
#[path = "js-scan.rs"]
mod js_scan;
mod json;
mod lint;
mod logger;
mod logs;
mod map;
mod paths;
mod preview;
#[path = "project-files.rs"]
mod project_files;
mod resize;
mod review;
mod skill;
#[path = "skill-init.rs"]
mod skill_init;
mod specifiers;
mod start;
mod test;
mod time;
mod version;
#[path = "version-manager.rs"]
mod version_manager;
mod walk;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match cli::run(&args) {
        Ok(code) => code,
        Err(error) => {
            logger::error(&format!("{error:#}"));
            1
        }
    };
    std::process::exit(code);
}
