# Test Plan: Personal Agenda Feature (Sprint 5.2.3)

## Feature Overview
When a MultiCoach owner clicks on a coach in the "Equipo" section and selects "Agenda", they should see that coach's personal agenda with real session data from Supabase.

## Prerequisites
- [ ] User is logged in as a MultiCoach owner (role = 'owner')
- [ ] Organization is loaded (MC_ORG is not null)
- [ ] Real coaches exist in the database (DB.coaches has entries)
- [ ] Real sessions are recorded in `sesiones_registro` for those coaches
- [ ] Supabase API is accessible at https://api.pathwaycareercoach.com

## Test Cases

### 1. Navigation Flow
**Objective:** Verify that clicking on a coach's "Agenda" button correctly navigates to Personal Agenda view

**Steps:**
1. Log in to MultiCoach as an owner
2. Click on "Equipo" in the sidebar
3. Click on any coach in the equipo drawer
4. Verify the coach drawer opens with coach details
5. Click "Agenda" button in the drawer
6. **Expected Result:**
   - [ ] Drawer closes
   - [ ] Navigates to "agenda" section
   - [ ] MC_AGENDA_COACH_ID should be set to coach's id
   - [ ] MC_AGENDA_COACH_NAME should be set to coach's name
   - [ ] MC_AGENDA_COACH_DATA should contain coach's full data

### 2. Personal Agenda Header Display
**Objective:** Verify that the coach's information is displayed in the agenda header

**Steps:**
1. From Personal Agenda view (after navigation)
2. Look at the top of the page
3. **Expected Result:**
   - [ ] Coach's name is visible
   - [ ] Coach's photo/avatar displays (if available)
   - [ ] Coach's specialty badge shows
   - [ ] Coach's status (Active/Inactive) shows with color
   - [ ] Coach's email is displayed
   - [ ] Number of clients is shown

### 3. Breadcrumb Navigation
**Objective:** Verify breadcrumb functionality for returning to team agenda

**Steps:**
1. From Personal Agenda view
2. Look for breadcrumb at top: "← Volver al Equipo · Agenda de [CoachName]"
3. Click "Volver al Equipo" button
4. **Expected Result:**
   - [ ] Returns to team agenda view
   - [ ] MC_AGENDA_COACH_ID is cleared
   - [ ] MC_AGENDA_COACH_NAME is cleared
   - [ ] MC_AGENDA_COACH_DATA is cleared
   - [ ] Displays full team agenda, not coach-specific

### 4. Session Data Display
**Objective:** Verify that real sessions from Supabase are displayed

**Steps:**
1. From Personal Agenda view
2. Check that sessions are displayed
3. **Expected Result:**
   - [ ] Only shows sessions for the selected coach (filtered by coach_id)
   - [ ] Does NOT show sessions from other coaches
   - [ ] Sessions appear in the agenda calendar or list view
   - [ ] Session details are readable (client name, time, type)

### 5. Data Filtering Verification
**Objective:** Verify that filtering by coach_id works correctly

**Steps:**
1. Note which coach you're viewing (e.g., "Coach A")
2. Check a session's details (client name, date, time)
3. Switch to team agenda view (Volver al Equipo)
4. Navigate to a different coach's personal agenda (e.g., "Coach B")
5. **Expected Result:**
   - [ ] Coach B's sessions are completely different from Coach A's
   - [ ] No sessions from Coach A appear in Coach B's view
   - [ ] Data is correctly isolated per coach

### 6. Multiple Coach Test
**Objective:** Verify the feature works consistently with multiple coaches

**Steps:**
1. Test with Coach A (run Test Cases 1-5)
2. Return to team agenda
3. Test with Coach B (repeat Test Cases 1-5)
4. Test with Coach C if available
5. **Expected Result:**
   - [ ] Each coach shows their own unique sessions
   - [ ] Navigation and breadcrumb work for all coaches
   - [ ] No data leakage between coaches

### 7. Edge Cases

#### 7.1 Coach with No Sessions
**Steps:**
1. Find a coach with no recorded sessions
2. Navigate to their Personal Agenda
3. **Expected Result:**
   - [ ] Shows "Sin sesiones" or empty state
   - [ ] Header still displays coach information
   - [ ] No errors in console
   - [ ] "Volver al Equipo" button still works

#### 7.2 Inactive Coach
**Steps:**
1. If available, navigate to an inactive coach's agenda
2. **Expected Result:**
   - [ ] Status badge shows "Inactivo"
   - [ ] Badge has different color (red/gray)
   - [ ] Can still view their data

#### 7.3 Coach with Many Sessions
**Steps:**
1. Find a coach with many sessions (10+)
2. Navigate to their Personal Agenda
3. **Expected Result:**
   - [ ] All sessions load without errors
   - [ ] Page remains responsive
   - [ ] Scrolling works smoothly
   - [ ] No missing sessions

### 8. Browser Console
**Objective:** Verify no errors occur during operation

**Steps:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Repeat Test Cases 1-7
4. **Expected Result:**
   - [ ] No JavaScript errors (red X's)
   - [ ] No warnings related to agenda or coaches
   - [ ] Debug logs show correct mode: "[AGENDA-PERSONAL] Mode: viewing [CoachName]"

### 9. Performance
**Objective:** Verify the feature performs well

**Steps:**
1. Navigate between multiple coaches quickly (5+ times)
2. Note load times
3. **Expected Result:**
   - [ ] Navigation is responsive (< 500ms)
   - [ ] Data loads without significant delay
   - [ ] No memory leaks (repeated navigations don't slow down)

### 10. Responsive Design
**Objective:** Verify feature works on different screen sizes

**Steps:**
1. Test on desktop (1920x1080)
2. Test on tablet (1024x768)
3. Test on mobile (375x667)
4. **Expected Result:**
   - [ ] Layout is readable on all sizes
   - [ ] Buttons are clickable on mobile
   - [ ] Header info is visible
   - [ ] No horizontal scrolling needed

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Navigation Flow | [ ] PASS [ ] FAIL | |
| 2. Header Display | [ ] PASS [ ] FAIL | |
| 3. Breadcrumb | [ ] PASS [ ] FAIL | |
| 4. Session Data | [ ] PASS [ ] FAIL | |
| 5. Data Filtering | [ ] PASS [ ] FAIL | |
| 6. Multiple Coaches | [ ] PASS [ ] FAIL | |
| 7. Edge Cases | [ ] PASS [ ] FAIL | |
| 8. Console | [ ] PASS [ ] FAIL | |
| 9. Performance | [ ] PASS [ ] FAIL | |
| 10. Responsive | [ ] PASS [ ] FAIL | |

## Known Issues / Deferred

- [ ] Calendar integration for date-based filtering (deferred to Phase 2)
- [ ] Custom availability display based on org config (basic version uses defaults)
- [ ] Real-time updates via Supabase subscription (may need refinement)

## Key Code Locations

| Component | File | Line |
|-----------|------|------|
| Navigation trigger | multicoach.html | 4115 (_equipoVerAgenda) |
| Context variables | multicoach.html | 1957-1958 (MC_AGENDA_COACH_*) |
| Agenda renderer | multicoach.html | 6648 (renderAgenda) |
| Header component | multicoach.html | 6614 (_renderPersonalAgendaHeader) |
| Breadcrumb | multicoach.html | 6804-6810 |
| Personal agenda detection | multicoach.html | 6654 (inPersonalAgendaMode) |
| Coach filtering | multicoach.html | 6669-6674 |
| Data clearing | multicoach.html | 1993-1997 |

## Verification Checklist

Before marking as COMPLETE:
- [ ] All 10 test cases pass
- [ ] No console errors
- [ ] Data isolation verified
- [ ] Multiple coaches tested
- [ ] Edge cases handled
- [ ] Responsive design verified
- [ ] Performance acceptable
- [ ] No data leaks between coaches
