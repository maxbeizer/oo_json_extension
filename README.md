## OptionOmega JSON Overlay Extension

A small helper extension that shows a live JSON snapshot of a backtest and can replay that data into the "New Backtest" form.

https://github.com/user-attachments/assets/ce1fcdd8-eff1-4050-8a1f-f15585a0cfcd

### Quick start

- Load the folder as an unpacked extension (`chrome://extensions` → Load unpacked → `oo_json_extension`). No build step needed.
- Open `optionomega.com/test/*`. A "LLM JSON" panel pins to the bottom of the page.
- Click **Refresh** to rescan, **Copy** to clipboard, or **Apply to form** to backfill the new backtest drawer.

### What it captures

- `header`: title/tags/link from the top bar.
- `metrics`: `dt`/`dd` card pairs (Underlying, Dates, P/L, trades, fees, etc.).
- `dateRange`: parsed `from`/`to`/`text` when present (dates normalized to ISO 8601 when parseable).
- `labeledValues`: headings paired with short numeric-ish values (fallback capture for two-column cards).
- `lists`: visible `ul`/`ol` items (entry/misc bullets).
- `legs`: each row in the legs table (`side`, `type`, `qty`, `dte`, `legType`, `text`).
- Also includes `url`, `title`, and `scrapedAt` timestamp.

### Using the panel

- Read/Copy: Use **Refresh** then **Copy** to grab the JSON for an LLM or logs.
- Apply to form: Paste JSON (from this extension or the input schema) and hit **Apply to form**. Dates, ticker label, legs, and common fee/slippage fields will be filled when selectors are found.
- Tweak before copy: You can edit the textarea manually; the panel won’t overwrite your edits until you hit **Refresh**.

### Schemas

- Result payload (`content.js` output): `schema/backtest-result.schema.json` (draft-07). Required: `url`, `title`, `scrapedAt`, `header`, `metrics`, `labeledValues`, `lists`, `legs`. Optional: `dateRange` (`from`/`to`/`text` or null; `from`/`to` emitted as ISO 8601 when parseable). Legs include `side`, `type`, `qty`, `dte`, `legType`, `text`.
- Input form payload (for **Apply to form**): `schema/backtest-input.schema.json` (draft-07) documents the accepted fields for seeding the backtest drawer (dates expect ISO 8601 `YYYY-MM-DD`).

### Extend or tweak

- Adjust capture heuristics in `content.js` (`extractLabeledValues`, `extractHeadingPairs`, `extractLists`, `extractLegsTable`).
- Prefer stable IDs/selectors in the app for more deterministic results.

### License

MIT
