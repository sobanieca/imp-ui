use crate::config::project_root;
use crate::paths::cwd;
use crate::version::VERSION;
use anyhow::{Result, bail};

const HELP: &str = include_str!("help.txt");

fn has(args: &[String], name: &str) -> bool {
    args.iter().any(|arg| arg == name)
}

fn flag(args: &[String], name: &str) -> Option<String> {
    let index = args.iter().position(|arg| arg == &format!("--{name}"))?;
    args.get(index + 1)
        .filter(|value| !value.is_empty())
        .cloned()
}

fn valued_flag(args: &[String], name: &str, problem: &str) -> Result<Option<String>> {
    let Some(index) = args.iter().position(|arg| arg == name) else {
        return Ok(None);
    };
    match args.get(index + 1) {
        Some(value) if !value.is_empty() && !value.starts_with("--") => Ok(Some(value.clone())),
        _ => bail!("{problem}"),
    }
}

fn font_flag(args: &[String]) -> Result<Option<String>> {
    valued_flag(
        args,
        "--font",
        "--font needs a font name, like '--font inter'",
    )
}

fn host_flag(args: &[String]) -> Result<Option<String>> {
    valued_flag(
        args,
        "--host",
        "--host needs an address, like '--host 0.0.0.0' to open the dev server to your network",
    )
}

fn port_flag(args: &[String]) -> Result<Option<u16>> {
    let Some(raw) = flag(args, "port") else {
        return Ok(None);
    };
    match raw.parse::<f64>() {
        Ok(value) if value.fract() == 0.0 && (0.0..=65535.0).contains(&value) => {
            Ok(Some(value as u16))
        }
        _ => bail!("--port must be an integer between 0 and 65535, got '{raw}'"),
    }
}

const MOCK_FLAGS: [&str; 2] = ["--mock", "--no-mock"];
const RELOAD_FLAG: &str = "--no-reload";

fn mock_flag(args: &[String]) -> Option<bool> {
    let mut chosen = None;
    for arg in args {
        if arg == "--mock" {
            chosen = Some(true);
        } else if arg == "--no-mock" {
            chosen = Some(false);
        }
    }
    chosen
}

fn positional(args: &[String]) -> Vec<String> {
    args.iter()
        .enumerate()
        .filter(|(index, arg)| {
            if arg.starts_with("--") {
                return false;
            }
            !(*index > 0 && args[index - 1].starts_with("--"))
        })
        .map(|(_, arg)| arg.clone())
        .collect()
}

fn without(args: &[String], removed: &[&str]) -> Vec<String> {
    args.iter()
        .filter(|arg| !removed.contains(&arg.as_str()))
        .cloned()
        .collect()
}

fn js_number(raw: &str) -> Option<f64> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some(0.0);
    }
    trimmed.parse::<f64>().ok()
}

pub fn main() -> i32 {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(code) => code,
        Err(error) => {
            crate::logger::error(&format!("{error:#}"));
            1
        }
    }
}

pub fn run(args: &[String]) -> Result<i32> {
    let command = args.first().map(String::as_str).unwrap_or("");
    let rest = if args.is_empty() { &[][..] } else { &args[1..] };
    crate::version_manager::maybe_delegate(args)?;
    let mut code = 0;
    match command {
        "--version" | "-v" => println!("{VERSION}"),
        "update" => {
            let requested = positional(rest).first().cloned();
            crate::version_manager::update(&cwd(), has(rest, "--check"), requested)?;
        }
        "prune" => crate::version_manager::prune()?,
        "init" => {
            let dir = positional(&without(rest, &["--pwa"])).first().cloned();
            crate::init::init(&cwd(), dir, has(rest, "--pwa"), font_flag(rest)?)?;
        }
        "start" => {
            crate::version_manager::notify_update(rest);
            let entry = positional(&without(rest, &["--mock", "--no-mock", RELOAD_FLAG]))
                .first()
                .cloned()
                .unwrap_or_else(|| "index.html".into());
            crate::start::start(crate::start::StartOptions {
                entry,
                port: port_flag(rest)?,
                host: host_flag(rest)?,
                env: flag(rest, "env"),
                mocks: mock_flag(rest),
                reload: !has(rest, RELOAD_FLAG),
            })?;
        }
        "preview" => {
            crate::version_manager::notify_update(rest);
            let mut boolean_flags = vec!["--list", "--json", RELOAD_FLAG];
            boolean_flags.extend(MOCK_FLAGS);
            let filtered = without(rest, &boolean_flags);
            crate::preview::preview(crate::preview::PreviewOptions {
                root: project_root(&cwd()),
                paths: positional(&filtered),
                port: port_flag(rest)?,
                host: host_flag(rest)?,
                env: flag(rest, "env"),
                list: has(rest, "--list"),
                json: has(rest, "--json"),
                mocks: mock_flag(rest),
                reload: !has(rest, RELOAD_FLAG),
                output: flag(rest, "output"),
            })?;
        }
        "review" => crate::review::review(&project_root(&cwd()), &positional(rest))?,
        "logs" => {
            let mut count = None;
            if let Some(index) = rest.iter().position(|arg| arg == "-n") {
                let raw = rest.get(index + 1).cloned().unwrap_or_default();
                let value = js_number(&raw);
                match value {
                    Some(value) if !raw.is_empty() && value.fract() == 0.0 && value > 0.0 => {
                        count = Some(value as usize)
                    }
                    _ => bail!("-n must be a positive integer, got '{raw}'"),
                }
            }
            let stray = rest
                .iter()
                .enumerate()
                .find(|(index, arg)| {
                    !["-f", "-n"].contains(&arg.as_str())
                        && (*index == 0 || rest[index - 1] != "-n")
                })
                .map(|(_, arg)| arg.clone());
            if let Some(stray) = stray {
                bail!("unknown argument '{stray}' - imp logs takes -n <count> and -f only");
            }
            crate::logs::logs(&project_root(&cwd()), count, has(rest, "-f"))?;
        }
        "build" => {
            crate::build::build(crate::build::BuildOptions {
                entry: positional(rest)
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "index.html".into()),
                output: flag(rest, "output").unwrap_or_else(|| "dist".into()),
                pwa: has(rest, "--pwa"),
                env: flag(rest, "env"),
            })?;
        }
        "install" => {
            let positionals = positional(rest);
            crate::install::install(
                &project_root(&cwd()),
                positionals.first().cloned(),
                positionals.get(1).cloned(),
                flag(rest, "alias"),
            )?;
        }
        "uninstall" => {
            crate::install::uninstall(&project_root(&cwd()), positional(rest).first().cloned())?
        }
        "audit" => {
            code = crate::audit::audit(
                &project_root(&cwd()),
                has(rest, "--sbom"),
                flag(rest, "output"),
            )?;
            if code != 0 {
                return Ok(code);
            }
        }
        "test" => {
            let mut boolean_flags = vec!["--list", "--unit", "--e2e"];
            boolean_flags.extend(MOCK_FLAGS);
            let filtered = without(rest, &boolean_flags);
            let jobs = match flag(rest, "jobs") {
                None => None,
                Some(raw) => match js_number(&raw) {
                    Some(value) if value > 0.0 => Some(value.floor() as usize),
                    _ => bail!("--jobs must be a positive integer, got '{raw}'"),
                },
            };
            let code = crate::test::run_tests(crate::test::TestOptions {
                root: cwd(),
                paths: positional(&filtered),
                list: has(rest, "--list"),
                unit: has(rest, "--unit"),
                e2e: has(rest, "--e2e"),
                jobs,
                filter: flag(rest, "filter"),
                screenshot_dir: flag(rest, "screenshots"),
                video_dir: flag(rest, "video"),
                mocks: mock_flag(rest),
            })?;
            crate::version_manager::notify_update(rest);
            return Ok(code);
        }
        "resize" => {
            let valued = ["-w", "--width", "-h", "--height", "--output"];
            let image = rest
                .iter()
                .enumerate()
                .find(|(index, arg)| {
                    !arg.starts_with('-')
                        && !(*index > 0 && valued.contains(&rest[index - 1].as_str()))
                })
                .map(|(_, arg)| arg.clone());
            let read_dimension = |short: &str, long: &str| -> Result<Option<u32>> {
                let Some(index) = rest.iter().position(|arg| arg == short || arg == long) else {
                    return Ok(None);
                };
                let raw = rest.get(index + 1).cloned().unwrap_or_default();
                match js_number(&raw) {
                    Some(value) if !raw.is_empty() && value.fract() == 0.0 && value > 0.0 => {
                        Ok(Some(value as u32))
                    }
                    _ => bail!("{long} must be a positive integer, got '{raw}'"),
                }
            };
            crate::resize::resize(crate::resize::ResizeOptions {
                root: project_root(&cwd()),
                image,
                width: read_dimension("-w", "--width")?,
                height: read_dimension("-h", "--height")?,
                output: flag(rest, "output"),
                stretch: has(rest, "--stretch"),
            })?;
        }
        "map" => crate::map::print_map(&cwd(), positional(rest).first().cloned())?,
        "skill" => {
            if has(rest, "--init") {
                if let Some(stray) = rest.iter().find(|arg| *arg != "--init") {
                    bail!("unknown argument '{stray}' - imp skill --init takes no other");
                }
                crate::skill_init::init_agent_skill()?;
            } else {
                crate::skill::print_skill(&positional(rest), &project_root(&cwd()))?;
            }
        }
        "licenses" => {
            println!(
                "{}",
                crate::embedded::expect_text("THIRD-PARTY-LICENSES.md").trim_end()
            )
        }
        "lint" => {
            let fix = has(rest, "--fix");
            let code = crate::lint::lint(&cwd(), &positional(&without(rest, &["--fix"])), fix)?;
            crate::version_manager::notify_update(rest);
            return Ok(code);
        }
        "fmt" => {
            let check = has(rest, "--check");
            let code = crate::fmt::fmt(&cwd(), &positional(&without(rest, &["--check"])), check)?;
            crate::version_manager::notify_update(rest);
            return Ok(code);
        }
        _ => {
            println!("{HELP}");
            if !command.is_empty() && command != "help" && command != "--help" {
                return Ok(1);
            }
        }
    }
    if command != "update" {
        crate::version_manager::notify_update(rest);
    }
    Ok(code)
}
