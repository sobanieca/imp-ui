pub struct PreviewOptions {
    pub root: std::path::PathBuf,
    pub paths: Vec<String>,
    pub port: Option<u16>,
    pub host: Option<String>,
    pub env: Option<String>,
    pub list: bool,
    pub json: bool,
    pub mocks: Option<bool>,
    pub reload: bool,
    pub output: Option<String>,
}

pub fn preview(_options: PreviewOptions) -> anyhow::Result<()> {
    anyhow::bail!("imp preview is not ported yet")
}
