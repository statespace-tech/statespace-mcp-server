---
tools:
  - [snowsql, -c, $SNOWFLAKE_CONNECTION, -q, { regex: "^SELECT\\b.*" }]
---

# Instructions
- Understand the schema by exploring tables, columns, and relationships
- Translate the user's question into a query that answers it
