---
tools:
  - [mongosh, $MONGODB_URI, --eval, { regex: "^db\\.\\w+\\.(find|findOne|aggregate|count|distinct)\\(" }]
---

# Instructions
- Understand the schema by listing collections and sampling their document structure
- Translate the user's question into a query that answers it
