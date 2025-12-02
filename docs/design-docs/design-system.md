# Design System

This design system defines a brand-new visual identity for the dashboard application. It is not derived from any existing UI; every component and style token is specified for a fresh interface that retains the same high-level page layout (sidebar, dashboard header, and status bar).

## Foundations

- **Color palette**
  - **Base**: Porcelain (#F6F7FB) backgrounds with Deep Midnight (#0B1C2C) text for high readability.
  - **Primary**: Cobalt Blue (#2F6FED) for actions, links, and highlights.
  - **Secondary**: Amber Glow (#F4A623) for warnings and secondary callouts.
  - **Success**: Emerald (#27AE60); **Danger**: Crimson (#E74C3C); **Info**: Teal Mist (#19A7A8); **Neutral accents**: Mist Gray (#D7DCE3).
- **Typography**
  - **Font family**: "Inter" with 1.6 line-height for dense data surfaces.
  - **Scale**: 12 / 14 / 16 / 18 / 24 / 32 px. Body uses 14–16 px; headers use 18+ with bold weights.
  - **Emphasis**: Use weight (600) before size increases; avoid italics.
- **Spacing & layout**
  - **Grid**: 8 px base unit; page gutters of 24 px on desktop, 16 px on tablet.
  - **Cards**: 12 px inner padding, 8 px corner radius, subtle shadow (0 4px 18px rgba(11, 28, 44, 0.08)).
  - **Density**: Tables use 12 px row height padding; form fields use 10 px vertical padding.
- **Iconography**
  - Use outline icons with 1.5 px strokes; primary color for active states and Mist Gray for inactive.
- **States & feedback**
  - **Hover**: Light primary tint backgrounds (#E7EFFF).
  - **Focus**: 2 px cobalt outline with 2 px radius.
  - **Disabled**: 60% opacity, no shadows, and muted text (#9AA3B1).
- **Motion**
  - Micro-interactions use 150–200 ms ease-out transitions; avoid large-scale animations for data-heavy surfaces.

## Components

- **Buttons**: Primary (filled cobalt), secondary (ghost with cobalt border), destructive (crimson fill), and tertiary icon-only variants. All have 8 px radii and 12 px horizontal padding.
- **Form controls**: Input fields with 1 px border (#D7DCE3) and 8 px radius; on focus, border becomes cobalt with glow. Error states show crimson border and inline helper text.
- **Tables**: Zebra striping with porcelain rows; sticky header with subtle shadow and 14 px bold text. Inline chips for status badges (success/amber/crimson).
- **Chips & badges**: Rounded (12 px radius), small (12 px text) with bold weight. Color-coded based on status tokens above.
- **Modals & drawers**: Centered modal up to 640 px width; side drawer width 420 px. Both use frosted backdrop (#0B1C2C, 30% opacity) and escape/click-away dismissal.

## Accessibility & theming

- Contrast ratios meet WCAG AA for text and controls. Provide a high-contrast mode that swaps porcelain backgrounds for pure white and deep midnight text for near-black (#0A0A0A) while retaining action colors.
- Reduced motion preference disables animated transitions and replaces them with instant state changes.

## Tone & imagery

- Visual tone is analytical and confident. Use neutral illustrations with geometric shapes; avoid skeuomorphic or playful imagery.
