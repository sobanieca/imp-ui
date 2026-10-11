use crate::colors::{bold, dim, green};
use crate::paths::{absolute, home_dir};
use anyhow::{Result, bail};
use std::path::{Path, PathBuf};

const SKILL_NAME: &str = "imp";

const SKILL_TARGETS: [(&str, &str); 2] =
    [(".agents/skills", "Codex, Cursor"), (".claude/skills", "Claude Code, Cursor")];

pub const AGENT_SKILL: &str = include_str!("../templates/agent-skill.md");

pub struct SkillRoot {
    pub dir: PathBuf,
    pub reason: &'static str,
    pub global: bool,
}

pub fn find_skill_root(start: &Path, home: Option<&Path>) -> Result<SkillRoot> {
    let home_dir = home.map(absolute);
    let mut dir = absolute(start);
    loop {
        if dir.join(".git").exists() {
            return Ok(SkillRoot { dir, reason: "git root", global: false });
        }
        if Some(&dir) == home_dir.as_ref() || !dir.pop() {
            break;
        }
    }
    let Some(home_dir) = home_dir else {
        bail!("not in a git repository and the home folder is unknown - set HOME")
    };
    Ok(SkillRoot { dir: home_dir, reason: "not in a git repository", global: true })
}

pub fn install_agent_skill(root: &SkillRoot) -> Result<Vec<(String, &'static str)>> {
    let files: Vec<(String, &'static str)> = SKILL_TARGETS
        .iter()
        .map(|(dir, read_by)| (format!("{dir}/{SKILL_NAME}/SKILL.md"), *read_by))
        .collect();
    for (path, _) in &files {
        let file = root.dir.join(path);
        if file.exists() {
            bail!("{} already exists - delete it to write the skill again", file.display());
        }
    }
    for (path, _) in &files {
        let file = root.dir.join(path);
        std::fs::create_dir_all(file.parent().unwrap())?;
        std::fs::write(&file, AGENT_SKILL)?;
    }
    Ok(files)
}

pub fn init_agent_skill() -> Result<()> {
    let root = find_skill_root(&crate::paths::cwd(), home_dir().as_deref())?;
    let files = install_agent_skill(&root)?;
    let created = if root.global { "Created the imp skill for all projects" } else { "Created the imp skill" };
    println!("{} in {} ({})\n", green(created), root.dir.display(), root.reason);
    let width = files.iter().map(|(path, _)| path.len()).max().unwrap_or(0);
    for (path, read_by) in &files {
        println!("  {}  {}", bold(format!("{path:<width$}")), dim(read_by));
    }
    println!("\nTry: /imp add a settings page with a theme switch");
    Ok(())
}
