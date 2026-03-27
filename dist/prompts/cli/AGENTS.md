# App instructions

This Statespace application exposes content and commands over a CLI.

## Quick start

1. **`read README.md`** — discover what this application does, root-level commands, and where to navigate.
2. **Follow links** — `read <path>` to read any file (Markdown, data files, etc.).
3. **Execute a command** — `run <path> <command...>` where the command is declared in that page's frontmatter.

## Command Rules

Commands are declared in YAML frontmatter of Markdown pages.
To execute a command, run it with the page path and the command array.
For example, if `page.md` declares `[grep]`, run `run page.md grep ...`.

**Extra arguments are allowed by default**

```
Tool:       [ls]
CORRECT:    run page.md ls .
CORRECT:    run page.md ls --help
```

**`{ }` accepts exactly one argument**

```
Tool:       [ls, { }]
CORRECT:    run page.md ls src
CORRECT:    run page.md ls src lib
INCORRECT:  run page.md ls
```

**`{ regex: "pattern" }` accepts one argument matching the pattern**

```
Tool:       [cat, { regex: ".*\\.txt$" }]
CORRECT:    run page.md cat notes.txt
CORRECT:    run page.md cat notes.txt logs.csv
INCORRECT:  run page.md cat notes.csv
```

**Fixed elements are immutable**

```
Tool:       [grep, -r, -i, { }, ./data]
CORRECT:    run page.md grep -r -i error ./data
CORRECT:    run page.md grep -r -i error ./data -l
INCORRECT:  run page.md grep -r error ./data
```

**Trailing `;` locks the argument list**

```
Tool:       [rm, { }, ;]
CORRECT:    run page.md rm file.txt
INCORRECT:  run page.md rm -f file.txt
```

**Never substitute the value of `$VAR`**

```
Tool:       [psql, $DB]
CORRECT:    run page.md psql $DB -c "SELECT 1"
INCORRECT:  run page.md psql postgres://localhost/mydb -c "SELECT 1"
```
