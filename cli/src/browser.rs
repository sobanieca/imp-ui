use crate::cache_dir::imp_cache_directory;
use crate::http_client::{get, sha256_hex};
use crate::logger;
use anyhow::{Result, anyhow, bail};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

pub const CHROME_VERSION: &str = "156.0.8078.47";

struct Build {
    platform: &'static str,
    sha256: &'static str,
    executable: &'static [&'static str],
}

fn current_build() -> Option<Build> {
    Some(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => Build {
            platform: "linux64",
            sha256: "e6c94490f0b6b337225aeb2d2a5034858516b7017356980ba94f5176d8774a50",
            executable: &["chrome-linux64", "chrome"],
        },
        ("macos", "aarch64") => Build {
            platform: "mac-arm64",
            sha256: "ad7f2b49a4dc679af286b1b1b386670d93ca7868079f69012d21ba0ac8293df3",
            executable: &[
                "chrome-mac-arm64",
                "Google Chrome for Testing.app",
                "Contents",
                "MacOS",
                "Google Chrome for Testing",
            ],
        },
        ("macos", "x86_64") => Build {
            platform: "mac-x64",
            sha256: "5a38b8e3d621514fff0775dcae678a152ce378890188c88eef79fc97aa59fccd",
            executable: &[
                "chrome-mac-x64",
                "Google Chrome for Testing.app",
                "Contents",
                "MacOS",
                "Google Chrome for Testing",
            ],
        },
        ("windows", "x86_64") => Build {
            platform: "win64",
            sha256: "a4e0d57245e167e98a9d465af1e3774d2b4ec9f04e483d19bcd97a6f63cf46dd",
            executable: &["chrome-win64", "chrome.exe"],
        },
        _ => return None,
    })
}

fn system_browsers() -> (&'static [&'static str], &'static [&'static str]) {
    match std::env::consts::OS {
        "linux" => (
            &[
                "google-chrome",
                "google-chrome-stable",
                "chromium",
                "chromium-browser",
                "chrome",
            ],
            &[],
        ),
        "macos" => (
            &[],
            &[
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Chromium.app/Contents/MacOS/Chromium",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            ],
        ),
        "windows" => (
            &[],
            &[
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            ],
        ),
        _ => (&[], &[]),
    }
}

pub fn browser_cache_directory() -> Result<PathBuf> {
    Ok(imp_cache_directory()?
        .join("browser")
        .join(format!("chrome-{CHROME_VERSION}")))
}

pub fn find_system_browser() -> Option<PathBuf> {
    let (commands, paths) = system_browsers();
    for path in paths {
        if Path::new(path).is_file() {
            return Some(PathBuf::from(path));
        }
    }
    let path_value = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&path_value) {
        for command in commands {
            let candidate = directory.join(command);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

pub fn find_cached_browser() -> Option<PathBuf> {
    let build = current_build()?;
    let mut path = browser_cache_directory().ok()?;
    for part in build.executable {
        path.push(part);
    }
    path.is_file().then_some(path)
}

fn extract_zip(bytes: &[u8], directory: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))?;
    let mut symlinks = Vec::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.is_dir() {
            continue;
        }
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let path = directory.join(name);
        let mode = entry.unix_mode().unwrap_or(0o644);
        let mut data = Vec::new();
        std::io::Read::read_to_end(&mut entry, &mut data)?;
        if mode & 0o170000 == 0o120000 {
            symlinks.push((String::from_utf8_lossy(&data).into_owned(), path));
            continue;
        }
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, &data)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = if mode & 0o777 == 0 {
                0o644
            } else {
                mode & 0o777
            };
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(permissions))?;
        }
    }
    #[cfg(unix)]
    for (target, path) in symlinks {
        std::fs::create_dir_all(path.parent().unwrap())?;
        let _ = std::fs::remove_file(&path);
        std::os::unix::fs::symlink(target, &path)?;
    }
    Ok(())
}

pub fn download_browser() -> Result<PathBuf> {
    let Some(build) = current_build() else {
        bail!(
            "no managed browser build for {}-{} - point imp at an installed Chrome or Chromium via \"test\": {{ \"browser\": \"<path>\" }} in imp.json",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    };
    let url = format!(
        "https://storage.googleapis.com/chrome-for-testing-public/{CHROME_VERSION}/{}/chrome-{}.zip",
        build.platform, build.platform
    );
    let directory = browser_cache_directory()?;
    let parent = directory.parent().unwrap();
    std::fs::create_dir_all(parent)?;
    // Parallel `imp test` workers are separate processes that can all find the
    // cache empty at once. One downloads under the lock; the rest wait for it
    // and then find the finished browser.
    let lock = std::fs::File::create(parent.join(format!("chrome-{CHROME_VERSION}.lock")))?;
    lock.lock()?;
    if let Some(executable) = find_cached_browser() {
        return Ok(executable);
    }
    logger::info(&format!(
        "downloading Chrome {CHROME_VERSION} for browser tests (one-time, cached in {})...",
        parent.display()
    ));
    let response = get(&url, &[], None)?;
    if !response.ok() {
        bail!("browser download failed: {} {url}", response.status);
    }
    let digest = sha256_hex(&response.body);
    if digest != build.sha256 {
        bail!(
            "browser download checksum mismatch for {url}\n  expected {}\n  received {digest}",
            build.sha256
        );
    }
    // Unpack beside the cache and rename it into place when complete, so
    // find_cached_browser never sees an executable that is still being written.
    let staging = parent.join(format!("chrome-{CHROME_VERSION}.partial"));
    let _ = std::fs::remove_dir_all(&staging);
    extract_zip(&response.body, &staging)?;
    let _ = std::fs::remove_dir_all(&directory);
    std::fs::rename(&staging, &directory)?;
    let executable = find_cached_browser()
        .ok_or_else(|| anyhow!("browser download completed but no executable was found"))?;
    logger::info(&format!("browser ready: {}", executable.display()));
    Ok(executable)
}

pub fn resolve_browser(configured: Option<&str>) -> Result<PathBuf> {
    if let Some(path) = configured {
        if !Path::new(path).is_file() {
            bail!("configured test browser not found: {path}");
        }
        return Ok(PathBuf::from(path));
    }
    if let Some(path) = std::env::var_os("IMP_BROWSER").filter(|value| !value.is_empty()) {
        let path = PathBuf::from(path);
        if !path.is_file() {
            bail!("IMP_BROWSER points to a missing file: {}", path.display());
        }
        return Ok(path);
    }
    if let Some(found) = find_system_browser().or_else(find_cached_browser) {
        return Ok(found);
    }
    download_browser()
}

pub struct Chrome {
    child: Child,
    profile: PathBuf,
    endpoint: Arc<(Mutex<Option<String>>, Condvar)>,
}

fn running_as_root() -> bool {
    #[cfg(unix)]
    {
        std::fs::metadata("/proc/self")
            .map(|meta| std::os::unix::fs::MetadataExt::uid(&meta) == 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        false
    }
}

impl Chrome {
    pub fn launch(executable: &Path, url: &str) -> Result<Chrome> {
        let profile = std::env::temp_dir().join(format!(
            "imp-chrome-{}-{}",
            std::process::id(),
            crate::time::now_millis()
        ));
        std::fs::create_dir_all(&profile)?;
        let mut command = Command::new(executable);
        command.args([
            "--headless=new",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--disable-dev-shm-usage",
            "--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,CertificateTransparencyComponentUpdater",
            "--disable-client-side-phishing-detection",
            "--disable-domain-reliability",
            "--disable-breakpad",
            "--no-pings",
            "--no-service-autorun",
            "--metrics-recording-only",
            "--password-store=basic",
            "--use-mock-keychain",
            "--mute-audio",
            "--hide-scrollbars",
            "--window-size=800,600",
            "--remote-debugging-port=0",
            "--remote-allow-origins=*",
        ]);
        if running_as_root() {
            command.arg("--no-sandbox");
        }
        command.arg(format!("--user-data-dir={}", profile.display()));
        command.arg(url);
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|error| {
            anyhow!(
                "could not start the browser {} - {error}",
                executable.display()
            )
        })?;
        let endpoint = Arc::new((Mutex::new(None), Condvar::new()));
        let stderr = child.stderr.take().unwrap();
        let shared = endpoint.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Some(index) = line.find("ws://") {
                    let (lock, ready) = &*shared;
                    *lock.lock().unwrap() = Some(line[index..].trim().to_string());
                    ready.notify_all();
                }
            }
        });
        Ok(Chrome {
            child,
            profile,
            endpoint,
        })
    }

    pub fn endpoint(&self, timeout: Duration) -> Option<String> {
        let (lock, ready) = &*self.endpoint;
        let guard = lock.lock().unwrap();
        let (guard, _) = ready
            .wait_timeout_while(guard, timeout, |value| value.is_none())
            .unwrap();
        guard.clone()
    }

    pub fn shared_endpoint(&self) -> Arc<(Mutex<Option<String>>, Condvar)> {
        self.endpoint.clone()
    }

    pub fn exited(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(Some(_)))
    }
}

impl Drop for Chrome {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        for _ in 0..20 {
            if std::fs::remove_dir_all(&self.profile).is_ok() || !self.profile.exists() {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}
