## LLM JSON Overlay Extension

Lightweight MV3 content script that drops a `details` element on every page, pins it to the bottom, and fills it with JSON extracted from on-screen data so you can paste directly into an LLM.

### How it works

- Injects a `details` panel labeled “LLM JSON” at the bottom of the page (only on `optionomega.com`).
- Extracts:
  - `header`: name/tags/link from the top bar (#message-heading)
  - `metrics`: every `dt`/`dd` card pair (covers Underlying, Dates, Entry/Misc bullets, P/L through Trades/Winners, etc.)
  - `dateRange`: parsed `from` / `to` when present in the Dates card
  - `labeledValues`: combined `metrics`, headings with nearby values, and two-child card layouts (backward compatible)
  - `lists`: visible bullet/numbered lists (e.g., Entry, Misc)
  - `legs`: each row of the legs table (text-only summary)
- Renders JSON with `url`, `title`, `scrapedAt`, and the above fields.
- Provides **Refresh** to re-scan and **Copy** to put the JSON onto your clipboard.

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
