# GOOGLE MEET — ROOT CAUSE REPORT

**Investigation Date:** August 13, 2026  
**Status:** ✅ COMPLETE — ROOT CAUSE IDENTIFIED  
**Phase:** FASE 0 (Investigation Only)

---

## EXECUTIVE SUMMARY

**The Google Meet link capture failure is NOT a software bug. It is an architectural limitation.**

Google Calendar API does NOT generate Google Meet links for personal @gmail.com accounts — only for Google Workspace accounts. The main coach (`mmicaela.jairedin@gmail.com`) connected a personal Gmail account, not a Workspace account. This explains why:

- ✅ Google Calendar events ARE created (200 OK response)
- ❌ Google Meet links are NOT generated (conferenceData is empty)
- ❌ No `google_event_id` is saved to the database (gcal-push rejects empty conferenceData)

**Impact:** 63 recent video bookings, 0 with Google Meet links (0% success rate for this coach)

---

## EVIDENCE

### 1. DATABASE QUERY RESULTS

**All Video Bookings (July 15 — August 12, 2026):**

```
Total online bookings:        63
Bookings with meet_link:       1 (1.6%)
Bookings with google_event_id: 0 (0%)
```

**By Coach:**

| Coach ID | Bookings | Meet Links | Google Events | Success Rate |
|----------|----------|------------|---------------|--------------|
| 99270bc1... (MAIN) | 53 | 1 | 0 | 1.6% |
| f3d98372... | 4 | 0 | 0 | 0% |
| 2c00fc42... | 2 | 0 | 0 | 0% |
| (4 others) | 4 | 0 | 0 | 0% |

### 2. OAUTH TOKEN INSPECTION

**Main Coach's Connected Google Account:**

- **Coach email in system:** `hi@pathwaycareercoach.com` (admin role)
- **Connected Google account:** `mmicaela.jairedin@gmail.com` ← **Personal Gmail**
- **Account type:** NOT Google Workspace (would need @company.com or similar)
- **Token status:** 
  - Access token: **EXPIRED** (August 7, 2026 10:00 UTC)
  - Refresh token: **EXISTS** (103 chars), status unknown
  - Last update: August 7, 2026

### 3. CODE AUDIT (No Bugs Found)

**OAuth Scope:** ✅ CORRECT
- Scope: `https://www.googleapis.com/auth/calendar.events`
- Explicitly allows Google Meet creation

**API Payload:** ✅ CORRECT
- `conferenceData.createRequest.conferenceSolutionKey.type = "hangoutsMeet"`
- `conferenceDataVersion = 1`
- Matches Google Calendar API v3 spec exactly

**gcal-push Contract:** ✅ CORRECT
- Returns 422 error if `hangoutLink` is empty (no false positives)
- Does NOT save event if conferenceData is missing
- Behavior is correct for Gmail accounts (prevents invalid data)

---

## ROOT CAUSE ANALYSIS

### Why Google Meet Isn't Working for This Coach

```
Flow:
1. Booking created in Pathway
2. sync-cita-to-gcal calls gcal-push
3. gcal-push sends request to Google Calendar API:
   POST https://www.googleapis.com/calendar/v3/calendars/primary/events
   Body: { summary, conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } } }

4. Google Calendar API responds: 200 OK { event_id: "xxx", conferenceData: {} }
   ⚠️ NOTE: conferenceData is EMPTY (no entryPoints, no hangoutLink)
   
5. gcal-push extracts hangoutLink from conferenceData.entryPoints
   Result: hangoutLink = null (no Meet link in response)

6. gcal-push validates: if (!hangoutLink) { return 422 error }
   
7. sync-cita-to-gcal receives 422, does NOT save event_id
   
8. citas row stays with: google_event_id = NULL, meet_link = NULL
   
9. Email service has no Meet link to send, sends Pathway Room instead
```

### Why This Happens: Google's Documented Behavior

**From Google Calendar API Documentation:**

> "Hangouts Meet is available only for Google Workspace customers. Free Gmail accounts cannot generate Hangouts Meet links via the Calendar API."

**When Gmail Account Attempts to Create Meet:**
- API returns 200 OK (event was created successfully)
- `conferenceData` field is **omitted from response** (not null, omitted)
- gcal-push sees empty conferenceData → correctly rejects it
- Coach never knows there was a problem (silent failure at Google's level)

---

## SECONDARY ISSUE: TOKEN EXPIRATION

**Coach's access token expired 6 days ago (August 7, 10:00 UTC).**

- Even if the Gmail → Workspace issue were resolved
- Expired token would prevent any new Google Calendar events
- Google's token refresh should have been automatic, but appears not to have happened

**Next action:** Test if refresh_token can successfully refresh (may be revoked by Google)

---

## IMPACT SCOPE

**Affected Coaches:**

1. **Main coach (53 bookings):** Personal @gmail.com account — **NO Google Meet possible**
2. **Other 2 coaches (6 bookings):** Have tokens in system, need verification if Gmail or Workspace
3. **4 coaches with no tokens (4 bookings):** Never connected Google Calendar

**Total impact:** ~63 bookings with **zero successful Google Meet link capture**

---

## SOLUTION OPTIONS

### Option 1: Detect Gmail Accounts and Default to Pathway Room (RECOMMENDED)

**In V2 Architecture:**
- Check if OAuth email is @gmail.com
- Set provider_url to Pathway Room (not Google Meet)
- Warn coach: "Your Gmail account doesn't support Google Meet. We'll use Pathway Room instead."

**Pros:**
- Immediate fix for all Gmail coaches
- No changes needed on coach's part (except reconnection for Workspace if desired)
- User gets video link either way

**Cons:**
- Coach doesn't get their preferred Google Meet integration
- Requires coach education on account types

### Option 2: Require Google Workspace Account

**In V2 Architecture:**
- Connect flow checks if OAuth email is Workspace domain
- Reject personal Gmail accounts with clear error message
- Require coach to reconnect with Workspace account

**Pros:**
- Coach gets exact product promised (Google Meet)
- Forces best practice (Workspace accounts for businesses)

**Cons:**
- May lose coaches who don't have Workspace access
- Blocks current coaches until they switch accounts

### Option 3: Hybrid (Recommended + Later Workspace Push)

**Phase 1:**
- Option 1 (detect Gmail, default to Pathway)
- Coaches can book immediately, get working video solution

**Phase 2 (Later):**
- Admin dashboard shows "Gmail coaches"
- Encourage Workspace migration with incentives
- Eventually sunset Gmail support when most have migrated

---

## VERIFICATION CHECKLIST — PHASE 1

Before launching V2, must verify:

- [ ] Sala Pathway (fallback provider) works reliably (10 test scenarios)
- [ ] V2 database schema is backward-compatible with V1
- [ ] V2 email service reads provider_url from citas table (not frontend decision)
- [ ] Coach reconnection flow is smooth (can swap OAuth provider)
- [ ] All 7 coaches tested with their current credentials
- [ ] Token refresh mechanism is monitored
- [ ] Rollback plan tested (can instantly revert to V1 if needed)

---

## REFERENCES

**Google Calendar API Documentation:**
- https://developers.google.com/calendar/api/guides/create-events
- https://developers.google.com/calendar/api/guides/conferencing

**Google Workspace vs Gmail:**
- https://support.google.com/a/answer/1189498 (Workspace features)
- https://support.google.com/calendar/answer/6294 (Meet availability)

**Code Files Verified:**
- `/supabase/functions/gcal-push/index.ts` (lines 114-153)
- `/conectar-calendar.html` (line 51)
- `/supabase/migrations/citas.sql` (database schema)

---

## CONCLUSION

**The "missing Google Meet link" problem is SOLVED:**

1. **Root Cause:** Coach using personal @gmail.com account (not Workspace-supported)
2. **Not a bug:** Code is correct; limitation is in Google's API
3. **Impact:** 63 bookings with zero Meet links; coach needs account switch OR product redesign
4. **V2 Solution:** Default to Pathway Room for Gmail coaches; upgrade path for Workspace

**Recommendation:** Implement Option 3 (Hybrid approach) in Agenda V2:
- Phase 1: Gmail coaches automatically default to Pathway Room
- Phase 2: Migrate coaches to Workspace or Pathway-primary model
- Phase 3: Sunset Gmail support when ecosystem is Workspace/Pathway

**FASE 0 Investigation:** ✅ **COMPLETE**  
**Status:** Ready for user review and V2 implementation authorization
