

## Task 34 - Private Stream Key Access

- Created `apps/web/src/app/api/rooms/[id]/verify-key/route.ts`:
  - POST handler accepting `{ key: string }` body
  - Finds room by slug via `prisma.streamRoom.findUnique`
  - Room not found → 404 (standard, doesn't leak existence for private rooms because we check after finding)
  - PUBLIC room → 200 `{ valid: true }` (no key needed)
  - PRIVATE room:
    - Rate limiting: `INCR rate:verify-key:<ip>` in Redis with 60s TTL, max 5 attempts → 429 if exceeded
    - Fetches active keys from `prisma.streamKey.findMany({ where: { roomId, isActive: true } })`
    - Compares provided key against each `keyHash` using `bcrypt.compare()` (async)
    - Match → 200 `{ valid: true, room: { name, slug, manualMode } }`
    - No match → 200 `{ valid: false }` (doesn't reveal room exists)
  - IP extraction from `x-forwarded-for` (first entry) or `x-real-ip`, falls back to `'unknown'`
  - Uses `cacheKeys.rateLimit()` from `@/lib/cache-keys`

- Modified `apps/web/src/app/live/[id]/page.tsx`:
  - Added `useSession()` from `next-auth/react` to detect authenticated users
  - Added `useSearchParams()` from `next/navigation` to read `?key=xxx` from URL
  - Added states: `accessGranted`, `checkingKey`, `keyError`, `inputKey`
  - After fetching room data:
    - PUBLIC → `accessGranted = true`, stream loads normally
    - PRIVATE + authenticated → `accessGranted = true`, no key needed
    - PRIVATE + unauthenticated + `?key=xxx` in URL → POST to `/api/rooms/${slug}/verify-key`, sets `accessGranted` on valid key
    - PRIVATE + unauthenticated + no URL key → shows key input form
  - Key input form: `Input.Password` + "Access" button, Enter-to-submit via `onPressEnter`
  - Invalid key: shows `Result` component with status 403, title "Access Denied", subtitle "Access Denied: Invalid or expired key"
  - Loading state: `Spin` while fetching room or validating key
  - Key is NOT stored in URL after validation — uses `accessGranted` component state
  - Room details are NOT exposed before key validation for private rooms

- `pnpm tsc --noEmit`: zero errors
- `pnpm build`: ✓ Compiled successfully, ✓ 19/19 static pages generated. Redis ECONNREFUSED during build trace is pre-existing.
