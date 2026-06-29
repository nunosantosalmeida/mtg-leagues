## Mode Rules

### Plan Mode Instructions
- Never assume the choice of design, tech stack, or implementation details; always ask clarifying questions.
- Provide a clear layout of modified and newly created files before prompting to switch modes.
- Keep token usage efficient by giving brief structural overviews rather than full blocks of pseudo-code.

### Build Mode Instructions
- Stick strictly to the agreed-upon architecture defined in the Plan phase.
- Run `npm test` (or your project's test command) after modifying files to ensure nothing is broken.
- Do not add features outside the requested scope.

## Technical Context
- **Build Command:** `npm run build` or `cargo build`
- **Test Command:** `npm run test` or `pytest`
- **Linting Rules:** Use ESLint with Prettier formatting. Do not leave unused imports.

## Guardrails
- **Conciseness:** Keep text explanations short and directly to the point.
- **Modularity:** Prefer small, single-responsibility files over editing large monolithic files.
- **Subagents:** For complex structural changes, invoke specialized subagents (e.g., `@Scout` or `@Explore`) to research the local codebase before writing.


## Next.js 16 & React 19 Guardrails
- **App Router First:** Never generate files in a `/pages` directory. Use the `/app` directory with `layout.tsx`, `page.tsx`, and Server Components by default.
- **Server Functions:** Write mutations inside `app/actions.js` or file-level `'use server'` functions. Never mix `'use client'` and Server Functions in the same file.
- **React Compiler & Memoization:** The React Compiler is active. Do not write manual `useMemo` or `useCallback` optimizations unless specifically requested.
- **Async Request APIs:** Remember that access to `params`, `searchParams`, `cookies()`, and `headers()` is strictly asynchronous in Next.js 16. Always `await` them.

## Prisma 7 & Driver Adapter Configuration
- **Prisma Client Initialization:** SQLite uses the `@prisma/adapter-better-sqlite3` driver adapter. The Prisma client must always be instantiated by passing the driver instance:
  ```typescript
  import sqlite from 'better-sqlite3'
  import { PrismaClient } from '@prisma/client'
  import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

  const libsql = new sqlite('dev.db')
  const adapter = new PrismaBetterSqlite3(libsql)
  export const prisma = new PrismaClient({ adapter })
  ```
- **Prisma Schemas:** When updating `schema.prisma`, use standard SQLite types (`String`, `Int`, `Boolean`, `DateTime`). Do not attempt to use Postgres-specific types like `Json` or Enums (use `String` with Zod validation instead).

## Tailwind v4 & Shadcn/UI v4 (Base UI)
- **Tailwind v4 Configuration:** Tailwind CSS v4 relies on a CSS-first configuration (`@theme` inside global CSS) rather than a `tailwind.config.js` file. Do not attempt to edit or create a `tailwind.config.js`.
- **Base UI Primitives:** Shadcn components use `@base-ui/react` primitives rather than Radix UI. Ensure any newly generated layout components comply with Base UI syntax conventions.


## Domain Logic Rules (MTG Leagues)
- **Point-Based Calculators:** Keep the complex logic for league points separated from your UI components. Ensure all logic lives in a dedicated `/lib/points.ts` utility file.
- **Multi-League Isolation:** Every single database query fetch for Matches, Standings, or Rosters must filter strictly by an active `leagueId`. 
- **Role Guardrails:** Admin routes (`/admin/*`) or admin-scoped Server Functions must explicitly validate that the `next-auth` session user has the `ADMIN` role. Never rely on client-side routing checks for data security.


## Verification Steps
- Before running `npm run dev`, verify that the Prisma schema is aligned by evaluating changes with `npx prisma db push`.
- Always verify built code against Turbopack using `next build` before declaring a Build task complete.
