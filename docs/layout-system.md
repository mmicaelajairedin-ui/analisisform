# Layout System — DESIGN PHASE B (Standardization)

Single source of truth for layouts across all Pathway pages. All spacing, alignment, and responsive patterns derive from tokens in `pw-design-tokens.css`.

## Core Principle

**Tokens first, utility classes second, inline styles never.** If you're adding `style="..."` to an element, that's a code smell — use the appropriate token or utility class instead.

## Token Categories

### Spacing (8px base grid)

All spacing values are multiples of 8px for vertical rhythm and alignment:

- `--pw-space-xs`: 4px (micro)
- `--pw-space-sm`: 8px (base)
- `--pw-space-md`: 12px (small)
- `--pw-space-lg`: 16px (medium)
- `--pw-space-xl`: 24px (large)
- `--pw-space-2xl`: 32px (extra large)
- `--pw-space-3xl`: 48px (massive)

### Padding Shortcuts

Canonical padding values for common components:

- `--pw-pad-card`: 20px (card body padding)
- `--pw-pad-section`: 18px (section padding)
- `--pw-pad-sidebar`: 16px 12px (sidebar horizontal × vertical)

### Gaps (element-to-element spacing)

- `--pw-gap-cards`: 14px (grid card spacing)
- `--pw-gap-section`: 13px (container/flex gap)

### Layout Dimensions (DO NOT CHANGE)

These are architectural; changing them breaks the entire layout:

- `--pw-sidebar-width`: 248px (main sidebar)
- `--pw-sidebar-width-collapsed`: 80px (mobile/collapsed)
- `--pw-container-max`: 1200px (max content width)
- `--pw-container-narrow-max`: 760px (narrow/modal width)

### Breakpoints

Responsive behavior is tied to these hard breakpoints:

- `--pw-break-mobile`: 760px (≤ mobile)
- `--pw-break-tablet`: 900px (tablet)
- `--pw-break-wide`: 1024px (wide desktop)
- `--pw-break-xl`: 1280px (extra wide)

## Utility Classes

Pre-built layout patterns, imported from `pw-design-tokens.css`. Use these instead of writing custom CSS.

### Containers

```html
<!-- Max-width + centered -->
<div class="pw-container">content</div>

<!-- Narrow (e.g., modals, forms) -->
<div class="pw-container pw-container--narrow">content</div>

<!-- No horizontal padding -->
<div class="pw-container pw-container--no-pad">content</div>
```

### Spacing

```html
<!-- Padding shortcuts -->
<div class="pw-p-card">padded card</div>
<div class="pw-px-md pw-py-lg">custom padding</div>

<!-- Gap utilities -->
<div class="pw-flex pw-gap-lg">items with 24px gap</div>
```

### Flexbox

```html
<!-- Flex with automatic spacing between items -->
<div class="pw-flex">
  <span>Left</span>
  <span>Right</span>
</div>

<!-- Flex column (vertical stack) -->
<div class="pw-flex pw-flex--col">
  <span>Item 1</span>
  <span>Item 2</span>
</div>

<!-- Flex with centered content -->
<div class="pw-flex pw-flex--center">centered</div>

<!-- Flex wrapping on small screens -->
<div class="pw-flex pw-flex--wrap pw-gap-md">items</div>
```

### Grid Patterns

```html
<!-- Auto-fill grid (responsive card grid) -->
<div class="pw-grid pw-grid--auto">
  <div class="pw-card">Card 1</div>
  <div class="pw-card">Card 2</div>
</div>

<!-- Fixed column counts -->
<div class="pw-grid pw-grid--cols-3">three columns</div>
<div class="pw-grid pw-grid--cols-2">two columns</div>

<!-- Sidebar + main layout -->
<div class="pw-grid pw-grid--sidebar">
  <aside>sidebar (212px)</aside>
  <main>content (1fr)</main>
</div>
```

### Stacks (Semantic containers)

```html
<!-- Vertical stack with --pw-gap-section spacing -->
<div class="pw-stack">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Large gaps (--pw-space-xl) -->
<div class="pw-stack pw-stack--lg">items</div>

<!-- Small gaps (--pw-space-md) -->
<div class="pw-stack pw-stack--sm">items</div>
```

### App Shell (Full-height layouts)

```html
<!-- Sidebar + main app layout -->
<div class="pw-app">
  <aside>sidebar</aside>
  <div class="pw-main">
    <header>top bar</header>
    <div class="pw-scroll">
      <!-- scrollable content -->
    </div>
  </div>
</div>

<!-- Full-width app (no sidebar) -->
<div class="pw-app pw-app--full-width">
  <div class="pw-main">...</div>
</div>
```

### Cards & Card Grids

```html
<!-- Card (semantic, applies card styling) -->
<div class="pw-card">content</div>

<!-- Grid of cards (auto-responsive) -->
<div class="pw-cards">
  <div class="pw-card">Card 1</div>
  <div class="pw-card">Card 2</div>
</div>

<!-- Dense card grid (smaller gaps) -->
<div class="pw-cards pw-cards--dense">items</div>
```

## Responsive Behavior

**Mobile-first:** design for mobile (≤760px) first, add breakpoints for larger screens.

### Breakpoint Usage

```css
/* Mobile (default) */
.element { grid-template-columns: 1fr; }

/* Tablet and up */
@media (min-width: 761px) {
  .element { grid-template-columns: 1fr 1fr; }
}

/* Desktop and up */
@media (min-width: 901px) {
  .element { grid-template-columns: repeat(3, 1fr); }
}
```

### Built-in Responsive Utilities

These utilities automatically adapt at breakpoints:

- `.pw-grid--auto` → 1-col mobile, auto-fill (290px+) desktop
- `.pw-grid--cols-3` → 2-col mobile, 3-col desktop
- `.pw-grid--cols-2` → 1-col mobile, 2-col desktop
- `.pw-grid--sidebar` → stacked mobile, sidebar layout desktop
- `.pw-scroll` → adjusted padding mobile vs. desktop

## Migration Checklist

When standardizing a page:

1. ✅ Replace hardcoded `padding:` with `.pw-p-*` utilities
2. ✅ Replace hardcoded `gap:` with `.pw-gap-*` utilities
3. ✅ Replace `<div style="display:grid; grid-template-columns:...">` with `.pw-grid--*` utilities
4. ✅ Replace custom flexbox with `.pw-flex` + `.pw-flex--*` utilities
5. ✅ Wrap content in `.pw-container` where needed (max-width centering)
6. ✅ Use `.pw-scroll` for scrollable regions
7. ✅ Use `.pw-cards` for card grids
8. ✅ Test responsive behavior at 760px, 900px, 1024px breakpoints

## Do's and Don'ts

### ✅ DO

```html
<!-- Use tokens in CSS variables -->
<div style="gap: var(--pw-gap-section);">items</div>

<!-- Use utility classes -->
<div class="pw-flex pw-gap-lg">items</div>

<!-- Use component-specific tokens -->
<div class="pw-card">content</div>

<!-- Responsive with media queries -->
<div style="grid-template-columns: 1fr;">
  @media (min-width: 761px) { grid-template-columns: 1fr 1fr; }
</div>
```

### ❌ DON'T

```html
<!-- Magic numbers -->
<div style="padding: 18px; gap: 14px;">NO</div>

<!-- Duplicated spacing values -->
<div style="padding: 18px;">
  <div style="padding: 18px;">nested same padding</div>
</div>

<!-- Inline breakpoints without tokens -->
<div style="max-width: 1200px;">no token</div>

<!-- Inconsistent sidebar widths -->
<aside style="width: 220px;">wrong width</aside>
```

## Files

- `pw-design-tokens.css` — Token definitions + utility classes
- `pathway-panel.css` — Panel-specific overrides (minimal)
- `pathway-portal.css` — Portal-specific overrides (minimal)
- `pw-icons.css` — Icon sizing (separate system)
- `docs/layout-system.md` — This file

## Validation

Run the layout audit:

```bash
node scripts/check-layout.js  # (pending: validates consistent token usage)
```

All changes pass `check-syntax.js`, `check-smoke.js`, `check-guardrails.js`, and `check-parity.js`.
