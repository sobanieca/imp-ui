mod check;
mod licenses;
#[path = "natural-earth.rs"]
mod natural_earth;
mod perf;
mod script;
mod site;
mod vendor;
mod workspace;

use anyhow::Result;
use std::process::ExitCode;
use workspace::{build_imp, repo_root, run_imp};

const USAGE: &str = "usage: cargo xtask <task>

  example                serve the todo example on http://localhost:4400/
  preview                serve the component previews on http://localhost:4401/
  site                   build the home page into site/dist/ and serve it with rfm
  build-site             build the home page into site/dist/
  test [filter]          run the library tests, then the Rust tests
  check [--verify]       format and lint the repository (--verify: write nothing)
  verify                 check without writing, then test
  update-snapshots       run the CLI tests and rewrite their snapshots
  binary-size            fail when the release binary is over binary-size-limit.json
  vendor-lucide          regenerate lib/src/icons/lucide-icons.js
  vendor-natural-earth   regenerate the world data of map
  vendor-puppeteer       regenerate cli/vendor/puppeteer/
  licenses               list the crates of the binary in THIRD-PARTY-LICENSES.md
  perf [options]         build the perf apps and run the scenarios
  perf-profile <file>    print the functions with the most self time in a CPU profile";

fn serve(folder: &str, command: &str) -> Result<()> {
    let binary = build_imp("dev")?;
    run_imp(
        &binary,
        &[command, "--no-reload"],
        &repo_root().join(folder),
    )
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let task = args.first().map(String::as_str).unwrap_or("");
    let rest = args.get(1..).unwrap_or_default();
    let result = match task {
        "example" => serve("examples", "start"),
        "preview" => serve("lib/src", "preview"),
        "site" => site::serve_site(),
        "build-site" => site::build_site(),
        "test" => check::test(rest),
        "check" => check::check(!rest.iter().any(|arg| arg == "--verify")),
        "verify" => check::check(false).and_then(|()| check::test(rest)),
        "update-snapshots" => check::update_snapshots(),
        "binary-size" => check::binary_size(),
        "vendor-lucide" => vendor::lucide(),
        "vendor-natural-earth" => natural_earth::natural_earth(),
        "vendor-puppeteer" => vendor::puppeteer(),
        "licenses" => licenses::write(),
        "perf" => perf::perf(rest),
        "perf-profile" => perf::profile_summary(rest),
        _ => {
            eprintln!("{USAGE}");
            return ExitCode::FAILURE;
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::FAILURE
        }
    }
}
