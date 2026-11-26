# Settings inventory (from Settings.jsx and PrintersManagement.jsx at 5817f82)

Every item below must exist after the rebuild. Tab names: old → new.

## Printers (old "Printer Fleet")
- Table of printers: Name, IP, Serial; per row Edit, Delete (old: `window.confirm` "Are you sure you want to delete this printer? This will disconnect it immediately. Archives will remain.")
- Button "+ Add New Printer" → form dialog "Add New Printer" / "Edit Printer"
- Fields: `name` (required), `ip` (required), `serial` (required), `access_code` (required on add; blank on edit, "Leave blank to keep unchanged")
- Requests: GET /api/printers; POST /api/printers; PUT /api/printers/:id; DELETE /api/printers/:id
- Messages: "Printer added successfully!", "Printer updated successfully!", "Printer deleted", errors

## Integrations
- Home Assistant: `ha_url`, `ha_token` (password), `ha_printer_energy_entity`
- `energy_rate_source` radios: `ha` (Home Assistant entity, default when not "manual") / `manual`
- If ha: `ha_rate_entity`; if manual: `manual_energy_rate` (label "Manual Electricity Rate (£/kWh)")
- Button "Test HA Connection" → POST /api/test/ha with the whole settings object
- Gemini: `gemini_api_key` (password) + link to https://aistudio.google.com/

## Stock and preferences (old "Stock & Prefs")
- `low_stock_threshold` (placeholder 200), `bambu_store_region` (placeholder https://uk.store.bambulab.com)
- Calculator rates: `calc_wear_rate` (£/hour), `calc_energy_rate` (£/kWh), `calc_labor_rate` (£/hour), `calc_markup` (%), `calc_avg_wattage` (W)

## Security and sign-in (old "Security & SSO")
- `oidc_issuer`, `oidc_client_id`, `oidc_client_secret` (password)
- Button "Logout Local Admin" → AuthContext.logout

## Backups
- `auto_backup_enabled` checkbox (stored as 'true'/'false')
- When enabled: `auto_backup_interval_days` select (1 Daily, 7 Weekly, 30 Monthly; default '1'), `auto_backup_retention` (default '5', 1 to 100)
- "Create & Download Manual Backup" → POST /api/backups/manual, toast "Backup created: {filename}", refresh list
- Restore: file input `.zip` only ("Only .zip backup files are supported"), overwrite warning, POST /api/backups/restore (field `backup`), restoring view, reload after 5 s
- Available backups list: name, date, size KB, "Download" → GET /api/backups/download/:name as blob

## Every non-printer tab
- Submit "Save Tab Settings" → POST /api/settings with the whole settings object (masked values included); "Settings saved successfully!"
- Initial defaults merged under loaded settings: ha_url, ha_token, ha_energy_entity, ha_rate_entity, energy_rate_source 'ha', manual_energy_rate, oidc_*, calc_* all ''
