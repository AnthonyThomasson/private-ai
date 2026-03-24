# CLAUDE.md

This file provides guidance to AI coding assistants working with this repository.

## Commands

```bash
pnpm dev              # Start dev server at localhost:3000 (uses Turbopack)
pnpm build            # Production build
pnpm lint             # Run ESLint

pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:push          # Apply migrations to local SQLite DB
pnpm db:studio        # Open Drizzle Studio (visual DB browser)
pnpm db:seed          # Push migrations + seed with a fresh murder via AI agents
```

## Architecture

AI-powered interactive murder mystery game. Users investigate procedurally-generated crimes by interviewing AI-driven suspects.

### Data Flow

1. **Murder Generation**: `services/agents/story/` uses OpenAI GPT-4.1-mini via the `deepagents` library to generate a complete murder scenario — victim, perpetrator, supporting characters, locations, and an interconnected clue chain.
2. **Suspect Interviews**: `POST /api/messages` drives the core gameplay. The suspect agent (`services/agents/suspect/suspect.ts`) roleplays NPCs during chat, tracking a stress level (0–100). As stress rises through questioning, suspects reveal clues. At 100, the perpetrator confesses.
3. **Clue Progression**: Clues are linked in a graph (`clueLink` table). Revealing one clue can unlock related clues and point to new suspects.

### Key Directories

- `src/app/` — Next.js App Router pages. The interview UI lives at `/murders/[murderId]/person/[personId]`.
- `src/services/agents/` — All AI agent logic. Subdirectories: `story/` (murder generation, evaluators, painter for DALL-E images), `suspect/` (interview roleplay).
- `src/db/` — Drizzle ORM schema and models. Database is SQLite (`local.db`), configured via `DB_FILE_NAME` env var.
- `src/components/` — React components organized by feature: `chat/`, `clues/`, `people/`.
- `.skills/` — Custom AI assistant skills for development workflows (see below).
- `.agents/` — Custom subagents for Cursor and Claude Code (see below).

### Database Schema

Core entities: `murders`, `people` (suspects/victim/perpetrator), `locations`, `clues`, `clueLink` (graph edges), `messages` (chat history per user token).

The `people` table has a `type` field distinguishing victim, perpetrator, and witnesses. Stress levels and visible clues are tracked per person/user session.

### AI Stack

- **deepagents** library — wraps OpenAI for the suspect roleplay and murder generation agents
- **LangChain + LangGraph** — used in some generation pipelines
- **OpenAI GPT-4.1-mini** — primary model for all agents
- **DALL-E** — character and crime scene image generation (controlled by `GENERATE_IMAGES=yes` env var)

## Environment Variables

```
DB_FILE_NAME=file:local.db
OPENAI_API_KEY=...
GENERATE_IMAGES=yes   # Set to anything else to skip image generation
```

## Custom Skills

The `.skills/` directory contains assistant workflows for testing and debugging:

- `/murder-db-seed` — Wipe and reseed the DB with a fresh AI-generated murder
- `/murder-db-inspect` — Query the DB to inspect murders, clues, and perpetrator setup
- `/murder-cheat-stress` — Manually set suspect stress in DB to force clue reveals or confession
- `/evaluator-builder` — Story evaluator architecture; use when creating or modifying evaluators

## Custom Agents

The `.agents/` directory contains subagents for Cursor and Claude Code (synced to `.cursor/agents/` and `.claude/agents/`):

- `/test-clue-progression` — End-to-end test of the clue reveal flow via browser + DB
