# UI Overhaul Plan
## Screening Notes — Premium Redesign

---

## Phase 1: Audit & UX Diagnosis

### Primary User Flows (Top 3 Tasks)

1. **Flow 1: Setup & Start Screening**
   - Open app → Setup modal (name + genre) → Start Screening
   - **Pain Points**: Modal not at top, cramped, keyboard covers button

2. **Flow 2: Take Notes During Screening**
   - Start timer → Tap note buttons → View notes list → Edit notes
   - **Pain Points**: None critical; could be more refined

3. **Flow 3: Export & Manage**
   - Export notes → Share/Email → View history → Load past sessions
   - **Pain Points**: Export modal has 6 buttons, could be better organized

### Key Screens & Components

**Main App Screen:**
- Header (screening name, controls, dim slider, timer)
- Main content (note buttons grid)
- Notes section (list + actions)

**Modals (7 total):**
1. Setup (name input, genre selection)
2. Settings/Customize (button labels)
3. Export (6 actions)
4. History/Sessions (list view)
5. Edit Note (context input)
6. Other Note (custom note input)
7. Confirmation (yes/no)

### Visual Inconsistencies

**Spacing:**
- Inconsistent gaps: 8px, 10px, 12px, 14px, 16px, 20px, 24px
- No systematic spacing scale
- Header padding: 12px 16px (should be 16px 20px)
- Modal padding varies wildly (6px-20px)

**Typography:**
- Font sizes scattered: 10px, 11px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 22px
- No clear type scale
- Font weights: 400, 500, 600 (inconsistent)
- Line heights not explicitly set

**Colors:**
- Hard-coded hex values throughout (#0a0a0a, #111111, #151515, #1a1a1a, #222222, #2a2a2a, #333333)
- No color tokens/system
- Status colors: #4a9eff (running), #ffaa4a (paused) - hard-coded
- Danger: #ff6b6b - hard-coded

**Borders & Radii:**
- Border radius: 4px, 6px, 8px, 10px, 12px (inconsistent)
- Border widths: 1px, 2px (inconsistent)
- Border colors: #222222, #2a2a2a, #333333 (no system)

### Interaction Problems

**Button States:**
- Only `:active` states defined
- No `:hover` states (desktop users)
- No `:focus-visible` states (keyboard navigation)
- No disabled states visually distinct

**Focus Management:**
- No visible focus indicators
- Keyboard navigation not optimized
- Modal focus trapping not implemented

**Modal Behavior:**
- Setup modal positioning issues (keyboard covers)
- Modal backdrop click closes all but setup (inconsistent)
- Modal stacking/z-index issues

### Accessibility Issues

**Critical:**
- No visible focus rings (WCAG failure)
- Color contrast may fail on some text (#888888 on #0a0a0a = 4.8:1, needs 4.5:1+)
- No ARIA labels on icon buttons (×, +, remove)
- Modal dialogs lack proper ARIA roles
- Input fields lack proper labels (placeholder-only)

**Moderate:**
- Touch targets meet 44px minimum (good)
- But small buttons (12px font) could be larger
- No skip links for keyboard navigation

### Mobile-Specific Issues

**Layout:**
- Header controls wrap awkwardly
- Dim slider triangle track may be too subtle on small screens
- Modal max-widths may be too narrow on tablets

**Touch:**
- All targets are adequate (44px+)
- But button gaps (8-12px) may cause mis-taps

### Current Strengths (Keep)

✅ Dark theme is solid foundation
✅ Large tap targets for main buttons
✅ Minimal animations (appropriate for theater)
✅ PWA functionality works
✅ Service worker handles offline
✅ No framework dependencies

---

## Phase 2: Design System (Proposed)

### CSS Variables Structure

```css
:root {
  /* Colors - Backgrounds */
  --bg-base: #000000;
  --bg-elevated: #0a0a0a;
  --bg-surface: #111111;
  --bg-surface-2: #151515;
  --bg-surface-3: #1a1a1a;
  
  /* Colors - Text */
  --text-primary: #ffffff;
  --text-secondary: #e0e0e0;
  --text-tertiary: #aaaaaa;
  --text-quaternary: #888888;
  
  /* Colors - Semantic */
  --accent-primary: #4a9eff;
  --accent-warning: #ffaa4a;
  --accent-danger: #ff6b6b;
  --accent-success: #4ade80;
  
  /* Colors - Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.20);
  
  /* Spacing Scale (8px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Typography Scale */
  --font-xs: 11px;
  --font-sm: 13px;
  --font-base: 15px;
  --font-md: 17px;
  --font-lg: 19px;
  --font-xl: 21px;
  --font-2xl: 24px;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;
  
  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* Shadows (subtle) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.5);
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Typography Hierarchy

- **Page Title**: 19px, semibold, --text-primary
- **Section Header**: 15px, medium, --text-secondary
- **Body**: 15px, normal, --text-secondary
- **Meta/Secondary**: 13px, normal, --text-tertiary
- **Caption**: 11px, normal, --text-quaternary

---

## Phase 3: Core UI Primitives (Refactor Plan)

### Buttons

**Current Issues:**
- `.btn-primary`, `.btn-small`, `.btn-danger` - inconsistent naming
- No focus states
- Active states are subtle but OK

**Proposed:**
```css
.btn {
  /* Base styles */
}
.btn--primary { }
.btn--secondary { }
.btn--tertiary { }
.btn--danger { }
.btn--size-sm { }
.btn--size-md { }
.btn--size-lg { }
```

### Inputs

**Current Issues:**
- `.input-text`, `.input-select` - basic but functional
- Missing focus states
- Placeholder-only labels (accessibility)

**Proposed:**
- Always visible labels
- Clear focus rings
- Better placeholder styling

### Cards/Panels

**Current:**
- `.modal-content`, `.note-item`, `.session-item` - functional but inconsistent

**Proposed:**
- Unified `.card` component
- Consistent padding/spacing
- Subtle elevation

### Modals

**Current Issues:**
- Multiple modal variations (`.modal-setup`, `.modal-small`)
- Inconsistent padding
- Positioning problems

**Proposed:**
- Single `.modal` component
- Consistent structure
- Better positioning system

---

## Implementation Milestones

### Milestone 1: Design Tokens + Typography + Buttons
**Goal**: Foundation system in place
**Changes:**
- Add CSS variables to `:root`
- Refactor typography to use tokens
- Standardize button components
- Add focus states
**Files**: `styles.css`
**Risk**: Low - only styling changes
**Time**: ~30min

### Milestone 2: Layout & Spacing Refinement
**Goal**: Consistent spacing and visual hierarchy
**Changes:**
- Apply spacing scale throughout
- Refine header layout
- Improve modal padding/spacing
- Better button grid spacing
**Files**: `styles.css`
**Risk**: Low - visual only
**Time**: ~30min

### Milestone 3: Components & Accessibility
**Goal**: Polished, accessible components
**Changes:**
- Refactor modals for consistency
- Add ARIA labels
- Improve focus management
- Better input labeling
- Fix contrast issues
**Files**: `index.html`, `styles.css`, `app.js`
**Risk**: Medium - requires HTML/JS changes
**Time**: ~45min

---

## What Will Change

### Visual Design
- ✅ **Spacing**: Systematic 8px-based scale
- ✅ **Typography**: Clear hierarchy, consistent sizes
- ✅ **Colors**: Token-based system
- ✅ **Borders**: Unified radius and width system
- ✅ **Shadows**: Subtle elevation for depth

### Components
- ✅ **Buttons**: Consistent variants, proper states
- ✅ **Inputs**: Always-visible labels, focus states
- ✅ **Modals**: Unified component, better positioning
- ✅ **Cards**: Consistent panel styling

### UX Improvements
- ✅ **Header**: Better organization, clearer hierarchy
- ✅ **Setup Modal**: Proper top positioning, better sizing
- ✅ **Export Modal**: Consider grouping or secondary actions
- ✅ **Notes List**: More refined spacing and typography

### Accessibility
- ✅ **Focus**: Visible focus rings everywhere
- ✅ **Labels**: Proper `<label>` elements
- ✅ **ARIA**: Modal roles, button labels
- ✅ **Contrast**: Ensure WCAG AA compliance

---

## What Will Remain Untouched

- ✅ **Core functionality**: All features work as-is
- ✅ **PWA behavior**: Service worker, manifest unchanged
- ✅ **State management**: localStorage structure unchanged
- ✅ **JavaScript logic**: Only minor cleanup, no rewrites
- ✅ **Dark theme**: Enhanced but same aesthetic direction
- ✅ **Dim overlay**: Custom slider design preserved

---

## Risks & Edge Cases

**Risk 1: Breaking existing styles**
- **Mitigation**: Use CSS variables with fallbacks, test incrementally
- **Impact**: Low - we're enhancing, not rewriting

**Risk 2: Modal positioning on different devices**
- **Mitigation**: Test on multiple screen sizes, use safe-area-inset properly
- **Impact**: Medium - this has been an issue before

**Risk 3: Color contrast issues**
- **Mitigation**: Test with contrast checker, adjust if needed
- **Impact**: Low - we're improving, not worsening

**Risk 4: Touch target sizes**
- **Mitigation**: Ensure all interactive elements meet 44px minimum
- **Impact**: Low - current targets are already good

---

## Files to Modify/Create

### Existing Files (Modify)
1. `styles.css` - Complete refactor with design tokens
2. `index.html` - Add ARIA labels, semantic improvements
3. `app.js` - Minor cleanup, focus management

### No New Files Needed
- All changes fit within existing structure

---

## Success Criteria

✅ Mobile / tablet / desktop verified
✅ Keyboard navigation verified (Tab, Enter, Escape)
✅ Dark theme verified (maintains theater aesthetic)
✅ Offline/PWA behavior intact
✅ Visual consistency across app
✅ WCAG AA contrast ratios met
✅ All interactive elements have focus states
✅ Touch targets 44px+ maintained

---

## Before/After Rationale

### Typography Improvements
**Before**: Inconsistent sizes, no clear hierarchy
**After**: Systematic scale, clear information hierarchy
**Why**: Makes scanning easier, feels more professional

### Spacing Improvements
**Before**: Random spacing values, cramped in places
**After**: 8px-based scale, breathing room
**Why**: Reduces visual noise, improves readability

### Color System
**Before**: Hard-coded hex values scattered
**After**: Centralized tokens, easy to adjust
**Why**: Maintainability, consistency, easier theming

### Component Consistency
**Before**: Similar components styled differently
**After**: Unified patterns, clear variants
**Why**: Reduces cognitive load, faster to understand

### Accessibility
**Before**: Missing focus states, placeholder-only labels
**After**: Full keyboard navigation, proper labels
**Why**: Legal/compliance, broader user base, better UX

---

## Next Steps

1. ✅ Create this plan (done)
2. Implement Milestone 1 (Design Tokens + Typography + Buttons)
3. Test and iterate
4. Implement Milestone 2 (Layout & Spacing)
5. Test and iterate
6. Implement Milestone 3 (Components & Accessibility)
7. Final verification and polish
