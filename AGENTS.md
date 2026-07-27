# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project for the `moj-agent` chatbot.

- `app/page.tsx` contains the main chat UI.
- `app/think/page.tsx` contains the deep-thinking chat page.
- `app/api/chat/route.ts` handles normal chat, model selection, fallback logic, and business commands.
- `app/api/think/route.ts` handles the `/think` analysis endpoint.
- `app/globals.css` contains shared styling.
- `BUSINESS_COMMANDS.md` documents `/manewr` and `/dziennik` few-shot command behavior.
- `.env.local` stores `GOOGLE_GENERATIVE_AI_API_KEY`; do not commit real secrets.

Generated folders such as `.next/`, `node_modules/`, and log files should not be edited manually.

## Build, Test, and Development Commands

Use `pnpm` for package management.

```bash
pnpm dev
```

Runs the local dev server, normally at `http://127.0.0.1:3000`.

```bash
pnpm build
```

Compiles the production build and runs TypeScript checks.

```bash
pnpm start
```

Starts the production server after a successful build.

There is currently no dedicated `test` script; use `pnpm build` plus manual endpoint checks for validation.

## Coding Style & Naming Conventions

Write TypeScript and React components with 2-space indentation. Use `PascalCase` for React components, `camelCase` for variables/functions, and lowercase route folder names such as `app/think`.

Keep API route logic explicit and readable. Put prompt text near the route that uses it. Prefer typed unions for fixed options, for example `type AiModel = "flash" | "pro"`.

## Testing Guidelines

Validate changes with:

```bash
pnpm build
```

For chat behavior, manually test:

- `/` for the standard agent.
- `/think` for step-by-step analysis.
- `/api/chat` with `/manewr ...` and `/dziennik ...`.
- `/api/think` with a calculation-style prompt.

When adding tests later, place them near the relevant module or under a `tests/` directory and name files `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

No reliable Git history is available in this workspace, so use clear imperative commit messages, for example:

```text
Add business command prompts
Fix Gemini fallback handling
```

Pull requests should include a short summary, validation steps, screenshots for UI changes, and notes about any prompt/model behavior changes.

## Security & Configuration Tips

Keep API keys only in `.env.local`. Do not print secrets in logs or responses. When changing Gemini model IDs, test both normal streaming and fallback behavior before handing off.

## Supabase Migrations

Keep database schema changes in `supabase/migrations/` as committed, numbered SQL files. Apply them in ascending numeric order in Supabase SQL Editor:

1. `001_initial_agent_memory.sql`
2. `002_running_mvp.sql`
3. `003_add_athlete_home_location.sql`

For every new schema change, add a new migration with the next number and a descriptive snake_case name. Do not edit a migration that may already have been applied to a shared environment; add a follow-up migration instead. Never commit `.env.local` or Supabase keys.

## Backup instrukcji

Po każdej zmianie tego pliku (`AGENTS.md`) zaktualizuj jego kopię na Google Drive. Użyj istniejącego pliku `AGENTS.md` na Dysku Google, aby zachować jedną aktualną kopię zamiast tworzyć duplikaty.
