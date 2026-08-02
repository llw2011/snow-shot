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

## Switchable Theme System

Snow Shot separates color mode from visual skin. `Light`, `Dark`, and `System`
control luminance, while `themePreset` selects the product skin. Every preset must
support both light and dark modes, so changing the skin never disables the system
theme preference.

- **Obsidian Core / 黑曜核心** is the compatibility default. It preserves the
  compact near-black command-workbench direction described above.
- **Aurora Pulse / 极光脉冲** uses violet, magenta, and cyan atmospheric light
  over translucent dark or light glass.
- **Prism Bloom / 棱镜霞光** combines coral, lavender, and indigo in a softer,
  luminous mesh with rounded floating surfaces.
- **Emerald Matrix / 翡翠矩阵** uses an ink-green technical grid, compact radii,
  and emerald focus signals.
- **Chromatic Studio / 彩色工作室** uses a high-contrast frame with alternating
  pastel accents for creative command groups.
- **Glacier Crystal / 冰川晶体** uses ice-blue light, pearl surfaces, and deeply
  layered frosted glass.

Theme presets own the canvas atmosphere, surface ladder, borders, shadows,
sidebar/header material, logo treatment, command rows, and keycaps. The user's
accent color and radius remain adjustable after selecting a preset. Runtime color
resolution must reject an accent with insufficient contrast against the active
canvas and core surfaces, then use the preset's readable recommendation instead.

Theme text tokens have stable readability roles across every preset. `ink`,
`body`, and informational `muted` text must keep at least 4.5:1 contrast on the
canvas, standard surfaces, cards, and content panels. `ash` is reserved for
disabled or non-text UI and must keep at least 3:1. The application uses a
platform-native UI font stack with explicit CJK fallbacks, standard 400/600
weights, and a 12px minimum for explanatory copy. Glass themes keep their vivid
atmosphere outside content surfaces while panels, sidebars, and headers remain
opaque enough for predictable text contrast.

Semantic info, success, warning, and error colors are also text colors. Each
must keep at least 4.5:1 contrast on every core surface in all twelve preset/mode
combinations. Solid primary and danger controls use a foreground derived from
the active canvas instead of assuming white text. Decorative accent colors are
not valid text colors unless they independently pass the same contrast check.

Third-party content and overlay roots must follow Snow Shot's selected mode,
not the operating system media query. Markdown variables, embedded display
iframes, Ant Design's `App` root, portals, messages, modals, dropdowns, tooltips,
and popovers all live inside or explicitly receive the active theme context.
The provider order is `ConfigProvider -> Ant App -> application content`.

User-supplied background images and custom CSS remain the highest-priority skin
layer. When a custom background is active, layout chrome becomes translucent and
must not hide the image. Theme presets may still provide readable foreground,
border, and control tokens above that custom layer. Custom CSS may be used without
selecting a background image; image position, opacity, blur, and mask controls are
inactive until an image path is present.

The mask control remains authoritative over custom-background translucency; a
theme preset must not narrow its range or silently turn the main layout opaque.
At the default mask level, major surfaces retain the established 83% overlay and
form controls add their established 42% local surface, so the image stays visible
without making controls image-dependent. While an image is active,
secondary `body` text is promoted to `ink`, informational `muted` text is
promoted to `body`, and disabled `ash` is promoted to `muted`. Users who
deliberately lower the mask continue to trade foreground contrast for a more
prominent image.
