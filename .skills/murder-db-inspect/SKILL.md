---
name: murder-db-inspect
description: Resolves the local murder mystery database path and runs sqlite3 queries for murders, perpetrators, initially visible suspects, and clue graphs. Use when debugging murder setup, verifying the perpetrator is hidden at start, or planning non-linear test paths.
---

# Murder DB — Inspect (sqlite3)

## Database path

- Read `DB_FILE_NAME` from `.env` (same as Drizzle / `src/db/index.ts`).
- Common local value: `file:data/local.db` or `file:./local.db` — **strip the `file:` prefix** for `sqlite3`.
- If unset, try `data/local.db` or `local.db` in the project root.

Use one path consistently in all commands below as `<db_path>`.

## List murders and perpetrator

```bash
sqlite3 <db_path> "SELECT m.id, m.description, m.perpetrator_id, p.name as perpetrator_name FROM murders m LEFT JOIN people p ON m.perpetrator_id = p.id;"
```

Pick a `murder_id`. For clue-progression tests, the perpetrator must not be in the **initial visible suspects** (next query).

## Initially visible suspects (not victim)

People with at least one `clue_links` row where `is_visible = 1`:

```bash
sqlite3 <db_path> "
SELECT DISTINCT cl.person_id, pe.name
FROM clue_links cl
JOIN people pe ON cl.person_id = pe.id
WHERE cl.murder_id = <murder_id> AND cl.is_visible = 1 AND cl.person_id != (SELECT victim_id FROM murders WHERE id = <murder_id>);
"
```

**Check**: `perpetrator_id` must not appear in this list. If it does, reseed (`murder-db-seed`) or fix data.

## Clue graph (plan paths / red herrings)

```bash
sqlite3 <db_path> "
SELECT cl.id, c.description as clue, pe.name, cl.is_visible
FROM clue_links cl
JOIN clues c ON cl.clue_id = c.id
JOIN people pe ON cl.person_id = pe.id
WHERE cl.murder_id = <murder_id>
ORDER BY cl.clue_id, cl.person_id;
"
```

Use to find bridge clues and non-linear paths. Prefer **murder-cheat-stress** for stress updates, not ad-hoc `UPDATE` here unless debugging.
