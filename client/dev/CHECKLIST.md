# Action checklist (spec section 8)

Each action is exercised by a browser test against the mock server. "kbd" means the test drives it by keyboard or
the control is a real button/link/input reachable by Tab (checked for name and 44 px size in test_final.py).

## Print status
- [x] Status pill per printer, hero for PREPARE/RUNNING/PAUSE, compact card otherwise — test_print_status (current_print, idle, two_printers, finished_without_name)
- [x] Ring, percentage, layer, name, material line, time left, finish time, used of predicted — test_current_print
- [x] Nozzle(s), bed, chamber tiles; fans and light line — test_temperatures
- [x] Waiting for printer; no printers; load error — test_no_state, test_empty, test_fail
- [x] Runout and takeover banners; runout and takeover dialogs — test_runout, test_events_open_dialogs
- [x] Missing data shows no NaN/undefined — test_sparse_data
- [x] AMS units, rename, humidity and temperature — test_slots, test_rename
- [x] Slot panel: change spool, clear slot, missing spool clearable — test_change_spool, test_clear_slot, test_missing_spool_can_be_cleared
- [x] Empty external holders line with assign buttons — test_empty_holders
- [x] Black filament outlined — test_black_spool_outlined
- [x] Keyboard: slot opens with Enter, Escape returns focus — test_keyboard (kbd)
- [x] Refresh in header — header button "Refresh" (test_final names/sizes)

## Spools
- [x] Add spool, table/grid switch, import/export menu — test_import_export_menu, test_grid_actions_visible, test_spool_form
- [x] Show/hide stats — test_stats_toggle
- [x] Filters Active, Archived, All, Used, New, Low stock — test_filters
- [x] Sortable columns persisted; bad storage survives — test_sort_persists, test_bad_storage
- [x] Colour name derived — test_colour_name_and_location
- [x] Row edit, restock (when low), menu: deduct, archive/restore, delete with confirm — test_row_menu_deduct, test_archive_from_menu, test_delete_confirms
- [x] Phone cards with sort selector — test_phone_cards
- [x] Selection, select all, bulk set location — test_bulk_location, test_select_all
- [x] Spool form: add brand, add material, knowledge hints, auto-detect, RFID, input kept, single submit — test_spool_form, test_dialogs

## Print history
- [x] Cards with thumbnail/no image, status, filament, cost, timelapse — test_cards, test_timelapse_viewer
- [x] Details panel with media (token), AI analysis, costs — test_open_details
- [x] Menu: live camera, extract timelapse, upload photo/video, delete photo/video, delete — test_menu_items, test_regenerate, test_upload, test_delete_one_confirms
- [x] Selection, select all, bulk delete — test_select_does_not_open, test_bulk_delete
- [x] Live socket update in open panel — test_socket_update_in_open_panel

## Scrap saver
- [x] Spools under 100 g, select dims models — test_lists_only_scrap_spools, test_selecting_marks_models_that_do_not_fit
- [x] Add model dialog, delete asks first, external link — test_add_model, test_delete_asks_first, test_external_link

## Analytics
- [x] Four tiles, material and failure bars, success donut, problem filament — test_tiles, test_bars_and_failures
- [x] Refetch on archive events — test_refetch_on_archive_event

## Calculator
- [x] Upload by click, drop or keyboard; analyse — test_keyboard_file_choice (kbd), test_quote
- [x] Assign spools, quantity, labour, quote — test_quote, test_quantity_and_labour
- [x] Save quote with corrected spool cost — test_save_quote_costs

## Jobs and quotes
- [x] Search, status filter, edit dialog, delete confirm, currency — test_jobs

## Settings
- [x] Every field from dev/settings-inventory.md on its tab — test_fields_exist, test_manual_rate_field, test_backup_options_show_when_enabled
- [x] Save, HA test, add/edit/delete printer, manual backup, restore guard, sign out — test_settings

## Profile and sign-in
- [x] Local login, SSO, ?local=true, ?error=, first-run setup, profile, sign out — test_auth

## Whole app
- [x] No sideways scroll, 44 px targets and names at 1440, 900, 390 on every route — test_final
- [x] Reduced motion — test_reduced_motion
- [x] Navigation, bottom bar, assistant keeps conversation — test_shell
