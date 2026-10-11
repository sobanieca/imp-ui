pub struct StartOptions {
    pub entry: String,
    pub port: Option<u16>,
    pub host: Option<String>,
    pub env: Option<String>,
    pub mocks: Option<bool>,
    pub reload: bool,
}

pub fn start(_options: StartOptions) -> anyhow::Result<()> {
    anyhow::bail!("imp start is not ported yet")
}

pub fn start_e2e_app(
    _root: &std::path::Path,
    _config: &crate::config::Config,
    _mocks: Option<bool>,
) -> anyhow::Result<crate::test::E2eApp> {
    anyhow::bail!("e2e specs are not ported yet")
}
