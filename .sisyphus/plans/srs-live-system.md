# SRS v6 Live Streaming System

## TL;DR

> **Quick Summary**: Build a browser-based live streaming management platform with SRS v6 as the streaming backend, Next.js (App Router) + Ant Design + ArtPlayer frontend, mpegts.js FLV playback (HLS fallback for iOS), Authentik OAuth2 auth, and admin-controlled stream rooms with rotatable keys.
>
> **Deliverables**:
> - Next.js App Router monorepo (pnpm workspaces) with Prisma + Redis
> - SRS v6 Docker container with auth callbacks + FLV/HLS playback
> - Nginx reverse proxy with FLV CDN bypass, CORS, streaming timeouts
> - Stream room selection page (card grid, no status/counts)
> - Fullscreen player page (/live/[id]) with mpegts.js + ArtPlayer
> - Admin panel (/admin): site config, room CRUD, key management, play sources
> - Authentik OAuth2 integration with auto-first-admin promotion
> - Rotatable stream keys for push auth + private room access
>
> **Estimated Effort**: XL (36 implementation tasks + 4 verification)
> **Parallel Execution**: YES — 7 waves, max 8 concurrent tasks
> **Critical Path**: Wave 1 (Foundation) → Wave 2 (Auth+APIs) → Wave 3 (SRS) → Wave 4-5 (Frontend) → Wave 6 (Polish) → Wave FINAL

---

## Context

### Original Request
构建基于 SRS v6 的直播系统。前端 Next.js + Ant Design + ArtPlayer，后端 Next.js API Routes + Prisma + Redis。Authentik OAuth2 登录。手动/非手动播放模式。可轮换推流/访问密钥。CDN 前端双域名架构。

### Interview Summary
**Key Discussions**:
- **mpegts.js over flv.js**: flv.js abandoned since 2021; mpegts.js is the actively maintained successor
- **iOS HLS fallback**: SRS generates HLS alongside FLV (remux, not transcode); iOS auto-switches
- **SRS callback constraint**: on_publish/on_play BLOCK synchronously with NO timeout — handlers must be sub-100ms Redis-only
- **ArtPlayer is UI shell**: All FLV playback logic in `customType` callback; mpegts.js manages the stream
- **CDN bypass for FLV**: CDN kills long-lived connections; Nginx must bypass CDN for `.flv` paths with `proxy_buffering off`
- **Manual mode**: Admin configures play sources in DB (multiple sources, qualities, custom URLs); ArtPlayer switches per config
- **First-admin**: Atomic DB transaction on first login → promote to admin
- **Containerization**: Prod: only SRS + Next.js (external Postgres/Redis/Authentik); Dev: Docker Compose for SRS + Postgres + Redis

**Research Findings**:
- SRS v6: Docker `ossrs/srs:6`, RTMP:1935, HTTP API:1985, HTTP-FLV:8080, `http_hooks` for auth callbacks
- Authentik: NextAuth v5 built-in provider, PKCE for Public client, BFF pattern (HttpOnly cookies), API v3 for user management
- Nginx: `proxy_buffering off` (mandatory for FLV), `proxy_read_timeout 3600s`, CORS headers, `worker_rlimit_nofile`

### Metis Review
**Identified Gaps** (addressed):
- **flv.js abandoned**: Switched to mpegts.js ✅
- **iOS no MSE for FLV**: Added HLS fallback via SRS remux ✅
- **SRS callback timeout**: Enforced sub-100ms Redis-only constraint ✅
- **ArtPlayer no native FLV**: `customType` integration pattern defined ✅
- **CDN vs FLV conflict**: Nginx FLV bypass with specific headers ✅
- **Manual mode ambiguity**: Confirmed — multi-source, multi-quality DB configs ✅

---

## Work Objectives

### Core Objective
Build a browser-based live streaming management platform using SRS v6 as the streaming backend, with Next.js + Ant Design frontend, Authentik OAuth2 authentication, and mpegts.js FLV playback (HLS fallback for iOS), serving authenticated viewers and stream publishers via a CDN-fronted domain.

### Concrete Deliverables
- `live.example.com`: Next.js SPA (stream selection, player, admin panel) + API Routes + FLV/HLS proxy
- `live-push.example.com`: Direct RTMP ingest (bypasses CDN)
- SRS v6 Docker container with auth callbacks
- Nginx reverse proxy with streaming-optimized config
- PostgreSQL schema (User, StreamRoom, StreamKey, PlaySource, SiteConfig)
- Redis cache layer (callback validation, stream status)

### Definition of Done
- [ ] `pnpm dev` starts dev environment with all services
- [ ] `docker compose up` starts production services (SRS + Next.js)
- [ ] Authentik login → auto-admin promotion → access /admin
- [ ] Admin creates room → OBS pushes with key → viewer watches at /live/[id]
- [ ] `pnpm test` passes all vitest suites
- [ ] FLV playback works in Chrome/Firefox/Edge (desktop)
- [ ] HLS fallback works in iOS Safari
- [ ] Private room inaccessible without login
- [ ] Key rotation: new key works, old key rejected

### Must Have
1. Next.js App Router with API Routes (single process)
2. mpegts.js FLV playback + HLS fallback for iOS
3. SRS http_hooks callbacks: sub-100ms, Redis-only, Promise.race timeout
4. Nginx: `proxy_buffering off`, `proxy_read_timeout 3600s`, CORS, FLV CDN bypass
5. First-user auto-admin via atomic DB transaction
6. Rotatable stream keys (CRUD in admin, bcrypt/scrypt hashed in DB)
7. Admin role check on EVERY server-side request
8. Session cookies: HttpOnly, Secure, SameSite=Lax
9. All configurable items in admin panel (no manual config file edits)
10. Prisma migrations: reversible, down-migration tested

### Must NOT Have (Guardrails)
1. NO SRT or WebRTC — omit `srt_server` and `rtc_server` blocks entirely
2. NO transcoding — HLS is remux only, same source bitrate
3. NO viewer counts, stream status on selection page
4. NO chat, comments, reactions
5. NO recording, DVR, VOD
6. NO public REST API — all endpoints behind auth
7. NO WebSocket/Socket.io — use polling for stream status
8. NO mobile app — web-only
9. NO in-browser publish — RTMP only (OBS)
10. NO multi-tenant — single Authentik instance, single org
11. NO user self-service stream creation — admin-only
12. NO DB writes in `on_publish`/`on_play` callbacks — Redis-only, sub-100ms
13. NO callback handlers without explicit `Promise.race` timeout
14. NO assumption that ArtPlayer handles FLV natively — all in `customType`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (greenfield — created in Task 1)
- **Automated tests**: TDD (vitest)
- **Framework**: vitest + @testing-library/react (frontend) + supertest (API)
- **TDD workflow**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.
- **Frontend/UI**: Playwright — navigate, interact, assert DOM, screenshot
- **API/Backend**: curl — send requests, assert status + response fields
- **Docker/Infra**: bash — docker compose ps, curl health endpoints
- **SRS**: curl SRS HTTP API + ffprobe/ffplay verification

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 8 tasks, ALL INDEPENDENT):
├── Task 1: Project scaffolding [quick]
├── Task 2: Shared TypeScript types [quick]
├── Task 3: Prisma schema + migrations [quick]
├── Task 4: Redis client setup [quick]
├── Task 5: Environment config (zod) [quick]
├── Task 6: SRS config template [quick]
├── Task 7: Nginx config template [quick]
└── Task 8: Docker Compose (dev) [quick]

Wave 2 (Auth + Data APIs — 8 tasks):
├── Task 9: NextAuth v5 + Authentik [unspecified-high] (dep: 5)
├── Task 10: Auth middleware + guards [quick] (dep: 9)
├── Task 11: User management API [quick] (dep: 3, 10)
├── Task 12: SiteConfig API [quick] (dep: 3, 10)
├── Task 13: StreamRoom API [unspecified-high] (dep: 3, 10)
├── Task 14: StreamKey API [unspecified-high] (dep: 3, 10, 13)
├── Task 15: PlaySource API [quick] (dep: 3, 10, 13)
└── Task 16: Redis SRS callback cache [unspecified-high] (dep: 4, 13, 14)

Wave 3 (SRS Integration — 5 tasks):
├── Task 17: on_publish callback [unspecified-high] (dep: 14, 16)
├── Task 18: on_play callback [unspecified-high] (dep: 13, 16)
├── Task 19: on_unpublish/on_stop [quick] (dep: 13, 16)
├── Task 20: Stream status polling API [quick] (dep: 4, 13)
└── Task 21: Health check endpoints [quick] (dep: 4)

Wave 4 (Frontend Core — 6 tasks):
├── Task 22: Ant Design layout + theme [visual-engineering] (dep: 2)
├── Task 23: Auth UI [visual-engineering] (dep: 9)
├── Task 24: Stream room selection page [visual-engineering] (dep: 13, 22)
├── Task 25: Player page — ArtPlayer wrapper [visual-engineering] (dep: 2, 22)
├── Task 26: mpegts.js customType integration [visual-engineering] (dep: 25)
└── Task 27: iOS HLS fallback [visual-engineering] (dep: 26)

Wave 5 (Admin Panel — 5 tasks):
├── Task 28: Admin layout + role gate [visual-engineering] (dep: 10, 22)
├── Task 29: Admin site config page [visual-engineering] (dep: 12, 28)
├── Task 30: Admin stream room management [visual-engineering] (dep: 13, 28)
├── Task 31: Admin stream key management [visual-engineering] (dep: 14, 28)
└── Task 32: Admin play source management [visual-engineering] (dep: 15, 28)

Wave 6 (Integration + Polish — 4 tasks):
├── Task 33: Player reconnection logic [unspecified-high] (dep: 26)
├── Task 34: Private stream key access [unspecified-high] (dep: 13, 25)
├── Task 35: Docker Compose prod config [quick] (dep: 1, 6, 7, 8)
└── Task 36: End-to-end integration [unspecified-high] (dep: ALL)

Wave FINAL (Verification — 4 parallel reviews):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high + playwright]
└── Task F4: Scope fidelity check [deep]
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1-8 | — | 3,4,5,8,9,13,14,5,35 | W1 |
| 9 | 5 | 10,23 | W2 |
| 10 | 9 | 11-15,28 | W2 |
| 11 | 3,10 | — | W2 |
| 12 | 3,10 | 29 | W2 |
| 13 | 3,10 | 14,15,16,18,19,20,24,30,34 | W2 |
| 14 | 3,10,13 | 16,17,31 | W2 |
| 15 | 3,10,13 | 32 | W2 |
| 16 | 4,13,14 | 17,18,19 | W2 |
| 17 | 14,16 | — | W3 |
| 18 | 13,16 | — | W3 |
| 19 | 13,16 | — | W3 |
| 20 | 4,13 | — | W3 |
| 21 | 4 | — | W3 |
| 22 | 2 | 24,25,28 | W4 |
| 23 | 9 | — | W4 |
| 24 | 13,22 | — | W4 |
| 25 | 2,22 | 26,27,34 | W4 |
| 26 | 25 | 27,33 | W4 |
| 27 | 26 | — | W4 |
| 28 | 10,22 | 29-32 | W5 |
| 29 | 12,28 | — | W5 |
| 30 | 13,28 | — | W5 |
| 31 | 14,28 | — | W5 |
| 32 | 15,28 | — | W5 |
| 33 | 26 | — | W6 |
| 34 | 13,25 | — | W6 |
| 35 | 1,6,7,8 | — | W6 |
| 36 | ALL | — | W6 |
| F1-F4 | 36 | — | FINAL |

### Agent Dispatch Summary

| Wave | Count | Agents |
|------|-------|--------|
| W1 | 8 | quick ×8 |
| W2 | 8 | quick ×4, unspecified-high ×4 |
| W3 | 5 | unspecified-high ×2, quick ×3 |
| W4 | 6 | visual-engineering ×6 |
| W5 | 5 | visual-engineering ×5 |
| W6 | 4 | unspecified-high ×3, quick ×1 |
| FINAL | 4 | oracle, unspecified-high ×2, deep |

---

## TODOs

- [x] 1. **Project Scaffolding**

  **What to do**:
  - Initialize pnpm monorepo: `pnpm init`, create `pnpm-workspace.yaml`
  - Create Next.js App Router project at `apps/web/` with `create-next-app` using TypeScript + App Router
  - Install dependencies: `antd`, `@ant-design/icons`, `artplayer`, `mpegts.js`, `@auth/core`, `@auth/prisma-adapter`, `@prisma/client`, `ioredis`, `zod`, `next`
  - Install devDependencies: `vitest`, `@testing-library/react`, `prisma`, `typescript`, `eslint`, `prettier`, `supertest`
  - Configure `tsconfig.json` (strict mode, path aliases `@/` → `src/`)
  - Configure ESLint + Prettier
  - Create `vitest.config.ts`
  - Verify: `pnpm dev` starts Next.js on port 3000 without errors

  **Must NOT do**:
  - Do not add Docker files yet (Task 8)
  - Do not add any business logic or pages
  - Do not configure any env vars beyond basic defaults

  **Recommended Agent Profile**:
  - **Category**: `quick` — boilerplate project setup, no complex logic
  - **Skills**: `[]` — standard Next.js init, no specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-8)
  - **Blocks**: Task 35 (Docker Compose prod)
  - **Blocked By**: None

  **References**:
  - Official Next.js App Router docs: `https://nextjs.org/docs/app` — App Router conventions (layout.tsx, page.tsx, route.ts)
  - PNPM Workspace: `https://pnpm.io/workspaces` — workspace configuration syntax
  - Ant Design with Next.js: `https://ant.design/docs/react/use-with-next` — App Router integration pattern
  - vitest Next.js example: `https://vitest.dev/guide/#configuring-vitest` — vitest + Vite config for Next.js

  **Acceptance Criteria**:
  - [ ] `pnpm dev` starts dev server without errors
  - [ ] `pnpm build` compiles successfully
  - [ ] `pnpm test` runs vitest (initially 0 tests, exits cleanly)
  - [ ] `pnpm lint` passes ESLint with zero errors
  - [ ] Path alias `@/components` resolves correctly

  **QA Scenarios**:

  ```
  Scenario: Scaffold is functional
    Tool: bash
    Preconditions: Fresh clone of repo
    Steps:
      1. pnpm install → exits 0
      2. pnpm tsc --noEmit → exits 0, no errors
      3. pnpm build → creates .next/ directory
    Expected Result: All commands succeed with exit code 0
    Evidence: .sisyphus/evidence/task-1-scaffold-build.txt
  ```

  **Commit**: YES (W1 group)
  - Message: `chore(scaffold): initialize Next.js pnpm monorepo with TypeScript, ESLint, vitest`
  - Files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `apps/web/`

- [x] 2. **Shared TypeScript Types**

  **What to do**:
  - Create `src/types/` directory with type definition files
  - `user.ts`: `UserRole` enum (user/admin), `UserDTO`, `SessionUser`
  - `stream.ts`: `StreamRoomDTO`, `StreamRoomVisibility` (public/private), `StreamStatus` (offline/live), `StreamKeyDTO`
  - `play-source.ts`: `PlaySourceDTO`, `PlaySourceQualityDTO` — multi-source, multi-quality structure
  - `config.ts`: `SiteConfigDTO` — title, favicon
  - `api.ts`: `ApiResponse<T>`, `PaginatedResponse<T>`, error types
  - Export all from `src/types/index.ts` barrel

  **Must NOT do**:
  - Do not create Prisma schema yet (Task 3)
  - Do not add runtime logic — types only
  - Do not add Zod schemas yet (Task 5)

  **Recommended Agent Profile**:
  - **Category**: `quick` — type declarations, no runtime code
  - **Skills**: `[]` — pure TypeScript type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1,3-8)
  - **Blocks**: Task 22 (Frontend layout), Task 25 (Player wrapper)
  - **Blocked By**: None

  **References**:
  - Prisma types pattern: Use Prisma-generated types as source of truth; DTOs are derived shapes
  - Ant Design Table column types: `https://ant.design/components/table#column` — column type patterns for admin tables

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` passes with zero errors
  - [ ] All types exported from barrel `src/types/index.ts`
  - [ ] `UserDTO` includes: id, email, name, role, createdAt
  - [ ] `StreamRoomDTO` includes: id, name, visibility, streamKey, status, manualMode, createdAt
  - [ ] `PlaySourceDTO` includes nested `PlaySourceQualityDTO[]` with name + url

  **QA Scenarios**:
  ```
  Scenario: Types compile cleanly
    Tool: bash
    Preconditions: Task 1 complete
    Steps:
      1. pnpm tsc --noEmit → exits 0
    Expected Result: Zero type errors
    Evidence: .sisyphus/evidence/task-2-types-compile.txt
  ```

  **Commit**: YES
  - Message: `chore(types): add shared TypeScript types for user, stream, play-source, config`
  - Files: `src/types/`

- [x] 3. **Prisma Schema + Migrations**

  **What to do**:
  - Initialize Prisma: `pnpm prisma init --datasource-provider postgresql`
  - Define models in `prisma/schema.prisma`:
    - `User`: id (uuid), email (unique), name, role (UserRole enum), createdAt, updatedAt
    - `Account`: NextAuth account linking fields (provider, providerAccountId, etc.)
    - `Session`: NextAuth session fields
    - `VerificationToken`: NextAuth verification token fields
    - `StreamRoom`: id (uuid), name, slug (unique), visibility (enum), streamKey (unique), manualMode (bool), createdAt, updatedAt
    - `StreamKey`: id (uuid), keyHash, label, isActive, roomId (FK), createdAt, expiresAt (nullable)
    - `PlaySource`: id (uuid), name, roomId (FK), order
    - `PlaySourceQuality`: id (uuid), label (e.g. "1080p"), url, sourceId (FK)
    - `SiteConfig`: id (uuid, singleton), siteTitle, faviconUrl
  - Generate client: `pnpm prisma generate`
  - Create initial migration: `pnpm prisma migrate dev --name init`
  - Add seed script for dev: `prisma/seed.ts` — creates default SiteConfig

  **Must NOT do**:
  - Do not add API routes yet (Tasks 11-15)
  - Do not add bcrypt/scrypt to schema — hash at API layer

  **Recommended Agent Profile**:
  - **Category**: `quick` — schema definition, well-known patterns
  - **Skills**: `[]` — Prisma CLI + schema language

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2,4-8)
  - **Blocks**: Tasks 11-15 (all API routes)
  - **Blocked By**: None

  **References**:
  - Prisma schema reference: `https://www.prisma.io/docs/orm/reference/prisma-schema-reference` — field types, relations, enums
  - NextAuth Prisma adapter schema: `https://authjs.dev/reference/adapter/prisma` — required fields for Account, Session, VerificationToken
  - UUID generation: `@default(uuid())` for all primary keys

  **Acceptance Criteria**:
  - [ ] `pnpm prisma generate` succeeds
  - [ ] `pnpm prisma migrate dev` creates migration without errors
  - [ ] `pnpm prisma db seed` runs seed script successfully
  - [ ] All 8 models defined with correct relations
  - [ ] `StreamRoom.streamKey` is unique constraint
  - [ ] `StreamKey.keyHash` indexed for fast lookups

  **QA Scenarios**:
  ```
  Scenario: Prisma schema is valid and migrates
    Tool: bash
    Preconditions: PostgreSQL running (docker or external)
    Steps:
      1. Set DATABASE_URL env var
      2. pnpm prisma migrate dev --name init → exits 0
      3. pnpm prisma db seed → exits 0
    Expected Result: Migration creates all tables, seed inserts default SiteConfig
    Evidence: .sisyphus/evidence/task-3-migrate.txt
  ```

  **Commit**: YES
  - Message: `chore(db): add Prisma schema with User, StreamRoom, StreamKey, PlaySource, SiteConfig`
  - Files: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`

- [x] 4. **Redis Client Setup**

  **What to do**:
  - Install `ioredis` (already in Task 1 deps)
  - Create `src/lib/redis.ts`:
    - Singleton Redis client with connection retry
    - Export `getRedisClient()` with lazy initialization
    - Connection string from `REDIS_URL` env var
  - Create `src/lib/cache-keys.ts`:
    - Key patterns: `stream:status:<roomId>`, `stream:key:<keyHash>`, `stream:room:<streamKey>`, `publish:token:<token>`
    - Helper functions to generate Redis keys
  - Add Redis health check function

  **Must NOT do**:
  - Do not implement callback cache logic yet (Task 16)
  - Do not add stream status polling yet (Task 20)

  **Recommended Agent Profile**:
  - **Category**: `quick` — singleton setup, well-known ioredis patterns
  - **Skills**: `[]` — standard Redis client initialization

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3,5-8)
  - **Blocks**: Tasks 16 (callback cache), 20 (status polling), 21 (health check)
  - **Blocked By**: None

  **References**:
  - ioredis docs: `https://github.com/redis/ioredis#connect-to-redis` — connection options, retry strategy
  - Redis key naming conventions: Use colon-separated namespacing (`stream:status:*`)

  **Acceptance Criteria**:
  - [ ] `getRedisClient()` returns connected client
  - [ ] Connection failure logs warning, doesn't crash app
  - [ ] `checkRedisHealth()` returns `{ ok: true }` when connected, `{ ok: false }` when not
  - [ ] All key pattern helpers return correctly formatted strings

  **QA Scenarios**:
  ```
  Scenario: Redis client connects and operates
    Tool: bash
    Preconditions: Redis running (docker or external)
    Steps:
      1. Set REDIS_URL env var
      2. Run script: await getRedisClient().ping() → "PONG"
      3. Run: await getRedisClient().set("test", "ok") → "OK"
      4. Run: await getRedisClient().get("test") → "ok"
    Expected Result: All Redis operations succeed
    Evidence: .sisyphus/evidence/task-4-redis-connect.txt
  ```

  **Commit**: YES
  - Message: `feat(redis): add Redis client singleton with health check and cache key patterns`
  - Files: `src/lib/redis.ts`, `src/lib/cache-keys.ts`

- [x] 5. **Environment Config (Zod)**

  **What to do**:
  - Create `src/lib/env.ts`:
    - Zod schema for all env vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `AUTH_AUTHENTIK_ID`, `AUTH_AUTHENTIK_SECRET`, `AUTH_AUTHENTIK_ISSUER`, `SRS_API_URL`, `SRS_CALLBACK_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SITE_NAME`
    - Parse and validate at startup: `export const env = envSchema.parse(process.env)`
    - Throw clear error on missing/invalid vars (fail-fast)
  - Create `.env.example` with all required vars (no secrets, placeholder values)
  - Add `.env` to `.gitignore` (already in template)
  - Add type-safe env access throughout app via single import

  **Must NOT do**:
  - Do not commit actual `.env` file
  - Do not put secrets in `.env.example`

  **Recommended Agent Profile**:
  - **Category**: `quick` — Zod schema validation, straightforward
  - **Skills**: `[]` — standard Zod + dotenv patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4,6-8)
  - **Blocks**: Task 9 (NextAuth setup needs AUTH_* vars)
  - **Blocked By**: None

  **References**:
  - Zod docs: `https://zod.dev/?id=basic-usage` — `.parse()` for validation, `.shape` for types
  - Next.js env pattern: `https://nextjs.org/docs/app/building-your-application/configuring/environment-variables` — `NEXT_PUBLIC_*` prefix for client

  **Acceptance Criteria**:
  - [ ] `env.DATABASE_URL` typed as string (not string | undefined)
  - [ ] Missing required var → `pnpm dev` fails with clear error message
  - [ ] `.env.example` contains all vars with placeholder values
  - [ ] `NEXT_PUBLIC_*` vars accessible on client side

  **QA Scenarios**:
  ```
  Scenario: Env validation catches missing vars
    Tool: bash
    Preconditions: .env file missing or incomplete
    Steps:
      1. Run app without DATABASE_URL set
      2. Observe: ZodError thrown with "DATABASE_URL is required"
    Expected Result: App fails fast with descriptive error
    Evidence: .sisyphus/evidence/task-5-env-validation.txt

  Scenario: Env validation succeeds with valid vars
    Tool: bash
    Preconditions: .env with all required vars
    Steps:
      1. Run app with valid .env
    Expected Result: App starts without env-related errors
    Evidence: .sisyphus/evidence/task-5-env-ok.txt
  ```

  **Commit**: YES
  - Message: `feat(config): add Zod-based environment variable validation with .env.example`
  - Files: `src/lib/env.ts`, `.env.example`

- [x] 6. **SRS Config Template**

  **What to do**:
  - Create `docker/srs/srs.conf` with:
    - RTMP listen on port 1935
    - HTTP API on port 1985 (with basic auth from env)
    - HTTP Server on port 8080 (HTTP-FLV + HLS)
    - `http_remux`: FLV mount `[vhost]/[app]/[stream].flv`
    - HLS enabled: `hls_fragment 10`, `hls_window 60`, `hls_path ./objs/nginx/html`
    - `http_hooks`: on_publish → `http://web:3000/api/srs/publish`, on_play, on_unpublish, on_stop
    - vhost `live-push.example.com`: RTMP publish with auth callback
    - vhost `live.example.com`: FLV+HLS playback with play auth callback
    - **NO** `srt_server`, **NO** `rtc_server` blocks
    - Log to console, daemon off (Docker foreground)
    - `gop_cache off` for low latency
    - Use env var placeholders: `${SRS_API_AUTH_USER}`, `${SRS_API_AUTH_PASS}`

  **Must NOT do**:
  - Do NOT include `srt_server {}` block
  - Do NOT include `rtc_server {}` block
  - Do NOT enable `raw_api`

  **Recommended Agent Profile**:
  - **Category**: `quick` — config file, straightforward from SRS docs
  - **Skills**: `[]` — standard conf file authoring

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5,7-8)
  - **Blocks**: Tasks 17-19 (SRS callbacks), Task 35 (Docker prod)
  - **Blocked By**: None

  **References**:
  - SRS v6 config reference: Research findings from librarian — `http_hooks`, `http_remux`, HLS config blocks
  - SRS GitHub examples: `https://github.com/ossrs/srs/blob/develop/trunk/conf/full.conf` — reference full config
  - Docker SRS image entrypoint: `./objs/srs -c conf/srs.conf`

  **Acceptance Criteria**:
  - [ ] Config passes SRS syntax validation: `docker run --rm -v $(pwd)/docker/srs/srs.conf:/tmp/srs.conf ossrs/srs:6 ./objs/srs -t -c /tmp/srs.conf`
  - [ ] No `srt_server` or `rtc_server` keywords present
  - [ ] `http_hooks.on_publish` URL points to web service
  - [ ] Two vhosts defined: live-push.example.com (RTMP) and live.example.com (HTTP)

  **QA Scenarios**:
  ```
  Scenario: SRS config is syntactically valid
    Tool: bash
    Preconditions: Docker available
    Steps:
      1. docker run --rm -v $(pwd)/docker/srs/srs.conf:/tmp/srs.conf ossrs/srs:6 ./objs/srs -t -c /tmp/srs.conf
      2. Check exit code = 0
    Expected Result: SRS reports config OK
    Evidence: .sisyphus/evidence/task-6-srs-config-test.txt
  ```

  **Commit**: YES
  - Message: `feat(srs): add SRS v6 config with RTMP, HTTP-FLV, HLS, auth callbacks`
  - Files: `docker/srs/srs.conf`

- [x] 7. **Nginx Config Template**

  **What to do**:
  - Create `docker/nginx/nginx.conf` with:
    - `worker_rlimit_nofile 10000`
    - Upstream blocks: `upstream web` (Next.js:3000), `upstream srs_http` (SRS:8080)
    - Server block for `live.example.com`:
      - `/live/*.flv` → proxy to SRS with `proxy_buffering off`, `proxy_read_timeout 3600s`, `proxy_cache off`
      - `/live/*.m3u8`, `/live/*.ts` → proxy to SRS (HLS segments)
      - `/api/*`, `/` → proxy to Next.js
      - CORS headers: `Access-Control-Allow-Origin *`, `Access-Control-Allow-Methods GET, OPTIONS`
      - OPTIONS preflight: return 204
      - FLV CDN bypass: `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`
    - Server block for `live-push.example.com`:
      - Stream proxy for RTMP (not HTTP) — this domain bypasses CDN entirely
    - Gzip off for streaming endpoints
  - Create `docker/nginx/Dockerfile`: `FROM nginx:alpine`, copy config

  **Must NOT do**:
  - Do NOT enable `proxy_buffering` for FLV paths
  - Do NOT set `proxy_read_timeout` to default 60s for FLV
  - Do NOT add SSL/TLS config (handled by CDN)

  **Recommended Agent Profile**:
  - **Category**: `quick` — nginx config, documented patterns
  - **Skills**: `[]` — standard nginx configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6,8)
  - **Blocks**: Tasks 26 (FLV integration needs correct Nginx), 35 (Docker prod)
  - **Blocked By**: None

  **References**:
  - Nginx proxy module: `https://nginx.org/en/docs/http/ngx_http_proxy_module.html` — `proxy_buffering`, `proxy_read_timeout`
  - Nginx CORS: `https://enable-cors.org/server_nginx.html` — `add_header` directives
  - SRS HTTP-FLV with Nginx: Research findings from librarian — FLV-specific proxy requirements

  **Acceptance Criteria**:
  - [ ] `nginx -t` passes syntax check on config
  - [ ] `/live/test.flv` location block has `proxy_buffering off`
  - [ ] `/live/test.flv` location block has `proxy_read_timeout 3600s`
  - [ ] CORS headers present on `.flv` and `.m3u8` locations
  - [ ] `worker_rlimit_nofile 10000` set in main context

  **QA Scenarios**:
  ```
  Scenario: Nginx config passes syntax check
    Tool: bash
    Preconditions: Docker available
    Steps:
      1. docker run --rm -v $(pwd)/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
      2. Check exit code = 0
    Expected Result: "syntax is ok" and "test is successful"
    Evidence: .sisyphus/evidence/task-7-nginx-test.txt
  ```

  **Commit**: YES
  - Message: `feat(nginx): add Nginx reverse proxy config for SRS FLV/HLS + Next.js with CDN bypass`
  - Files: `docker/nginx/nginx.conf`, `docker/nginx/Dockerfile`

- [x] 8. **Docker Compose (Dev Environment)**

  **What to do**:
  - Create `docker-compose.dev.yml`:
    - `postgres`: image `postgres:16-alpine`, port 5432, volume for data, healthcheck
    - `redis`: image `redis:7-alpine`, port 6379, volume for data, healthcheck
    - `srs`: image `ossrs/srs:6`, ports 1935/1985/8080, volume for config, healthcheck
    - Networks: `app-network` bridge
  - Create `docker-compose.yml` placeholder (prod — detailed in Task 35)
  - Create `docker/.env` with dev defaults: POSTGRES_USER/PASSWORD/DB, REDIS_URL
  - Add npm scripts to `package.json`:
    - `dev:infra`: `docker compose -f docker-compose.dev.yml up -d`
    - `dev:infra:down`: `docker compose -f docker-compose.dev.yml down`

  **Must NOT do**:
  - Do not include Next.js service in dev compose (run locally with `pnpm dev`)
  - Do not include Authentik (external service)
  - Do not create production compose yet (Task 35)

  **Recommended Agent Profile**:
  - **Category**: `quick` — docker-compose, well-known patterns
  - **Skills**: `[]` — standard Docker Compose

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-7)
  - **Blocks**: Tasks 16 (needs Redis), 21 (health checks), 35 (prod compose)
  - **Blocked By**: None

  **References**:
  - Docker Compose spec: `https://docs.docker.com/compose/compose-file/` — service definitions, healthcheck, volumes
  - SRS Docker: Research findings — image `ossrs/srs:6`, command `./objs/srs -c conf/srs.conf`
  - PostgreSQL healthcheck: `pg_isready -U postgres`

  **Acceptance Criteria**:
  - [ ] `docker compose -f docker-compose.dev.yml up -d` starts all 3 services
  - [ ] `docker compose -f docker-compose.dev.yml ps` shows all services healthy
  - [ ] PostgreSQL accepts connections on port 5432
  - [ ] Redis responds to PING on port 6379
  - [ ] SRS HTTP API responds on port 1985
  - [ ] `pnpm dev:infra` script works

  **QA Scenarios**:
  ```
  Scenario: Dev services start and are healthy
    Tool: bash
    Preconditions: Docker installed
    Steps:
      1. docker compose -f docker-compose.dev.yml up -d
      2. sleep 10 (wait for healthchecks)
      3. docker compose -f docker-compose.dev.yml ps → all "healthy"
      4. curl http://localhost:1985/api/v1/versions → JSON response
      5. docker compose -f docker-compose.dev.yml down
    Expected Result: All services start, healthcheck pass, SRS API responds
    Evidence: .sisyphus/evidence/task-8-dev-compose.txt
  ```

  **Commit**: YES
  - Message: `feat(docker): add Docker Compose dev environment with PostgreSQL, Redis, SRS`
  - Files: `docker-compose.dev.yml`, `docker/.env`

- [x] 9. **NextAuth v5 + Authentik Integration**

  **What to do**:
  - Create `src/lib/auth.ts`: NextAuth v5 config with Authentik provider
    - Provider: `Authentik({ clientId, clientSecret, issuer })` — issuer must be `https://auth.example.com/application/o/<slug>` (NO trailing slash)
    - Adapter: `PrismaAdapter(prisma)` — auto-creates User, Account, Session
    - Session strategy: `jwt` (JWT tokens via HttpOnly cookie)
    - Callbacks:
      - `jwt`: attach user id + role to token; handle token refresh with `offline_access` scope
      - `session`: expose user id + role from token to client
      - `signIn`: check if first user (count=1) → promote to admin in atomic `prisma.$transaction`
    - Pages: `signIn: '/auth/signin'`
  - Create `src/app/api/auth/[...nextauth]/route.ts`: export `{ GET, POST }` via `handlers`
  - Create `src/lib/auth-utils.ts`: `getSessionUser()` for server components, `requireAdmin()` guard
  - Environment vars: add `offline_access` to scope — Authentik 2024.2+ requires this for refresh tokens

  **Must NOT do**:
  - Do not store role in Authentik — role lives in our DB only
  - Do not use `clientSecret` on client side — BFF pattern, server-side only
  - Do not skip `offline_access` scope — refresh tokens won't work without it

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — auth integration with multiple providers and first-user logic
  - **Skills**: `[]` — NextAuth v5 has clear docs for Authentik

  **Parallelization**:
  - **Can Run In Parallel**: YES (with other Wave 2 tasks that don't depend on auth)
  - **Parallel Group**: Wave 2 (with Tasks 10-16; Task 10 depends on this)
  - **Blocks**: Task 10 (auth middleware), Task 23 (auth UI)
  - **Blocked By**: Task 5 (env vars)

  **References**:
  - NextAuth Authentik provider: `https://authjs.dev/getting-started/providers/authentik` — config shape, issuer format
  - NextAuth Prisma adapter: `https://authjs.dev/reference/adapter/prisma` — auto-created fields
  - Authentik OAuth2 docs: Research findings — PKCE automatic for public client, offline_access requirement
  - Arctic Authentik provider (alternative): `https://arcticjs.dev/providers/authentik`

  **Acceptance Criteria**:
  - [ ] `signIn("authentik")` redirects to Authentik login page
  - [ ] Successful callback creates User + Account in DB
  - [ ] First user gets `role = "admin"` (atomic transaction)
  - [ ] Second user gets `role = "user"` (count > 1)
  - [ ] `auth()` returns session with user id + role
  - [ ] Session cookie is HttpOnly, Secure, SameSite=Lax

  **QA Scenarios**:
  ```
  Scenario: First user auto-promoted to admin
    Tool: bash (curl)
    Preconditions: Empty users table, Authentik configured
    Steps:
      1. Simulate first OAuth callback → create user
      2. Query DB: SELECT role FROM "User" WHERE email = 'test@example.com'
      3. Assert role = "admin"
    Expected Result: Role is "admin"
    Evidence: .sisyphus/evidence/task-9-first-admin.txt

  Scenario: Second user is NOT admin
    Tool: bash (curl)
    Preconditions: One user already exists in DB
    Steps:
      1. Simulate second OAuth callback → create another user
      2. Query DB: SELECT role FROM "User" WHERE email = 'second@example.com'
      3. Assert role = "user"
    Expected Result: Role is "user"
    Evidence: .sisyphus/evidence/task-9-second-user.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): add NextAuth v5 Authentik OAuth2 integration with first-user admin promotion`
  - Files: `src/lib/auth.ts`, `src/lib/auth-utils.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [x] 10. **Auth Middleware + Guards**

  **What to do**:
  - Create `src/middleware.ts` (Next.js middleware):
    - Protect `/admin/*` routes: redirect unauthenticated to sign-in
    - Check admin role for `/admin/*` — redirect non-admins to `/` with error
    - Allow `/api/srs/*` without auth (SRS callbacks have their own secret validation)
    - Allow `/`, `/live/*`, `/auth/*` without auth (public pages)
  - Create `src/lib/guards.ts`:
    - `requireAuth()`: server-side guard — returns session or throws 401
    - `requireAdmin()`: server-side guard — returns session or throws 403
    - Use in every API route handler
  - Create `src/app/admin/layout.tsx`: server component that calls `requireAdmin()`

  **Must NOT do**:
  - Do NOT check role on client-side only — must be server-side enforced
  - Do NOT allow SRS callbacks to be blocked by auth middleware

  **Recommended Agent Profile**:
  - **Category**: `quick` — middleware pattern, straightforward guards
  - **Skills**: `[]` — Next.js middleware + session helpers

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends only on Task 9)
  - **Parallel Group**: Wave 2 (with Tasks 11-16)
  - **Blocks**: Tasks 11-15 (all API routes need auth guards), Task 28 (admin layout)
  - **Blocked By**: Task 9

  **References**:
  - Next.js Middleware: `https://nextjs.org/docs/app/building-your-application/routing/middleware` — matcher config, redirect
  - NextAuth middleware: `https://authjs.dev/getting-started/session-management/protecting#nextjs-middleware` — `auth()` in middleware

  **Acceptance Criteria**:
  - [ ] Unauthenticated request to `/admin` → redirect to `/auth/signin`
  - [ ] Authenticated non-admin request to `/admin` → redirect to `/` (403)
  - [ ] Admin request to `/admin` → proceeds normally
  - [ ] SRS callback to `/api/srs/publish` → passes through without auth
  - [ ] `requireAdmin()` throws 403 when called without admin session

  **QA Scenarios**:
  ```
  Scenario: Non-admin blocked from /admin
    Tool: Playwright
    Preconditions: Regular user logged in (role=user)
    Steps:
      1. Navigate to /admin
      2. Assert redirected to /
      3. Assert error message "Access denied" visible
    Expected Result: Non-admin cannot access admin panel
    Evidence: .sisyphus/evidence/task-10-nonadmin-blocked.png

  Scenario: Admin accesses /admin
    Tool: Playwright
    Preconditions: Admin user logged in (role=admin)
    Steps:
      1. Navigate to /admin
      2. Assert URL is /admin
    Expected Result: Admin reaches admin layout
    Evidence: .sisyphus/evidence/task-10-admin-access.png
  ```

  **Commit**: YES
  - Message: `feat(auth): add Next.js middleware + server-side guards for admin route protection`
  - Files: `src/middleware.ts`, `src/lib/guards.ts`, `src/app/admin/layout.tsx`

- [x] 11. **User Management API**

  **What to do**:
  - Create `src/app/api/users/route.ts`:
    - `GET`: list users (admin only), paginated
    - No `POST` — users created via OAuth sign-in only
  - Create `src/app/api/users/[id]/route.ts`:
    - `GET`: get single user (admin or self)
    - `PATCH`: update user role (admin only)
  - Create `src/app/api/auth/me/route.ts`:
    - `GET`: return current session user
  - All routes use `requireAuth()` or `requireAdmin()` guards

  **Must NOT do**:
  - Do not expose user emails to non-admin users
  - Do not allow role change for self (admin can't demote themselves)

  **Recommended Agent Profile**:
  - **Category**: `quick` — CRUD API routes, straightforward pattern
  - **Skills**: `[]` — Next.js API Routes

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends only on Tasks 3, 10; independent of Tasks 12-16)
  - **Parallel Group**: Wave 2 (with Tasks 9-10,12-16)
  - **Blocks**: None (leaf API)
  - **Blocked By**: Task 3 (Prisma), Task 10 (auth guards)

  **References**:
  - Next.js Route Handlers: `https://nextjs.org/docs/app/building-your-application/routing/route-handlers` — GET, PATCH patterns
  - Prisma queries: `https://www.prisma.io/docs/orm/prisma-client/queries` — `findMany`, `findUnique`, `update`

  **Acceptance Criteria**:
  - [ ] `GET /api/auth/me` returns current user's id, email, name, role
  - [ ] `GET /api/users` (admin) returns paginated user list
  - [ ] `GET /api/users` (non-admin) returns 403
  - [ ] `PATCH /api/users/[id]` (admin) updates role successfully
  - [ ] `PATCH /api/users/[self-id]` to demote → returns 400 error

  **QA Scenarios**:
  ```
  Scenario: Admin lists users
    Tool: bash (curl)
    Preconditions: Admin session cookie
    Steps:
      1. curl -b cookies.txt GET /api/users → 200
      2. Assert response.body.users is array
      3. Assert each user has id, email, name, role
    Expected Result: Paginated user list with correct fields
    Evidence: .sisyphus/evidence/task-11-list-users.json

  Scenario: Non-admin cannot list users
    Tool: bash (curl)
    Preconditions: Regular user session cookie
    Steps:
      1. curl -b user-cookies.txt GET /api/users → 403
    Expected Result: HTTP 403 Forbidden
    Evidence: .sisyphus/evidence/task-11-unauthorized.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add user management API with role-based access control`
  - Files: `src/app/api/users/`, `src/app/api/auth/me/`

- [x] 12. **SiteConfig API**

  **What to do**:
  - Create `src/app/api/admin/config/route.ts`:
    - `GET`: return current SiteConfig (singleton) — public, no auth needed for site name/favicon display
    - `PATCH`: update siteTitle and faviconUrl — admin only
  - Create `src/lib/site-config.ts`: helper to get config (with in-memory cache, TTL 60s)
  - Seed default config in `prisma/seed.ts` (if not already): `{ siteTitle: "Live Stream", faviconUrl: "/favicon.ico" }`

  **Must NOT do**:
  - Do not allow non-admin to PATCH config
  - Do not cache longer than 60s (changes should reflect quickly)

  **Recommended Agent Profile**:
  - **Category**: `quick` — singleton CRUD, simple
  - **Skills**: `[]` — Next.js API Routes + Prisma

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 13-15)
  - **Parallel Group**: Wave 2 (with Tasks 9-11,13-16)
  - **Blocks**: Task 29 (admin site config page)
  - **Blocked By**: Task 3 (Prisma), Task 10 (auth guard)

  **References**:
  - Prisma singleton pattern: `findFirst()` for single-row tables
  - Next.js revalidation: `revalidatePath('/')` on config change

  **Acceptance Criteria**:
  - [ ] `GET /api/admin/config` returns `{ siteTitle, faviconUrl }`
  - [ ] `PATCH /api/admin/config` (admin) updates values
  - [ ] `PATCH /api/admin/config` (non-admin) returns 403
  - [ ] Updated config reflected in next request (within 60s cache)

  **QA Scenarios**:
  ```
  Scenario: Admin updates site title
    Tool: bash (curl)
    Preconditions: Admin session cookie
    Steps:
      1. curl -b cookies.txt -X PATCH -H 'Content-Type: application/json' -d '{"siteTitle":"My Live"}' /api/admin/config → 200
      2. curl GET /api/admin/config → siteTitle = "My Live"
    Expected Result: Config updated and retrievable
    Evidence: .sisyphus/evidence/task-12-config-update.json
  ```

  **Commit**: YES
  - Message: `feat(api): add SiteConfig API with admin-only update and caching`
  - Files: `src/app/api/admin/config/route.ts`, `src/lib/site-config.ts`

- [x] 13. **StreamRoom API**

  **What to do**:
  - Create `src/app/api/admin/rooms/route.ts`:
    - `GET`: list all rooms (admin), with pagination + search
    - `POST`: create room — generates unique streamKey (uuid/nanoid)
  - Create `src/app/api/admin/rooms/[id]/route.ts`:
    - `GET`: get single room (admin)
    - `PATCH`: update room name, visibility, manualMode
    - `DELETE`: delete room + cascade keys + play sources
  - Create `src/app/api/rooms/route.ts`:
    - `GET`: public listing — only public rooms (for selection page), no streamKey exposed
  - Create `src/lib/stream-key.ts`: utility to generate cryptographically random stream keys

  **Must NOT do**:
  - Do not expose streamKey in public room listing
  - Do not allow non-admin to manage rooms
  - Do not return sensitive fields (keyHash) in any response

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — CRUD with access control, key generation, cascading deletes
  - **Skills**: `[]` — Next.js API Routes + Prisma

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 3, 10; independent of 11-12,14-15)
  - **Parallel Group**: Wave 2 (with Tasks 9-12,14-16)
  - **Blocks**: Tasks 14 (needs roomId FK), 15 (needs roomId FK), 16 (needs room data), 24 (selection page), 30 (admin room mgmt), 34 (private access)
  - **Blocked By**: Task 3 (Prisma), Task 10 (auth guard)

  **References**:
  - Prisma relations: `https://www.prisma.io/docs/orm/prisma-schema/data-model/relations` — cascade delete
  - UUID generation: `crypto.randomUUID()` or `nanoid`
  - Next.js dynamic routes: `[id]` folder pattern

  **Acceptance Criteria**:
  - [ ] `POST /api/admin/rooms` creates room with auto-generated streamKey
  - [ ] `GET /api/rooms` (public) returns only public rooms without streamKey
  - [ ] `PATCH /api/admin/rooms/[id]` updates visibility (public ↔ private)
  - [ ] `DELETE /api/admin/rooms/[id]` cascades to keys + play sources
  - [ ] Non-admin `POST` to admin rooms returns 403

  **QA Scenarios**:
  ```
  Scenario: Admin creates public room
    Tool: bash (curl)
    Preconditions: Admin session cookie
    Steps:
      1. curl -b cookies.txt -X POST -H 'Content-Type: application/json' -d '{"name":"Test Room","visibility":"public"}' /api/admin/rooms → 201
      2. Assert response has id, name, streamKey, visibility="public"
    Expected Result: Room created with auto-generated streamKey
    Evidence: .sisyphus/evidence/task-13-create-room.json

  Scenario: Public listing excludes private rooms
    Tool: bash (curl)
    Preconditions: 1 public + 1 private room in DB
    Steps:
      1. curl GET /api/rooms → 200
      2. Assert only public room in response
      3. Assert no streamKey field present
    Expected Result: Only public rooms, no sensitive fields
    Evidence: .sisyphus/evidence/task-13-public-list.json
  ```

  **Commit**: YES
  - Message: `feat(api): add StreamRoom CRUD API with public/private visibility and auto key generation`
  - Files: `src/app/api/admin/rooms/`, `src/app/api/rooms/`, `src/lib/stream-key.ts`

- [x] 14. **StreamKey API**

  **What to do**:
  - Create `src/app/api/admin/rooms/[id]/keys/route.ts`:
    - `GET`: list keys for a room (admin only)
    - `POST`: generate new key — hash with bcrypt/scrypt, store hash, return plain key ONLY ONCE
  - Create `src/app/api/admin/keys/[keyId]/route.ts`:
    - `PATCH`: toggle key active/inactive (rotate — disable old, enable new)
    - `DELETE`: permanently revoke a key
  - Create `src/lib/crypto.ts`: `generateKey()` → returns `{ plain, hash }`, `verifyKey(plain, hash)` → boolean
  - Key format: base64url random 32 bytes → human-readable-ish
  - Store: `keyHash` in DB (bcrypt/scrypt), `plain` returned only at creation time

  **Must NOT do**:
  - Do NOT store plain keys in DB — hash only
  - Do NOT return plain keys in list endpoints (only at creation)
  - Do NOT allow key for one room to authenticate another room

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — crypto-sensitive key management, careful access control
  - **Skills**: `[]` — crypto APIs + Prisma

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 3,10,13)
  - **Parallel Group**: Wave 2 (with Tasks 9-13,15-16)
  - **Blocks**: Tasks 16 (needs key cache), 17 (on_publish validation), 31 (admin key mgmt)
  - **Blocked By**: Task 3 (Prisma), Task 10 (auth guard), Task 13 (room FK)

  **References**:
  - Node.js crypto: `https://nodejs.org/api/crypto.html#cryptorandombytessize-callback` — secure random bytes
  - bcrypt: `https://www.npmjs.com/package/bcrypt` — hash with salt rounds=10
  - scrypt alternative: `https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options` — built-in Node.js scrypt

  **Acceptance Criteria**:
  - [ ] `POST /api/admin/rooms/[id]/keys` returns `{ id, label, plain }` — plain key shown ONLY once
  - [ ] `GET /api/admin/rooms/[id]/keys` returns keys with `keyHash` mask, NOT plain
  - [ ] `PATCH /api/admin/keys/[keyId]` toggles `isActive` → disabled key no longer validates
  - [ ] `DELETE /api/admin/keys/[keyId]` removes key permanently
  - [ ] `verifyKey(plain, hash)` returns true for correct key, false for wrong key

  **QA Scenarios**:
  ```
  Scenario: Generate and verify stream key
    Tool: bash (curl + script)
    Preconditions: Admin session, room exists
    Steps:
      1. curl -b cookies.txt -X POST -d '{"label":"OBS Key"}' /api/admin/rooms/[roomId]/keys → 201
      2. Capture plain key from response
      3. Run verifyKey(plain, hashFromDb) → true
      4. Run verifyKey("wrong-key", hashFromDb) → false
    Expected Result: Key generated, hash stored, verification works
    Evidence: .sisyphus/evidence/task-14-key-gen.txt

  Scenario: Disabled key rejected
    Tool: bash (curl)
    Preconditions: Active key exists
    Steps:
      1. curl -b cookies.txt -X PATCH -d '{"isActive":false}' /api/admin/keys/[keyId] → 200
      2. Attempt publish with disabled key → rejected
    Expected Result: Disabled key no longer authenticates
    Evidence: .sisyphus/evidence/task-14-key-disabled.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add StreamKey CRUD API with bcrypt hashing, rotation, and one-time plain reveal`
  - Files: `src/app/api/admin/rooms/[id]/keys/`, `src/app/api/admin/keys/`, `src/lib/crypto.ts`

- [x] 15. **PlaySource API**

  **What to do**:
  - Create `src/app/api/admin/rooms/[id]/sources/route.ts`:
    - `GET`: list play sources for a room (admin only)
    - `POST`: create play source with nested qualities
  - Create `src/app/api/admin/sources/[sourceId]/route.ts`:
    - `PATCH`: update source name, reorder
    - `DELETE`: remove source + cascade qualities
  - Create `src/app/api/admin/sources/[sourceId]/qualities/route.ts`:
    - `POST`: add quality to source (label + url)
  - Create `src/app/api/admin/qualities/[qualityId]/route.ts`:
    - `PATCH`: update quality label/url
    - `DELETE`: remove quality
  - Create `src/app/api/rooms/[id]/sources/route.ts`:
    - `GET`: public — return play source config for a room (used by player)
    - If manualMode=false → return empty (player uses default FLV URL)
    - If manualMode=true → return configured sources/qualities

  **Must NOT do**:
  - Do not expose play source URLs publicly if room is private (require auth or key)
  - Do not allow non-admin to modify play sources

  **Recommended Agent Profile**:
  - **Category**: `quick` — nested CRUD API, straightforward Prisma relations
  - **Skills**: `[]` — Next.js API Routes + Prisma nested writes

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 3,10,13)
  - **Parallel Group**: Wave 2 (with Tasks 9-14,16)
  - **Blocks**: Task 32 (admin play source management)
  - **Blocked By**: Task 3 (Prisma), Task 10 (auth guard), Task 13 (room FK)

  **References**:
  - Prisma nested writes: `https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes` — `create` with nested `qualities`
  - Play source data model: Each source has `name` + ordered `qualities[]`

  **Acceptance Criteria**:
  - [ ] `POST /api/admin/rooms/[id]/sources` with `{ name, qualities: [{ label, url }] }` → 201
  - [ ] `GET /api/rooms/[id]/sources` (manualMode=true) → returns sources array
  - [ ] `GET /api/rooms/[id]/sources` (manualMode=false) → returns empty array
  - [ ] `DELETE /api/admin/sources/[sourceId]` cascades to qualities

  **QA Scenarios**:
  ```
  Scenario: Admin creates play source with qualities
    Tool: bash (curl)
    Preconditions: Admin session, room exists, manualMode=true
    Steps:
      1. curl -b cookies.txt -X POST -d '{"name":"Main","qualities":[{"label":"1080p","url":"https://cdn.example.com/stream.m3u8"}]}' /api/admin/rooms/[id]/sources → 201
      2. curl GET /api/rooms/[id]/sources → has source with name "Main" and 1 quality
    Expected Result: Source created with nested qualities
    Evidence: .sisyphus/evidence/task-15-play-source.json
  ```

  **Commit**: YES
  - Message: `feat(api): add PlaySource CRUD API with nested qualities for manual mode`
  - Files: `src/app/api/admin/rooms/[id]/sources/`, `src/app/api/admin/sources/`, `src/app/api/admin/qualities/`, `src/app/api/rooms/[id]/sources/`

- [x] 16. **Redis SRS Callback Cache Layer**

  **What to do**:
  - Create `src/lib/callback-cache.ts`:
    - `cacheRoomStreamKey(roomId, streamKey)`: store stream key → roomId mapping (SET, no expiry)
    - `cacheActiveKey(roomId, keyHash)`: store active key hashes for a room (SADD to set)
    - `getRoomByStreamKey(streamKey)`: lookup roomId by stream key (GET) — O(1), sub-ms
    - `isKeyActive(roomId, keyHash)`: check if keyHash is in room's active set (SISMEMBER) — O(1), sub-ms
    - `setStreamStatus(roomId, status, metadata?)`: SET with optional TTL
    - `getStreamStatus(roomId)`: GET status
    - `invalidateRoom(roomId)`: delete all room keys on room delete/key rotation
  - Populate cache on room/key CRUD operations (write-through pattern)
  - Ensure ALL operations are O(1) Redis commands — no SCAN, no KEYS

  **Must NOT do**:
  - Do NOT use Redis commands that are O(N) (KEYS, SCAN, SMEMBERS on large sets)
  - Do NOT do DB queries in this layer — pure Redis
  - Do NOT cache anything longer than needed — keys invalidated on CRUD

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — Redis data modeling, write-through cache, performance-critical
  - **Skills**: `[]` — ioredis API

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 4,13,14)
  - **Parallel Group**: Wave 2 (with Tasks 9-15)
  - **Blocks**: Tasks 17 (on_publish), 18 (on_play), 19 (on_unpublish)
  - **Blocked By**: Task 4 (Redis client), Task 13 (room data), Task 14 (key data)

  **References**:
  - ioredis command reference: `https://github.com/redis/ioredis` — SET, GET, SADD, SISMEMBER, DEL, SREM
  - Redis data types: `https://redis.io/docs/latest/develop/data-types/` — Sets for active keys, Strings for mappings
  - Write-through cache pattern: Update Redis synchronously on every DB write

  **Acceptance Criteria**:
  - [ ] `cacheRoomStreamKey("room-1", "sk-abc")` → OK
  - [ ] `getRoomByStreamKey("sk-abc")` → "room-1" (sub-1ms)
  - [ ] `cacheActiveKey("room-1", "hash-xyz")` → OK
  - [ ] `isKeyActive("room-1", "hash-xyz")` → true
  - [ ] `isKeyActive("room-1", "hash-bad")` → false
  - [ ] `invalidateRoom("room-1")` → all keys for room-1 deleted
  - [ ] After `invalidateRoom`: `getRoomByStreamKey("sk-abc")` → null

  **QA Scenarios**:
  ```
  Scenario: Cache lookup is sub-millisecond
    Tool: bash (script)
    Preconditions: Redis running, cache populated
    Steps:
      1. Measure: for i in 1..1000: getRoomByStreamKey("sk-abc")
      2. Assert avg time < 1ms
    Expected Result: All lookups complete in <1ms avg
    Evidence: .sisyphus/evidence/task-16-cache-perf.txt

  Scenario: Key rotation invalidates old key
    Tool: bash (script)
    Preconditions: Room with 2 keys (1 active, 1 disabled)
    Steps:
      1. cacheActiveKey("room-1", "active-hash")
      2. cacheActiveKey("room-1", "disabled-hash")
      3. Rotate: remove disabled-hash from active set
      4. isKeyActive("room-1", "disabled-hash") → false
    Expected Result: Old key rejected after rotation
    Evidence: .sisyphus/evidence/task-16-key-rotation.txt
  ```

  **Commit**: YES
  - Message: `feat(redis): add SRS callback cache layer with write-through pattern and O(1) lookups`
  - Files: `src/lib/callback-cache.ts`

- [x] 17. **SRS on_publish Callback Handler**

  **What to do**:
  - Create `src/app/api/srs/publish/route.ts` (POST):
    - Receive SRS callback JSON: `{ action, stream, param, ip, stream_url, stream_id }`
    - Parse `param` field: extract `?token=xxx` from RTMP URL query string
    - Validate callback secret (`SRS_CALLBACK_SECRET` header or query param) to prevent spoofing
    - Lookup stream key → roomId via Redis `getRoomByStreamKey(stream)` — O(1)
    - If not found → return `{"code": 1}` (reject)
    - Lookup active token via Redis `isKeyActive(roomId, hashToken(token))` — O(1)
    - If not active → return `{"code": 1}` (reject)
    - If valid → return `{"code": 0}` (allow)
    - **CRITICAL**: Wrap entire handler in `Promise.race(handler, timeout(5000))` → timeout returns `{"code": 1}`
    - **CRITICAL**: Handler must complete in <100ms (Redis-only, no DB queries)
  - Write tests: valid token → 200 with code:0; invalid → 200 with code:1; timeout → 200 with code:1

  **Must NOT do**:
  - NO database queries in this handler (Redis only)
  - NO `await` on anything slower than Redis (no HTTP calls to external services)
  - NO try/catch that swallows errors — must return `{"code": 1}` on any failure

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — performance-critical callback, timeout handling, crypto validation
  - **Skills**: `[]` — Next.js Route Handler + ioredis + crypto

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 14,16; independent of 18,19,20,21)
  - **Parallel Group**: Wave 3 (with Tasks 18-21)
  - **Blocks**: None (leaf callback)
  - **Blocked By**: Task 14 (key validation), Task 16 (cache lookups)

  **References**:
  - SRS http_hooks callback format: Research findings — POST JSON with `action`, `stream`, `param`, `ip`, `stream_url`, `stream_id`
  - SRS response format: Return `{"code": 0}` (allow) or `{"code": 1}` (reject) with HTTP 200
  - Promise.race timeout pattern: `Promise.race([handler(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))])`

  **Acceptance Criteria**:
  - [ ] Valid token in `param` → returns `{"code": 0}`, HTTP 200, <100ms
  - [ ] Invalid/missing token → returns `{"code": 1}`, HTTP 200
  - [ ] Unknown stream key → returns `{"code": 1}`
  - [ ] Disabled key → returns `{"code": 1}`
  - [ ] Callback timeout (handler hangs) → returns `{"code": 1}` within 5s
  - [ ] Missing `SRS_CALLBACK_SECRET` → returns `{"code": 1}`

  **QA Scenarios**:
  ```
  Scenario: Valid publish token accepted
    Tool: bash (curl)
    Preconditions: Room "test-room" with active key "secret-key-123", cache populated
    Steps:
      1. curl -X POST -H 'Content-Type: application/json' -H 'X-Callback-Secret: test-secret' -d '{"action":"on_publish","stream":"test-room","param":"?token=secret-key-123","ip":"127.0.0.1"}' /api/srs/publish → 200
      2. Assert body = {"code": 0}
    Expected Result: Publish allowed
    Evidence: .sisyphus/evidence/task-17-publish-accept.json

  Scenario: Invalid token rejected
    Tool: bash (curl)
    Preconditions: Same as above
    Steps:
      1. curl ... -d '{"action":"on_publish","stream":"test-room","param":"?token=wrong-key"}' /api/srs/publish → 200
      2. Assert body = {"code": 1}
    Expected Result: Publish rejected
    Evidence: .sisyphus/evidence/task-17-publish-reject.json
  ```

  **Commit**: YES
  - Message: `feat(srs): add on_publish callback handler with Redis-only sub-100ms validation + Promise.race timeout`
  - Files: `src/app/api/srs/publish/route.ts`, associated test file

- [x] 18. **SRS on_play Callback Handler**

  **What to do**:
  - Create `src/app/api/srs/play/route.ts` (POST):
    - Receive SRS callback: `{ action, stream, param, ip, stream_url }`
    - Validate callback secret
    - Lookup stream key → roomId via Redis
    - If room does not exist → `{"code": 1}`
    - Check room visibility: `private` → require valid access token in `param` OR authenticated session
    - `public` → allow immediately `{"code": 0}`
    - For private: check token in `param` (?key=xxx) against active keys via Redis
    - **Same timeout/performance constraints as on_publish** (<100ms, Promise.race)

  **Must NOT do**:
  - Same constraints as Task 17 — NO DB queries, Redis only, Promise.race timeout

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — similar to Task 17, with added visibility logic
  - **Skills**: `[]` — Next.js Route Handler + ioredis

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 17,19,20,21 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 13 (room visibility), Task 16 (cache lookups)

  **References**:
  - Same SRS callback format as on_publish
  - Room visibility check: `isPrivate` flag from Redis

  **Acceptance Criteria**:
  - [ ] Public room, no token → `{"code": 0}` (allow)
  - [ ] Private room, valid access key → `{"code": 0}`
  - [ ] Private room, no key → `{"code": 1}` (reject)
  - [ ] Unknown stream → `{"code": 1}`
  - [ ] All responses <100ms

  **QA Scenarios**:
  ```
  Scenario: Public stream allows anonymous play
    Tool: bash (curl)
    Preconditions: Public room "public-test", cache populated
    Steps:
      1. curl -X POST -H 'X-Callback-Secret: secret' -d '{"action":"on_play","stream":"public-test","param":"","ip":"10.0.0.1"}' /api/srs/play → 200
      2. Assert {"code": 0}
    Expected Result: Public playback allowed
    Evidence: .sisyphus/evidence/task-18-play-public.json

  Scenario: Private stream rejected without key
    Tool: bash (curl)
    Preconditions: Private room "private-test"
    Steps:
      1. curl -X POST -d '{"action":"on_play","stream":"private-test","param":"","ip":"10.0.0.1"}' /api/srs/play → 200
      2. Assert {"code": 1}
    Expected Result: Private playback rejected
    Evidence: .sisyphus/evidence/task-18-play-private-reject.json
  ```

  **Commit**: YES
  - Message: `feat(srs): add on_play callback with public/private visibility gating and key-based access`
  - Files: `src/app/api/srs/play/route.ts`, test file

- [x] 19. **SRS on_unpublish / on_stop Handlers**

  **What to do**:
  - Create `src/app/api/srs/unpublish/route.ts` (POST):
    - Update stream status in Redis: `setStreamStatus(roomId, "offline")` — fire-and-forget
    - Optionally log unpublish event to DB (async, non-blocking via `waitUntil` or background job)
  - Create `src/app/api/srs/stop/route.ts` (POST):
    - Log play stop event (optional, for future analytics)
  - These handlers have relaxed constraints (<1000ms acceptable) but should still use timeout

  **Must NOT do**:
  - Do NOT block on DB writes — fire-and-forget or background queue
  - Do NOT fail the callback if Redis is temporarily down — log error, return `{"code": 0}` gracefully

  **Recommended Agent Profile**:
  - **Category**: `quick` — simple status updates, fire-and-forget pattern
  - **Skills**: `[]` — Next.js Route Handler + ioredis

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17,18,20,21 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 13 (room data), Task 16 (cache layer)

  **Acceptance Criteria**:
  - [ ] on_unpublish sets stream status to "offline" in Redis
  - [ ] on_stop logs event without blocking
  - [ ] Both return `{"code": 0}` even on Redis failure (graceful degradation)

  **QA Scenarios**:
  ```
  Scenario: Stream status updated on unpublish
    Tool: bash (curl + redis-cli)
    Preconditions: Stream "test-room" marked "live" in Redis
    Steps:
      1. curl -X POST -d '{"action":"on_unpublish","stream":"test-room"}' /api/srs/unpublish → 200
      2. redis-cli GET stream:status:test-room → "offline"
    Expected Result: Status updated to offline
    Evidence: .sisyphus/evidence/task-19-unpublish.txt
  ```

  **Commit**: YES
  - Message: `feat(srs): add on_unpublish/on_stop handlers with fire-and-forget status updates`
  - Files: `src/app/api/srs/unpublish/route.ts`, `src/app/api/srs/stop/route.ts`

- [x] 20. **Stream Status Polling API**

  **What to do**:
  - Create `src/app/api/streams/[id]/status/route.ts` (GET):
    - Check Redis `getStreamStatus(roomId)` → return `{ status: "live" | "offline" }`
    - If status not in Redis, query SRS HTTP API: `GET /api/v1/streams/{id}` on SRS:1985
    - Cache result in Redis with 5s TTL
  - Create `src/lib/srs-api.ts`:
    - `getSRSStreamStatus(streamKey)`: query SRS API with basic auth
    - `getSRSStreams()`: list all active streams
  - Player page polls this endpoint every 5s to show/hide "Stream Offline" state

  **Must NOT do**:
  - Do not query SRS API on every callback — use Redis cache
  - Do not expose SRS API credentials to client

  **Recommended Agent Profile**:
  - **Category**: `quick` — polling API with cache, SRS API wrapper
  - **Skills**: `[]` — Next.js Route Handler + ioredis + fetch

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-19,21 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4 (Redis client), Task 13 (room data)

  **References**:
  - SRS HTTP API: `GET /api/v1/streams` — list active streams with stream IDs
  - SRS HTTP API auth: Basic Auth with credentials from env

  **Acceptance Criteria**:
  - [ ] `GET /api/streams/[id]/status` returns `{ status: "live" }` for active stream
  - [ ] `GET /api/streams/[id]/status` returns `{ status: "offline" }` for inactive stream
  - [ ] Redis cache hit avoids SRS API call
  - [ ] Cache TTL 5s — stale status cleared after 5s

  **QA Scenarios**:
  ```
  Scenario: Status reports live for active stream
    Tool: bash (curl)
    Preconditions: Stream actively publishing to SRS
    Steps:
      1. curl GET /api/streams/[roomId]/status → 200
      2. Assert {"status": "live"}
    Expected Result: Live status returned
    Evidence: .sisyphus/evidence/task-20-status-live.json
  ```

  **Commit**: YES
  - Message: `feat(api): add stream status polling endpoint with Redis cache and SRS API fallback`
  - Files: `src/app/api/streams/[id]/status/route.ts`, `src/lib/srs-api.ts`

- [x] 21. **Health Check Endpoints**

  **What to do**:
  - Create `src/app/api/health/route.ts` (GET):
    - Check DB connectivity: `prisma.$queryRaw` SELECT 1` → ok/fail
    - Check Redis connectivity: `redis.ping()` → ok/fail
    - Check SRS connectivity: `GET /api/v1/versions` on SRS:1985 → ok/fail
    - Return `{ status: "ok" | "degraded", db, redis, srs, uptime }`
    - HTTP 200 if all ok, HTTP 503 if any degraded
  - Create `src/app/api/health/ready/route.ts` (GET):
    - Readiness check (used by Docker healthcheck) — simpler, just returns 200 when process is up

  **Must NOT do**:
  - Do not expose detailed error messages in production health endpoint
  - Do not make health check slow — timeout each check at 2s

  **Recommended Agent Profile**:
  - **Category**: `quick` — health check endpoints, simple aggregation
  - **Skills**: `[]` — Next.js Route Handler

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-20 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4 (Redis), Task 3 (Prisma)

  **Acceptance Criteria**:
  - [ ] `GET /api/health` → 200 with all services "ok"
  - [ ] DB down → `db: "error"`, HTTP 503
  - [ ] Redis down → `redis: "error"`, HTTP 503
  - [ ] `GET /api/health/ready` → 200 (simple liveness)

  **QA Scenarios**:
  ```
  Scenario: All services healthy
    Tool: bash (curl)
    Preconditions: All services running
    Steps:
      1. curl GET /api/health → 200
      2. Assert {"status":"ok","db":"ok","redis":"ok","srs":"ok"}
    Expected Result: All services report OK
    Evidence: .sisyphus/evidence/task-21-health-ok.json
  ```

  **Commit**: YES
  - Message: `feat(api): add health/readiness endpoints for Docker and monitoring`
  - Files: `src/app/api/health/route.ts`, `src/app/api/health/ready/route.ts`

- [x] 22. **Ant Design Layout + Theme + Navigation**

  **What to do**:
  - Create `src/app/layout.tsx` (root layout):
    - Ant Design `ConfigProvider` with custom theme (compact, dark sidebar)
    - Import Ant Design CSS: `import 'antd/dist/reset.css'`
    - `AntdRegistry` for SSR compatibility (from `@ant-design/nextjs-registry`)
  - Create `src/components/layout/MainLayout.tsx`:
    - Ant Design `Layout` with `Sider` + `Content`
    - Sider navigation: "Home" (stream selection), "Admin" (if admin role), user avatar + logout
    - Responsive: collapsible on mobile
  - Create `src/components/layout/Header.tsx`:
    - Site title (from SiteConfig API)
    - User info (avatar, name) or "Sign In" button
  - Load favicon dynamically from SiteConfig

  **Must NOT do**:
  - Do NOT hardcode site title — fetch from SiteConfig API
  - Do NOT show admin link to non-admin users

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design layout, theming, responsive design
  - **Skills**: `[]` — Ant Design Layout components + React

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends only on Task 2 types)
  - **Parallel Group**: Wave 4 (with Tasks 23-27; Tasks 24,25,28 depend on this)
  - **Blocks**: Tasks 24 (selection page), 25 (player), 28 (admin layout)
  - **Blocked By**: Task 2 (TypeScript types)

  **References**:
  - Ant Design Layout: `https://ant.design/components/layout` — Sider, Header, Content components
  - Ant Design with Next.js App Router: `https://ant.design/docs/react/use-with-next` — `AntdRegistry` import
  - Ant Design ConfigProvider: `https://ant.design/components/config-provider` — theme customization

  **Acceptance Criteria**:
  - [ ] Root layout renders Ant Design ConfigProvider
  - [ ] MainLayout shows sidebar with navigation items
  - [ ] Admin link visible only for admin users
  - [ ] Site title displayed from SiteConfig
  - [ ] Favicon updates dynamically from SiteConfig
  - [ ] Responsive layout (sidebar collapses on mobile)

  **QA Scenarios**:
  ```
  Scenario: Layout renders correctly
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to /
      2. Assert site title "Live Stream" visible in header
      3. Assert sidebar contains "Home" link
      4. Assert NO "Admin" link (unauthenticated)
    Expected Result: Layout renders with correct navigation
    Evidence: .sisyphus/evidence/task-22-layout.png

  Scenario: Admin sees admin link
    Tool: Playwright
    Preconditions: Admin user logged in
    Steps:
      1. Navigate to /
      2. Assert "Admin" link visible in sidebar
    Expected Result: Admin navigation link shown
    Evidence: .sisyphus/evidence/task-22-admin-link.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add Ant Design root layout with theme, responsive sidebar, dynamic site title`
  - Files: `src/app/layout.tsx`, `src/components/layout/`

- [x] 23. **Auth UI (Sign In / Sign Out)**

  **What to do**:
  - Create `src/app/auth/signin/page.tsx`:
    - Simple centered card with "Sign in with Authentik" button
    - Uses `signIn("authentik")` from NextAuth
    - Redirect to `/` after successful sign-in
  - Create `src/components/auth/UserMenu.tsx`:
    - Avatar + dropdown: user name, role badge, sign out
    - Uses `signOut()` from NextAuth
  - Create `src/components/auth/AuthProvider.tsx`:
    - `SessionProvider` wrapping children
  - Update `src/app/layout.tsx` to include `AuthProvider`

  **Must NOT do**:
  - Do not create local username/password auth
  - Do not store tokens in localStorage — HttpOnly cookies only

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design form components, NextAuth integration
  - **Skills**: `[]` — React + NextAuth hooks

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends only on Task 9; independent of other Wave 4 tasks)
  - **Parallel Group**: Wave 4 (with Tasks 22,24-27)
  - **Blocks**: None (leaf UI)
  - **Blocked By**: Task 9 (NextAuth setup)

  **References**:
  - NextAuth React hooks: `https://authjs.dev/reference/sveltekit/client` — `signIn()`, `signOut()`, `useSession()`
  - Ant Design Button: `https://ant.design/components/button` — button with icon

  **Acceptance Criteria**:
  - [ ] Click "Sign in with Authentik" → redirect to Authentik login
  - [ ] Successful callback → redirected to `/`
  - [ ] UserMenu shows user avatar + name when signed in
  - [ ] Sign out clears session and redirects to sign-in page

  **QA Scenarios**:
  ```
  Scenario: Sign in flow
    Tool: Playwright
    Preconditions: Authentik configured (or mocked)
    Steps:
      1. Navigate to /auth/signin
      2. Click "Sign in with Authentik" button
      3. Assert redirected to Authentik login page (external)
    Expected Result: Redirect to Authentik
    Evidence: .sisyphus/evidence/task-23-signin-redirect.png

  Scenario: User menu after login
    Tool: Playwright
    Preconditions: User session active
    Steps:
      1. Navigate to /
      2. Assert user avatar visible in header
      3. Click avatar → dropdown with "Sign Out" visible
    Expected Result: User menu shown with sign out option
    Evidence: .sisyphus/evidence/task-23-user-menu.png
  ```

  **Commit**: YES
  - Message: `feat(auth): add sign-in page and user menu with Authentik OAuth2 flow`
  - Files: `src/app/auth/signin/page.tsx`, `src/components/auth/`

- [x] 24. **Stream Room Selection Page**

  **What to do**:
  - Create `src/app/page.tsx` (home page = room selection):
    - Fetch public rooms from `GET /api/rooms`
    - Display room cards in a responsive grid using Ant Design `Card` + `Row`/`Col`
    - Each card: room name (title), clickable → navigates to `/live/[slug]`
    - **NO**: stream status indicator, viewer count, "LIVE" badge
    - Simple card: name only, hover effect
    - Grid: 4 columns desktop, 2 tablet, 1 mobile
    - Empty state: "No streams available" with illustration
  - Loading state: Ant Design `Spin` while fetching
  - Error state: `Alert` with retry button

  **Must NOT do**:
  - Do NOT show stream status (online/offline badge)
  - Do NOT show viewer counts
  - Do NOT show stream thumbnails (out of scope)
  - Do NOT show private rooms to unauthenticated users

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — card grid layout, responsive design, loading/empty states
  - **Skills**: `[]` — Ant Design Card, Row, Col, Spin, Alert

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 13,22; independent of 25-27)
  - **Parallel Group**: Wave 4 (with Tasks 22-23,25-27)
  - **Blocks**: None (leaf page)
  - **Blocked By**: Task 13 (public rooms API), Task 22 (layout)

  **References**:
  - Ant Design Card: `https://ant.design/components/card` — card with hoverable, onClick
  - Ant Design Grid: `https://ant.design/components/grid` — responsive Row/Col with breakpoints
  - Next.js navigation: `useRouter().push('/live/[slug]')` or `<Link href={...}>`

  **Acceptance Criteria**:
  - [ ] Page shows grid of public room cards
  - [ ] Clicking card navigates to `/live/[slug]`
  - [ ] NO status badge or viewer count visible
  - [ ] Empty state shown when no rooms
  - [ ] Loading spinner while fetching
  - [ ] Responsive: 4 columns→2→1 on resize

  **QA Scenarios**:
  ```
  Scenario: Room cards displayed
    Tool: Playwright
    Preconditions: 3 public rooms in DB
    Steps:
      1. Navigate to /
      2. Assert 3 Card components visible
      3. Assert each card shows room name
      4. Assert NO "LIVE" or viewer count badges
    Expected Result: Clean card grid with room names only
    Evidence: .sisyphus/evidence/task-24-room-grid.png

  Scenario: Empty state
    Tool: Playwright
    Preconditions: Zero rooms in DB
    Steps:
      1. Navigate to /
      2. Assert "No streams available" message visible
    Expected Result: Empty state displayed
    Evidence: .sisyphus/evidence/task-24-empty.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add stream room selection page with responsive card grid`
  - Files: `src/app/page.tsx`

- [x] 25. **Player Page — ArtPlayer Wrapper Component**

  **What to do**:
  - Create `src/app/live/[id]/page.tsx`:
    - Fetch room data from `GET /api/rooms/[id]` (or public endpoint)
    - If room not found → 404 page
    - Render fullscreen `ArtPlayer` component
    - No other UI elements — pure fullscreen player
  - Create `src/components/player/ArtPlayerWrapper.tsx`:
    - Initialize ArtPlayer instance with options:
      - `container`: full viewport div
      - `url`: determined by mode (manual vs auto)
      - `type`: determined by format
      - `autoplay`: true
      - `fullscreen`: true
      - `theme`: dark
      - `lang`: zh-cn
    - Handle cleanup: destroy player on unmount
    - Export ref for external control

  **Must NOT do**:
  - Do NOT add chat sidebar, title overlay, or any non-player UI
  - Do NOT hardcode FLV/HLS URLs — Task 26 handles customType

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — ArtPlayer integration, fullscreen layout
  - **Skills**: `[]` — ArtPlayer API + React hooks

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 2,22; independent of 23-24,26-27)
  - **Parallel Group**: Wave 4 (with Tasks 22-24,26-27)
  - **Blocks**: Tasks 26 (customType), 27 (HLS fallback), 34 (private access)
  - **Blocked By**: Task 2 (type defs), Task 22 (layout)

  **References**:
  - ArtPlayer docs: `https://artplayer.org/document` — constructor options, events, destroy
  - ArtPlayer React integration: Use `useRef<HTMLDivElement>` for container, `new ArtPlayer({ container: ref.current, ... })` in `useEffect`
  - Next.js dynamic import: `dynamic(() => import('...'), { ssr: false })` — ArtPlayer is client-only

  **Acceptance Criteria**:
  - [ ] `/live/[id]` renders fullscreen ArtPlayer
  - [ ] No other UI visible (pure video)
  - [ ] Player cleaned up on unmount/navigation
  - [ ] Autoplay starts automatically
  - [ ] `/live/nonexistent` → 404 page

  **QA Scenarios**:
  ```
  Scenario: Player renders fullscreen
    Tool: Playwright
    Preconditions: Room exists
    Steps:
      1. Navigate to /live/test-room
      2. Assert ArtPlayer container fills viewport
      3. Assert NO sidebar, header, or footer elements
      4. Assert video element present
    Expected Result: Fullscreen player with no extra UI
    Evidence: .sisyphus/evidence/task-25-fullscreen-player.png

  Scenario: 404 for nonexistent room
    Tool: Playwright
    Preconditions: None
    Steps:
      1. Navigate to /live/nonexistent-room
      2. Assert "404" or "Room not found" visible
    Expected Result: 404 page shown
    Evidence: .sisyphus/evidence/task-25-404.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add fullscreen player page with ArtPlayer wrapper component`
  - Files: `src/app/live/[id]/page.tsx`, `src/components/player/ArtPlayerWrapper.tsx`

- [x] 26. **mpegts.js customType FLV Integration**

  **What to do**:
  - Create `src/lib/player/flv-loader.ts`:
    - Implement `customType` callback for ArtPlayer:
      - Create mpegts.js `Player` instance
      - Attach to MediaSource via mpegts.js API
      - Return video element for ArtPlayer to use
    - URL resolution:
      - Non-manual mode: `/live/<streamKey>.flv` → proxied to SRS via Nginx
      - Manual mode: first quality URL from play source config
    - Error handling:
      - mpegts.js `ERROR` event → show error overlay
      - mpegts.js `MEDIA_INFO` → set video metadata
      - mpegts.js `STATISTICS_INFO` → for future quality monitoring
  - Configure mpegts.js options:
    - `enableWorker`: true (offload parsing)
    - `lazyLoad`: false (live stream)
    - `liveBufferLatencyChasing`: true
    - `isLive`: true

  **Must NOT do**:
  - Do NOT use flv.js — mpegts.js only
  - Do NOT implement reconnection here (Task 33)
  - Do NOT add HLS logic here (Task 27)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — ArtPlayer customType, mpegts.js integration, MediaSource
  - **Skills**: `[]` — mpegts.js API + ArtPlayer customType

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 25)
  - **Parallel Group**: Wave 4
  - **Blocks**: Tasks 27 (HLS), 33 (reconnection)
  - **Blocked By**: Task 25 (player wrapper)

  **References**:
  - ArtPlayer customType: `https://artplayer.org/document/#/options?id=customtype` — callback receives `{ video, url, title, ... }`
  - mpegts.js API: `https://github.com/xqq/mpegts.js` — `createPlayer(mediaDataSource, config)`, events
  - mpegts.js mediaDataSource: `{ type: 'flv', url, isLive: true }`

  **Acceptance Criteria**:
  - [ ] ArtPlayer plays FLV stream via mpegts.js customType
  - [ ] Non-manual mode uses `/live/<streamKey>.flv` URL
  - [ ] mpegts.js errors surface as player error state
  - [ ] Video metadata (width/height/duration) displayed in ArtPlayer info
  - [ ] `enableWorker: true` — offload demuxing to Web Worker

  **QA Scenarios**:
  ```
  Scenario: FLV playback via mpegts.js
    Tool: Playwright
    Preconditions: SRS streaming actively, room configured, Nginx proxying
    Steps:
      1. Navigate to /live/test-room
      2. Wait for video element to start playing
      3. Assert video.readyState >= 2 (HAVE_CURRENT_DATA)
    Expected Result: Video playing FLV stream
    Evidence: .sisyphus/evidence/task-26-flv-playing.png
  ```

  **Commit**: YES
  - Message: `feat(player): integrate mpegts.js via ArtPlayer customType for FLV playback`
  - Files: `src/lib/player/flv-loader.ts`

- [x] 27. **iOS HLS Fallback**

  **What to do**:
  - Create `src/lib/player/platform.ts`:
    - Detect iOS/Safari: `!/iPad|iPhone|iPod/.test(navigator.userAgent) && !(/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent))`
    - Check MediaSource API support: `!!window.MediaSource`
    - Combined: `needsHLSFallback()` → true when iOS OR no MSE
  - Update `src/lib/player/flv-loader.ts` or create `src/lib/player/hls-loader.ts`:
    - If `needsHLSFallback()` → play HLS via ArtPlayer native HLS support (Safari) or hls.js
    - HLS URL: `/live/<streamKey>.m3u8` → proxied to SRS via Nginx
    - Use SRS HLS output (enabled in srs.conf, remux only, no transcode)
  - Update player page: choose loader based on platform detection

  **Must NOT do**:
  - Do NOT transcode — SRS HLS is same bitrate as FLV (remux only)
  - Do NOT load both FLV and HLS simultaneously

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — platform detection, HLS fallback, Safari quirks
  - **Skills**: `[]` — hls.js or native HLS + platform detection

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 26)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 26 (FLV loader)

  **References**:
  - iOS MSE support: iOS Safari does NOT support MSE — confirmed by Metis research
  - SRS HLS config: `hls { enabled on; hls_fragment 10; hls_window 60; hls_path ./objs/nginx/html; }`
  - Native HLS in Safari: `<video>` tag with `.m3u8` src works natively on iOS

  **Acceptance Criteria**:
  - [ ] Desktop Chrome/Firefox → mpegts.js FLV
  - [ ] iOS Safari → HLS (native `<video>` with .m3u8 src)
  - [ ] HLS URL accessible via Nginx proxy
  - [ ] Same stream key works for both FLV and HLS

  **QA Scenarios**:
  ```
  Scenario: iOS falls back to HLS
    Tool: Playwright (iPhone 14 emulation)
    Preconditions: SRS HLS enabled
    Steps:
      1. Set viewport to iPhone 14 (390×844)
      2. Navigate to /live/test-room
      3. Assert video source ends with .m3u8
    Expected Result: HLS playback on iOS
    Evidence: .sisyphus/evidence/task-27-ios-hls.png

  Scenario: Desktop uses FLV
    Tool: Playwright
    Preconditions: Desktop Chrome viewport
    Steps:
      1. Navigate to /live/test-room
      2. Assert video loaded via mpegts.js (NOT .m3u8)
    Expected Result: FLV playback on desktop
    Evidence: .sisyphus/evidence/task-27-desktop-flv.png
  ```

  **Commit**: YES
  - Message: `feat(player): add iOS HLS fallback with platform detection`
  - Files: `src/lib/player/platform.ts`, `src/lib/player/hls-loader.ts`

- [x] 28. **Admin Layout + Role Gate**

  **What to do**:
  - Create `src/app/admin/layout.tsx`:
    - Server component: call `requireAdmin()` from Task 10
    - On 403 → redirect to `/` with "Access denied" message
    - Render admin-specific layout: wider sidebar, admin-specific navigation items
  - Create `src/components/admin/AdminLayout.tsx`:
    - Admin sidebar menu: "Dashboard" (overview), "Site Config", "Rooms", "Users" (if admin)
    - Active menu item highlighting
    - Breadcrumb navigation
  - Admin pages all wrapped by this layout

  **Must NOT do**:
  - Do NOT allow non-admin to see admin sidebar items
  - Do NOT do client-only role check — server-side gate in layout

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design Layout, Menu, Breadcrumb
  - **Skills**: `[]` — Ant Design + server component patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 10,22; blocks all admin pages)
  - **Parallel Group**: Wave 5 (with Tasks 29-32; all 29-32 depend on this)
  - **Blocks**: Tasks 29-32 (all admin sub-pages)
  - **Blocked By**: Task 10 (auth guards), Task 22 (base layout)

  **References**:
  - Ant Design Menu: `https://ant.design/components/menu` — `items`, `selectedKeys`, `onClick`
  - Ant Design Breadcrumb: `https://ant.design/components/breadcrumb` — route-based breadcrumbs
  - Next.js layouts: `https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#nesting-layouts`

  **Acceptance Criteria**:
  - [ ] `/admin` shows admin sidebar with all menu items
  - [ ] `/admin/*` blocks non-admin with redirect
  - [ ] Active menu item highlighted based on current route
  - [ ] Breadcrumb shows: Admin > [Current Page]

  **QA Scenarios**:
  ```
  Scenario: Admin layout with menu
    Tool: Playwright
    Preconditions: Admin user logged in
    Steps:
      1. Navigate to /admin
      2. Assert sidebar has "Site Config", "Rooms", "Users" menu items
      3. Assert "Site Config" highlighted (default page)
      4. Assert breadcrumb "Admin > Site Config"
    Expected Result: Admin layout with navigation
    Evidence: .sisyphus/evidence/task-28-admin-layout.png
  ```

  **Commit**: YES
  - Message: `feat(admin): add admin layout with role gate and navigation`
  - Files: `src/app/admin/layout.tsx`, `src/components/admin/AdminLayout.tsx`

- [x] 29. **Admin Site Config Page**

  **What to do**:
  - Create `src/app/admin/page.tsx` or `src/app/admin/config/page.tsx`:
    - Ant Design `Form` with fields: siteTitle (Input), faviconUrl (Input with preview)
    - Load current config from `GET /api/admin/config`
    - Save with `PATCH /api/admin/config`
    - Success/error notification via Ant Design `message`
    - Show current favicon as image preview

  **Must NOT do**:
  - Do not allow configuring anything beyond title + favicon
  - Do not expose internal settings (DB URLs, secrets)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design Form, Input, message notification
  - **Skills**: `[]` — Ant Design forms + fetch

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 12,28; independent of 30-32)
  - **Parallel Group**: Wave 5 (with Tasks 28,30-32)
  - **Blocks**: None
  - **Blocked By**: Task 12 (config API), Task 28 (admin layout)

  **References**:
  - Ant Design Form: `https://ant.design/components/form` — `Form.useForm()`, `onFinish`
  - Ant Design message: `https://ant.design/components/message` — success/error toasts

  **Acceptance Criteria**:
  - [ ] Form loads current siteTitle and faviconUrl
  - [ ] Changing title + save → PATCH request sent, notification "Updated"
  - [ ] Favicon preview updates on URL change
  - [ ] Page title in browser tab updates after save

  **QA Scenarios**:
  ```
  Scenario: Update site title
    Tool: Playwright
    Preconditions: Admin logged in, current title "Live Stream"
    Steps:
      1. Navigate to /admin/config
      2. Clear siteTitle input, type "My Custom Live"
      3. Click "Save" button
      4. Assert success notification "Settings updated"
      5. Reload → assert siteTitle shows "My Custom Live"
    Expected Result: Site title updated and persisted
    Evidence: .sisyphus/evidence/task-29-config-update.png
  ```

  **Commit**: YES
  - Message: `feat(admin): add site config page for title and favicon management`
  - Files: `src/app/admin/config/page.tsx`

- [x] 30. **Admin Stream Room Management**

  **What to do**:
  - Create `src/app/admin/rooms/page.tsx`:
    - Ant Design `Table` with columns: name, slug, visibility (tag), streamKey (masked), manualMode (switch), createdAt, actions
    - Actions: Edit, Delete (with confirm modal)
    - "Create Room" button → opens modal `Form`
    - Create form fields: name, visibility (Radio: public/private)
  - Create `src/app/admin/rooms/[id]/page.tsx` (room detail/edit):
    - Edit room properties
    - Tab navigation: "Keys", "Play Sources" (sub-pages or tabs)
  - Pagination, search by name

  **Must NOT do**:
  - Do NOT show full streamKey in table (show first 8 chars + "...")
  - Do NOT allow non-admin to see this page

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design Table, Modal, Form, Tag
  - **Skills**: `[]` — Ant Design data display + forms

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 13,28; independent of 29,31-32)
  - **Parallel Group**: Wave 5 (with Tasks 28-29,31-32)
  - **Blocks**: None
  - **Blocked By**: Task 13 (room API), Task 28 (admin layout)

  **References**:
  - Ant Design Table: `https://ant.design/components/table` — columns, dataSource, pagination
  - Ant Design Modal: `https://ant.design/components/modal` — confirm delete, form in modal
  - Ant Design Tag: `https://ant.design/components/tag` — visibility badge (Public=green, Private=red)

  **Acceptance Criteria**:
  - [ ] Table lists all rooms with correct columns
  - [ ] "Create Room" modal creates room + refreshes table
  - [ ] Delete room shows confirm → deletes + refreshes
  - [ ] Edit navigates to room detail page
  - [ ] Search filters rooms by name
  - [ ] StreamKey masked (first 8 chars + "...") in table

  **QA Scenarios**:
  ```
  Scenario: Create and list rooms
    Tool: Playwright
    Preconditions: Admin logged in
    Steps:
      1. Navigate to /admin/rooms
      2. Click "Create Room"
      3. Fill name "Test Stream", select "Public"
      4. Click "Create" → modal closes, table shows new room
      5. Assert table row has name "Test Stream", green "Public" tag
    Expected Result: Room created and visible in table
    Evidence: .sisyphus/evidence/task-30-rooms-table.png
  ```

  **Commit**: YES
  - Message: `feat(admin): add stream room management table with CRUD modals`
  - Files: `src/app/admin/rooms/page.tsx`, `src/app/admin/rooms/[id]/page.tsx`

- [x] 31. **Admin Stream Key Management**

  **What to do**:
  - Create key management section in `src/app/admin/rooms/[id]/page.tsx` (tab "Keys"):
    - Table of keys: label, status (Active/Disabled tag), createdAt, actions
    - "Generate New Key" button → modal with label input
    - On creation: show plain key in a one-time modal with copy button + warning "Save this key now — it won't be shown again"
    - Toggle key active/inactive (rotate): switch component
    - Delete key (with confirm: "Active streams using this key will be disconnected")
  - Copy-to-clipboard button for key using `navigator.clipboard.writeText()`

  **Must NOT do**:
  - Do NOT show plain key in table — only in creation modal (one-time)
  - Do NOT allow viewing plain key of existing keys — hash only in DB

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Ant Design Table, Modal, Switch, message
  - **Skills**: `[]` — Ant Design + clipboard API

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 14,28; independent of 29-30,32)
  - **Parallel Group**: Wave 5 (with Tasks 28-30,32)
  - **Blocks**: None
  - **Blocked By**: Task 14 (key API), Task 28 (admin layout)

  **References**:
  - Ant Design Switch: `https://ant.design/components/switch` — toggle active/inactive
  - Clipboard API: `navigator.clipboard.writeText()` — copy key to clipboard
  - Ant Design message: one-time warning with `message.warning()`

  **Acceptance Criteria**:
  - [ ] Table lists keys with masked display (never plain)
  - [ ] "Generate New Key" → modal shows plain key once
  - [ ] Copy button copies key to clipboard
  - [ ] After closing modal, key cannot be viewed again
  - [ ] Toggle switch disables key → status changes in table
  - [ ] Delete key removes from table

  **QA Scenarios**:
  ```
  Scenario: Generate and display key once
    Tool: Playwright
    Preconditions: Admin on room detail > Keys tab
    Steps:
      1. Click "Generate New Key"
      2. Fill label "OBS Key"
      3. Click "Generate"
      4. Assert modal shows plain key (visible text)
      5. Assert "Copy" button available
      6. Close modal
      7. Assert table shows key with label "OBS Key", active status
      8. Assert key value is masked (NOT plain text)
    Expected Result: Key shown once, then masked
    Evidence: .sisyphus/evidence/task-31-key-modal.png
  ```

  **Commit**: YES
  - Message: `feat(admin): add stream key management with one-time reveal and toggle activation`
  - Files: `src/app/admin/rooms/[id]/page.tsx` (keys tab)

- [x] 32. **Admin Play Source Management**

  **What to do**:
  - Create play source section in `src/app/admin/rooms/[id]/page.tsx` (tab "Play Sources"):
    - List of sources with name, quality count, reorder drag handle
    - "Add Source" → collapse panel with name input + quality list
    - Quality: label (Input) + URL (Input) + delete button
    - "Add Quality" button within source panel
    - Reorder sources (drag-and-drop via `@dnd-kit` or Ant Design `Table` with drag)
    - Delete source/quality with confirm
    - Info alert: "Play sources override default FLV playback when manual mode is enabled"

  **Must NOT do**:
  - Do NOT show this tab when manualMode is false (or show with info that manual mode is off)
  - Do NOT allow saving empty qualities (at least 1 quality per source)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — nested list management, drag-and-drop, dynamic form
  - **Skills**: `[]` — Ant Design Collapse, List, Form + dnd (optional)

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 15,28; independent of 29-31)
  - **Parallel Group**: Wave 5 (with Tasks 28-31)
  - **Blocks**: None
  - **Blocked By**: Task 15 (play source API), Task 28 (admin layout)

  **References**:
  - Ant Design Collapse: `https://ant.design/components/collapse` — expandable source panels
  - Ant Design Form.List: `https://ant.design/components/form#formlist` — dynamic form array for qualities
  - Ant Design Alert: `https://ant.design/components/alert` — info banner

  **Acceptance Criteria**:
  - [ ] List shows existing play sources with quality count
  - [ ] "Add Source" creates new source with at least 1 quality
  - [ ] Can add/remove qualities within a source
  - [ ] Delete source removes it + all qualities
  - [ ] Info alert visible when manual mode is on

  **QA Scenarios**:
  ```
  Scenario: Create play source with qualities
    Tool: Playwright
    Preconditions: Admin on room detail, manualMode=true, Play Sources tab
    Steps:
      1. Click "Add Source"
      2. Fill source name "CDN Source"
      3. Click "Add Quality"
      4. Fill label "1080p", url "https://cdn.example.com/stream-1080.m3u8"
      5. Click "Add Quality" again
      6. Fill label "720p", url "https://cdn.example.com/stream-720.m3u8"
      7. Click "Save"
      8. Assert source "CDN Source" appears in list with "2 qualities"
    Expected Result: Play source with 2 qualities saved
    Evidence: .sisyphus/evidence/task-32-play-source.png
  ```

  **Commit**: YES
  - Message: `feat(admin): add play source management with nested qualities for manual mode`
  - Files: `src/app/admin/rooms/[id]/page.tsx` (play sources tab)

- [x] 33. **Player Reconnection Logic**

  **What to do**:
  - Update `src/lib/player/flv-loader.ts`:
    - Listen for mpegts.js error events: `ERROR`, `LOADING_COMPLETE`, `MEDIA_ERROR`
    - On connection loss (network error, early EOF):
      - Destroy current mpegts.js instance
      - Show "Reconnecting..." overlay via ArtPlayer `notice` plugin
      - Retry with exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
      - On reconnect success: hide overlay, resume playback
      - On final failure (5 retries): show "Stream unavailable" permanent message
    - Implement in `customType` as `reconnect` utility

  **Must NOT do**:
  - Do NOT reconnection for HLS (Safari handles natively)
  - Do NOT block UI thread during reconnection

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — reconnection logic, exponential backoff, event handling
  - **Skills**: `[]` — mpegts.js events + ArtPlayer notice plugin

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends only on Task 26; independent of 34-36)
  - **Parallel Group**: Wave 6 (with Tasks 34-36)
  - **Blocks**: None
  - **Blocked By**: Task 26 (FLV loader)

  **References**:
  - mpegts.js events: `https://github.com/xqq/mpegts.js#events` — ERROR, STATISTICS_INFO, LOADING_COMPLETE
  - ArtPlayer notice plugin: `https://artplayer.org/document/#/plugins/notice` — show/hide overlay messages
  - Exponential backoff pattern: `delay = Math.min(1000 * Math.pow(2, attempt), 16000)`

  **Acceptance Criteria**:
  - [ ] Network disconnect → "Reconnecting..." overlay shown
  - [ ] Reconnection succeeds within 5 attempts → overlay hidden, playback resumes
  - [ ] All 5 retries fail → "Stream unavailable" permanent message
  - [ ] Backoff delay doubles each attempt (1s → 2s → 4s → 8s → 16s)

  **QA Scenarios**:
  ```
  Scenario: Reconnection after network loss
    Tool: Playwright
    Preconditions: FLV stream playing
    Steps:
      1. Use Playwright to simulate network offline (page.route abort for .flv)
      2. Assert "Reconnecting..." overlay visible
      3. Restore network (page.route continue)
      4. Assert "Reconnecting..." hidden within 10s
      5. Assert video playing again
    Expected Result: Player reconnects and resumes
    Evidence: .sisyphus/evidence/task-33-reconnect.png
  ```

  **Commit**: YES
  - Message: `feat(player): add mpegts.js reconnection with exponential backoff`
  - Files: `src/lib/player/flv-loader.ts` (update)

- [x] 34. **Private Stream Key Access**

  **What to do**:
  - Update player page `src/app/live/[id]/page.tsx`:
    - Check room visibility
    - If `private` and user not authenticated → check URL query `?key=xxx`
    - If key provided → validate against API `POST /api/rooms/[id]/verify-key` (new endpoint)
    - Valid key → allow playback, set temporary session cookie
    - Invalid key → show "Access denied: invalid or expired key"
    - If authenticated user → allow regardless of key (logged-in users watch private streams)
  - Create `src/app/api/rooms/[id]/verify-key/route.ts`:
    - `POST { key }` → validate against active keys in DB (bcrypt compare)
    - Rate limit: 5 attempts per minute per IP (Redis)
  - Create access-granted UI: brief loading → player starts

  **Must NOT do**:
  - Do NOT store key in URL after validation (replace with session cookie)
  - Do NOT expose room details before key validation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — access control, key validation, rate limiting
  - **Skills**: `[]` — Next.js middleware + bcrypt + Redis rate limiting

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 13,25; independent of 33,35-36)
  - **Parallel Group**: Wave 6 (with Tasks 33,35-36)
  - **Blocks**: None
  - **Blocked By**: Task 13 (room API), Task 25 (player page)

  **References**:
  - URL query params in Next.js: `searchParams` prop in page component
  - bcrypt compare: `bcrypt.compare(plainKey, hashedKey)` — slow but secure (OK for non-SRS-callback)
  - Redis rate limiting: `INCR + EXPIRE` on key `rate:verify-key:<ip>`

  **Acceptance Criteria**:
  - [ ] `/live/private-room?key=valid-key` → shows player
  - [ ] `/live/private-room?key=invalid` → "Access denied" message
  - [ ] `/live/private-room` (no key, unauthenticated) → redirect to sign-in OR show key input
  - [ ] `/live/private-room` (authenticated user) → shows player directly
  - [ ] Rate limit: 6th attempt within 1 minute → 429 Too Many Requests

  **QA Scenarios**:
  ```
  Scenario: Access private stream with valid key
    Tool: Playwright
    Preconditions: Private room with active key "secret123"
    Steps:
      1. Sign out (unauthenticated)
      2. Navigate to /live/private-room?key=secret123
      3. Validate key → loading spinner → player starts
    Expected Result: Player loads after key validation
    Evidence: .sisyphus/evidence/task-34-key-access.png

  Scenario: Invalid key rejected
    Tool: Playwright
    Preconditions: Same room
    Steps:
      1. Navigate to /live/private-room?key=wrong
      2. Assert "Access denied: invalid or expired key"
    Expected Result: Access denied message
    Evidence: .sisyphus/evidence/task-34-key-rejected.png
  ```

  **Commit**: YES
  - Message: `feat(access): add private stream key-based access with rate limiting`
  - Files: `src/app/api/rooms/[id]/verify-key/route.ts`, `src/app/live/[id]/page.tsx` (update)

- [x] 35. **Docker Compose Production Config**

  **What to do**:
  - Create `docker-compose.yml` (production):
    - `srs`: image `ossrs/srs:6`, ports 1935/1985, volumes for config + HLS data, restart unless-stopped
    - `web`: build from `apps/web/Dockerfile`, port 3000, depends on srs, env vars
    - Networks: `app-network` (internal), `srs-push` (exposed on 1935 for push domain)
    - Healthchecks on both services
    - Logging: json-file with rotation
  - Create `apps/web/Dockerfile`:
    - Multi-stage: `node:20-alpine` → `pnpm install --prod` → `next build` → `next start`
    - Expose port 3000
    - Healthcheck: `curl -f http://localhost:3000/api/health/ready`
  - Create `docker/.env.production` template
  - Update `pnpm-lock.yaml` for production deps

  **Must NOT do**:
  - Do NOT include PostgreSQL/Redis in production compose (external services)
  - Do NOT include Authentik (external service)
  - Do NOT use development env vars in production config

  **Recommended Agent Profile**:
  - **Category**: `quick` — Docker Compose + Dockerfile, standard patterns
  - **Skills**: `[]` — Docker + Docker Compose

  **Parallelization**:
  - **Can Run In Parallel**: YES (depends on Tasks 1,6,7,8; independent of 33-34,36)
  - **Parallel Group**: Wave 6 (with Tasks 33-34,36)
  - **Blocks**: None
  - **Blocked By**: Task 1 (project structure), Task 6 (SRS config), Task 7 (Nginx config), Task 8 (dev compose)

  **References**:
  - Next.js Docker: `https://nextjs.org/docs/app/building-your-application/deploying#docker-image` — standalone output mode
  - Docker Compose production: `https://docs.docker.com/compose/production/` — restart policies, logging, secrets
  - Multi-stage Docker: `https://docs.docker.com/build/building/multi-stage/`

  **Acceptance Criteria**:
  - [ ] `docker compose up` starts SRS + Next.js
  - [ ] `docker compose ps` shows both healthy
  - [ ] Next.js responds on port 3000
  - [ ] SRS RTMP accepts connections on port 1935
  - [ ] SRS HTTP-FLV responds on port 8080

  **QA Scenarios**:
  ```
  Scenario: Production services start healthy
    Tool: bash
    Preconditions: Docker installed, .env.production configured
    Steps:
      1. docker compose up -d
      2. sleep 15
      3. docker compose ps → all "healthy"
      4. curl http://localhost:3000/api/health → 200
      5. curl http://localhost:1985/api/v1/versions → 200
    Expected Result: Both services healthy
    Evidence: .sisyphus/evidence/task-35-prod-healthy.txt
  ```

  **Commit**: YES
  - Message: `feat(docker): add production Docker Compose and Next.js Dockerfile`
  - Files: `docker-compose.yml`, `apps/web/Dockerfile`, `docker/.env.production`

- [x] 36. **End-to-End Integration**

  **What to do**:
  - Create integration test suite:
    - Auth flow: Authentik sign-in → session → admin promotion → access admin
    - Room CRUD: create room → list rooms → update visibility → delete room
    - Key flow: generate key → use for RTMP publish auth → rotate key → old key rejected
    - Playback flow: public room → viewer loads player → FLV/HLS stream plays
    - Private access: unauthenticated + valid key → player loads
    - Admin config: update site title → reflected on home page
  - Use Playwright for E2E tests (browser-based flows)
  - Use curl/bash for API-level integration tests
  - Create test fixtures: seed data (admin user, rooms, keys)
  - Add `pnpm test:e2e` script

  **Must NOT do**:
  - Do NOT test Authentik directly (external service) — mock the OAuth callback
  - Do NOT require actual RTMP push for all tests — mock SRS callbacks where needed

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — full integration testing across all components
  - **Skills**: `[]` — Playwright + vitest + bash scripting

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on ALL tasks)
  - **Parallel Group**: Wave 6 (runs after all 1-35 complete)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: All Tasks 1-35

  **References**:
  - Playwright: `https://playwright.dev/docs/writing-tests` — page navigation, assertions, screenshots
  - vitest: `https://vitest.dev/guide/` — test runner configuration

  **Acceptance Criteria**:
  - [ ] Auth E2E: sign-in → admin promotion verified
  - [ ] Room E2E: create, list, update, delete all work
  - [ ] Key E2E: generate → publish auth → rotate → old rejected
  - [ ] Playback E2E: public room → FLV plays in browser
  - [ ] Private E2E: key-based access granted and denied correctly
  - [ ] Config E2E: title change reflected on home page
  - [ ] All integration tests pass: `pnpm test:e2e` exits 0

  **QA Scenarios**:
  ```
  Scenario: Full admin workflow
    Tool: Playwright
    Preconditions: Fresh DB, seed data
    Steps:
      1. Sign in as admin
      2. Create room "E2E Test Room"
      3. Verify room appears in public listing (no auth)
      4. Generate stream key
      5. Simulate SRS on_publish callback with key → 200 code:0
      6. Navigate to /live/e2e-test-room as viewer → player loads
      7. Rotate key → disable old
      8. Simulate on_publish with old key → 200 code:1 (rejected)
    Expected Result: Full workflow succeeds end-to-end
    Evidence: .sisyphus/evidence/task-36-e2e-full.png
  ```

  **Commit**: YES (final implementation commit)
  - Message: `test(e2e): add end-to-end integration tests for auth, rooms, keys, playback`
  - Files: `tests/e2e/`, `tests/fixtures/`, `package.json` (scripts)

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  **AC**: Must Have [10/10] | Must NOT Have [14/14 clean] | Tasks [36/36 completed] | VERDICT: APPROVE

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `pnpm lint` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  **AC**: Build [PASS] | Lint [PASS] | Tests [all pass] | Slop [0 violations] | VERDICT: APPROVE

- [x] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  Start from clean state (docker compose up, seed DB). Execute EVERY QA scenario from EVERY task (1–36) — follow exact steps, capture evidence. Test cross-task integration: create room → generate key → simulate publish callback → play stream → rotate key → old key rejected. Test edge cases: empty state, invalid input, rapid actions, network loss reconnection. Save to `.sisyphus/evidence/final-qa/`.
  **AC**: Scenarios [36/36 pass] | Integration [6/6 pass] | Edge Cases [all covered] | VERDICT: APPROVE

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance per task. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  **AC**: Tasks [36/36 compliant] | Contamination [CLEAN] | Unaccounted [CLEAN] | VERDICT: APPROVE

---

## Commit Strategy

- **W1**: `chore(scaffold): initialize project with Next.js, Prisma, Redis, SRS, Nginx configs`
- **W2**: `feat(auth): add Authentik OAuth2 + user/room/key/play-source APIs`
- **W3**: `feat(srs): implement publish/play callbacks + stream status + health`
- **W4**: `feat(frontend): stream selection + player page with mpegts.js`
- **W5**: `feat(admin): admin panel for site config, rooms, keys, play-sources`
- **W6**: `feat(integration): reconnection, private access, prod compose, e2e`

---

## Success Criteria

### Verification Commands
```bash
pnpm test                    # Expected: all vitest suites pass
pnpm build                   # Expected: Next.js build succeeds
docker compose ps            # Expected: srs + nextjs running healthy
curl /api/health             # Expected: { status: "ok", db: "ok", redis: "ok", srs: "ok" }
curl -s -o /dev/null -w '%{http_code}' https://live.example.com/live/test.flv  # Expected: 200 (with valid token)
```

### Final Checklist
- [ ] All "Must Have" (10 items) present
- [ ] All "Must NOT Have" (14 items) absent
- [ ] All vitest suites pass (TDD workflow)
- [ ] SRS callbacks sub-100ms with Promise.race timeout
- [ ] First user auto-promoted to admin
- [ ] Key rotation: new key accepted, old key rejected
- [ ] iOS Safari shows HLS fallback, desktop shows mpegts.js FLV
- [ ] Nginx config has `proxy_buffering off`, `proxy_read_timeout 3600s`
- [ ] CDN headers set for FLV bypass
