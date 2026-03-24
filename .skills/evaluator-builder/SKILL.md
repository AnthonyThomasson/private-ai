---
name: evaluator-builder
description: Expert in story evaluator architecture. Use when creating new evaluators, modifying existing ones, or ensuring evaluator changes follow the validate–fix pattern and shared tooling.
---

# Story Evaluator Architecture

Teaches the architecture for murder mystery evaluators in `src/services/agents/story/evaluators/`. Use when building new evaluators or changing existing ones.

## Directory Layout

Each evaluator lives in `evaluators/<name>/`:

```
evaluators/<name>/
├── index.ts          # Exports validateAndFix<Name>
├── fixer.ts          # Exports run<Name>Fix
└── prompts/
    ├── system.md     # Fix agent instructions (required)
    └── constraints.md # Validation criteria (optional; for LLM validators)
```

## Index Contract

`index.ts` exports a single function:

```ts
validateAndFix<Name>(
  murderId: number,
  maxFixAttempts: number,
  maxFixRecursionLimit: number,
)
```

**Loop**: validate → if invalid, call fixer with reason → re-validate. Repeat until valid or `maxFixAttempts` exhausted.

**Returns**: `{ valid: boolean, validation?, murder? }` (or `narrative` for narrativeEvaluator).

**Internal validate function**: Pure logic or LLM call; returns `{ valid, reason? }`. The reason is passed to the fixer.

## Fixer Contract

`fixer.ts` exports:

```ts
run<Name>Fix(
  murderId: number,
  reason: string,
  opts: { recursionLimit?: number } = {}
)
```

- Use `createDeepAgent` with `getFixTools(murderId)` from `../../tools/index`
- Load system prompt from `prompts/system.md`
- Invoke with `Validation failed: "${reason}". Fix this and only this problem.`
- Catch recursion-limit errors (msg includes "recursion" or "GRAPH_RECURSION"); log as incomplete, do not rethrow

## Shared Fix Tools

**Always** use `getFixTools(murderId)` from `src/services/agents/story/tools/index.ts`. Do not duplicate tools. Tools include: `get_chain_state`, `set_clue_link_visible`, `update_clue_description`, `update_clue_relation`, `update_clue_link_person`, `add_clue_link`, `create_person`, `create_clue`, `update_person_motive`.

## Validation Types

| Type | Example | How |
|------|---------|-----|
| Deterministic | chainValidator | Pure TS: BFS, sets, string checks. No LLM. |
| LLM-based | narrativeEvaluator | `ChatOpenAI` + `withStructuredOutput(zod schema)`. Pass murder state + `constraints.md`; return `{ valid, reason }`. |

## Integration

`src/services/agents/story/index.ts` calls evaluators in sequence after murder generation:

1. `validateAndFixChain` — graph structure
2. `validateAndFixNarrative` — narrative coherence

Add new evaluators by importing and calling after the existing ones. On invalid, `cleanupMurder` and retry or throw.

## Existing Evaluators

### chainValidator

- **Validates**: Perpetrator reachable from crime-scene clues via BFS; depth ≥ 2; at least one dead-end branch; perpetrator not visible initially; perpetrator name not in clues/relations.
- **Fixer**: `runChainFix` — repair graph (add links, people, clues) per `prompts/system.md`.

### narrativeEvaluator

- **Validates**: Motive quality, clue-motive coherence, cause-of-death consistency, character consistency, relation plausibility, timeline, identity protection. Uses LLM with `constraints.md`.
- **Fixer**: `runNarrativeFix` — prefer `update_person_motive`, `update_clue_description`, `update_clue_relation`; only create entities if needed.

## New Evaluator Checklist

1. Create `evaluators/<name>/` folder
2. Add `index.ts` with `validateAndFix<Name>` loop
3. Add `fixer.ts` with `run<Name>Fix` using `getFixTools`, `createDeepAgent`, `prompts/system.md`
4. Add `prompts/system.md` — minimal fix instructions (get_chain_state first, fix one thing, stop)
5. Add `prompts/constraints.md` if using LLM validation
6. Import and call in `story/index.ts` after chain/narrative
7. Use existing fix tools; do not add new tools unless they belong in `tools/index.ts` for all evaluators

## Anti-patterns

- **Don't duplicate fix tools** — use `getFixTools(murderId)`
- **Don't skip the validate–fix loop** — evaluators always: validate → fix → re-validate
- **Don't bypass getFixTools** — fixers must use the shared tool set
- **Don't change graph/visibility in narrative fixer** — narrative fixer only touches motive, clue descriptions, relations
