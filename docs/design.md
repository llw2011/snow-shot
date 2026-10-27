# Snow Shot Design Contract — Search-first Workbench

Snow Shot is a desktop capture instrument that is mostly driven by global
shortcuts. The main window exists to start an action, change its shortcut, and
adjust the few settings that action owns. Everything is one search away.

## Product Shape

The main window has one shell and one master/detail split:

1. **Top bar (52px)** — brand, the global search field (`Ctrl/⌘ K`), the
   S/M/L window size control and native window buttons. The bar is the drag
   handle; interactive controls are not.
2. **Navigator (left, 288–312px)** — every capture action, tool and settings
   page in four sections: Capture, Translation & AI, Recording & desktop,
   Settings. Filters (All / Functions / Settings) and search narrow the list.
   Actions show their shortcut as a keycap; settings show a one-line summary.
3. **Detail (right)** — the selected item. There is no second-level rail, tab
   strip or nested card stack.

Below 900px the navigator becomes a drawer opened from the top bar menu
button; opening an item closes it. Typing in search opens it.

The navigator is driven by `src/components/workbench/registry.ts`. Adding a
page means adding one registry entry and one detail mapping in
`src/pages/workbench/index.tsx`; routes, search and the shortcut table follow.

## Item Kinds

- **Action** (`/w/<id>`) — header with a primary *Run now* button, a shortcut
  group with the editable keycap and its registration state, then the settings
  this action owns (e.g. Screenshot owns capture behavior and copy/save), then
  related links.
- **Tool** (`/tools/translation`, `/tools/chat`, `/tools/captureHistory`) — a
  full-height working surface with a slim 48px header holding the tool's own
  controls and a link to its preferences.
- **Settings** (`/w/<id>`) — header, then settings groups.

Each persisted settings group is edited in exactly one place. Legacy routes
(`/settings/*`, `/personalization/*`, `/about`) redirect to their new item.

## Settings Grammar

- A settings group has a muted 12px title, an optional description, an
  optional *Reset* action, and rows. No group is wrapped in a card.
- A row is label (14px/500) left, control right, 48px minimum height, 1px
  hairline separator. Sliders, multi-selects, radio groups, paths, text areas
  and long templates stack label above a full-width control.
- Rows come from ordinary antd `Form.Item`s inside `SettingsGroup`; the row
  CSS only applies inside `.settings-rows`. Free-form rows use `SettingsLine`.
- `useSettingsGroupForm(group)` binds one form to one persisted group and saves
  partial values immediately; a view can unmount at any time.

## Model Services

Chat, translation and OCR share one list of model services. A service is an
endpoint + key + model with capabilities (thinking, vision) and uses (chat,
translation, OCR). The stored per-feature lists stay as they were; the service
view is derived from them and written back (`serviceModel.ts`).

Adding a service is paste-first: the scheme and API path are completed, the
provider is detected (Ollama, LM Studio, llama.cpp, vLLM, OpenAI, DeepSeek,
DashScope, Zhipu, SiliconFlow, OpenRouter, DeepL), models and capabilities are
read, and uses are suggested. Loopback runtimes are scanned once per session.
Thinking-capable models are asked not to reason (`reasoning_effort: "none"`)
for translation and for chat when thinking is off.

## Visual System

Warm neutral surfaces with a single orange accent, in two luminance modes.

| Role | Light | Dark |
|---|---|---|
| Canvas / navigator | `#FAFAF9` | `#141312` |
| Detail surface | `#FFFFFF` | `#1B1A19` |
| Elevated surface | `#F4F3F1` | `#232120` |
| Ink / body / muted | `#1C1917` / `#44403C` / `#736D67` | `#F5F4F2` / `#CFCBC6` / `#A39E98` |
| Accent | `#D9480F` | `#FF7A3D` |
| Success / warning / error / info | `#15803D` / `#B45309` / `#DC2626` / `#2563EB` | `#4ADE80` / `#FACC15` / `#F87171` / `#6CA8FF` |

- Status colors keep their hue. Shortcut conflicts, failed connections and
  test results are also expressed with text and icons, never color alone.
- Surfaces are flat. Only floating layers (menus, popovers, dialogs, the
  compact navigator drawer) carry a soft shadow.
- Radii: 8px controls, 12px icon tiles and panels, 13px chips.
- Icons are 1.6px stroke icons on a 24px grid (`workbench/icons.tsx`).
- Historic `themePreset`, `mainColor`, radius and skin values stay readable in
  stored data but do not change the runtime look.

## Typography, Spacing, and States

- Platform UI stack with explicit CJK fallbacks (`--snow-shot-font-ui`);
  monospace (`--snow-shot-font-mono`) for keycaps, endpoints and model ids.
- Body and controls 14px/21px, page titles 20px/28px, group titles 12px.
- 4/8px spacing rhythm; detail content is capped at 780px.
- Focus is a 2px accent outline (inset on list items). Keyboard: `Ctrl/⌘ K`
  focuses search, arrows move the highlight, Enter opens, Escape clears.
- `prefers-reduced-motion` removes non-essential transitions.

## Overlay and Compatibility Rules

Ant Design portals inherit the palette through `ConfigProvider` tokens
(`src/constants/themePresets.ts`, `appSettingsContextProvider`). Runtime theme
context continues to flow through `ConfigProvider -> Ant App -> application
content`. `--snow-shot-*` CSS variables remain available to capture, pin and
canvas windows.
