pub struct ResizeOptions {
    pub root: std::path::PathBuf,
    pub image: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub output: Option<String>,
    pub stretch: bool,
}

pub fn resize(_options: ResizeOptions) -> anyhow::Result<()> {
    anyhow::bail!("imp resize is not ported yet")
}
