---
name: test-clue-progression
description: Test murder mystery clue progression end-to-end. Queries the DB to identify the perpetrator, navigates to localhost:3000, verifies the perpetrator is hidden initially, uses murder-cheat-stress to reveal clues through suspect interviews, and validates a non-linear path with 3+ suspects and branching clues. Use when testing clue reveal flow, debugging investigation chains, or validating murder mystery gameplay.
---

# Test Clue Progression

End-to-end test for murder mystery clue progression. Verifies suspects unlock through interviews, perpetrator stays hidden until late, and the investigation path is non-linear (multiple suspects, some dead ends).

## Prerequisites

- App running at http://localhost:3000
- At least one murder in the DB
- Use the **murder-cheat-stress** skill when modifying suspect stress

## DB Setup

DB file is `data/local.db` (or `local.db` in project root). Use `DB_FILE_NAME` from .env if present — strip the `file:` prefix for sqlite3 (e.g. `data/local.db`).

## Step 1: Query DB to Determine the Murderer

```bash
# List murders and get perpetrator
sqlite3 data/local.db "SELECT m.id, m.description, m.perpetrator_id, p.name as perpetrator_name FROM murders m LEFT JOIN people p ON m.perpetrator_id = p.id;"
```

Pick a `murder_id` for testing. Note `perpetrator_id` — the perpetrator must NOT be in the initial visible suspects.

## Step 2: Verify Perpetrator Is Hidden Initially

Initial visible suspects = people with at least one `clue_links` row where `is_visible = 1` (and not the victim).

```bash
# Visible suspect person IDs for a murder
sqlite3 data/local.db "
SELECT DISTINCT cl.person_id, pe.name 
FROM clue_links cl 
JOIN people pe ON cl.person_id = pe.id 
WHERE cl.murder_id = <murder_id> AND cl.is_visible = 1 AND cl.person_id != (SELECT victim_id FROM murders WHERE id = <murder_id>);
"

# Perpetrator must NOT appear in the above list
```

If the perpetrator appears, the murder setup is invalid for this test — pick another murder or generate a new one.

## Step 3: Inspect Clue Graph (Optional)

To plan a non-linear test path, inspect the clue chain:

```bash
sqlite3 data/local.db "
SELECT cl.id, c.description as clue, pe.name, cl.is_visible 
FROM clue_links cl 
JOIN clues c ON cl.clue_id = c.id 
JOIN people pe ON cl.person_id = pe.id 
WHERE cl.murder_id = <murder_id> 
ORDER BY cl.clue_id, cl.person_id;
"
```

Look for clues linked to multiple people (bridge clues). Some should lead to red herrings, not the perpetrator.

## Step 4: Navigate and Select a Murder

1. Navigate to http://localhost:3000/
2. Select a murder (click its description) → redirects to `/murders/<id>/clues`
3. Verify the people sidebar shows only initial suspects — perpetrator name must NOT appear

Use cursor-ide-browser: `browser_navigate` → `browser_snapshot` to verify sidebar contents.

## Step 5: Reveal Clues via Stress Cheat

Use **murder-cheat-stress** to set stress on visible suspects so they reveal clues when interviewed:

- Stress ≥ 31: suspect discloses clue links when asked about them
- Stress 100: perpetrator confesses

```bash
# Set stress on a visible suspect (replace IDs)
sqlite3 data/local.db "UPDATE people SET stress = 50 WHERE id = <person_id>;"
```

Get person IDs:

```bash
sqlite3 data/local.db "SELECT id, name, stress FROM people WHERE murder_id = <murder_id>;"
```

## Step 6: Interview Suspects to Trigger Reveals

1. Click a suspect in the sidebar → `/murders/<id>/person/<person_id>`
2. Ask questions that touch their clue connections (e.g. about evidence, alibis, people they know)
3. With stress ≥ 31, they should call `reveal_clue_link` → new suspects appear in sidebar
4. Repeat with newly unlocked suspects

**Non-linear path**: Do NOT rush straight to the perpetrator. Intentionally:
- Interview 2+ initial suspects
- Follow clues that unlock red herrings (suspects with no path to perpetrator)
- Only then follow the chain that leads to the perpetrator
- Expect 3+ distinct suspects before the perpetrator becomes visible

## Step 7: Validation Checklist

- [ ] Perpetrator was NOT visible at start
- [ ] At least 3 suspects interviewed before perpetrator appeared
- [ ] Path was non-linear: multiple clues led to multiple suspects
- [ ] Some suspects/clues did not lead to the perpetrator (dead ends)
- [ ] Perpetrator became visible only after a preceding suspect revealed their linking clue
- [ ] At stress 100, perpetrator confessed

## Troubleshooting

**Perpetrator visible at start**: Murder generation may have marked a perpetrator clue visible. Check `clue_links.is_visible` for the perpetrator's links — they should be 0.

**Suspect won't reveal**: Ensure stress ≥ 31. Ask questions that directly touch their clue relations (from the clue graph query).

**No new suspects unlock**: The revealed clue must link to another person. Check the clue graph — bridge clues link informant + next suspect.
