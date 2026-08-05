# Snow Shot Design Direction — Snowfield Workbench

Snow Shot uses a quiet desktop-utility skin built around command shelves and progressively disclosed settings. The product should feel fast, local, precise, and calm rather than decorative, marketing-led, or simultaneously dense.

## Visual Language

- Default canvas is near-black: `#07080A`.
- Surfaces use a quiet ladder: `#0D0D0D`, `#101111`, `#121212`.
- Borders are 1px hairlines: `#242728` or soft white alpha.
- Elevation comes from surface contrast and hairlines, not stacked cards or heavy shadow.
- Primary actions may use white-on-dark contrast. Chromatic accents are reserved for status, warnings, and tool identity.
- Radius stays compact: 6px for rows and keycaps, 8px for panels and controls.

## Product Skin

- The app frame is a desktop workbench: sidebar, window bar, and content panel read as one continuous command surface.
- The Snow Shot mark should be original: a small capture-frame/snow mark, not a third-party logo or brand copy.
- The sidebar shows every top-level destination but expands only the active navigation group.
- Home actions are single-column command rows at the default 1024×632 window: tool icon, action label, and a trailing shortcut/status control.
- Settings begin with section summaries. One section is open by default; every other section remains visible as a stable heading and expands without unmounting its form fields.
- A setting is one readable row. At compact desktop widths, labels and controls must not compete in two unrelated side-by-side columns.
- Toolbars stay icon-first. Selected states use a lifted surface and hairline border.

## Component Treatment

- Buttons and form controls: 40px default height, 34px only when compact mode is explicitly enabled, 8px radius, subtle border.
- Keycaps: compact dark gradient, 4-6px radius, muted text.
- Page section navigation: a horizontally scrollable row of quiet text buttons with a surface selected state; it reveals collapsed targets before scrolling.
- Menus: selected row is one surface step lighter; avoid saturated color blocks.
- Cards and panels: only for repeated command groups, settings sections, modal/tools, and actual framed content. Do not nest a bordered button card inside multiple decorative cards.

## Motion

- Prefer short, functional transitions around 120-180ms.
- Avoid decorative motion. Interaction feedback should clarify focus, selection, loading, or capture state.
- `prefers-reduced-motion` removes smooth scrolling and reduces transitions to immediate feedback.

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

Theme presets own the canvas atmosphere, color ladder, borders, restrained
material, logo treatment, and recommended accent. All presets share the same
information hierarchy, layout, component geometry, focus treatment, command-row
structure, and settings disclosure. Presets must not color groups by DOM order or
change content density. The user's accent color and radius remain adjustable after
selecting a preset. Runtime color resolution must reject an accent with insufficient
contrast against the active canvas and core surfaces, then use the preset's readable
recommendation instead.

Theme text tokens have stable readability roles across every preset. `ink`,
`body`, and informational `muted` text must keep at least 4.5:1 contrast on the
canvas, standard surfaces, cards, and content panels. `ash` is reserved for
disabled or non-text UI and must keep at least 3:1. The application uses a
platform-native UI font stack with explicit CJK fallbacks, standard 400/600
weights, and a 12px minimum for explanatory copy. Glass themes keep their vivid
atmosphere outside content surfaces while panels, sidebars, and headers remain
opaque enough for predictable text contrast.

Compact layout changes control height, spacing, and padding without shrinking the
application root type scale or showing more sections at once. Default interface
copy remains 14px at a 1.5 line height; 12px is reserved for explanatory copy,
tags, badges, tooltips, and keycaps rather than used as the inherited application
font size.

The primary form factor is the 1024×632 Tauri window with either an expanded or
collapsed sidebar. Responsive decisions use the content container width, not the
outer viewport: command lists and top-level settings fields become one column when
the available content surface is 880px or narrower. Long translated labels, paths,
and model identifiers must wrap or truncate inside their own row without causing
horizontal page scrolling.

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

Existing public skin hooks such as `.menu-layout-wrap`, `.content-wrap`,
`.snow-command-button`, and `--snow-shot-*` variables remain compatibility aliases
for user custom CSS when semantic slots are added or internal layout is refined.
