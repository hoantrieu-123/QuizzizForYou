---
name: Lumina Academic
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#00505f'
  on-tertiary: '#ffffff'
  tertiary-container: '#006a7c'
  on-tertiary-container: '#93e8ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system expresses a focused, high-precision academic environment engineered for modern educators, institutional administrators, and students. The interface bridges the gap between deep analytical capability and cognitive calm, rejecting clutter in favor of scannable, high-legibility workspaces. 

The aesthetic is Modern Corporate with subtle tactile depth: crisp slate canvases, luminous indigo-violet focal points, hyper-legible geometric typography, and gentle elevation layers. The visual tone feels authoritative yet approachable, eliminating cognitive fatigue during prolonged assessment authoring, high-stakes proctored testing, and granular cohort performance analysis.

## Colors

The palette balances clean slate foundations with intense optical accents:

- **Canvas & Surfaces:** Grounded on a calibrated background of `#F8FAFC` (Slate 50), with pure white `#FFFFFF` for primary elevated containers and cards. Muted panels leverage `#F1F5F9` (Slate 100).
- **Primary & Accent:** Primary actions, key indicators, and navigational active states use deep indigo (`#4F46E5`). The violet accent (`#7C3AED`) brings energy to secondary interactive items, rich badges, and highlighted metrics. A crisp electric cyan (`#06B6D4`) serves as an auxiliary tertiary for analytics highlights, data progress paths, and active timers.
- **Neutrals & Text:** Deep Slate (`#0F172A`) drives high-contrast headings and primary labels. Body text rests at `#334155` (Slate 700), with secondary metadata anchored in `#64748B` (Slate 500). Border boundaries use whisper-quiet slate tones (`#E2E8F0` resting, `#CBD5E1` active).
- **Semantics:**
  - **Success / Passed:** Emerald (`#10B981`) paired with light mint wash (`#ECFDF5`).
  - **Warning / Review Flag:** Amber (`#F59E0B`) with warm amber tint (`#FFFBEB`).
  - **Danger / Critical Alert / Proctored Violation:** Rose (`#EF4444`) with soft rose veil (`#FEF2F2`).

## Typography

Plus Jakarta Sans is utilized uniformly across all roles to achieve a clean, cohesive, and modern academic aesthetic. 

- **Display & Headlines:** Tightly tracked headings (-0.03em to -0.015em) provide strong structural anchors for dashboards, assessment titles, and score metrics.
- **Body:** Open apertures and generous x-heights guarantee crisp readability across long-form problem descriptions, instructional rubrics, and rich code blocks.
- **Labels & Badges:** Slightly expanded tracking (+0.01em to +0.04em) in uppercase and title-case variants keeps micro-metadata, time counters, status tags, and question taxonomy tags legible at small viewports.

## Layout & Spacing

The layout adopts a flexible 12-column grid system built on an 8-point spatial rhythm (with 4-point micro-adjustments for compact dashboard tables and input paddings):

- **Grid Architecture:** Desktop views span 12 columns with 1.5rem gutters and 2rem page borders. Tablet devices condense to 8 columns with 1.25rem gutters. Mobile devices collapse into a single 4-column flow with 1rem gutters and edges.
- **Dashboard Composition:** Persistent left vertical navigation (64px collapsed, 260px expanded) paired with an open-flow central workspace. Multi-pane panels (such as the Question Bank Editor or Split Rubric Grader) use an asymmetric 7:5 ratio or 8:4 ratio on viewports >= 1280px.
- **Component Breathing Room:** High internal card padding (1.5rem to 2rem) enforces visual hierarchy, preventing assessment content and multi-choice selections from crowding.

## Elevation & Depth

Visual hierarchy uses a refined combination of surface tonal layering and ambient soft shadows tinted with cool indigo/slate hues:

- **Level 0 (Flat Ground):** `#F8FAFC` base page canvas. No shadow.
- **Level 1 (Card & Content Blocks):** Pure `#FFFFFF` surface bordered by a subtle boundary: `1px solid #E2E8F0`. Shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Hovered Cards & Interactive Controls):** Applied on active hover states for question tiles and assignment rows. Border shifts to `#CBD5E1`. Shadow: `0 8px 20px -4px rgba(79, 70, 229, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)`.
- **Level 3 (Dropdowns, Overlays & Sticky Test Navigation):** Floating context menus and pinned exam submission bars. Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)`.
- **Exam Focus Ambient:** During active testing mode, background distractions recede behind a soft dark overlay (`rgba(15, 23, 42, 0.6)`) with subtle backdrop blur (`blur(4px)`).

## Shapes

The design system embraces an intentional, approachable structural rounding:

- **Standard Containers & Cards:** Styled with `rounded-2xl` (1rem to 1.5rem) to soften dense analytical interfaces and create an inviting space.
- **Controls & Buttons:** Inputs, select triggers, and action buttons default to `rounded-xl` (0.75rem), producing an ergonomic click target.
- **Micro-Badges & Tags:** Fully pill-shaped (`rounded-full`) to distinctly differentiate metadata from primary card blocks.

## Components

### Buttons
- **Primary:** Filled `#4F46E5` background, white text, `rounded-xl`, with smooth transition to `#4338CA` on hover. High-priority focus ring: `ring-4 ring-indigo-500/20`.
- **Secondary / Accent:** Filled `#7C3AED` or subtle purple tint (`bg-violet-50 text-violet-700 hover:bg-violet-100`).
- **Tertiary / Outline:** `#FFFFFF` background, `border border-slate-200`, Slate 700 text, hover effect applying Slate 50 with dark slate text.
- **Destructive:** Bordered or solid `#EF4444` with soft rose hover highlight.

### Data Badges & Chips
- **Interactive Badges:** Full-pill shapes with subtle border and pastel wash. 
  - *Completed:* `#ECFDF5` background, `#059669` text, `#A7F3D0` border.
  - *In Review:* `#FEF3C7` background, `#D97706` text, `#FDE68A` border.
  - *Critical / Flagged:* `#FEF2F2` background, `#DC2626` text, `#FECACA` border.
  - *Topic Pill:* `#EEF2FF` background, `#4F46E5` text, `#E0E7FF` border.

### Question Bank & Quiz Editor
- **Draggable Question Cards:** Modular white `rounded-2xl` containers featuring drag handles (Slate 400), inline difficulty indicators, and inline score adjusters.
- **Rich Text / Math Prompt:** Clean borderless focus editing area bordered by an embedded formula and media toolbar.
- **Answer Option Builder:** Multi-choice rows with dedicated selection radio buttons, instant "Mark Correct" toggle switches, and conditional feedback input drawers.

### File Dropzone States
- **Resting:** Dashed border (`2px dashed #CBD5E1`), Slate 50 background, centered cloud upload icon with indigo accent, supporting drag-and-drop instructions in Slate 500.
- **Active Drag Over:** Animated pulsing indigo border (`2px dashed #4F46E5`), background shifting to `#EEF2FF`, icon scale 1.05.
- **Upload Progress:** Slate 100 progress track with gradient Indigo-to-Electric-Blue fill (`#4F46E5` to `#06B6D4`), along with itemized file cards and status checks.

### Exam Testing Mode (Proctored Environment)
- **Minimalist Top Bar:** Pinned distraction-free header hosting student ID, persistent high-contrast countdown timer (switching to `#EF4444` when under 5 minutes), and direct Question Matrix drawer toggle.
- **Question Canvas:** Centered high-legibility pane with keyboard navigation cues (`Alt+N` for Next, `Alt+F` to Flag).
- **Security / Integrity Indicators:** Subtle green beacon ("Webcam & Audio Proctored Active") in top-right screen space.

### Tabs & Navigation
- **Pill Segmented Controls:** Encapsulated in a Slate 100 background container; active tab elevated with pure white background, Slate 900 text, and Level 1 soft shadow.
- **Underline Tabs:** Borderless slate tabs with an animated 2px `#4F46E5` bottom indicator line and medium text weight on active selection.

### Form Inputs, Checkboxes & Radios
- **Inputs:** Slate 50 or white fill, `border-slate-200`, text-slate-800, placeholder Slate 400, transitioning to `border-indigo-600` with `ring-4 ring-indigo-500/10` on focus.
- **Checkboxes & Radios:** Custom high-contrast controls; checked state features solid indigo fill with sharp white glyphs.