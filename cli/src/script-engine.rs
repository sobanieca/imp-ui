use crate::logger;
use rquickjs::{Context, Ctx, Function, Object, Runtime, Value};

pub fn message_of(ctx: &Ctx<'_>, error: rquickjs::Error) -> String {
    if !error.is_exception() {
        return error.to_string();
    }
    let thrown = ctx.catch();
    if let Some(object) = thrown.as_object() {
        if let Ok(message) = object.get::<_, String>("message") {
            return message;
        }
    }
    thrown
        .as_string()
        .and_then(|text| text.to_string().ok())
        .unwrap_or_else(|| format!("{thrown:?}"))
}

pub fn console_text<'js>(values: &[Value<'js>]) -> String {
    let Some(ctx) = values.first().map(|value| value.ctx().clone()) else {
        return String::new();
    };
    let json: Option<Object> = ctx.globals().get("JSON").ok();
    let stringify: Option<Function> = json.and_then(|json| json.get("stringify").ok());
    values
        .iter()
        .map(|value| {
            if let Some(text) = value.as_string() {
                return text.to_string().unwrap_or_default();
            }
            if value.is_object() && !value.is_function() {
                if let Some(text) = stringify
                    .as_ref()
                    .and_then(|stringify| stringify.call::<_, String>((value.clone(),)).ok())
                {
                    return text;
                }
            }
            ctx.globals()
                .get::<_, Function>("String")
                .and_then(|string| string.call::<_, String>((value.clone(),)))
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn install_console(ctx: &Ctx<'_>, prefix: &'static str) -> rquickjs::Result<()> {
    let console = Object::new(ctx.clone())?;
    for level in ["log", "info", "warn", "error", "debug"] {
        console.set(
            level,
            Function::new(
                ctx.clone(),
                move |values: rquickjs::function::Rest<Value<'_>>| {
                    let text = format!("{prefix}{}", console_text(&values.0));
                    match level {
                        "error" => logger::error(&text),
                        "warn" => logger::warn(&text),
                        "debug" => logger::debug(&text),
                        _ => logger::info(&text),
                    }
                },
            )?,
        )?;
    }
    ctx.globals().set("console", console)
}

pub fn run_jobs(runtime: &Runtime) -> Result<(), String> {
    loop {
        match runtime.execute_pending_job() {
            Ok(true) => continue,
            Ok(false) => return Ok(()),
            Err(exception) => {
                let message = exception.0.with(|ctx| {
                    let thrown = ctx.catch();
                    thrown
                        .as_object()
                        .and_then(|object| object.get::<_, String>("message").ok())
                        .unwrap_or_else(|| format!("{thrown:?}"))
                });
                return Err(message);
            }
        }
    }
}

const ABSENT_WEB_APIS: &str = "for (const name of ['URL', 'URLSearchParams']) {\n  globalThis[name] = class {\n    constructor() {\n      throw new TypeError(`${name} is not available while imp reads a module outside a page`)\n    }\n  }\n}\n";

pub fn evaluate(
    script: &str,
    function_module: &str,
    input: &str,
    prefix: &'static str,
) -> Result<String, String> {
    let runtime = Runtime::new().map_err(|error| error.to_string())?;
    let context = Context::full(&runtime).map_err(|error| error.to_string())?;
    let result = context.with(|ctx| -> Result<String, String> {
        install_console(&ctx, prefix).map_err(|error| message_of(&ctx, error))?;
        ctx.eval::<(), _>(ABSENT_WEB_APIS)
            .map_err(|error| message_of(&ctx, error))?;
        ctx.eval::<(), _>(script)
            .map_err(|error| message_of(&ctx, error))?;
        let source = format!(
            "({})",
            crate::browser_script::function_source(function_module)
        );
        let function: Function = ctx
            .eval(source.as_str())
            .map_err(|error| message_of(&ctx, error))?;
        let argument: Value = ctx
            .json_parse(input)
            .map_err(|error| message_of(&ctx, error))?;
        function
            .call::<_, String>((argument,))
            .map_err(|error| message_of(&ctx, error))
    })?;
    run_jobs(&runtime)?;
    Ok(result)
}
