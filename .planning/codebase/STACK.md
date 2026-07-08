# Technology Stack

**Analysis Date:** 2026-07-08

## Languages

**Primary:**
- TypeScript 5.9.3 locked / `^5.7.2` declared - application, domain, repository, tests, and build configuration in `src/**/*.ts`, `src/**/*.tsx`, `vite.config.ts`, `tsconfig.json`, and `tsconfig.node.json`.
- TSX / React JSX - UI components and app entry in `src/main.tsx`, `src/App.tsx`, and `src/components/*.tsx`.

**Secondary:**
- SQL / PL/pgSQL - Supabase Postgres schema, RLS policies, triggers, seed/bootstrap scripts, and RPC functions in `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `supabase/migrations/20260707000000_workspace_admin_rpc.sql`, `supabase/bootstrap.owner.sql`, `supabase/grant.initial-admins.sql`, `supabase/seed.dev.sql`, and `supabase/seed.owner-samples.sql`.
- CSS - global application styling in `src/App.css`.
- YAML - GitHub Pages deployment workflow in `.github/workflows/deploy-pages.yml`.
- HTML - Vite document shell in `index.html`.

## Runtime

**Environment:**
- Node.js `>=22.0.0` required by `package.json`.
- GitHub Actions uses Node `22` via `actions/setup-node@v4` in `.github/workflows/deploy-pages.yml`.
- Browser runtime for the shipped app; Supabase is accessed from the browser through `src/lib/supabaseClient.ts`.

**Package Manager:**
- npm - scripts and install flow are defined in `package.json` and `README.md`.
- Lockfile: present, `package-lock.json` lockfileVersion `3`.

## Frameworks

**Core:**
- React `19.2.7` locked / `^19.0.0` declared - SPA UI rendering in `src/main.tsx`, `src/App.tsx`, and `src/components/*.tsx`.
- React DOM `19.2.7` locked / `^19.0.0` declared - browser mounting in `src/main.tsx`.
- Vite `6.4.3` locked / `^6.0.7` declared - dev server, production build, preview, and static asset bundling configured in `vite.config.ts`.
- `@vitejs/plugin-react` `4.3.4` declared - React transform plugin used by `vite.config.ts`.

**Testing:**
- Vitest `3.2.6` - test runner configured through `vite.config.ts` with `environment: 'jsdom'` and `setupFiles: './vitest.setup.ts'`.
- jsdom `25.0.1` - DOM environment for component tests.
- React Testing Library `16.1.0`, `@testing-library/jest-dom` `6.6.3`, and `@testing-library/user-event` `14.5.2` - component testing helpers used by tests such as `src/components/AuthGate.test.tsx` and `src/App.test.tsx`.

**Build/Dev:**
- TypeScript project build - `npm run build` runs `tsc -b && vite build` from `package.json`.
- Vite dev server - `npm run dev` runs `vite --host 127.0.0.1` from `package.json`.
- Vite preview server - `npm run preview` runs `vite preview --host 127.0.0.1` from `package.json`.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` `2.110.0` - browser Supabase client for Auth, Postgres table access, and RPC calls in `src/lib/supabaseClient.ts`, `src/auth/authRepository.ts`, and `src/domain/orderRepository.ts`.
- `react` / `react-dom` - UI runtime for `src/App.tsx`, `src/main.tsx`, and `src/components/*.tsx`.
- `react-day-picker` `10.0.1` - date picking UI dependency declared in `package.json`; relevant date/time UI lives in `src/components/DesiredDateTimePicker.tsx`.
- `es-toolkit` `1.49.0` - utility dependency declared in `package.json`.

**Infrastructure:**
- `typescript` `5.9.3` locked - strict type checking through `tsconfig.json`.
- `vite` `6.4.3` locked - app build and static output to `dist`.
- `vitest` `3.2.6` - unit/component test execution.
- `@types/node` `26.0.1`, `@types/react` `19.2.17`, and `@types/react-dom` `19.2.3` - TypeScript ambient/runtime typings.

## Configuration

**Environment:**
- Frontend config is read from Vite public env variables in `src/lib/supabaseClient.ts`.
- Required public env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- `.env` file present - contains environment configuration and was not read.
- `.env.example` file present - contains environment configuration examples and was not read.
- GitHub Pages injects Supabase public config from repository variables in `.github/workflows/deploy-pages.yml`.
- `README.md` documents local `.env.local` setup and GitHub Actions Repository Variables for Supabase public config.

**Build:**
- `vite.config.ts` sets `base: '/lyru-oms/'`, uses the React plugin, and configures Vitest.
- `tsconfig.json` uses `target: "ES2020"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `strict: true`, `jsx: "react-jsx"`, and includes `src`.
- `tsconfig.node.json` type-checks `vite.config.ts` as a composite TS project.
- `index.html` is the Vite app HTML entry.
- No ESLint, Prettier, Biome, Docker, Vercel, Netlify, or Supabase CLI config file detected in the full-repo scan.

## Platform Requirements

**Development:**
- Node.js 22 or newer.
- npm install from `package-lock.json`.
- Supabase project with migrations from `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql` and `supabase/migrations/20260707000000_workspace_admin_rpc.sql` applied.
- Browser-accessible Supabase public URL and publishable key configured through Vite env.

**Production:**
- Static SPA build output in `dist`.
- GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`.
- Vite base path is `/lyru-oms/` in `vite.config.ts`, matching GitHub Pages hosting documented in `README.md`.
- Production data/auth backend is Supabase Auth + Postgres + RLS, with public browser credentials only.

---

*Stack analysis: 2026-07-08*
