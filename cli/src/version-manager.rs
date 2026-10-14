use crate::cache_dir::imp_cache_directory;
use crate::colors::{cyan, dim};
use crate::config::{
    ConfigChange, Insertion, find_config_file, try_parse_config, update_config_file,
};
use crate::file_size::format_size;
use crate::http_client::{Fetched, get, sha256_hex};
use crate::specifiers::EXACT_VERSION;
use crate::version::{VERSION, is_newer};
use anyhow::{Result, anyhow, bail};
use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::time::Duration;

const REPO: &str = "sobanieca/imp-ui";
const UPDATE_CHECK_INTERVAL: u128 = 24 * 60 * 60 * 1000;
const STALE_AFTER: u128 = 30 * 24 * 60 * 60 * 1000;
const DELEGATED_ENV: &str = "IMP_DELEGATED";
const EXECUTABLE: &str = if cfg!(windows) { "imp.exe" } else { "imp" };

fn platform_slug() -> Result<&'static str> {
    Ok(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "x86_64") => "macos-x64",
        ("macos", "aarch64") => "macos-arm64",
        ("linux", "x86_64") => "linux-x64",
        ("linux", "aarch64") => "linux-arm64",
        ("windows", "x86_64") => "windows-x64",
        ("windows", "aarch64") => "windows-arm64",
        (os, arch) => bail!(
            "imp does not ship a binary for {os}/{arch} - supported platforms are macOS, Linux and Windows on x64 or arm64"
        ),
    })
}

fn asset_name() -> Result<String> {
    Ok(format!(
        "imp-{}{}",
        platform_slug()?,
        if cfg!(windows) { ".exe" } else { "" }
    ))
}

pub type Fetch<'f> = dyn Fn(&str, &[(&str, &str)], Option<Duration>) -> Result<Fetched> + 'f;

pub struct Releases<'a> {
    pub cache: PathBuf,
    pub fetch: &'a Fetch<'a>,
}

fn network_get(url: &str, headers: &[(&str, &str)], timeout: Option<Duration>) -> Result<Fetched> {
    get(url, headers, timeout)
}

fn system() -> Result<Releases<'static>> {
    Ok(Releases {
        cache: imp_cache_directory()?,
        fetch: &network_get,
    })
}

fn release_asset_url(version: &str) -> Result<String> {
    Ok(format!(
        "https://github.com/{REPO}/releases/download/v{version}/{}",
        asset_name()?
    ))
}

fn read_pin(start: &Path) -> Option<String> {
    let found = find_config_file(start)?;
    let text = std::fs::read_to_string(found.path).ok()?;
    try_parse_config(&text)?
        .get("version")?
        .as_str()
        .map(String::from)
}

fn config_in_dir(dir: &Path) -> Option<PathBuf> {
    ["imp.json", "imp.jsonc"]
        .iter()
        .map(|name| dir.join(name))
        .find(|path| path.exists())
}

fn find_pin_target(start: &Path) -> Option<PathBuf> {
    let mut dir = start.to_path_buf();
    let mut nearest = None;
    loop {
        let config = config_in_dir(&dir);
        if config.is_some() && nearest.is_none() {
            nearest = config.clone();
        }
        if dir.join(".git").exists() {
            return config.or(nearest);
        }
        if !dir.pop() {
            return nearest;
        }
    }
}

impl Releases<'_> {
    fn versions_dir(&self) -> Result<PathBuf> {
        Ok(self.cache.join("versions"))
    }

    fn version_dir(&self, version: &str) -> Result<PathBuf> {
        Ok(self.versions_dir()?.join(version))
    }

    fn version_binary_path(&self, version: &str) -> Result<PathBuf> {
        Ok(self.version_dir(version)?.join(EXECUTABLE))
    }

    fn fetch_expected_checksum(&self, url: &str, version: &str) -> Result<String> {
        let response = (self.fetch)(&format!("{url}.sha256"), &[], None).map_err(|error| {
            anyhow!("imp {version} checksum could not be fetched from {url}.sha256 - {error}")
        })?;
        if !response.ok() {
            bail!(
                "imp {version} checksum could not be fetched - {url}.sha256 responded {}",
                response.status
            );
        }
        let text = response.text();
        let hex = text.split_whitespace().next().unwrap_or("").to_lowercase();
        if hex.len() != 64 || !hex.chars().all(|char| char.is_ascii_hexdigit()) {
            bail!("imp {version} checksum is malformed at {url}.sha256");
        }
        Ok(hex)
    }

    fn download_version(&self, version: &str) -> Result<PathBuf> {
        let url = release_asset_url(version)?;
        let response = (self.fetch)(&url, &[], None).map_err(|error| {
            anyhow!("imp {version} could not be downloaded from {url} - {error}")
        })?;
        if !response.ok() {
            bail!(
                "imp {version} could not be downloaded - {url} responded {}",
                response.status
            );
        }
        let expected = self.fetch_expected_checksum(&url, version)?;
        let actual = sha256_hex(&response.body);
        if actual != expected {
            bail!("imp {version} failed checksum verification - expected {expected}, got {actual}");
        }
        let dir = self.version_dir(version)?;
        std::fs::create_dir_all(&dir)?;
        let final_path = dir.join(EXECUTABLE);
        let temp_path = dir.join(format!("{EXECUTABLE}.download-{}", std::process::id()));
        std::fs::write(&temp_path, &response.body)?;
        make_executable(&temp_path);
        std::fs::rename(&temp_path, &final_path)?;
        Ok(final_path)
    }

    pub fn ensure_version(&self, version: &str) -> Result<PathBuf> {
        if !EXACT_VERSION.is_match(version) {
            bail!("'{version}' is not an exact imp version - expected a version like '1.2.3'");
        }
        let path = self.version_binary_path(version)?;
        if path.exists() {
            return Ok(path);
        }
        eprintln!("{}", dim(format!("imp {version} - downloading...")));
        let downloaded = self.download_version(version)?;
        self.warn_stale_versions(version);
        Ok(downloaded)
    }

    pub fn resolve_latest_version(&self, timeout: Option<Duration>) -> Result<String> {
        let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
        let response = (self.fetch)(&url, &[("accept", "application/vnd.github+json")], timeout)?;
        if !response.ok() {
            bail!(
                "could not resolve the latest imp release - GitHub responded {}",
                response.status
            );
        }
        let tag = response
            .json()?
            .get("tag_name")
            .and_then(|tag| tag.as_str().map(String::from));
        match tag {
            Some(tag) => Ok(tag.strip_prefix('v').map(String::from).unwrap_or(tag)),
            None => {
                bail!(
                    "could not resolve the latest imp release - no tag_name in the GitHub response"
                )
            }
        }
    }

    fn touch_last_used(&self, version: &str) {
        if let Ok(dir) = self.version_dir(version)
            && dir.exists()
        {
            let _ = std::fs::write(
                dir.join("lastUsed"),
                crate::time::iso_string(crate::time::now_millis()),
            );
        }
    }

    fn last_used_time(&self, version: &str) -> u128 {
        if let Ok(dir) = self.version_dir(version)
            && let Some(parsed) = std::fs::read_to_string(dir.join("lastUsed"))
                .ok()
                .and_then(|text| parse_iso_millis(&text))
        {
            return parsed;
        }
        self.version_binary_path(version)
            .ok()
            .and_then(|path| std::fs::metadata(path).ok())
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|elapsed| elapsed.as_millis())
            .unwrap_or_else(crate::time::now_millis)
    }

    fn stale_versions(&self, exclude: &str) -> Vec<String> {
        let now = crate::time::now_millis();
        let Ok(dir) = self.versions_dir() else {
            return Vec::new();
        };
        let Ok(entries) = std::fs::read_dir(dir) else {
            return Vec::new();
        };
        let mut stale: Vec<String> = entries
            .flatten()
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|version| version != exclude)
            .filter(|version| {
                self.version_binary_path(version)
                    .is_ok_and(|path| path.exists())
            })
            .filter(|version| now.saturating_sub(self.last_used_time(version)) > STALE_AFTER)
            .collect();
        stale.sort();
        stale
    }

    fn warn_stale_versions(&self, just_installed: &str) {
        let stale = self.stale_versions(just_installed);
        if stale.is_empty() {
            return;
        }
        let single = stale.len() == 1;
        eprintln!(
            "{}",
            dim(format!(
                "{} unused imp {} ({}) {} not run in over 30 days - run 'imp prune' to remove {} and reclaim disk space",
                stale.len(),
                if single { "version" } else { "versions" },
                stale.join(", "),
                if single { "has" } else { "have" },
                if single { "it" } else { "them" }
            ))
        );
    }
}

#[cfg(unix)]
pub fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
}

#[cfg(not(unix))]
pub fn make_executable(_path: &Path) {}

fn parse_iso_millis(text: &str) -> Option<u128> {
    let text = text.trim();
    let (date, time) = text.split_once('T')?;
    let mut parts = date.split('-').map(|part| part.parse::<i64>().ok());
    let (year, month, day) = (parts.next()??, parts.next()??, parts.next()??);
    let time = time.trim_end_matches('Z');
    let (hms, millis) = time.split_once('.').unwrap_or((time, "0"));
    let mut clock = hms.split(':').map(|part| part.parse::<i64>().ok());
    let (hour, minute, second) = (clock.next()??, clock.next()??, clock.next()??);
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let seconds = days * 86_400 + hour * 3600 + minute * 60 + second;
    Some(seconds as u128 * 1000 + millis.parse::<u128>().unwrap_or(0))
}

fn directory_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                directory_size(&path)
            } else {
                std::fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0)
            }
        })
        .sum()
}

impl Releases<'_> {
    pub fn prune(&self) -> Result<Vec<String>> {
        let stale = self.stale_versions(VERSION);
        if stale.is_empty() {
            return Ok(vec![
                "no unused imp versions to prune - nothing cached is older than 30 days".into(),
            ]);
        }
        let mut lines = Vec::new();
        let mut freed = 0;
        for version in &stale {
            let dir = self.version_dir(version)?;
            freed += directory_size(&dir);
            let _ = std::fs::remove_dir_all(&dir);
            lines.push(format!("removed imp {version}"));
        }
        let single = stale.len() == 1;
        lines.push(format!(
            "pruned {} unused {}, freed {}",
            stale.len(),
            if single { "version" } else { "versions" },
            format_size(freed)
        ));
        Ok(lines)
    }

    pub fn update(&self, root: &Path, check: bool, requested: Option<String>) -> Result<String> {
        let target = match requested {
            Some(version) => version,
            None => self.resolve_latest_version(None)?,
        };
        if check {
            return Ok(if is_newer(&target, VERSION) {
                format!("imp {target} is available (you have {VERSION}) - run 'imp update'")
            } else {
                format!("imp {VERSION} is up to date")
            });
        }
        self.ensure_version(&target)?;
        let Some(pin_path) = find_pin_target(root) else {
            return Ok(format!(
                "imp {target} downloaded - no imp.json or imp.jsonc found, so no project pin was written"
            ));
        };
        let previous = std::fs::read_to_string(&pin_path)
            .ok()
            .and_then(|text| try_parse_config(&text))
            .and_then(|config| {
                config
                    .get("version")
                    .and_then(|value| value.as_str().map(String::from))
            });
        update_config_file(
            &pin_path,
            &[ConfigChange {
                path: vec!["version".into()],
                value: Some(serde_json::Value::String(target.clone())),
                insertion: Insertion::First,
            }],
        )?;
        let change = match previous {
            Some(previous) if previous != target => format!("{previous} -> {target}"),
            _ => target.clone(),
        };
        Ok(format!(
            "imp updated {change} (pinned in {})",
            pin_path.display()
        ))
    }

    fn latest_release_throttled(&self) -> Result<String> {
        let cache_path = self.cache.join("update-check.json");
        let now = crate::time::now_millis();
        if let Some(cache) = std::fs::read_to_string(&cache_path)
            .ok()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            && let (Some(latest), Some(checked)) = (
                cache.get("latest").and_then(|v| v.as_str()),
                cache.get("checkedAt").and_then(|v| v.as_f64()),
            )
            && now.saturating_sub(checked as u128) < UPDATE_CHECK_INTERVAL
        {
            return Ok(latest.to_string());
        }
        let latest = self.resolve_latest_version(Some(Duration::from_millis(2000)))?;
        let _ = std::fs::create_dir_all(&self.cache);
        let _ = std::fs::write(
            &cache_path,
            serde_json::json!({ "latest": latest, "checkedAt": now as u64 }).to_string(),
        );
        Ok(latest)
    }

    pub fn update_notice(
        &self,
        args: &[String],
        interactive: bool,
        shell: &dyn Fn(&str) -> Option<String>,
    ) -> Option<String> {
        if args.iter().any(|arg| arg == "--no-update-check")
            || shell("IMP_NO_UPDATE_CHECK").is_some_and(|value| !value.is_empty())
            || shell("IMP_VERSION").is_some_and(|value| value == "system")
            || !interactive
            || read_pin(&crate::paths::cwd()).is_some()
        {
            return None;
        }
        let latest = self.latest_release_throttled().ok()?;
        is_newer(&latest, VERSION).then(|| {
            format!(
                "{}{}",
                cyan(format!("imp {latest} is available")),
                dim(format!(" (you have {VERSION}) - run 'imp update'"))
            )
        })
    }
}

pub fn prune() -> Result<()> {
    for line in system()?.prune()? {
        println!("{line}");
    }
    Ok(())
}

pub fn update(root: &Path, check: bool, requested: Option<String>) -> Result<()> {
    println!("{}", system()?.update(root, check, requested)?);
    Ok(())
}

pub fn ensure_version(version: &str) -> Result<PathBuf> {
    system()?.ensure_version(version)
}

pub fn maybe_delegate(args: &[String]) -> Result<()> {
    let releases = system()?;
    releases.touch_last_used(VERSION);
    let delegated = std::env::var(DELEGATED_ENV).is_ok_and(|value| value == "1");
    // SAFETY: imp is single threaded at this point of start-up.
    unsafe { std::env::remove_var(DELEGATED_ENV) };
    if delegated || std::env::var("IMP_VERSION").is_ok_and(|value| value == "system") {
        return Ok(());
    }
    let Some(pin) = read_pin(&crate::paths::cwd()) else {
        return Ok(());
    };
    if pin == VERSION {
        return Ok(());
    }
    let binary = releases.ensure_version(&pin).map_err(|error| {
        anyhow!("{error}\n(imp.json pins version {pin}; set IMP_VERSION=system to run this binary regardless)")
    })?;
    let status = std::process::Command::new(binary)
        .args(args)
        .env(DELEGATED_ENV, "1")
        .status()?;
    std::process::exit(status.code().unwrap_or(1));
}

pub fn notify_update(args: &[String]) {
    let Ok(releases) = system() else { return };
    let shell = |name: &str| std::env::var(name).ok();
    if let Some(notice) = releases.update_notice(args, std::io::stdout().is_terminal(), &shell) {
        println!("{notice}");
    }
}
