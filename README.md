## OptionOmega JSON Overlay Extension

A small helper extension that shows a live JSON snapshot of a backtest for easy copy/paste.

https://github.com/user-attachments/assets/32e0b257-30c5-46c4-806a-38bdcadb7ba8

> [!WARNING]
> This is experimental and best effort. The API is very much under heavy development and there is not a stable version at this time. Use at your own risk.

### Quick start

- Load the folder as an unpacked extension (`chrome://extensions` → Load unpacked → `oo_json_extension`). No build step needed.
- Open `optionomega.com/test/*`. A "LLM JSON" panel pins to the bottom of the page.
- Click **Refresh** to rescan or **Copy** to clipboard.

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
- Tweak before copy: You can edit the textarea manually; the panel won’t overwrite your edits until you hit **Refresh**.

> Note: Form autofill was removed because the OptionOmega UI renders inputs dynamically; this extension now focuses solely on extracting and copying results.

### Schemas

- Result payload (`content.js` output): `schema/backtest-result.schema.json` (draft-07). Required: `url`, `title`, `scrapedAt`, `header`, `metrics`, `labeledValues`, `lists`, `legs`. Optional: `dateRange` (`from`/`to`/`text` or null; `from`/`to` emitted as ISO 8601 when parseable). Legs include `side`, `type`, `qty`, `dte`, `legType`, `text`.

### Extend or tweak

- Adjust capture heuristics in `content.js` (`extractLabeledValues`, `extractHeadingPairs`, `extractLists`, `extractLegsTable`).
- Prefer stable IDs/selectors in the app for more deterministic results.

### License

MIT
