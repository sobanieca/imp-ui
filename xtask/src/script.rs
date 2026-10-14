use anyhow::{Result, anyhow};
use rquickjs::loader::{ImportAttributes, Loader, Resolver};
use rquickjs::module::Declared;
use rquickjs::{Context, Ctx, Function, Module, Runtime};
use std::path::Path;

struct RelativeResolver;

fn join_module(base: &str, name: &str) -> String {
    let mut parts: Vec<&str> = base.split('/').collect();
    parts.pop();
    for segment in name.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

impl Resolver for RelativeResolver {
    fn resolve<'js>(
        &mut self,
        _ctx: &Ctx<'js>,
        base: &str,
        name: &str,
        _attributes: Option<ImportAttributes<'js>>,
    ) -> rquickjs::Result<String> {
        if !name.starts_with('.') {
            return Err(rquickjs::Error::new_resolving_message(
                base,
                name,
                "only relative imports run in an xtask script",
            ));
        }
        Ok(join_module(base, name))
    }
}

struct FileLoader;

impl Loader for FileLoader {
    fn load<'js>(
        &mut self,
        ctx: &Ctx<'js>,
        name: &str,
        _attributes: Option<ImportAttributes<'js>>,
    ) -> rquickjs::Result<Module<'js, Declared>> {
        let source = std::fs::read_to_string(name)
            .map_err(|_| rquickjs::Error::new_loading_message(name, "unable to read"))?;
        Module::declare(ctx.clone(), name, source)
    }
}

fn posix(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub type Host = fn(String) -> String;

pub fn call_export(
    module: &Path,
    export: &str,
    input: &serde_json::Value,
    host: &[(&str, Host)],
) -> Result<serde_json::Value> {
    let runtime = Runtime::new()?;
    runtime.set_max_stack_size(64 * 1024 * 1024);
    runtime.set_loader(RelativeResolver, FileLoader);
    let context = Context::full(&runtime)?;
    let folder = module.parent().unwrap_or(Path::new("."));
    let caller = format!("{}/__xtask.js", posix(folder));
    let file_name = module.file_name().unwrap().to_string_lossy();
    let host_names: Vec<String> = host
        .iter()
        .map(|(name, _)| format!("{name}: globalThis.__host_{name}"))
        .collect();
    let source = format!(
        "import {{ {export} }} from './{file_name}'\nglobalThis.__result = JSON.stringify({export}({{ ...JSON.parse(globalThis.__input), {} }}))\n",
        host_names.join(", ")
    );
    let failure = context.with(|ctx| -> Option<String> {
        let globals = ctx.globals();
        let setup = || -> rquickjs::Result<()> {
            globals.set("__input", input.to_string())?;
            for (name, function) in host {
                let function = *function;
                globals.set(
                    format!("__host_{name}"),
                    Function::new(ctx.clone(), move |text: String| function(text))?,
                )?;
            }
            let declared = Module::declare(ctx.clone(), caller.as_str(), source.as_str())?;
            let (_, promise) = declared.eval()?;
            promise.finish::<()>()
        };
        setup()
            .err()
            .map(|error| format!("{error}: {:?}", ctx.catch()))
    });
    if let Some(failure) = failure {
        return Err(anyhow!("{}: {failure}", posix(module)));
    }
    while runtime.execute_pending_job().unwrap_or(false) {}
    let result = context.with(|ctx| ctx.globals().get::<_, Option<String>>("__result"));
    let result = result?.ok_or_else(|| anyhow!("{} returned nothing", posix(module)))?;
    Ok(serde_json::from_str(&result)?)
}
