<br>

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/statespace-tech/statespace/main/docs/assets/images/header_light.png" />
    <img src="https://raw.githubusercontent.com/statespace-tech/statespace/main/docs/assets/images/header_dark.png" alt="Statespace" width="375" />
  </picture>
</div>

<div align="center">

<br>

*Self-documenting AI applications*

[![Test Suite](https://github.com/statespace-tech/statespace/actions/workflows/test.yml/badge.svg)](https://github.com/statespace-tech/statespace/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-MIT-007ec6?style=flat-square)](https://github.com/statespace-tech/statespace/blob/main/LICENSE)
[![crates.io](https://img.shields.io/crates/v/statespace?style=flat-square)](https://crates.io/crates/statespace)
[![Discord](https://img.shields.io/discord/1323415085011701870?label=Discord&logo=discord&logoColor=white&color=5865F2&style=flat-square)](https://discord.gg/rRyM7zkZTf)
[![X](https://img.shields.io/badge/Statespace-black?style=flat-square&logo=x&logoColor=white)](https://x.com/statespace_tech)

</div>

---

**Website: [https://statespace.com](https://statespace.com/)**

**Documentation: [https://docs.statespace.com](https://docs.statespace.com/)**

---

AI doesn't know your data. Statespace helps you build self-documenting data applications that describe themselves to agents. Build RAG, text-to-SQL, and knowledge bases that agents can maintain and improve over time. Once you’ve created an app, you can deploy, manage, and share it from our [cloud platform](https://statespace.com/).

## Quickstart

Get up and running with your first app by asking your coding agent:

```bash
claude "Create a Statespace app: https://statespace.com/AGENTS.md"
```

## Example

### 1. Create it

Create a new PostgreSQL app with:

```
statespace init --text-to-sql postgresql://user:pass@host:port/db
````

This creates an app skeleton with just enough tools and instructions for your agent to explore your database:

```yaml
---
tools:
  - [psql, -d, $DB, -c, { regex: "^SELECT\\b.*" }]
---

# Instructions
- Learn the schema by exploring tables, columns, and relationships
- Translate the user's question into a query that answers it
```

### 2. Build it

Build your full app by iterating on it with your coding agent:

```
claude "Document my database's schema and add a script to summarize them"
```

Your agent will spin up a local server to test your app:

```bash
statespace serve .demo/ --port 8000
```

The result is a self-documenting app that any agent can understand and use:

```text
demo/
├── README.md         # from above
├── script.py
└── schema/
    ├── users.md
    └── products.md
```

### 3. Ship it

Optionally, create a free [Statespace account](https://statespace.com/auth/login) to deploy your app and get a shareable URL:

```bash
statespace deploy path/to/app/
```

Then, connect any agent to your app through our API or MCP.

<details open>
<summary>API</summary>

Pass the public URL to your agent:

```bash
claude "Use the API at https://demo.statespace.app to find out the number of users"
```

</details>

<details>
<summary>MCP</summary>

Configure the MCP client:

```json
"statespace": {
  "command": "uvx",
  "args": ["statespace-mcp", "https://demo.statespace.app"]
}
```
</details>


### Example skeletons

- **[vectorless rag](examples/vectorless_rag)**
- **[postgresql](examples/postgresql)**
- **[mysql](examples/mysql)**
- **[sqlite](examples/sqlite)**
- **[snowflake](examples/snowflake)**
- **[mssql](examples/mssql)**
- **[mongodb](examples/mongodb)**
- **[duckdb](examples/duckdb)**

## Community & Contributing

- **Discord**: Join our [community server](https://discord.gg/rRyM7zkZTf) for real-time help and discussions
- **X**: Follow us [@statespace_tech](https://x.com/statespace_tech) for updates and news
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/statespace-tech/statespace/issues)

## License

This project is licensed under the terms of the MIT license.
