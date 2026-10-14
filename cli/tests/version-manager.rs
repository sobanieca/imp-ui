mod support;

use imp::http_client::{Fetched, sha256_hex};
use imp::version_manager::Releases;
use std::cell::RefCell;
use std::time::Duration;
use support::*;

const EXECUTABLE: &str = if cfg!(windows) { "imp.exe" } else { "imp" };
const DAY: u128 = 24 * 60 * 60 * 1000;

fn answer(status: u16, body: &[u8]) -> anyhow::Result<Fetched> {
    Ok(Fetched {
        status,
        body: body.to_vec(),
        retry_after: None,
    })
}

fn release_server(
    bytes: &'static [u8],
    checksum: Option<String>,
) -> impl Fn(&str) -> anyhow::Result<Fetched> {
    let digest = checksum.unwrap_or_else(|| sha256_hex(bytes));
    move |url: &str| {
        if url.ends_with(".sha256") {
            answer(200, format!("{digest}  imp\n").as_bytes())
        } else if url.contains("/releases/download/v9.9.9/") {
            answer(200, bytes)
        } else {
            answer(404, b"not found")
        }
    }
}

struct Recorder<F: Fn(&str) -> anyhow::Result<Fetched>> {
    serve: F,
    requests: RefCell<Vec<String>>,
}

impl<F: Fn(&str) -> anyhow::Result<Fetched>> Recorder<F> {
    fn new(serve: F) -> Self {
        Recorder {
            serve,
            requests: RefCell::new(Vec::new()),
        }
    }

    fn fetch(&self, url: &str, _: &[(&str, &str)], _: Option<Duration>) -> anyhow::Result<Fetched> {
        self.requests.borrow_mut().push(url.to_string());
        (self.serve)(url)
    }
}

fn error_of<T>(result: anyhow::Result<T>) -> String {
    result
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default()
}

#[test]
fn ensure_version_accepts_only_an_exact_version() {
    let cache = TempDir::new();
    let fetch = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(404, b"");
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    for version in ["latest", "1.2", "^1.2.3", "7"] {
        let message = error_of(releases.ensure_version(version));
        check(
            message.contains("is not an exact imp version"),
            format!("'{version}' gave '{message}'"),
        );
    }
}

#[test]
fn ensure_version_downloads_a_verified_binary_once_then_reuses_it() {
    let cache = TempDir::new();
    let recorder = Recorder::new(release_server(b"imp 9.9.9 binary", None));
    let fetch = |url: &str, headers: &[(&str, &str)], timeout: Option<Duration>| {
        recorder.fetch(url, headers, timeout)
    };
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let path = releases.ensure_version("9.9.9").unwrap();
    check(
        path == cache.join(&format!("versions/9.9.9/{EXECUTABLE}")),
        format!("unexpected path {}", path.display()),
    );
    check(read(&path) == "imp 9.9.9 binary", "the binary is stored");
    let requests = recorder.requests.borrow().clone();
    check(
        requests.len() == 2,
        format!("the first call fetches binary and checksum: {requests:?}"),
    );
    check(
        requests[1] == format!("{}.sha256", requests[0]),
        "the checksum comes from the same release as the binary",
    );
    check(
        releases.ensure_version("9.9.9").unwrap() == path,
        "the second call returns the cached binary",
    );
    check(
        recorder.requests.borrow().len() == 2,
        "the second call fetches nothing",
    );
}

#[test]
fn ensure_version_refuses_a_binary_whose_checksum_does_not_match() {
    let cache = TempDir::new();
    let serve = release_server(b"tampered", Some("a".repeat(64)));
    let fetch = |url: &str, _: &[(&str, &str)], _: Option<Duration>| serve(url);
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let message = error_of(releases.ensure_version("9.9.9"));
    check(
        message.contains("failed checksum verification"),
        format!("unexpected '{message}'"),
    );
    check(
        !cache.join(&format!("versions/9.9.9/{EXECUTABLE}")).exists(),
        "a binary that fails verification is not stored",
    );
}

#[test]
fn ensure_version_names_the_status_of_a_release_that_is_missing() {
    let cache = TempDir::new();
    let fetch = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(404, b"gone");
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let message = error_of(releases.ensure_version("9.9.8"));
    check(
        message.contains("responded 404"),
        format!("unexpected '{message}'"),
    );
}

#[test]
fn resolve_latest_version_reads_tag_name_without_the_leading_v() {
    let cache = TempDir::new();
    let recorder = Recorder::new(|_: &str| answer(200, br#"{"tag_name":"v4.5.6"}"#));
    let fetch = |url: &str, headers: &[(&str, &str)], timeout: Option<Duration>| {
        recorder.fetch(url, headers, timeout)
    };
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    check(
        releases.resolve_latest_version(None).unwrap() == "4.5.6",
        "the v prefix is removed",
    );
    check(
        recorder.requests.borrow()[0].ends_with("/releases/latest"),
        "unexpected request",
    );
    let limited = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(403, b"rate limited");
    let message = error_of(
        Releases {
            cache: cache.path.clone(),
            fetch: &limited,
        }
        .resolve_latest_version(None),
    );
    check(
        message.contains("GitHub responded 403"),
        format!("unexpected '{message}'"),
    );
    let empty = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(200, b"{}");
    let message = error_of(
        Releases {
            cache: cache.path.clone(),
            fetch: &empty,
        }
        .resolve_latest_version(None),
    );
    check(
        message.contains("no tag_name"),
        format!("unexpected '{message}'"),
    );
}

#[test]
fn prune_removes_only_the_versions_unused_for_over_30_days() {
    let cache = TempDir::new();
    let install = |version: &str, last_used: u128| {
        let dir = cache.join(&format!("versions/{version}"));
        write(&dir.join(EXECUTABLE), "binary");
        write(&dir.join("lastUsed"), &imp::time::iso_string(last_used));
    };
    let now = imp::time::now_millis();
    install("0.0.1", now - 40 * DAY);
    install("0.0.2", now - 2 * DAY);
    install(VERSION, now - 90 * DAY);
    let fetch = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(404, b"");
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let lines = releases.prune().unwrap();
    check(
        lines.contains(&"removed imp 0.0.1".to_string()),
        format!("unexpected output {lines:?}"),
    );
    check(
        lines
            .iter()
            .any(|line| line.starts_with("pruned 1 unused version")),
        format!("{lines:?}"),
    );
    check(
        !cache.join("versions/0.0.1").exists(),
        "the stale version is removed",
    );
    check(
        cache.join("versions/0.0.2").exists(),
        "a recent version is kept",
    );
    check(
        cache.join(&format!("versions/{VERSION}")).exists(),
        "the running version is kept",
    );
    let lines = releases.prune().unwrap();
    check(
        lines[0].starts_with("no unused imp versions to prune"),
        format!("unexpected {lines:?}"),
    );
}

#[test]
fn update_check_compares_the_latest_release_with_the_running_version() {
    let cache = TempDir::new();
    let fetch = |_: &str, _: &[(&str, &str)], _: Option<Duration>| answer(404, b"");
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let newer = releases
        .update(&cache.path, true, Some("999.0.0".into()))
        .unwrap();
    let older = releases
        .update(&cache.path, true, Some("0.0.0".into()))
        .unwrap();
    check(
        newer.starts_with("imp 999.0.0 is available"),
        format!("unexpected {newer}"),
    );
    check(
        older == format!("imp {VERSION} is up to date"),
        format!("unexpected {older}"),
    );
}

#[test]
fn update_downloads_the_version_and_pins_it_in_the_project() {
    let cache = TempDir::new();
    let project = TempDir::new();
    std::fs::create_dir_all(project.join(".git")).unwrap();
    write(
        &project.join("imp.json"),
        "{\n  \"version\": \"0.0.1\"\n}\n",
    );
    let serve = release_server(b"imp 9.9.9 binary", None);
    let fetch = |url: &str, _: &[(&str, &str)], _: Option<Duration>| serve(url);
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let line = releases
        .update(&project.path, false, Some("9.9.9".into()))
        .unwrap();
    check(
        line.starts_with("imp updated 0.0.1 -> 9.9.9"),
        format!("unexpected output {line}"),
    );
    let pinned: serde_json::Value = serde_json::from_str(&read(&project.join("imp.json"))).unwrap();
    check(
        pinned["version"] == "9.9.9",
        format!("the pin is {}", pinned["version"]),
    );
}

#[test]
fn a_pinned_project_runs_its_version_once() {
    let dir = TempDir::new();
    let cache = dir.join("cache");
    let project = dir.join("project");
    write(&project.join("imp.json"), "{ \"version\": \"9.9.9\" }\n");
    let fake = cache.join(format!("versions/9.9.9/{EXECUTABLE}"));
    write(
        &fake,
        "#!/bin/sh\necho \"delegated with IMP_DELEGATED=$IMP_DELEGATED\"\n",
    );
    std::process::Command::new("chmod")
        .args(["+x", &fake.to_string_lossy()])
        .status()
        .unwrap();
    let delegated = imp_command(&project)
        .arg("help")
        .env("IMP_CACHE_DIR", &cache)
        .env_remove("IMP_DELEGATED")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&delegated.stdout);
    check(
        stdout.trim() == "delegated with IMP_DELEGATED=1",
        format!("the pinned binary did not run: {stdout}"),
    );
    let own = imp_command(&project)
        .arg("help")
        .env("IMP_CACHE_DIR", &cache)
        .env("IMP_DELEGATED", "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&own.stdout);
    check(
        !stdout.contains("delegated"),
        "a delegated run delegated again",
    );
}

#[test]
fn the_update_notice_never_asks_github_when_the_check_is_turned_off() {
    let cache = TempDir::new();
    let recorder = Recorder::new(|_: &str| answer(200, br#"{"tag_name":"v999.0.0"}"#));
    let fetch = |url: &str, headers: &[(&str, &str)], timeout: Option<Duration>| {
        recorder.fetch(url, headers, timeout)
    };
    let releases = Releases {
        cache: cache.path.clone(),
        fetch: &fetch,
    };
    let none = |_: &str| None;
    let off = |name: &str| (name == "IMP_NO_UPDATE_CHECK").then(|| "1".to_string());
    let system = |name: &str| (name == "IMP_VERSION").then(|| "system".to_string());
    let notices = [
        releases.update_notice(&["--no-update-check".to_string()], true, &none),
        releases.update_notice(&[], true, &off),
        releases.update_notice(&[], true, &system),
        releases.update_notice(&[], false, &none),
    ];
    check(
        notices.iter().all(Option::is_none),
        format!("unexpected output {notices:?}"),
    );
    check(
        recorder.requests.borrow().is_empty(),
        format!("unexpected requests {:?}", recorder.requests.borrow()),
    );
}
