---
tools:
  - [sed]
  - [grep, -r, {}, ./data]
---

# Instructions
- Search for passages relevant to the question using grep
- Read surrounding lines with sed to get full context around matches
- For large files, binary search by section before reading further
