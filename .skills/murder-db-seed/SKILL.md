---
name: murder-db-seed
description: Clears the murder mystery SQLite database and seeds one fresh murder via the deep agent. Use when resetting local test state, after corrupt data, before E2E clue tests, or when the user asks to reseed, wipe, or clear the murder DB.
---

# Murder DB — Clear & Reseed

## Command

```bash
pnpm db:seed
```

Runs `pnpm run db:push` then `tsx src/db/seed.ts`.

## What it does

1. **Schema**: `db:push` syncs Drizzle schema to the DB (see `drizzle.config.ts`; URL from `DB_FILE_NAME` in `.env`).
2. **Clear** (`src/db/seed.ts`): With `PRAGMA foreign_keys = OFF`, deletes all rows from `clue_links`, `clues`, `messages`, `people`, `locations`, `murders` (in that order).
3. **Seed**: Calls `generateMurder()` — LLM-driven generation; can take a while and needs API keys configured.

## When to use

- Known-good state before manual or scripted clue-progression tests
- Suspect bad `clue_links` / visibility data
- After schema changes, to avoid stale rows

## Notes

- **Destructive**: Removes every murder and related data.
- If `sqlite3` commands fail on path, confirm `DB_FILE_NAME` matches the file you expect (strip a `file:` prefix if present).
