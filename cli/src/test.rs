pub struct TestOptions {
    pub root: std::path::PathBuf,
    pub paths: Vec<String>,
    pub list: bool,
    pub unit: bool,
    pub e2e: bool,
    pub jobs: Option<usize>,
    pub filter: Option<String>,
    pub screenshot_dir: Option<String>,
    pub video_dir: Option<String>,
    pub mocks: Option<bool>,
}

pub fn run_tests(_options: TestOptions) -> anyhow::Result<i32> {
    anyhow::bail!("imp test is not ported yet")
}
