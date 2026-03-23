---
name: test-clue-progression
description: Test murder mystery clue progression end-to-end. Orchestrates murder-db-seed, murder-db-inspect, murder-cheat-stress, and browser verification on localhost:3000. Use when testing clue reveal flow, debugging investigation chains, or validating murder mystery gameplay.
---

# Test Clue Progression

End-to-end test: suspects unlock through interviews, perpetrator hidden at first, non-linear path (multiple suspects, dead ends).

## Related skills

| Skill | Role |
|-------|------|
| **murder-db-seed** | Clear DB and generate one fresh murder before the test |
| **murder-db-inspect** | `sqlite3` path + queries for murder id, visible suspects, clue graph |
| **murder-cheat-stress** | Raise `people.stress` to force reveals / confession |
| **cursor-ide-browser** (MCP) / **claude browser** | Navigate app, snapshot sidebar, click suspects, chat |

## Prerequisites

- App at http://localhost:3000
- After reseed, exactly one murder (or pick a `murder_id` from inspect queries)

## Workflow

1. **Reset data** — Read and follow **murder-db-seed** (`pnpm db:seed`). Wait for generation to finish.
2. **Inspect DB** — Use **murder-db-inspect** to get `murder_id`, confirm perpetrator is not in the visible-suspects query, optionally map the clue graph.
3. **Browser** — Use **cursor-ide-browser** (MCP) or **claude browser**: open `/`, open the murder → `/murders/<id>/clues`. Sidebar must not list the perpetrator.
4. **Stress** — **murder-cheat-stress**: set stress on suspects you will interview (e.g. 50); perpetrator 100 when testing confession.
5. **Interviews** — Use **cursor-ide-browser** (MCP) or **claude browser**: open suspects, ask about their clue ties; expect `reveal_clue_link` and new sidebar entries when stress ≥ 31.

**Non-linear path**: Interview 2+ initial suspects, follow red herrings, only then chain to the perpetrator; aim for 3+ distinct suspects before the perpetrator appears.

## Validation checklist

- [ ] Perpetrator not visible at start
- [ ] ≥3 suspects interviewed before perpetrator visible
- [ ] Non-linear path; dead ends / red herrings
- [ ] Perpetrator appeared only after another suspect’s reveal
- [ ] At stress 100, perpetrator confessed

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Perpetrator visible at start | **murder-db-inspect** visible-suspects query; `clue_links.is_visible` on perpetrator links should be 0 |
| Bad / stale data | **murder-db-seed** again |
| Suspect won’t reveal | **murder-cheat-stress** (≥31); questions tied to their clue links from clue graph |
| No new suspects | Bridge clue must link to another person — clue graph query in **murder-db-inspect** |
