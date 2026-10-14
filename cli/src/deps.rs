use crate::bundler::{
    Assets, Bundle, BundleError, Format, ImpLibrary, LegalComments, Options, bundle,
};
use crate::dependency_manifest::PackageRecord;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub fn bundled_packages(inputs: &[String]) -> Vec<PackageRecord> {
    let Ok(npm) = crate::npm::shared() else {
        return Vec::new();
    };
    let mut packages: BTreeMap<String, PackageRecord> = BTreeMap::new();
    for input in inputs {
        let path = Path::new(input);
        let Some(package) = npm.package_of_path(path) else {
            continue;
        };
        let id = format!("{}@{}", package.name, package.version);
        let file = crate::paths::relative_posix(&package.directory, path);
        let record = packages.entry(id).or_insert_with(|| PackageRecord {
            registry: package.registry,
            name: package.name.clone(),
            version: package.version.clone(),
            directory: package.directory.clone(),
            files: Vec::new(),
            integrity: None,
            attestation_listed: false,
        });
        if !record.files.contains(&file) {
            record.files.push(file);
        }
    }
    packages.into_values().collect()
}

pub struct BundledDependency {
    pub files: Vec<(String, Vec<u8>)>,
    pub entry: Option<PathBuf>,
    pub packages: Vec<PackageRecord>,
    pub imp_imports: Vec<String>,
}

fn kept_imp_imports(bundle: &Bundle) -> Vec<String> {
    bundle
        .external_imports
        .iter()
        .filter(|import| *import == "imp" || import.starts_with("imp/"))
        .cloned()
        .collect()
}

pub fn bundle_dependency(
    root: &Path,
    specifier: &str,
    alias: &str,
) -> Result<BundledDependency, BundleError> {
    let mut options = Options::new(root).entry(specifier);
    options.entries[0].0 = Some(alias.to_string());
    options.imp = ImpLibrary::External;
    options.external_imp = true;
    options.minify = true;
    options.format = Format::Esm;
    options.legal_comments = LegalComments::Inline;
    options.assets = Assets::Files;
    options.entry_names = "[name].js".into();
    options.chunk_names = format!("{alias}-[hash].js");
    options.asset_names = "[name]-[hash][extname]".into();
    options.public_path = Some(format!("/dependencies/{alias}/"));
    let bundled = bundle(options)?;
    let mut files: Vec<(String, Vec<u8>)> = bundled
        .chunks
        .iter()
        .map(|chunk| (chunk.file_name.clone(), chunk.code.as_bytes().to_vec()))
        .collect();
    files.extend(
        bundled
            .assets
            .iter()
            .map(|asset| (asset.file_name.clone(), asset.bytes.clone())),
    );
    let entry = bundled
        .chunks
        .iter()
        .find(|chunk| chunk.is_entry)
        .and_then(|chunk| chunk.facade_module_id.clone())
        .map(PathBuf::from);
    Ok(BundledDependency {
        files,
        entry,
        packages: bundled_packages(&bundled.inputs),
        imp_imports: kept_imp_imports(&bundled),
    })
}
