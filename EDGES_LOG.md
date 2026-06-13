# IDme — Edge Cases & Design Decisions Log (v1.0)

This document log details the critical edge cases, structural design decisions, and mitigations implemented in IDme v1.0.

---

## 1. Onboarding & Session Lifecycle

### Edge Case: Page Refresh or Provider Redirect Destroys JS Memory
- **Problem**: When a user connects to GitHub/LinkedIn, they are redirected to the provider's OAuth server and then back to `/create?session=TOKEN`. A naive SPA wizard would lose its current step and connection states upon page reload.
- **Mitigation**:
  1. Cryptographic session tokens and slugs are written to `localStorage` immediately upon username reservation.
  2. When loading `/create`, the application checks the URL query parameters first, and falls back to `localStorage` for session recovery.
  3. The `GET /api/session/{token}` endpoint is enhanced to return fresh single-use OAuth authorize URLs on the fly. This allows the restored wizard view to populate valid connection buttons dynamically.

### Edge Case: Concurrent Slug Claims (Race Condition)
- **Problem**: Two users type the same username and both see it as "available" simultaneously. They both click "Reserve".
- **Mitigation**: The database enforces a `UNIQUE` constraint on the `slug` column. The backend `POST /api/create` performs a select and inserts inside the transaction. In case of a collision, the second request throws a `409 Conflict` (Username already taken), which is caught by the frontend and prompts the user to select another handle.

---

## 2. OAuth & Authentication Flows

### Edge Case: State Replay & Replay Attacks
- **Problem**: An attacker attempts to reuse an OAuth state parameter to link their platform account to a victim's session.
- **Mitigation**: States are generated using `secrets.token_urlsafe(32)` and stored in Redis with a 10-minute TTL. Upon callback, the state is retrieved and **immediately deleted** (single-use constraint), neutralizing replay attempts.

### Edge Case: Platform API Failures or Denial of Scope
- **Problem**: The user completes the OAuth login but denies profile information permissions, or the provider API is temporarily unreachable.
- **Mitigation**: If the token exchange or profile fetch fails, the callback handler redirects the user to `/create?error=platform_auth_failed&session=TOKEN`. The wizard displays a clear notification banner without resetting their entire session state.

---

## 3. Trust Score Engine

### Edge Case: Name Consistency Matching
- **Problem**: Matching user names across platforms is brittle due to variations (e.g., "Alex M." vs "Alex Morgan").
- **Mitigation**: Names are normalized (trimmed, lowercased, special characters stripped). The engine evaluates the counts of matching names across all connected platforms. A single connected platform gets a consistency score of 50% (neutral), while multiple matching names scale up to 100%.

### Edge Case: Age Calculation Fallbacks
- **Problem**: Certain platforms may not provide a public account creation date in standard payloads.
- **Mitigation**: The trust engine attempts to parse ISO dates and handles missing/corrupt values gracefully by setting them to 0, ensuring that the profile render never fails.

---

## 4. Performance & Scalability

### Edge Case: Database Bottleneck on High-Traffic Profile Visits
- **Problem**: Storing page views synchronously blocks the render speed of public profiles.
- **Mitigation**: Profile visits are recorded using `asyncio.create_task(_record_visit(...))` in a fire-and-forget manner. Any DB issues in visit recording are caught and logged silently, meaning they never impact the user experience.
