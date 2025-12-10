## OptionOmega JSON Overlay Extension

A lightweight browser extension that adds the output of a backtest as JSON to a `details` element at the bottom of the page. This makes it easy to, for example, feed the results to an LLM perhaps. More of a proof of concept of a feature request for optionomega.com

https://github.com/user-attachments/assets/ce1fcdd8-eff1-4050-8a1f-f15585a0cfcd

### How it works

- Injects a `details` panel labeled “LLM JSON” at the bottom of the page (only on `optionomega.com/test/*`).
- Extracts:
  - `header`: name/tags/link from the top bar (#message-heading)
  - `metrics`: every `dt`/`dd` card pair (covers Underlying, Dates, Entry/Misc bullets, P/L through Trades/Winners, etc.)
  - `dateRange`: parsed `from` / `to` when present in the Dates card
  - `labeledValues`: combined `metrics`, headings with nearby values, and two-child card layouts (backward compatible)
  - `lists`: visible bullet/numbered lists (e.g., Entry, Misc)
  - `legs`: each row of the legs table (text-only summary)
- Renders JSON with `url`, `title`, `scrapedAt`, and the above fields.
- Provides **Refresh** to re-scan and **Copy** to put the JSON onto your clipboard.
- **Apply to form**: paste JSON into the textarea and click **Apply to form** to backfill key fields in the "New Backtest" drawer (dates, starting funds/fees, ticker label text, legs).

### Install (Chrome/Edge)

1. `npm install` is not needed—this is a static extension.
2. `Load unpacked` in `chrome://extensions` (or Edge: `edge://extensions`).
3. Pick the `oo_json_extension` folder that contains `manifest.json`.
4. Visit the target page; the bottom overlay will appear. Toggle it with the summary caret.

### Usage tips

- Click **Refresh** after page data changes (e.g., new backtest results).
- Edit the textarea before copying if you want to add manual fields the heuristics miss.
- The extractor prefers compact two-child layouts; if you add consistent labels to your app, the capture improves.

### What gets captured

- `labeledValues`: cards/headings that look like `Label` + `Value` where the value contains numbers, currency, %, or ±.
- `lists`: visible `ul`/`ol` items (useful for entry/misc bullets like in the screenshot).

### Extending

- Adjust extraction logic in `content.js` (`extractLabeledValues`, `extractHeadingPairs`, `extractLists`).
- Add custom selectors or stable test IDs from your app if you need deterministic fields.

### Schema

- Result payload schema: `schema/backtest-result.schema.json` (draft-07). Required top-level fields: `url`, `title`, `scrapedAt`, `header`, `metrics`, `labeledValues`, `lists`, `legs`. Optional/structured: `dateRange` (`from`/`to`/`text` or null) and leg entries with `side`, `type`, `qty`, `dte`, `legType`, `text`. This is what `content.js` emits.
- Input form schema: `schema/backtest-input.schema.json` (draft-07) describes the fields for populating the "New Backtest" form when you paste JSON and click **Apply to form**.
- `output.schema.json` has been merged into `backtest-result.schema.json`; only the two files above remain.

### License

MIT
