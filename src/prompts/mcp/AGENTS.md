# App instructions

This Statespace application exposes content and tools over MCP.

## Quick start

1. **`read_page("README.md")`** — discover what this application does, root-level tools, and where to navigate.
2. **Follow links** — call `read_page` with any path to read content (Markdown, data files, etc.).
3. **Execute a command** — call `run_command` with the page path and command where the tool is declared.

## Command Rules

Commands are declared in YAML frontmatter of Markdown pages.
To execute a command, call `run_command` with the path of the page that declares it and the command array.
For example, if `page.md` declares `[grep]`, call `run_command(path="page.md", command=["grep", ...])`.

**Extra arguments are allowed by default**

```
Tool:       [ls]
CORRECT:    run_command(command=["ls", "."])
CORRECT:    run_command(command=["ls", "--help"])
```

**`{ }` accepts exactly one argument**

```
Tool:       [ls, { }]
CORRECT:    run_command(command=["ls", "src"])
CORRECT:    run_command(command=["ls", "src", "lib"])
INCORRECT:  run_command(command=["ls"])
```

**`{ regex: "pattern" }` accepts one argument matching the pattern**

```
Tool:       [cat, { regex: ".*\\.txt$" }]
CORRECT:    run_command(command=["cat", "notes.txt"])
CORRECT:    run_command(command=["cat", "notes.txt", "logs.csv"])
INCORRECT:  run_command(command=["cat", "notes.csv"])
```

**Fixed elements are immutable**

```
Tool:       [grep, -r, -i, { }, ./data]
CORRECT:    run_command(command=["grep", "-r", "-i", "error", "./data"])
CORRECT:    run_command(command=["grep", "-r", "-i", "error", "./data", "-l"])
INCORRECT:  run_command(command=["grep", "-r", "error", "./data"])
```

**Trailing `;` locks the argument list**

```
Tool:       [rm, { }, ;]
CORRECT:    run_command(command=["rm", "file.txt"])
INCORRECT:  run_command(command=["rm", "-f", "file.txt"])
```

**Never substitute the value of `$VAR`**

```
Tool:       ["psql, "$DB"]
CORRECT:    ["psql", "$DB", "-c", "SELECT 1"]
INCORRECT:  ["psql", "postgres://localhost/mydb", "-c", "SELECT 1"]
```
