use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

const EMBEDDED_TREES: &[(&str, &[&str])] = &[
    ("lib/src", &["public", ".imp"]),
    ("skills", &[]),
    ("cli/js", &[]),
    ("cli/templates", &[]),
    ("cli/vendor", &[]),
];

const EMBEDDED_FILES: &[&str] = &["THIRD-PARTY-LICENSES.md", "LICENSE"];

fn collect(root: &Path, relative: &str, skipped: &[&str], into: &mut Vec<String>) {
    let directory = root.join(relative);
    let Ok(entries) = fs::read_dir(&directory) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = format!("{relative}/{name}");
        let file_type = entry.file_type().expect("file type");
        if file_type.is_dir() {
            if skipped.iter().any(|skip| *skip == name) || name.starts_with('.') {
                continue;
            }
            collect(root, &path, &[], into);
        } else if file_type.is_file() {
            into.push(path);
        }
    }
}

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest.parent().unwrap().to_path_buf();
    let mut files = Vec::new();
    for (tree, skipped) in EMBEDDED_TREES {
        println!("cargo:rerun-if-changed={}", root.join(tree).display());
        collect(&root, tree, skipped, &mut files);
    }
    for file in EMBEDDED_FILES {
        println!("cargo:rerun-if-changed={}", root.join(file).display());
        files.push((*file).to_string());
    }
    files.sort();
    let mut source = String::from("pub static FILES: &[(&str, &[u8])] = &[\n");
    for file in &files {
        let absolute = root.join(file);
        writeln!(source, "    ({file:?}, include_bytes!({:?})),", absolute.display().to_string())
            .unwrap();
    }
    source.push_str("];\n");
    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("embedded.rs");
    fs::write(out, source).unwrap();
}
