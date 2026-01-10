# Visual Redesign Plan
## Surface-Driven Premium Interface

---

## Phase 1: Visual Audit

### Current Issues

**1. Button-Heavy Layout**
- Main grid: 6-9 outlined buttons with visible borders
- Header: 4 small outlined buttons in a row (cluttered)
- Notes header: 3 action buttons visible at all times
- Everything feels like "buttons" not "surfaces"

**2. Equal Visual Weight**
- Timer/status buried in header, small text
- All buttons look the same (no hierarchy)
- All header buttons have same prominence
- Notes actions compete with content

**3. Border Overload**
- Every button has `border: 1px solid`
- Section dividers (`border-top: 1px solid`)
- Note items have borders
- Modal headers/footers have borders
- Creates visual noise

**4. Density Issues**
- Header controls tightly packed (4 buttons in row)
- Button grid gaps are small (16px)
- Notes header has title + 3 buttons side-by-side
- Timer controls cramped (status, timecode, button)

**5. Pure Black Everywhere**
- Background is `#000000` (pure black)
- Feels harsh, not premium
- No layered depth perception

**6. Typography Hierarchy Issues**
- Timer is small (14px) and buried
- Status is tiny (11px)
- Buttons are medium (19px) but feel equal
- No clear "what matters most" signal

---

## Phase 2-4: Transformation Strategy

### New Visual Language

**Surface Layers:**
- Background: Soft dark gray (`#0a0a0a`) - subtle base
- Surface: Elevated card (`#111111`) - content containers
- Elevated Surface: Raised cards (`#151515`) - interactive areas
- Active Surface: Pressed state (`#1a1a1a`) - feedback

**Depth Instead of Borders:**
- Remove 90% of borders
- Use subtle shadows: `0 2px 8px rgba(0, 0, 0, 0.4)`
- Tonal elevation (background → surface → elevated)
- Soft shadows on cards: `0 4px 16px rgba(0, 0, 0, 0.5)`

**Typography Hierarchy:**
- Timer/Timecode: **Large (32px)**, prominent, primary anchor
- Status: **Medium (13px)**, secondary, quieter
- Card labels: **Medium (18px)**, confident but not shouting
- Notes content: **Base (15px)**, readable
- Meta text: **Small (12px)**, recedes

**Spacing Philosophy:**
- Double current spacing (16px → 32px for major sections)
- Generous card padding (24px-32px)
- Large gaps between cards (24px-32px)
- Let empty space exist

**Card-Based Surfaces:**
- Note buttons become **large cards** (not outlined buttons)
- Entire card is interactive surface
- Soft rounded corners (16px)
- Subtle elevation, no borders
- Hover: slight lift (shadow increase)
- Active: slight press (shadow decrease)

**Primary Visual Anchor:**
- Timer/Timecode becomes **hero element**
- Large, centered, at top (above cards)
- Status is secondary, smaller
- Start/Pause button is prominent but not primary

**Quieter Header:**
- Fewer visible buttons (maybe icon-based or grouped)
- Or: minimal text links instead of outlined buttons
- Screening name is prominent but calm
- Actions are available but don't shout

**Content-First Notes:**
- Remove "Notes" header (redundant)
- Remove action buttons from header (move to menu or bottom)
- Clean list of note cards
- Each note is a soft card, no borders
- Content is primary, chrome is minimal

---

## Implementation Plan

### Step 1: Surface System (CSS Tokens)
- Add surface layer tokens
- Soften background colors
- Create elevation system (shadow tokens)
- Remove border tokens (keep only where absolutely necessary)

### Step 2: Timer as Hero
- Large timecode display (32px+)
- Centered at top of main content
- Status as secondary indicator
- Start/Pause as clear but secondary action

### Step 3: Card-Based Button Grid
- Transform buttons to cards
- Remove all borders
- Increase spacing (32px gaps)
- Larger padding (32px-48px)
- Subtle elevation

### Step 4: Simplify Header
- Reduce button visibility (maybe icon buttons or minimal links)
- Larger screening name
- Quieter presence

### Step 5: Clean Notes List
- Remove notes header section
- Content-first note cards
- No borders, soft elevation
- Actions moved or hidden

---

## Success Metrics

✅ Timer/Timecode is immediately obvious and prominent
✅ Cards feel premium, not button-y
✅ Eye knows exactly where to look first
✅ Feels calm with generous spacing
✅ Would not look out of place next to modern iOS apps
✅ Dark theme feels sophisticated, not harsh
