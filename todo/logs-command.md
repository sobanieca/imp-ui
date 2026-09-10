# `imp logs` - print the dev log to stdout

`imp start` writes everything that it prints to `.imp/dev.log`. A user or an agent who wants to know
what the browser did must know that path, find the project root, and run `cat` or `grep` on the
file. The docs and the skills repeat the path in many places for that reason. `imp review` already
prints the reviews from `.imp/reviews/` without a path. The log needs the same door.

`imp logs` prints the content of `.imp/dev.log` to stdout. Nothing more. The user pipes it into
`grep`, `tail` or `less` as they do with any other command.

```
imp logs [-n <count>] [-f]
```

- **No option.** Print every entry of the log, in order, one entry per line. The output is the file
  as it is, with no colour and no extra header. So `imp logs | grep '\[browser:error\]'` works.
- **`-n <count>`.** Print the last `<count>` entries only.
- **`-f`.** Print the log, then keep the process open and print each new entry as `imp start` writes
  it. Stop on Ctrl-C. This gives the agent one command to watch the session, with no knowledge of
  the file.

## Behaviour

- Resolve the project root in the way that `imp review` does, so the command works from any folder
  under the project.
- When `.imp/dev.log` does not exist, print one line that says that no dev server has run in this
  project, and exit with code 1.
- The log holds the current session only, because `imp start` truncates it on start. `imp logs` does
  not change that. It reads and never writes.

## Docs and skills

- Add `imp logs` to the command table in `docs/cli.md` and `skills/cli.md`.
- In `docs/cli.md`, `skills/start.md`, `skills/logging.md` and `skills/review.md`, name `imp logs`
  as the way to read the session. Keep the path `.imp/dev.log` in one place, the description of the
  `.imp/` folder, so a reader who wants the file still finds it.
- Add `logs` as an alias of the `start` skill in `cli/src/skill.js`.
