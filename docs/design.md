# Snow Shot Design Contract — Capture Workbench

Snow Shot is a desktop capture instrument. Its interface must get people to a
capture target quickly, keep the capture context legible, and make supporting
tools easy to find without turning the application into a settings catalogue.

## Product Shape

The application has three levels of navigation, each with a single job:

1. The top application bar moves between the workbench, independent tools,
   settings, extensions, and About. It is the only global navigation.
2. The capture workbench prioritizes capture actions by task: begin capture,
   target a focused window, capture a full display, or wait for a delay.
   Secondary workflows such as OCR, translation, recording, pinning, and
   history remain available, but do not compete with the main capture action.
3. A settings route uses a local section rail and one active settings board.
   It never combines a global sidebar, a horizontal tab strip, and a pile of
   expanded cards in the same viewport.

Routes, fields, keyboard bindings, reset actions, persistence, plugin gates,
and native window behavior are retained. Layout changes do not change a
capture action's meaning or its shortcut.

## Single Black-and-White Theme

There is one visual system with two luminance modes:

- Dark mode uses near-black canvas, charcoal working surfaces, gray seams, and
  white current/focus states.
- Light mode uses off-white canvas, pale-gray working surfaces, gray seams, and
  black current/focus states.
- Gray is structural hierarchy, not a second accent. The interface does not use
  preset finishes, accent-color selection, gradients, glow, glass, background
  images, or decorative texture.

Historic `themePreset`, `mainColor`, radius, and skin settings remain readable
in stored data for compatibility. They do not choose the capture workbench's
runtime visual system. Existing data must never be deleted merely because its
old appearance is no longer surfaced in the UI.

## Frame and Navigation

- The top bar is 52px high and includes the Snow Shot mark, global navigation,
  and native window controls. It is one quiet structural line, not a second
  content card.
- Global navigation uses readable 14px labels. A selected item changes surface,
  border, and text weight; focus is visible without relying on color alone.
- The content region is a single working surface with a modest 12px outer
  clearance. Nested floating panels are avoided.
- A local settings rail is 152–176px wide on desktop. It holds the section
  names for only the current settings route, scrolls independently when needed,
  and exposes a clear keyboard focus path. It collapses only when its content
  would take space away from an essential form control.

## Capture Workbench

- The first visible action is the default capture action and its existing
  shortcut. Focus order begins there.
- Capture targets are arranged as a compact command deck, not as a category
  list: the default capture, focused window, full screen, and delay are the
  first choices; supporting capture transforms follow as a second tier.
- Independent workflows (translation, AI, video, pinning, and history) appear
  as a clearly separate secondary area. Plugin-dependent actions retain their
  existing availability gates.
- Every command keeps its action name and shortcut on a stable baseline. A
  missing or conflicting shortcut remains understandable through text/icon
  state, not color alone.

## Settings Workspace

- Settings are master/detail: the local section rail selects exactly one active
  board. All boards remain mounted so form state and immediate persistence are
  preserved; inactive boards use `hidden` and are absent from keyboard order.
- An active board has one heading, optional reset action, and aligned fields.
  It does not surround every ordinary field with another card.
- At an actual board width below 880px, ordinary fields use one full-width row.
  At widths below 700px, horizontal label/control pairs become a label above a
  full-width control. Type remains 14px or larger.
- A two-column field grid is permitted only when each field has room for a
  readable label and a full control. At intermediate widths, its labels sit
  above controls rather than being squeezed beside them.
- Shortcut editing is a key table. It has a two-column matrix only when the
  actual board width is at least 760px; otherwise it becomes one column while
  keeping action and keycap on one line.

## Typography, Spacing, and States

- Use the platform UI stack with the explicit CJK fallbacks in
  `--snow-shot-font-ui`. Do not add display fonts or Latin tracking to Chinese
  body copy.
- Body and controls are 14px/21px. Section headings are 16px/24px. Compact
  identifiers and keycaps may be 13px; ordinary labels are never reduced below
  14px to rescue a tight layout.
- Prefer flat surfaces, 1px seams, 4–8px radii, and 8px spacing rhythm. One
  functional surface change is enough for hover. Pressed feedback is brief and
  restrained.
- Focus uses a 2px inset black/white ring so it is never clipped by a scroll
  container. Selected, disabled, error, empty, and shortcut-conflict states
  retain text, icon, or structural differentiation in addition to color.
- `prefers-reduced-motion` removes non-essential transitions and smooth scroll.

## Overlay and Compatibility Rules

Ant Design portals (selects, pickers, modals, popovers, tooltips, messages, and
dropdowns) use the same monochrome surface, seam, type, and focus grammar as the
application shell. Runtime theme context continues to flow through
`ConfigProvider -> Ant App -> application content`.

Public CSS hooks such as `.menu-layout-wrap`, `.content-wrap`,
`.snow-command-button`, and `--snow-shot-*` stay available where practical for
compatibility, but are not permission to restore the retired preset system.
