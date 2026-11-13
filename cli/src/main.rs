#[cfg(target_env = "musl")]
#[global_allocator]
static GLOBAL_ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    std::process::exit(imp::cli::main());
}
