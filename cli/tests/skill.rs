mod support;

use imp::skill::{SKILLS, find_skill_name, skill_index, standard_component_skills};
use imp::skill_init::{AGENT_SKILL, find_skill_root};
use regex::Regex;
use support::*;

fn repo_root() -> std::path::PathBuf {
    cli_dir().parent().unwrap().to_path_buf()
}

#[test]
fn every_skills_page_is_registered_as_a_subject() {
    let pages: Vec<String> = list_files(&repo_root().join("skills"))
        .into_iter()
        .filter(|name| name.ends_with(".md") && !name.contains('/'))
        .collect();
    let registered: Vec<String> = SKILLS.iter().map(|skill| format!("{}.md", skill.name)).collect();
    for page in &pages {
        check(registered.contains(page), format!("skills/{page} has no subject in cli/src/skill.rs - a page is named after its subject"));
    }
    for file in &registered {
        check(pages.contains(file), format!("subject points at a missing skills/{file}"));
    }
}

#[test]
fn every_subject_prints_its_manual_out_of_the_binary() {
    let dangling = Regex::new(r"\]\([\w-]+\.md[^)]*\)").unwrap();
    for skill in SKILLS {
        let run = run_imp(&["skill", skill.name], &cli_dir());
        check(run.code == 0, format!("imp skill {} exited {}: {}", skill.name, run.code, run.stderr));
        check(run.stderr.is_empty(), format!("imp skill {} wrote to stderr: {}", skill.name, run.stderr));
        check(
            run.stdout.starts_with(&format!("imp skill: {} - {}", skill.name, skill.summary)),
            format!("imp skill {} is missing its banner", skill.name),
        );
        check(run.stdout.lines().count() > 20, format!("imp skill {} printed no manual", skill.name));
        check(
            !dangling.is_match(&run.stdout),
            format!("imp skill {} still links to a markdown file", skill.name),
        );
    }
}

#[test]
fn every_std_component_is_derived_from_the_barrels_with_a_skill_file() {
    let derived = standard_component_skills();
    let exported: Vec<String> = imp::library_exports::imp_module_exports()
        .iter()
        .filter(|(specifier, _)| specifier.starts_with("imp/std"))
        .flat_map(|(_, names)| names.iter().cloned())
        .collect();
    check(!exported.is_empty(), "no std components found in the barrels");
    for name in &exported {
        let subject = derived.iter().find(|(component, _)| component == name);
        check(subject.is_some(), format!("std/{name} is exported by imp/std but was not derived"));
        let (_, path) = subject.unwrap();
        check(repo_root().join(path).is_file(), format!("missing {path} - every std component ships a skill file"));
    }
    for (name, _) in &derived {
        check(exported.contains(name), format!("std/{name} was derived but imp/std exports no {name}"));
    }
}

#[test]
fn a_std_folder_is_one_group() {
    let std_root = repo_root().join("lib/src/std");
    let groups = imp::preview_source::scan_groups_module(&read(&std_root.join("preview-groups.js"))).unwrap();
    let keys: Vec<String> = groups.into_iter().map(|(key, _)| key).collect();
    let folders: Vec<String> = std::fs::read_dir(&std_root)
        .unwrap()
        .flatten()
        .filter(|entry| entry.file_type().unwrap().is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name != "shared" && !name.starts_with('.'))
        .collect();
    for key in &keys {
        check(folders.contains(key), format!("preview group '{key}' has no lib/src/std/{key} folder"));
    }
    let declared_group = Regex::new(r"export const group = groups\.(\w+)").unwrap();
    for folder in &folders {
        check(keys.contains(folder), format!("lib/src/std/{folder} has no preview group named '{folder}'"));
        let specifier = if folder == "general" { "imp/std".to_string() } else { format!("imp/std/{folder}") };
        let barrel = imp::specifiers::imp_module(&specifier);
        check(barrel.is_some(), format!("{specifier} is not a registered barrel"));
        let barrel = barrel.unwrap();
        let source = read(&repo_root().join("lib/src").join(barrel));
        check(
            barrel == format!("std/{folder}/index.js") || source.contains(&format!("'./{folder}/index.js'")),
            format!("{specifier} does not export lib/src/std/{folder}"),
        );
        for file in list_files(&std_root.join(folder)) {
            if !file.ends_with(".preview.js") || file.contains('/') {
                continue;
            }
            let source = read(&std_root.join(folder).join(&file));
            let declared = declared_group.captures(&source).map(|caps| caps[1].to_string());
            check(
                declared.as_deref() == Some(folder.as_str()),
                format!("lib/src/std/{folder}/{file} names group '{declared:?}', not '{folder}'"),
            );
        }
    }
}

#[test]
fn a_std_component_prints_its_skill_file_verbatim() {
    for (name, path) in standard_component_skills() {
        let source = normalize(read(&repo_root().join(&path)).trim_end());
        let run = run_imp(&["skill", &format!("std/{name}")], &cli_dir());
        check(run.code == 0, format!("imp skill std/{name} exited {}", run.code));
        check(run.stdout.trim_end() == source, format!("imp skill std/{name} did not print {path}"));
    }
}

#[test]
fn subjects_resolve_by_alias_specifier_and_file_name() {
    for skill in SKILLS {
        for alias in std::iter::once(&skill.name).chain(skill.aliases.iter()) {
            check(find_skill_name(alias).as_deref() == Some(skill.name), format!("'{alias}' does not resolve to {}", skill.name));
        }
    }
    check(find_skill_name("imp/State").as_deref() == Some("state"), "subject lookup is not case-insensitive");
    check(find_skill_name("state.md").as_deref() == Some("state"), "a docs file name does not resolve");
    check(find_skill_name("button").as_deref() == Some("std/button"), "'button' does not resolve to std/button");
    check(
        find_skill_name("imp/std/emptyState").as_deref() == Some("std/emptyState"),
        "an imp/std specifier does not resolve to its component",
    );
    check(find_skill_name("bogus").is_none(), "an unknown subject resolved to something");
}

#[test]
fn the_index_lists_every_subject_once() {
    let index = skill_index(&cli_dir());
    let names: Vec<String> = SKILLS
        .iter()
        .map(|skill| skill.name.to_string())
        .chain(standard_component_skills().into_iter().map(|(name, _)| format!("std/{name}")))
        .collect();
    for name in names {
        let count = index.lines().filter(|line| line.starts_with(&format!("  {name} "))).count();
        check(count == 1, format!("{name} appears {count} times in the index"));
    }
}

#[test]
fn the_index_lists_the_components_of_the_project_and_its_dependencies() {
    let run = run_imp(&["skill"], &fixture("skill-project"));
    check(run.stdout.contains("THIS PROJECT"), "the index has no project section");
    check(
        Regex::new(r"\n {2}\./counter\.js\s+counter - a self-contained").unwrap().is_match(&run.stdout),
        "the project component is missing from the index",
    );
    check(run.stdout.contains("read: imp skill ./path/to/component.js"), "the index does not say how to read a component by path");
    check(run.stdout.contains("imp skill std/button"), "the index does not say how to read a standard component");
    check(run.stdout.contains("INSTALLED COMPONENTS"), "the index has no installed components section");
    check(
        Regex::new(r"\n {2}widget\s+widget - a panel that an installed package ships").unwrap().is_match(&run.stdout),
        "the installed component is missing from the index",
    );
    let printed = run_imp(&["skill", "widget"], &fixture("skill-project"));
    check(printed.code == 0, format!("imp skill widget exited {}: {}", printed.code, printed.stderr));
    check(
        printed.stdout == "# widget - a panel that an installed package ships\n",
        format!("imp skill widget did not print imp-skill.md verbatim: {}", printed.stdout),
    );
    let empty = run_imp(&["skill"], &fixture("basic"));
    check(empty.stdout.contains("THIS PROJECT"), "the project section is missing when nothing is found");
    check(empty.stdout.contains("counter.skill.md"), "the empty project section names no file to write");
}

#[test]
fn skill_init_writes_the_agent_skill() {
    let root = TempDir::new();
    let home = root.join("home");
    for path in ["home/repo/.git", "home/repo/packages/app/src", "home/notes", ".git"] {
        std::fs::create_dir_all(root.join(path)).unwrap();
    }
    write(&home.join("repo/packages/app/AGENTS.md"), "# app\n");
    write(&home.join("notes/CLAUDE.md"), "# notes\n");
    let init = |cwd: &std::path::Path| {
        let output = imp_command(cwd).args(["skill", "--init"]).env("HOME", &home).output().unwrap();
        Run {
            code: output.status.code().unwrap_or(-1),
            stdout: normalize(&String::from_utf8_lossy(&output.stdout)),
            stderr: normalize(&String::from_utf8_lossy(&output.stderr)),
        }
    };
    let skill_at = |dir: &std::path::Path| std::fs::read_to_string(dir.join("SKILL.md")).ok();
    for start in ["repo/packages/app/src", "repo/packages", "repo"] {
        let found = find_skill_root(&home.join(start), Some(&home)).unwrap();
        check(found.dir == home.join("repo"), format!("from {start} the skill goes to {}", found.dir.display()));
    }
    let notes = find_skill_root(&home.join("notes"), Some(&home)).unwrap();
    check(notes.dir == home && notes.global, "a folder outside a repository is not home");
    check(find_skill_root(&home, Some(&home)).unwrap().dir == home, "a .git above the home folder counts");

    let run = init(&home.join("repo/packages/app/src"));
    check(run.code == 0, format!("imp skill --init exited {}: {}", run.code, run.stderr));
    check(run.stdout.contains(".claude/skills/imp/SKILL.md"), "the output names no skill file");
    for dir in [".agents", ".claude"] {
        check(
            skill_at(&home.join(format!("repo/{dir}/skills/imp"))).as_deref() == Some(AGENT_SKILL),
            format!("{dir}/skills/imp/SKILL.md is missing or different"),
        );
    }
    check(skill_at(&home.join("repo/packages/app/.claude/skills/imp")).is_none(), "a skill went to the package");
    check(AGENT_SKILL.starts_with("---\nname: imp\n"), "the skill has no name");

    let run = init(&home.join("notes"));
    check(run.code == 0, "imp skill --init failed outside a repository");
    check(skill_at(&home.join(".claude/skills/imp")).as_deref() == Some(AGENT_SKILL), "no skill in the home folder");
    check(skill_at(&home.join("notes/.claude/skills/imp")).is_none(), "a skill went to the folder");

    std::fs::remove_file(home.join(".agents/skills/imp/SKILL.md")).unwrap();
    let run = init(&home.join("notes"));
    check(run.code == 1, format!("a second imp skill --init exited {}", run.code));
    check(run.stderr.contains("already exists"), format!("the error does not name the file: {}", run.stderr));
    check(skill_at(&home.join(".agents/skills/imp")).is_none(), "a partial skill was written");
}
