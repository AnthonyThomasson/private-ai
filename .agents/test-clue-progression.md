---
name: test-clue-progression
description: End-to-end murder mystery clue progression test. Orchestrates murder-db-seed, murder-db-inspect, murder-cheat-stress, and browser verification on localhost:3000. Use when testing clue reveal flow, debugging investigation chains, or validating murder mystery gameplay.
model: inherit
---

# Test Clue Progression

End-to-end test: suspects unlock through interviews, perpetrator hidden at first, non-linear path (multiple suspects, dead ends).

Use skills **murder-db-seed**, **murder-db-inspect**, **murder-cheat-stress**, and **cursor-ide-browser** (MCP) or **claude browser** as needed.

## Prerequisites

- Check if the app is running at http://localhost:3000
- If not, start the app with `pnpm dev`
- After reseed, exactly one murder (or pick a `murder_id` from inspect queries)

## Workflow

1. **Reset data** — Read and follow **murder-db-seed** (`pnpm db:seed`). Wait for generation to finish.
2. **Inspect DB** — Use **murder-db-inspect** to get `murder_id`, confirm perpetrator is not in the visible-suspects query. **Map the clue graph** — you need `clue.description`, `pe.name`, and `cl.is_visible` to know what to ask each suspect.

   **CSI check** — Query for CSI characters and verify one is among the initially visible suspects:

   ```bash
   sqlite3 <db_path> "SELECT p.id, p.name, p.occupation, p.type FROM people p WHERE p.murder_id = <murder_id> AND p.type = 'csi';"
   sqlite3 <db_path> "SELECT p.id, p.name, p.type FROM people p JOIN clue_links cl ON cl.person_id = p.id WHERE cl.murder_id = <murder_id> AND cl.is_visible = 1 AND p.id != (SELECT victim_id FROM murders WHERE id = <murder_id>);"
   ```

   Confirm: at least one CSI character exists, and the first visible suspect(s) include the CSI character.

   **Motive check** — Query the perpetrator's motive:

   ```bash
   sqlite3 <db_path> "SELECT p.name, p.motive FROM people p JOIN murders m ON m.perpetrator_id = p.id WHERE m.id = <murder_id>;"
   ```

   Confirm: motive is non-null, specific (not generic like "anger"), and plausible given the crime scene description and victim's occupation/relationships. All non-perpetrators should have a null motive.

3. **Browser** — Use **cursor-ide-browser** (MCP) or **claude browser**: open `/`, open the murder → `/murders/<id>/clues`. Sidebar must not list the perpetrator.
4. **Stress** — **murder-cheat-stress**: set stress on suspects you will interview (e.g. 50); perpetrator 100 when testing confession.
5. **Interviews** — Follow the logical progression below.

### Logical progression: clue discovery → conversation

Each reveal must flow naturally from the conversation:

| Step | Action                  | Conversation tie                                                                                                                                                                                                                     |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | **Ask the right thing** | Use the clue graph: each `clue_links.relation` is what that person knows. Phrase your question to _touch_ that relation (e.g. relation = "Saw someone arguing with the victim" → ask about the argument, the victim, who was there). |
| B    | **Clue revealed**       | Suspect responds and calls `reveal_clue_link`; the clue's _other_ links become visible. Sidebar gains new suspect(s).                                                                                                                |
| C    | **Verify sidebar**      | Snapshot or refresh; confirm the new person appears in the sidebar.                                                                                                                                                                  |
| D    | **Continue the chain**  | Open the _newly visible_ suspect. Ask about _their_ relation to the revealed clue — the conversation should logically follow from what the informant just said (e.g. "I heard you were seen near the building that night").          |
| E    | **Repeat**              | Each reveal unlocks the next suspect; the conversation chain mirrors the clue graph.                                                                                                                                                 |

**Non-linear path**: Interview 2+ initial suspects, follow red herrings (dead-end clues), only then chain to the perpetrator; aim for 3+ distinct suspects before the perpetrator appears.

## Validation checklist

- [ ] At least one CSI character exists (type='csi' in people table)
- [ ] First visible crime-scene clue(s) link to the CSI character (not a regular witness)
- [ ] CSI character is NOT the perpetrator
- [ ] CSI character revealed forensic evidence freely within the first 1–2 questions (low/no stress required)
- [ ] Perpetrator not visible at start
- [ ] ≥3 suspects interviewed before perpetrator visible
- [ ] Non-linear path; dead ends / red herrings
- [ ] Perpetrator appeared only after another suspect's reveal
- [ ] Each reveal followed a logical conversation (question touched clue relation → reveal → sidebar update → next suspect asked about their relation)
- [ ] At stress 100, perpetrator confessed
- [ ] Perpetrator has a non-null, specific motive (not generic)
- [ ] Motive is consistent with the crime scene and clue chain
- [ ] At stress 100, perpetrator's confession references the motive (the "why")

## Troubleshooting

| Symptom                      | Check                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Perpetrator visible at start | **murder-db-inspect** visible-suspects query; `clue_links.is_visible` on perpetrator links should be 0                    |
| Bad / stale data             | **murder-db-seed** again                                                                                                  |
| Suspect won't reveal         | **murder-cheat-stress** (≥31); ask about their `clue_links.relation` — question must touch the relation to trigger reveal |
| No new suspects              | Bridge clue must link to another person — clue graph query in **murder-db-inspect**                                       |
| No CSI at crime scene        | Reseed — chain validator now enforces this; if it persists, check `type` column exists in DB (`pnpm db:push`)             |
| CSI is the perpetrator       | Chain validator prevents this; reseed if it slipped through a stale DB                                                    |
| CSI not revealing freely     | CSI should reveal at any stress level — check `type='csi'` is set correctly in the DB for that person                     |
