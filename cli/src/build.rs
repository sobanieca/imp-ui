pub struct BuildOptions {
    pub entry: String,
    pub output: String,
    pub pwa: bool,
    pub env: Option<String>,
}

pub fn build(_options: BuildOptions) -> anyhow::Result<()> {
    anyhow::bail!("imp build is not ported yet")
}
