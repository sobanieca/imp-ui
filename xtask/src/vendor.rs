use imp::bundler::{Assets, Format, ImpLibrary, LegalComments, Options, bundle};
use std::path::{Path, PathBuf};

pub const PUPPETEER_VERSION: &str = "24.43.1";

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}

pub fn puppeteer() -> anyhow::Result<()> {
    let root = repo_root();
    let target = root.join("cli").join("vendor").join("puppeteer");
    let mut options = Options::new(&root);
    options.entries.push((
        Some("puppeteer".into()),
        format!(
            "npm:puppeteer-core@{PUPPETEER_VERSION}/lib/esm/puppeteer/puppeteer-core-browser.js"
        ),
    ));
    options.imp = ImpLibrary::External;
    options.externals = vec![
        "node:*".into(),
        "@puppeteer/browsers".into(),
        "ws".into(),
        "chromium-bidi".into(),
    ];
    options.format = Format::Esm;
    options.minify = true;
    options.split = true;
    options.assets = Assets::Files;
    options.legal_comments = LegalComments::Inline;
    options.entry_names = "[name].js".into();
    options.chunk_names = "[name]-[hash].js".into();
    let bundled = bundle(options).map_err(|error| anyhow::anyhow!("{error}"))?;
    let _ = std::fs::remove_dir_all(&target);
    std::fs::create_dir_all(&target)?;
    let banner = format!("// puppeteer-core@{PUPPETEER_VERSION}\n");
    for chunk in &bundled.chunks {
        std::fs::write(
            target.join(&chunk.file_name),
            format!("{banner}{}", chunk.code),
        )?;
        println!(
            "  cli/vendor/puppeteer/{} ({} kB)",
            chunk.file_name,
            chunk.code.len() / 1024
        );
    }
    let packages = imp::deps::bundled_packages(&bundled.inputs);
    for package in &packages {
        println!("  bundled {}@{}", package.name, package.version);
    }
    Ok(())
}
