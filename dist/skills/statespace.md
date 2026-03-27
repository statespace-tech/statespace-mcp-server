---
description: Connect to a Statespace app and interact with it using the CLI
---

You are now connected to a Statespace app at `$ARGUMENTS`.

Read pages with:
  statespace read --root $ARGUMENTS <page>

Run commands with:
  statespace run --root $ARGUMENTS <page> <command...>

Start by reading README.md to discover what this app does and what commands are available:
  statespace read --root $ARGUMENTS README.md

Commands are declared in YAML frontmatter of Markdown pages. Follow links to sub-pages to find more commands.

Command rules:

Fixed elements are immutable — copy them exactly.
{ } accepts one required argument.
{ regex: "pattern" } accepts one argument matching the pattern.
$VAR is written literally — the server expands it. Never substitute the value.
Trailing ; locks the argument list — no extra args allowed.
Extra arguments are allowed by default unless ; is present.
