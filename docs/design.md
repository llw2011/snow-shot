# Snow Shot Design Direction

Snow Shot uses a compact desktop-utility skin inspired by command palettes and capture tools. The product should feel fast, local, and precise, not decorative or marketing-led.

## Visual Language

- Default canvas is near-black: `#07080A`.
- Surfaces use a quiet ladder: `#0D0D0D`, `#101111`, `#121212`.
- Borders are 1px hairlines: `#242728` or soft white alpha.
- Elevation comes from surface contrast, not heavy shadow.
- Primary actions may use white-on-dark contrast. Chromatic accents are reserved for status, warnings, and tool identity.
- Radius stays compact: 6px for rows and keycaps, 8px for panels and controls.

## Product Skin

- The app frame is a desktop workbench: sidebar, window bar, and content panel should read as one continuous dark command surface.
- The Snow Shot mark should be original: a small capture-frame/snow mark, not a third-party logo or brand copy.
- Home actions are command rows: tool icon, action label, and shortcut keycap.
- Settings are dense professional forms with clear section headers and restrained controls.
- Toolbars stay icon-first. Selected states use a lifted surface and hairline border.

## Component Treatment

- Buttons: 32-36px height, 8px radius, subtle border.
- Keycaps: compact dark gradient, 4-6px radius, muted text.
- Tabs: pill-like or underline-light, no large blue bars.
- Menus: selected row is one surface step lighter; avoid saturated color blocks.
- Cards and panels: only for repeated command groups, settings sections, modal/tools, and actual framed content.

## Motion

- Prefer short, functional transitions around 120-180ms.
- Avoid decorative motion. Interaction feedback should clarify focus, selection, loading, or capture state.
