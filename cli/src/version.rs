pub const VERSION: &str = env!("CARGO_PKG_VERSION");

fn core(version: &str) -> [u64; 3] {
    let mut parts = [0; 3];
    let base = version.split('-').next().unwrap_or("");
    for (index, part) in base.split('.').take(3).enumerate() {
        let digits: String = part.chars().take_while(char::is_ascii_digit).collect();
        parts[index] = digits.parse().unwrap_or(0);
    }
    parts
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    core(candidate) > core(current)
}
