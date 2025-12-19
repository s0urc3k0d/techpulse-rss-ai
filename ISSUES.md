# Issues GitHub - TechPulse AI

> Issues à créer manuellement sur GitHub ou via `gh issue create --title "..." --body "..."`

---

## 🔴 CRITIQUE

### Issue #1: [SECURITY] Migrate Gemini API calls to backend
**Labels**: `security`, `critical`, `backend`  
**Estimate**: 2-3 days

**Description**:
Currently, `vite.config.ts` exposes `GEMINI_API_KEY` directly in the client bundle via `process.env.API_KEY`. The `@google/genai` library is imported client-side via ESM CDN, making the API key visible in the source code.

**Impact**: Public API key = quota abuse, uncontrolled costs, security breach.

**Tasks**:
- [ ] Create backend API endpoints: `/api/categorize` and `/api/generate-script`
- [ ] Move `geminiService.ts` logic to server-side with input validation
- [ ] Implement rate limiting (10 req/min/IP) and authentication
- [ ] Update frontend to call `fetch('/api/...')` instead of direct Gemini import
- [ ] Remove `process.env` definitions from `vite.config.ts`
- [ ] Add integration tests for endpoints

**Acceptance Criteria**:
- API key is never exposed in client bundle
- Backend endpoints respond correctly with proper error handling
- Rate limiting is functional
- Frontend successfully communicates with backend

---

### Issue #2: [CONFIG] Normalize environment variables and build setup
**Labels**: `configuration`, `critical`, `dx`  
**Estimate**: 1 day

**Description**:
Inconsistency between `GEMINI_API_KEY` (README) and `API_KEY` (code). No `.env.example` file. Tailwind is loaded via CDN (non-optimal for production).

**Tasks**:
- [ ] Standardize variable name: `GEMINI_API_KEY` (server-side only)
- [ ] Create `.env.example` with inline documentation
- [ ] Migrate Tailwind CDN → PostCSS + config file (performance, CSS purge)
- [ ] Create missing `index.css` with base styles
- [ ] Add `npm run check-env` script to validate env vars on startup
- [ ] Update README with proper setup instructions

**Acceptance Criteria**:
- `.env.example` exists and is documented
- Tailwind is configured via `tailwind.config.js`
- Build produces optimized CSS bundle
- Clear error if env vars are missing

---

## 🟠 HIGH PRIORITY

### Issue #3: [RSS] Improve RSS fetching reliability (concurrency, retries, deduplication)
**Labels**: `enhancement`, `high`, `performance`  
**Estimate**: 1-2 days

**Description**:
Sequential RSS fetching blocks UI, no timeouts/retries, possible duplicates, fragile parsing.

**Tasks**:
- [ ] Implement `Promise.allSettled` with concurrency pool (pLimit, 4-6 workers)
- [ ] Add timeouts (10s), exponential retries (3 attempts)
- [ ] Deduplicate articles by hash(link + title)
- [ ] Handle exotic encodings and malformed XML gracefully
- [ ] Add short-term localStorage cache (1h TTL)
- [ ] Add unit tests for parsing and deduplication

---

### Issue #4: [PERSISTENCE] Add localStorage for feeds and configuration
**Labels**: `enhancement`, `high`, `ux`  
**Estimate**: 0.5-1 day

**Description**:
Feed list and selections are lost on refresh. No run history.

**Tasks**:
- [ ] Persist `feeds[]` in localStorage with auto-sync
- [ ] Save last date selection, recent articles, app state
- [ ] Add "Reset to default feeds" button
- [ ] Optional: Implement JSON export/import for config

---

### Issue #5: [AI] Implement batching and caching for AI calls
**Labels**: `enhancement`, `high`, `optimization`, `cost`  
**Estimate**: 1-2 days

**Description**:
Single large Gemini calls can timeout or be costly. No caching mechanism.

**Tasks**:
- [ ] Batch requests in chunks of 15-20 articles max
- [ ] Implement LRU cache (server-side or Redis) for classification results (24h TTL)
- [ ] Track usage metrics (tokens, latency, estimated cost)
- [ ] Implement fallback to "Autre" category if Gemini fails
- [ ] Add basic metrics dashboard

---

## 🟡 MEDIUM PRIORITY

### Issue #6: [TESTING] Add unit tests and CI/CD pipeline
**Labels**: `testing`, `ci-cd`, `medium`  
**Estimate**: 2-3 days

**Description**:
No tests = high regression risk. No automated validation.

**Tasks**:
- [ ] Install Jest + React Testing Library + Vitest
- [ ] Unit tests for `rssService`, `geminiService`, components
- [ ] Integration tests for API endpoints
- [ ] GitHub Actions: lint, tests, build, deploy preview
- [ ] Aim for >60% coverage
- [ ] Add status badge to README

---

### Issue #7: [UX] Improve error handling with toast notifications
**Labels**: `ux`, `medium`, `error-handling`  
**Estimate**: 1 day

**Description**:
Inconsistent error messages, no retry UI, intrusive alerts.

**Tasks**:
- [ ] Implement toast notifications (react-hot-toast or sonner)
- [ ] Centralize error handling (custom `useErrorHandler` hook)
- [ ] Add "Retry" buttons for temporary errors
- [ ] Server-side logging (Winston or Pino)
- [ ] Optional: Add Sentry for monitoring

---

### Issue #8: [PERFORMANCE] Optimize performance and accessibility
**Labels**: `performance`, `a11y`, `medium`  
**Estimate**: 1-2 days

**Description**:
No lazy loading, animations may cause motion sickness, limited accessibility.

**Tasks**:
- [ ] Lazy load components (React.lazy) and images
- [ ] Add `prefers-reduced-motion` support
- [ ] A11y audit: ARIA labels, keyboard navigation, color contrast (WCAG AA)
- [ ] Optimize bundle: code splitting, tree shaking
- [ ] Lighthouse score >90

---

## 🟢 LOW PRIORITY (Future Features)

### Issue #9: [FEATURE] Advanced search and filters
**Estimate**: 1 day
- Full-text search (title + description)
- Multiple filters: source, custom date range, keywords
- Sort: relevance, date, source

---

### Issue #10: [FEATURE] Multi-format export (PDF, Markdown, JSON)
**Estimate**: 1 day
- Export podcast script as PDF/Markdown
- Export selected articles as JSON/CSV

---

### Issue #11: [FEATURE] Run history and analytics dashboard
**Estimate**: 2-3 days
- Save run history (SQLite/Postgres/Supabase)
- Analytics dashboard: processed articles, popular categories, active sources
- Trend charts (Chart.js or Recharts)

---

### Issue #12: [FEATURE] Internationalization (i18n)
**Estimate**: 1 day
- Integrate react-i18next
- FR/EN translations for UI and categories
- Auto locale detection

---

### Issue #13: [FEATURE] Light/dark theme toggle
**Estimate**: 0.5 day
- Add light theme
- Save user preference
- Optional custom themes

---

### Issue #14: [FEATURE] PWA with offline mode
**Estimate**: 1-2 days
- Add manifest.json, service worker
- Cache articles offline
- Background sync

---

### Issue #15: [FEATURE] Automatic scheduler and webhooks
**Estimate**: 1-2 days
- Cron job for daily scrapes
- Webhook notifications (Slack, Discord, email)

---

## Quick Commands to Create Issues

```bash
# Install GitHub CLI if needed
# winget install GitHub.cli

# Create issues (run from repo root)
gh issue create --title "[SECURITY] Migrate Gemini API calls to backend" --body "See ISSUES.md #1" --label "security,critical,backend"
gh issue create --title "[CONFIG] Normalize environment variables and build setup" --body "See ISSUES.md #2" --label "configuration,critical,dx"
gh issue create --title "[RSS] Improve RSS fetching reliability" --body "See ISSUES.md #3" --label "enhancement,high,performance"
gh issue create --title "[PERSISTENCE] Add localStorage for feeds and configuration" --body "See ISSUES.md #4" --label "enhancement,high,ux"
gh issue create --title "[AI] Implement batching and caching for AI calls" --body "See ISSUES.md #5" --label "enhancement,high,optimization,cost"
gh issue create --title "[TESTING] Add unit tests and CI/CD pipeline" --body "See ISSUES.md #6" --label "testing,ci-cd,medium"
gh issue create --title "[UX] Improve error handling with toast notifications" --body "See ISSUES.md #7" --label "ux,medium,error-handling"
gh issue create --title "[PERFORMANCE] Optimize performance and accessibility" --body "See ISSUES.md #8" --label "performance,a11y,medium"
```
