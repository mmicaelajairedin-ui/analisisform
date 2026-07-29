# Branding System — DESIGN PHASE C (White-Label Implementation)

Coach-customizable brand colors applied to client-facing surfaces only. Platform chrome remains neutral for consistency across all coaches.

## Core Principle

**Neutral by default, branded on white-label surfaces.**

- **Chrome** (sidebar, buttons, panels, chat): Neutral colors (#EFE9DD, #ECE8DF, grays)
- **White-label** (client portal, public profile, coach branding): Coach's brand color via `--accent`

Why? If a coach sets brand color to red, the entire panel shouldn't turn red. Only the client-facing surfaces should reflect the coach's brand.

## Implementation

### 1. Token System (`pw-design-tokens.css`)

Default (neutral) tokens defined:

```css
:root {
  --accent: #2D6A4F;              /* Default Pathway green */
  --accent-dark: #1B4332;
  --accent-light: #E8F5EE;
  --brand: var(--accent);         /* Alias */
  --brand-soft: color-mix(...);
  /* ... etc */
}
```

### 2. White-Label Script (`pw-white-label.js`)

Inject coach's brand color at runtime:

```javascript
// Option A: Direct color
applyWhiteLabel('#8C7B80', 'Coach Name');

// Option B: From cache (faster)
_pwApplyBrandFromCache();

// Option C: From Supabase
const color = await _pwGetBrand(organizationId);
if (color) {
  applyWhiteLabel(color, 'Coach Name');
  _pwCacheBrandColor(color);  // Cache for next load
}
```

### 3. Integration Points

#### Client Portal (`cliente.html`)

```html
<script src="pw-white-label.js"></script>
<script>
  // Load brand on page load
  window._pwApplyBrandFromCache();
  
  // Fetch fresh color from Supabase
  (async () => {
    const orgId = localStorage.getItem('pw_org_id');
    const color = await _pwGetBrand(orgId);
    if (color) {
      applyWhiteLabel(color, 'Coach');
      _pwCacheBrandColor(color);
    }
  })();
</script>
```

#### Public Profile (`perfil-publico.html`)

```html
<script src="pw-white-label.js"></script>
<script>
  // Brand color passed via URL param or meta tag
  const color = new URLSearchParams(window.location.search).get('brand');
  if (color) applyWhiteLabel(color);
</script>
```

### 4. CSS Scope (What Gets Branded)

**White-label surfaces** (apply brand color):
- Client portal buttons, links, accents
- Public profile hero, badges
- Coach branding section
- Coach public name/title highlighting

**Neutral surfaces** (stay neutral):
- Coach panel sidebar (dark gradient)
- Panel buttons (use `--pw-bosque` fixed or neutral)
- Chat bubbles (crema/white)
- Cards and containers (white/neutral background)
- Icons and borders (neutral gray)

**Rule of thumb:** If it's something the client sees and the coach can customize, it's white-label. If it's platform chrome that affects all coaches equally, it stays neutral.

### 5. Database Integration

Store coach brand in `organizaciones` table:

```sql
ALTER TABLE organizaciones ADD COLUMN marca JSONB DEFAULT NULL;
-- Example: {"color": "#8C7B80", "name": "Coach Name"}
```

Query:
```javascript
const resp = await sbGet('organizaciones?id=eq.ORG_ID&select=marca');
const brandColor = resp[0]?.marca?.color;
```

## Color Derivation

The white-label script auto-generates color variants:

```
Input: #8C7B80 (coach color)
  ↓
--accent: #8C7B80
--accent-dark: #5C4B60 (30% darker)
--accent-light: #E5D9E1 (85% lighter)
--accent-soft: #F1E8F0 (92% lighter)
--brand-100: #F0E6ED (86% lighter)
--brand-border: #D9CCDA (76% lighter)
```

Automatic derivation ensures consistency without manual color math.

## Usage Patterns

### Pattern 1: Instant Load (Cached)

```javascript
// Fastest: no API call, instant branding
_pwApplyBrandFromCache();

// Then refresh from server
const color = await _pwGetBrand(orgId);
if (color && color !== localStorage.getItem('pw_brand_color')) {
  applyWhiteLabel(color);
  _pwCacheBrandColor(color);
}
```

### Pattern 2: Conditional Branding

```javascript
// Only brand if coach has Pro plan
if (coach.plan === 'pro') {
  applyWhiteLabel(coach.brandColor);
} else {
  // Basic plan: stay with default Pathway green
}
```

### Pattern 3: Multi-Coach Network

Each coach in a network keeps their own brand:

```javascript
// Multicoach: apply brand for the current network owner
const owner = await getNetworkOwner();
const brandColor = owner.marca?.color;
if (brandColor) applyWhiteLabel(brandColor);
```

## Fallback & Error Handling

If brand color fails or is invalid:

1. Invalid color format → Logged to console, no CSS injected
2. API error → Use cached color, fall back to default green
3. No data → Use default green (Pathway brand)

```javascript
// Safe application
const color = await _pwGetBrand(orgId);
if (color && isValidColor(color)) {
  applyWhiteLabel(color);
} else {
  console.warn('Branding failed, using default');
  // Page renders with default --accent (green)
}
```

## Design Checklist

When adding a new white-label element:

1. ✅ Use `--accent` (or `--brand`, `--rose`) for the color
2. ✅ Test with default green (Pathway)
3. ✅ Test with a custom color (e.g., red, blue, purple)
4. ✅ Ensure contrast ratio ≥ 4.5:1 (WCAG AA)
5. ✅ Verify hover states work (use `--accent-dark`)
6. ✅ Check dark mode if applicable

### Bad Example ❌

```css
/* Hardcoded color — can't be branded */
.btn { background: #2D6A4F; }
```

### Good Example ✅

```css
/* Uses token — will brand automatically */
.btn { background: var(--accent); }
.btn:hover { background: var(--accent-dark); }
```

## Testing

### Manual Test

1. Open DevTools (F12)
2. Run: `applyWhiteLabel('#FF0000', 'Red Coach')`
3. Check that accent elements turn red
4. Verify chrome (sidebar, panels) stays neutral
5. Check localStorage: `localStorage.getItem('pw_brand_color')`

### Automated Test (check-branding.js — pending)

```bash
node scripts/check-branding.js
# Verifies:
# - --accent used in white-label elements only
# - No hardcoded brand colors in chrome elements
# - pw-white-label.js loaded in correct pages
# - Contrast ratios meet WCAG standards
```

## Common Mistakes

### ❌ Branding the Sidebar

```css
.cp-side { background: var(--accent); } /* WRONG */
```

Sidebar is platform chrome, should stay dark/neutral.

### ❌ Branding Chat Bubbles

```css
.pw-msg-me { background: var(--accent); } /* WRONG */
```

Chat is neutral (crema). Only client portal buttons/accents brand.

### ❌ Hardcoded Colors

```css
.btn { background: #2D6A4F; } /* WRONG */
```

Use token so it can be overridden: `var(--accent)`.

### ✅ Correct: White-Label Portal Button

```css
.btn-primary { background: var(--accent); }
.btn-primary:hover { background: var(--accent-dark); }
```

Client sees their brand color. Chrome stays neutral.

## File Locations

- `pw-white-label.js` — Branding injection script
- `pw-design-tokens.css` — Default tokens + utility classes
- `docs/branding-system.md` — This file
- Database: `organizaciones.marca` (JSONB with `color` key)
- Pages using it: `cliente.html`, `perfil-publico.html` (and public portals)

## Roadmap

- [x] Token system (default neutral colors)
- [x] White-label script (color injection)
- [x] Documentation
- [ ] Guardrail validation (check-branding.js)
- [ ] Coach brand editor UI (in panel-v2)
- [ ] Pro plan lock (branding only for Pro coaches)
