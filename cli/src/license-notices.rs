use crate::dependency_manifest::{read_dependency_manifest, recorded_notices};
use crate::version::VERSION;
use anyhow::Result;
use serde_json::Value;
use std::path::Path;

pub const LICENSE_NOTICES_FILE: &str = "LICENSES.txt";

const HEADER: &str = "Third-party license notices

Every license notice carried by the code bundled into this build is reproduced
below, one block per notice, exactly as its authors wrote it. Ship this file
alongside the build: the licenses it lists require the notice to travel with the
code. Every script imp emitted points back here.";

const LIBRARY_HEADING: &str = "The imp library bundled into this build";

const RECORDED_HEADING: &str = "Packages bundled into this build

Recorded when each dependency was installed, one block per package.";

const EMBEDDED_HEADING: &str = "Notices carried in the bundled code";

pub struct Notices {
    pub library: Option<String>,
    pub recorded: Vec<String>,
    pub embedded: Vec<String>,
}

impl Notices {
    pub fn count(&self) -> usize {
        usize::from(self.library.is_some()) + self.recorded.len() + self.embedded.len()
    }

    pub fn file(&self) -> String {
        let mut sections: Vec<&str> = vec![HEADER];
        if let Some(library) = &self.library {
            sections.push(LIBRARY_HEADING);
            sections.push(library);
        }
        if !self.recorded.is_empty() {
            sections.push(RECORDED_HEADING);
            sections.extend(self.recorded.iter().map(String::as_str));
        }
        if !self.embedded.is_empty() {
            sections.push(EMBEDDED_HEADING);
            sections.extend(self.embedded.iter().map(String::as_str));
        }
        format!("{}\n", sections.join("\n\n"))
    }
}

pub fn collect_license_notices(
    root: &Path,
    dependencies: &[String],
    inputs: &[String],
    bundles_library: bool,
    embedded: Vec<String>,
) -> Result<(Notices, Vec<Value>, Vec<String>)> {
    let inputs: Vec<String> = inputs
        .iter()
        .map(|input| input.replace('\\', "/"))
        .collect();
    let mut manifests = Vec::new();
    let mut unrecorded = Vec::new();
    for alias in dependencies {
        let suffix = format!("dependencies/{alias}/{alias}.js");
        if !inputs.iter().any(|input| input.ends_with(&suffix)) {
            continue;
        }
        match read_dependency_manifest(root, alias)? {
            Some(manifest) => manifests.push(manifest),
            None => unrecorded.push(alias.clone()),
        }
    }
    let library = bundles_library.then(|| {
        format!(
            "imp@{VERSION} - MIT\n\n{}",
            crate::embedded::expect_text("LICENSE").trim_end()
        )
    });
    let notices = Notices {
        library,
        recorded: recorded_notices(&manifests),
        embedded,
    };
    Ok((notices, manifests, unrecorded))
}

pub fn unrecorded_licenses_warning(unrecorded: &[String]) -> String {
    format!(
        "no manifest.json for {} - the licenses of {} missing from {LICENSE_NOTICES_FILE}; run 'imp install' to record them",
        unrecorded.join(", "),
        if unrecorded.len() == 1 {
            "that dependency are"
        } else {
            "those dependencies are"
        }
    )
}

pub fn license_notices_reference(href: &str) -> String {
    format!("/*! Third-party license notices: {href} */\n")
}
