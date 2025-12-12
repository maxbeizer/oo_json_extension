/*
 * Injects a details element pinned to the bottom of the page that shows
 * heuristically extracted page data as JSON for quick copy/paste into an LLM.
 */

(() => {
  const PANEL_ID = "llm-json-overlay";

  if (document.getElementById(PANEL_ID)) return; // avoid double injects

  const state = {
    data: null,
  };

  const panel = document.createElement("details");
  panel.id = PANEL_ID;
  panel.open = false;
  panel.className = "llm-json-overlay";

  const summary = document.createElement("summary");
  summary.textContent = "LLM JSON";
  panel.appendChild(summary);

  const controls = document.createElement("div");
  controls.className = "llm-json-controls";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh";

  const status = document.createElement("span");
  status.className = "llm-json-status";

  controls.append(copyButton, refreshButton, status);

  const textArea = document.createElement("textarea");
  textArea.className = "llm-json-textarea";
  textArea.setAttribute("aria-label", "Extracted JSON");

  panel.append(controls, textArea);
  document.documentElement.appendChild(panel);

  function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function setStatus(msg) {
    status.textContent = msg;
    if (!msg) return;
    setTimeout(() => {
      if (status.textContent === msg) status.textContent = "";
    }, 1500);
  }

  function cleanText(str) {
    return str.replace(/\s+/g, " ").trim();
  }

  function isReadable(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  }

  function extractHeader() {
    const messageHeading = document.querySelector("#message-heading");
    const heading = messageHeading?.querySelector("span");
    const title = heading ? cleanText(heading.textContent || "") : "";
    const tagEls = messageHeading?.querySelectorAll(".bg-ooGold, .rounded-full.text-xs") || [];
    const tags = Array.from(tagEls)
      .map((el) => cleanText(el.textContent || ""))
      .filter(Boolean);
    const linkEl = messageHeading?.parentElement?.querySelector("p");
    const link = linkEl ? cleanText(linkEl.textContent || "") : "";
    return { title, tags, link };
  }

  function extractDefinitionPairs() {
    const pairs = {};
    document.querySelectorAll("dt").forEach((dt) => {
      if (!isReadable(dt)) return;
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName.toLowerCase() !== "dd" || !isReadable(dd)) return;
      const label = cleanText(dt.textContent || "");
      const value = cleanText(dd.textContent || "");
      if (!label || !value) return;
      if (!pairs[label]) pairs[label] = value;
    });
    return pairs;
  }

  function extractLabeledValues() {
    const results = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!isReadable(node)) continue;
      const children = Array.from(node.children).filter((child) => isReadable(child));
      if (children.length !== 2) continue;

      const [labelEl, valueEl] = children;
      const label = cleanText(labelEl.textContent || "");
      const value = cleanText(valueEl.textContent || "");
      const isShortLabel = label && label.length <= 32;
      const isValueLike = /[\d$%±-]/.test(value);

      if (!isShortLabel || !isValueLike) continue;
      if (!results[label]) results[label] = value;
    }
    return results;
  }

  function extractLists() {
    const lists = [];
    document.querySelectorAll("ul, ol").forEach((list) => {
      if (!isReadable(list)) return;
      const items = Array.from(list.querySelectorAll(":scope > li"))
        .map((li) => cleanText(li.textContent || ""))
        .filter(Boolean);
      if (items.length) lists.push(items);
    });
    return lists;
  }

  function extractHeadingPairs() {
    const pairs = {};
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    headings.forEach((heading) => {
      if (!isReadable(heading)) return;
      const label = cleanText(heading.textContent || "");
      if (!label) return;
      const next = heading.nextElementSibling;
      if (!next || !isReadable(next)) return;
      const value = cleanText(next.textContent || "");
      if (!value || value.length > 64) return;
      const isValueLike = /[\d$%±-]/.test(value) || value.split(" ").length <= 6;
      if (!isValueLike) return;
      if (!pairs[label]) pairs[label] = value;
    });
    return pairs;
  }

  function toISODate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  }

  function parseTime(value) {
    if (!value) return null;
    const cleaned = cleanText(value);
    const match = cleaned.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let [_, hhmm, meridiem] = match;
    let [hh, mm] = hhmm.split(":").map(Number);
    if (meridiem) {
      const mer = meridiem.toUpperCase();
      if (mer === "PM" && hh !== 12) hh += 12;
      if (mer === "AM" && hh === 12) hh = 0;
    }
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(hh)}:${pad(mm)}`;
  }

  function parseDays(text) {
    const days = [];
    const map = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    map.forEach((day) => {
      if (new RegExp(day, "i").test(text)) days.push(day);
    });
    return days.length ? days : null;
  }

  function extractLegsTable() {
    const legs = [];
    const legsDt = Array.from(document.querySelectorAll("dt")).find((el) => /Legs/i.test(el.textContent || ""));
    const table = legsDt?.nextElementSibling?.querySelector("table");
    if (!table) return legs;

    const isActive = (btn) => btn && /(ooRed|ooGreen)/i.test(btn.className || "");

    table.querySelectorAll("tbody tr").forEach((row) => {
      if (!isReadable(row)) return;
      const buttons = Array.from(row.querySelectorAll("button"));
      const sBtn = buttons.find((b) => /\bS\b/.test(b.textContent || ""));
      const bBtn = buttons.find((b) => /\bB\b/.test(b.textContent || ""));
      const cBtn = buttons.find((b) => /\bC\b/.test(b.textContent || ""));
      const pBtn = buttons.find((b) => /\bP\b/.test(b.textContent || ""));

      const legTypeBtn = row.querySelector("button.selectInput--nested") || row.querySelector("button.selectInput");
      const legType = legTypeBtn ? cleanText(legTypeBtn.textContent || "") : undefined;

      const side = isActive(sBtn) ? "Sell" : isActive(bBtn) ? "Buy" : null;
      const optionType = isActive(cBtn) ? "Call" : isActive(pBtn) ? "Put" : null;
      if (!side || !optionType) return;

      const inputs = Array.from(row.querySelectorAll("input"));
      const qtyRaw = cleanText(inputs[0]?.value || inputs[0]?.getAttribute("value") || "");
      const dteRaw = cleanText(inputs[2]?.value || inputs[2]?.getAttribute("value") || "");

      const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : v || undefined;
      };

      const qty = qtyRaw ? toNum(qtyRaw) : undefined;
      const dte = dteRaw ? toNum(dteRaw) : undefined;

      const entry = {
        side,
        type: optionType,
        qty,
        dte,
        legType,
      };
      entry.text = cleanText([side, optionType, qtyRaw && `qty ${qtyRaw}`, dteRaw && `dte ${dteRaw}`].filter(Boolean).join(" "));

      legs.push(entry);
    });

    return legs;
  }

  function extractDateRange(definitionPairs) {
    const raw = definitionPairs["Dates:"] || definitionPairs["Dates"] || "";
    if (!raw) return null;
    const match = raw.match(/from:\s*(.+?)\s*to:\s*(.+)/i);
    if (!match) return { text: raw };
    const [, from, to] = match;
    const fromISO = toISODate(cleanText(from));
    const toISO = toISODate(cleanText(to));
    return {
      from: fromISO || cleanText(from),
      to: toISO || cleanText(to),
      text: cleanText(raw),
    };
  }

  function deriveInputsFromLists(lists) {
    const derived = {};

    lists.forEach((list) => {
      const text = list.join("; ");

      list.forEach((item) => {
        const it = cleanText(item);

        if (/open\s+trades\s+at/i.test(it)) {
          const t = parseTime(it);
          if (t) derived.entryTime = t;
        }

        if (/exit\s+trades\s+at/i.test(it)) {
          const t = parseTime(it);
          if (t) derived.exitTime = t;
        }

        if (/profit\s*target\s*:\s*([\d.]+)/i.test(it)) {
          const m = it.match(/profit\s*target\s*:\s*([\d.]+)/i);
          if (m) {
            derived.profitTarget = Number(m[1]);
            derived.profitTargetMode = "%";
          }
        }

        if (/use\s+exact\s+dte/i.test(it)) derived.useExactDTE = true;

        if (/vix\s*:\s*max\s*([\d.]+)/i.test(it)) {
          const m = it.match(/vix\s*:\s*max\s*([\d.]+)/i);
          if (m) {
            derived.vixMax = Number(m[1]);
            derived.useVix = true;
          }
        }

        if (/cap\s+profits/i.test(it)) derived.capProfits = true;

        if (/every\s+/i.test(it)) {
          const days = parseDays(it);
          if (days) derived.entryDays = days;
        }
      });

      if (/contract\(s\)/i.test(text)) {
        const m = text.match(/up\s+to\s+(\d+)/i);
        if (m) derived.maxContractsPerTrade = Number(m[1]);
      }

      if (/allocate\s+(\d+)%/i.test(text)) {
        const m = text.match(/allocate\s+(\d+)%/i);
        if (m) derived.marginAllocationPct = Number(m[1]);
      }
    });

    return derived;
  }

  function buildPayload() {
    const header = extractHeader();
    const definitionPairs = extractDefinitionPairs();
    const labeledValues = extractLabeledValues();
    const headingPairs = extractHeadingPairs();
    const lists = extractLists();
    const legs = extractLegsTable();
    const derivedInputs = deriveInputsFromLists(lists);

    const combined = { ...definitionPairs, ...headingPairs, ...labeledValues };
    Object.keys(combined).forEach((key) => {
      const val = combined[key];
      const keyWords = key.split(" ").length;
      const valWords = typeof val === "string" ? val.split(" ").length : 0;
      const looksCombinedMetric = /Total Premium|Starting Capital|Ending Capital|Trades|Winners/i.test(key);
      if (looksCombinedMetric || keyWords > 4 || valWords > 8) delete combined[key];
    });
    const dateRange = extractDateRange(definitionPairs);

    const payload = {
      url: location.href,
      title: document.title,
      scrapedAt: new Date().toISOString(),
      header,
      metrics: { ...definitionPairs },
      dateRange,
      labeledValues: combined,
      lists,
      legs,
      ...derivedInputs,
    };

    // Improve readability for Entry/Exit/Misc using list bullets when present
    lists.forEach((list) => {
      const text = list.join("; ");
      if (/open trades|daily|dte|portfolio|contract|ema/i.test(text)) payload.metrics.Entry = text;
      else if (/stop loss|exit/i.test(text)) payload.metrics.Exit = text;
      else if (/fee|slippage|cap/i.test(text)) payload.metrics.Misc = text;
    });

    return payload;
  }

  function render() {
    state.data = buildPayload();
    textArea.value = JSON.stringify(state.data, null, 2);
  }

  copyButton.addEventListener("click", async () => {
    if (!state.data) render();
    try {
      await navigator.clipboard.writeText(textArea.value);
      setStatus("Copied");
    } catch (err) {
      setStatus("Clipboard blocked");
    }
  });

  refreshButton.addEventListener("click", () => {
    render();
    setStatus("Refreshed");
  });

  const debouncedRender = debounce(render, 200);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (panel.contains(m.target)) continue; // ignore our own overlay
      debouncedRender();
      break;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  render();
})();
