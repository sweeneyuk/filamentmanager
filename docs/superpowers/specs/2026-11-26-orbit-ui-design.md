# Filament Manager: Orbit UI overhaul

Date: 26 November 2026
Status: approved by the owner, 26 November 2026
Repository: `sweeneyuk/filamentmanager`, read at commit `5817f82`
Mockups: https://claude.ai/artifact/DTgM5Pd6hP6avhhJ4MJrKs (artboard "A. Orbit", file `project/Main.dc.html`)

## 1. Intent

The owner finds the current UI clunky and dated, and wants it to be "beautiful and fluent, with a modern design". They chose the **Orbit** mockup. The app was built with Google Antigravity.

What makes it feel clunky today (from screenshots and code):

- Every screen opens with a large title banner that pushes content down.
- Print status shows 11 telemetry tiles of equal weight.
- Every AMS slot carries its own "Change Spool" and "Clear" buttons.
- Screens look unrelated (Jobs has its own header and width) and there are several kinds of pop-up.
- About 540 inline styles and many hard-coded colours. `btn-secondary`, `btn-danger`, `icon-btn`, `settings-section`, `settings-desc` are used but have no CSS.

## 2. Goals, non-goals, anti-goals

**Goals**

- Every screen uses the Orbit look and one shared set of building blocks.
- Print status answers "what is printing, how far, when does it finish" at a glance.
- Every screen works on desktop and phone.
- Smooth transitions where something opens or changes.
- Fix the spool form reset and the saved quote cost bugs (section 9).

**Non-goals**

- No server, database, API, socket event or Stream Deck plugin changes.
- No new features, no new metrics, no search or filters that do not exist today.
- No light theme.
- No Tailwind or component kit.

**Anti-goals** (any of these means the work has failed)

- A current feature or action is lost or becomes unreachable.
- Black or white filament becomes invisible on any screen.
- An action is only reachable by mouse hover.
- A recoloured version of the old layout that does not look like the Orbit mockup.

## 3. Constraints

- React 19, Vite 8, react-router 7, lucide-react, recharts, axios, socket.io-client, color-namer. Keep them.
- Self-hosted Docker app. A push to `main` publishes a new container image (`.github/workflows/docker-publish.yml`). **Work on a branch such as `orbit-ui`. Never push to `main`; the owner merges.**
- Keep route paths and the `localStorage` keys `token`, `fm_view_mode`, `fm_sort_config`.
- Media URLs need `?token=`.
- The client has no tests.

## 4. Approaches

| Approach | Trade-off | Decision |
|---|---|---|
| Own Orbit building blocks in plain CSS | Closest match, builds on existing code, app keeps working between screens. Dialogs, menus and motion are hand-built. | **Chosen by the owner** |
| Tailwind with shadcn/ui | Accessible dialogs and menus ready made. Second styling system, larger change, needs restyling. | Not chosen |
| Recolour the stylesheet only | Quick, but inline styles block it and the new layout needs markup changes. | Rejected |

## 5. Decisions

**Owner decided:** the Orbit look; own building blocks; keep server and all features; desktop and phone; smooth transitions; fix the two bugs.

**Shown in the approved mockup:** side menu with the labels Print status, Spools, Print history, Scrap saver, Analytics, Calculator, Jobs and quotes, Settings, user name; no title banners; progress ring in the filament colour; AMS slots as rings; slot tap opens management; empty external holders as one line; "Ask the assistant" button in place of the floating bubble.

**Builder calls, for the owner to check** (marked ◆ below):

1. ◆ One low stock rule everywhere: remaining weight below the `low_stock_threshold` setting (default 200 g). Today the table filter uses the setting, the grid uses under 15% or 50 g, the AMS uses under 15%. "Ran out" stays at 0 g or less. Scrap saver keeps its own under 100 g rule.
2. ◆ Print history: clicking a card opens its details. Selecting is done with the checkbox. Today clicking the card selects it.
3. ◆ Short success messages (`showAlert` with `isError` false) become brief toasts. Errors and confirmations stay as dialogs.
4. ◆ Phone navigation is a bottom bar (Status, Spools, History, More) replacing the burger menu.
5. ◆ One money format everywhere, using the `currency` setting, default GBP.
6. ◆ Analytics pie charts for material and failure type become horizontal bars.
7. ◆ Tidier screens: less used spool actions (deduct, archive, delete) sit in a "more" menu; adding a scrap book model and editing a job open in dialogs; deleting a scrap book model asks first.

## 6. Visual system

Single dark theme (`color-scheme: dark`). All values as CSS custom properties.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#131a26` | page |
| `--nav` | `#172030` | side menu |
| `--surface` | `#1b2638` | cards |
| `--raised` | `#223048` | tiles, inputs inside cards |
| `--selected` | `#233248` | active menu item, secondary button |
| `--track` | `#2b3a54` | ring and bar track |
| `--line` | `#3a4d6e` | outline button, input border |
| `--text` | `#eef2f8` | text |
| `--muted` | `#a9b6ca` | secondary text |
| `--accent` | `#35d98b` | primary button (dark text `#08140f`), active state, focus |
| `--accent-soft` | `#17392f` | status pill background |
| `--accent-text` | `#6ff0b3` | status pill text |
| `--accent-surface` | `#223a45` | feeding slot background |
| `--warning` | `#ffb454` | low stock, paused |
| `--danger` | `#ff7b7f` | errors, delete, ran out, failed |
| `--info` | `#6cb6ff` | takeover notice, running |

- **Type:** Figtree 400/500/600/700, self-hosted through `@fontsource-variable/figtree` (works with no internet), fallback `system-ui`. Tabular numbers. Scale: 56 ring percentage, 32 page title, 30 key stat, 26 print name, 20 reading, 17 card title, 15 body, 14 secondary, 13 and 12 captions.
- **Radius:** hero 28, cards 24, tiles 16, menu items 14, inputs 12, buttons and pills 99.
- **Spacing:** 4 px steps; 24 between sections; page padding 32/36 desktop, 16 phone.
- **Depth:** separate by surface tone. Shadow only on dialogs, panels, menus and toasts.
- **Filament colour:** always drawn with a `rgba(255,255,255,.28)` outline. Never use it as text colour or as the only way to identify something.
- **Motion:** 150 ms hover and press, 250 ms ease-out for dialogs, panels, menus, toasts and tab changes, 500 ms for ring and bar values. No entrance animation on page load. Respect `prefers-reduced-motion`.
- **Targets:** at least 44 px. Visible 2 px accent focus outline.

## 7. Structure and building blocks

- `client/src/ui/` holds the components, each with its own CSS file; `ui/tokens.css` holds the tokens.
- Components: `AppShell`, `PageHeader`, `Button` (primary, secondary, outline, danger, icon), `Card`, `StatTile`, `StatusPill`, `Tabs`, `Field` (input, select, textarea, switch), `Dialog`, `SidePanel` (bottom sheet on phone), `Menu`, `Toast`, `FilamentRing`, `ProgressBar`, `FilamentDot`, `SpoolPicker`, `EmptyState`.
- `lib/` holds shared logic now repeated in screens: money, duration, remaining weight and low stock, AMS unit and slot names, colour names.
- Inline `style` only for values from data (filament colour, widths, ring angle).
- `AlertContext` keeps `showAlert`, `showConfirm`, `showPrompt` and renders the new `Dialog` and `Toast`. `window.confirm` calls move to `showConfirm`.
- `Dialog`, `SidePanel` and `Menu`: focus trap or focus return, Escape closes, labelled for screen readers.
- Delete `App.css` (unused starter file). Remove old rules from `index.css` as each screen moves; new class names must not collide with old ones while both exist.
- Split screen files over about 300 lines into smaller components in a folder per screen.

**Shell**

- 1100 px and wider: 232 px side menu with labels and lucide icons (icons are an addition to the mockup). The user name at the bottom opens Profile.
- 768 to 1099 px: icon rail with accessible labels and tooltips.
- Under 768 px: bottom bar; "More" opens a sheet with the remaining destinations.
- `PageHeader` is one compact row: page title, status or page actions, assistant button. No subtitle banner.
- "Ask the assistant" sits in each page header (icon only under 768 px) and opens a side panel with the existing chat. Conversation survives closing the panel and changing page.

**States for every screen:** loading (placeholder shapes), empty (one sentence and the next action), load error (message and "Try again"). Today several failures are silent.

## 8. Screens

Every action listed must remain.

### Print status (`/`)
- One section per printer: name and status pill (preparing, printing, paused, finished, failed, idle; colour plus words). `PREPARE`, `RUNNING` and `PAUSE` show the hero; an unrecognised status shows its name on the compact card.
- Hero: progress ring in the colour of the current tray's assigned spool (accent if unknown) with percentage and layer; print name; material and slot line; time left; finish time (now plus `remainingTime`); filament used `totalGramsDeducted`, "of N g" where N is the sum of `slicerFilaments[].used_g`, omitted if unavailable.
- Readings: nozzle or left and right nozzle, bed, chamber as tiles; part, hotend, aux and chamber fans and light as one quiet line.
- Keep the current temperature decoding, including packed values and chamber handling, by moving it unchanged into `lib/`.
- Idle, finished or failed: compact card with status, last print name and readings. No empty ring.
- A printer with no state yet shows "Waiting for printer" (today it is hidden).
- Runout notice and auto-refill takeover notice stay, as banners inside the hero. Takeover and runout dialogs stay.
- AMS: one card per unit with name, rename button, humidity and temperature (existing humidity mapping). Slots are ring buttons showing slot number, grams left, material. Ring fill is remaining over total. Feeding slot is outlined; other slots used by this print get a quieter mark. Unassigned slot with filament shows an empty ring, a dot in its reported colour and "Not assigned"; empty slot is dimmed. Low stock shows a warning label.
- Tapping a slot opens a side panel: spool details, "Change spool" (list of spools with brand, material, colour, remaining), "Clear slot".
- Empty external holders collapse to one line with an assign button per holder. Assigned ones show as unit cards.
- "Refresh" stays as an icon button in the page header.

### Spools (`/inventory`)
- Header: Add spool (primary), table or grid switch, menu with Import CSV and Export CSV.
- Show/Hide stats stays (hidden by default), restyled as a stats strip (total inventory, consumed, by material, low stock).
- Filters: Active, Archived, All, Used, New, Low stock.
- Table: all current columns and sorting. Colour shows swatch plus name (`color_name`, else derived with color-namer). Row actions: edit, and restock when applicable, visible; deduct, archive or restore, delete in a row menu.
- Under 768 px the table becomes a list of cards with a sort selector.
- Grid: spool cards with a large filament ring; actions always visible (edit, restock) plus the menu. Checkbox must not overlap actions.
- Selection and bulk bar (set location, archive, unarchive, delete, clear) unchanged in behaviour.
- Spool form (add and edit): dialog, full screen on phone, grouped into Filament, Weight and cost, Restock and tags. Keep add brand, add material, brand knowledge weight suggestions, variant auto-detect, RFID field.

### Print history (`/archive`)
- Card grid: thumbnail (or "No image"), name, date, duration, status pill (including in progress), filament dots with grams, total cost.
- Details panel: photo and timelapse with download, filament list, AI analysis status and note, energy and filament cost breakdown.
- Card menu: fetch live camera, extract from timelapse, upload photo, upload video, delete photo, delete video, delete.
- Selection, select all and bulk delete stay.

### Scrap saver (`/scrap-saver`)
- Two columns (stacked on phone): spools under 100 g as selectable rows with ring; scrap book list with the add form in a dialog behind "Add model". Selecting a spool still dims models that need more than it holds.
- Deleting a model asks for confirmation (new, small).

### Analytics (`/analytics`)
- Four stat tiles with the same figures. Material usage and failure types as horizontal bars with labelled values; success rate as a donut. Series colours come from tokens, not filament colours; a filament dot may sit beside a label.
- Problem filament list keeps its calculation, shows colour name or swatch and the print count.

### Calculator (`/calculator`)
- Same three steps: drop file, assign spools, adjust and quote. Summary stays visible beside the steps on wide screens. Same formulas and the same electricity rate sources. Save quote dialog.

### Jobs and quotes (`/jobs`)
- Same page layout as other screens. Search, status filter, cards. Editing moves into a dialog. Delete confirms with the shared dialog.

### Settings (`/settings`)
- Tabs: Printers, Integrations, Stock and preferences, Security and sign-in, Backups (horizontal scroll on phone).
- All fields, connection test, save per tab, printer add, edit and delete, backup create, download and restore (with a clear overwrite warning), logout.

### Profile, Login
- Restyled. Sign out, local login, first-run setup and SSO behaviour unchanged.

### App identity
- Update theme and background colour in `index.html` and `vite.config.js` to `#131a26`.

## 9. Bug fixes

1. **Spool form resets.** `SpoolModal` re-initialises whenever `brands`, `materials` or `brandKnowledge` change, so adding a brand or material (or a live spool update) wipes what was typed. Initialise only when the form opens or the edited spool changes, apply defaults once if lists arrive late, and select the newly added brand or material.
2. **Saved quote per-spool cost.** `Calculator.handleSaveQuote` assumes 1 kg spools. Use `weight × spool.cost / spool.total_weight`, matching the on-screen material cost, and 0 if either value is missing. Existing saved quotes are not rewritten.
3. **Follow-up pop-ups vanish** (found while planning). `AlertContext` closes its dialog after running the confirm action, so a prompt or alert opened from that action disappears at once, including the brand weight step of "Add brand". Close first, then run the action.

## 10. Noticed, deliberately not changed

- Nozzle temperatures: the owner has confirmed they are correct after an earlier bug fix. Move the web decoding unchanged and leave the server and Stream Deck temperature code alone, even though they read packed values in a different order.
- `main.jsx` unregisters service workers while `vite-plugin-pwa` is configured.
- Two separate electricity rate settings exist (`manual_energy_rate`, `calc_energy_rate`).

## 11. Order of work

Each step leaves the app usable and is reviewed before the next.

1. Tokens, font, building blocks, shell and assistant, dialog and toast (bug 3).
2. Print status. **Owner checks it on the real printer before continuing.**
3. Spools and spool form (bug 1).
4. Print history.
5. Analytics and Scrap saver.
6. Calculator and Jobs (bug 2).
7. Settings, Profile, Login.
8. Remove old CSS, final pass at all widths.

## 12. Checks

- `npm run build` and `npm run lint` pass in `client/` (record the lint baseline first).
- Run the client against mock API and socket data covering: printing, paused with runout, idle, two printers, empty lists, load failure, black and white filament, long print names. Do not connect to the real printer.
- Screenshot every screen at 1440, 900 and 390 px wide; no sideways page scroll; compare Print status with the mockup.
- Keyboard only: reach and operate every action.
- Walk the action lists in section 8 and tick each one.
- Logic that moves into `lib/` (temperatures, low stock, quote cost) gets small unit tests.

## 13. Left to the builder

Component APIs, file layout inside the rules above, mock data approach, test tool, exact hover and pressed shades, chart series colours, placeholder shapes, icon choice.

## 14. Starting the next session

- Package installs were blocked in the session that wrote this. The owner's settings now show internet use on with standard download sites; confirm `npm install` works.
- That session had read access to GitHub only. Request push access to commit to the `orbit-ui` branch. Commit this file there as `docs/superpowers/specs/2026-11-26-orbit-ui-design.md`.
- The implementation plan is written: Project doc `claude/2026-11-26-orbit-ui-plan.md`. Start at its Task 1 once the owner has chosen how to run it.
