# Environment Configuration — Project References & Validation

**Last updated:** 2026-08-08

## Valid Environments

### Production
- **Project Ref:** `ddxnrsnjdvtqhxunxnwj`
- **URL:** `https://api.pathwaycareercoach.com` (custom domain)
- **Domain:** pathwaycareercoach.com
- **Deployment:** Cloudflare Pages (auto-deploy from main)
- **Status:** Active

### Staging
- **Project Ref:** TBD (not yet configured)
- **URL:** TBD
- **Status:** PENDING

### Local Development
- **Project Ref:** Use local supabase instance or separate dev project
- **URL:** http://localhost:54321 (local) or <dev-project>.supabase.co
- **Status:** Developer choice

---

## Project Ref Allowlist

✅ **ALLOWED:**
- `ddxnrsnjdvtqhxunxnwj` (production)

❌ **BLOCKED (Regression Prevention):**
- `mzxgxkkgxvunpsiqbzxd` (ERR-ENV-001: incorrect/legacy project)

---

## Validation Strategy

### Frontend Commit
Each HTML page should inject the frontend_commit (git hash) for error correlation:
```html
<meta name="frontend-commit" content="COMMIT_HASH_HERE">
```

### Environment Detection
The frontend can detect environment from:
1. `window.location.hostname` (pathwaycareercoach.com = production)
2. Supabase URL from SUPABASE_URL env var (edge functions)
3. Fallback: assume production if running on custom domain

### Error Logging
When `upload_diagnostics` records an error, it captures:
- `environment` (production/staging/local/preview)
- `frontend_commit` (git hash from meta tag)
- `backend_commit` (from edge function deployment)
- `project_ref` (extracted from SUPABASE_URL)

### Guardrail (Fase 2)
Check that project_ref matches allowlist. If not, error is classified as ERR-ENV-001 (environment error) and flagged for investigation.

---

## How to Verify

**In production (pathwaycareercoach.com):**
```javascript
// Browser console
fetch('https://api.pathwaycareercoach.com/rest/v1/').then(r => console.log(r.status))
// Should return 200 (or 401 if unauthenticated, but endpoint exists)
```

**In logs/diagnostics:**
```sql
SELECT DISTINCT project_ref FROM upload_diagnostics 
WHERE ts > NOW() - INTERVAL '7 days'
ORDER BY project_ref;
```
Should only show `ddxnrsnjdvtqhxunxnwj`.

---

## Pending (Fase 2)

- [ ] Set up staging environment
- [ ] Configure allowlist validation in check-guardrails.js
- [ ] Add project_ref to upload_diagnostics schema
- [ ] Implement CI/CD check to prevent hardcoding legacy project refs
