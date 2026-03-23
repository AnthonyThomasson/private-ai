---
name: murder-cheat-stress
description: Cheat in the murder mystery game by manually updating suspect stress in the database to force clue reveals or perpetrator confessions. Use when testing, debugging, or the user wants to bypass the interview/interrogation mechanics.
---

# Murder Mystery Stress Cheat

## Overview

Suspects reveal clue links when their stress exceeds 30 (or when directly asked about a specific clue). The perpetrator confesses when stress reaches 100.

By directly updating the `people.stress` column, you can trigger these behaviors without proper interrogation.

## Database

- **Table**: `people`
- **Column**: `stress` (int, 0–100)
- **DB file**: `local.db` (or `DB_FILE_NAME` from .env)

## Cheat Commands

**Force clue reveal** (suspect will disclose on next relevant question):
```bash
sqlite3 local.db "UPDATE people SET stress = 50 WHERE id = <person_id>;"
```

**Force perpetrator confession** (on next response):
```bash
sqlite3 local.db "UPDATE people SET stress = 100 WHERE id = <person_id>;"
```

## Finding person IDs

```bash
sqlite3 local.db "SELECT id, name, stress FROM people WHERE murder_id = <murder_id>;"
```

## Notes

- Stress 31+ makes suspects more likely to reveal when questioned about their clue links
- Stress 100 triggers perpetrator confession (system prompt requires it)
- Use `pnpm db:studio` or `drizzle-kit studio` for a GUI if preferred
