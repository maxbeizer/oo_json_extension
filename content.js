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

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "Apply to form";

  const status = document.createElement("span");
  status.className = "llm-json-status";

  controls.append(copyButton, refreshButton, applyButton, status);

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

  function setInputValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSelectText(button, value) {
    if (!button) return;
    const span = button.querySelector("span.block.truncate");
    if (span) span.textContent = value;
    button.dispatchEvent(new Event("click", { bubbles: true }));
    button.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findToggle(labelText) {
    const toggles = Array.from(document.querySelectorAll("button.toggle"));
    return toggles.find((btn) => {
      const span = btn.nextElementSibling;
      if (!span) return false;
      return cleanText(span.textContent || "").toLowerCase().includes(labelText.toLowerCase());
    });
  }

  function findLabeledInput(labelText) {
    const labels = Array.from(document.querySelectorAll("label, .label"));
    const target = labels.find((el) => cleanText(el.textContent || "").toLowerCase().includes(labelText.toLowerCase()));
    if (!target) return null;
    const container = target.closest("div") || target.parentElement;
    if (!container) return null;
    const input = container.querySelector("input, textarea");
    return input;
  }

  function findDayButtons() {
    const abbrs = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];
    const buttons = Array.from(document.querySelectorAll("button"));
    const map = {};
    buttons.forEach((btn) => {
      const text = cleanText(btn.textContent || "");
      if (abbrs.includes(text)) map[text] = btn;
    });
    return map;
  }

  function findLegGroups() {
    // Leg rows in the builder use a consistent flex container with gap-2 and text-white.
    return Array.from(document.querySelectorAll(".flex.flex-wrap.gap-2.items-center.text-white"));
  }

  function clickButtonByText(root, text) {
    const btn = Array.from(root.querySelectorAll("button")).find((b) => cleanText(b.textContent || "").toLowerCase() === text.toLowerCase());
    if (btn) btn.click();
  }

  function applyLegs(legs) {
    if (!Array.isArray(legs) || !legs.length) return;
    const groups = findLegGroups();
    legs.forEach((leg, idx) => {
      const group = groups[idx];
      if (!group) return;
      if (leg.side) clickButtonByText(group, leg.side);
      if (leg.type) clickButtonByText(group, leg.type);

      const inputs = Array.from(group.querySelectorAll("input"));
      const qtyInput = inputs.find((inp) => inp.nextElementSibling && /QTY/i.test(inp.nextElementSibling.textContent || ""));
      const dteInput = inputs.find((inp) => inp.nextElementSibling && /DTE/i.test(inp.nextElementSibling.textContent || ""));

      if (leg.qty) setInputValue(qtyInput, leg.qty);
      if (leg.dte) setInputValue(dteInput, leg.dte);
    });
  }

  function applyDateRange(dateRange) {
    if (!dateRange) return;
    if (dateRange.from) {
      const start = findLabeledInput("Start Date");
      setInputValue(start, dateRange.from);
    }
    if (dateRange.to) {
      const end = findLabeledInput("End Date");
      setInputValue(end, dateRange.to);
    }
  }

  function applyTicker(header) {
    if (!header || !header.title) return;
    const tickerButton = Array.from(document.querySelectorAll("button.selectInput")).find((b) => /ticker/i.test(b.closest("div")?.previousElementSibling?.textContent || ""));
    if (!tickerButton) return;
    setSelectText(tickerButton, header.title);
  }

  function applyMiscMetrics(data) {
    if (!data || !data.metrics) return;
    if (data.metrics["Starting Capital"]) {
      const startFunds = findLabeledInput("Starting Funds");
      setInputValue(startFunds, data.metrics["Starting Capital"].replace(/[^\d.]/g, ""));
    }
    if (data.metrics["Entry Slippage"]) {
      const entrySlip = findLabeledInput("Entry Slippage");
      setInputValue(entrySlip, data.metrics["Entry Slippage"].replace(/[^\d.]/g, ""));
    }
    if (data.metrics["Exit Slippage"]) {
      const exitSlip = findLabeledInput("Exit Slippage");
      setInputValue(exitSlip, data.metrics["Exit Slippage"].replace(/[^\d.]/g, ""));
    }
    if (data.metrics["Opening Fees"] || data.metrics["Opening Fees:"]) {
      const openFees = findLabeledInput("Opening");
      setInputValue(openFees, (data.metrics["Opening Fees"] || data.metrics["Opening Fees:"]).replace(/[^\d.]/g, ""));
    }
    if (data.metrics["Closing Fees"] || data.metrics["Closing Fees:"]) {
      const closeFees = findLabeledInput("Closing");
      setInputValue(closeFees, (data.metrics["Closing Fees"] || data.metrics["Closing Fees:"]).replace(/[^\d.]/g, ""));
    }
  }

  function applyDerivedInputs(data) {
    if (!data) return;

    if (data.entryTime) setInputValue(findLabeledInput("Entry Time"), data.entryTime);
    if (data.exitTime) setInputValue(findLabeledInput("Exit Time"), data.exitTime);

    if (data.vixMax !== undefined && data.vixMax !== null) {
      const vixInput = findLabeledInput("VIX");
      setInputValue(vixInput, data.vixMax);
    }

    if (data.profitTarget !== undefined) {
      const ptInput = findLabeledInput("Profit Target");
      setInputValue(ptInput, data.profitTarget);
    }

    if (data.profitTargetMode) {
      const ptMode = Array.from(document.querySelectorAll("button.selectInput")).find((b) => /profit/i.test(b.closest("div")?.previousElementSibling?.textContent || ""));
      setSelectText(ptMode, data.profitTargetMode);
    }

    if (data.capProfits !== undefined) {
      const toggle = findToggle("Cap");
      const desired = Boolean(data.capProfits);
      if (toggle) {
        const isOn = toggle.getAttribute("aria-checked") === "true";
        if (isOn !== desired) toggle.click();
      }
    }

    if (Array.isArray(data.entryDays)) {
      const dayMap = {
        Monday: "M",
        Tuesday: "Tu",
        Wednesday: "W",
        Thursday: "Th",
        Friday: "F",
        Saturday: "Sa",
        Sunday: "Su",
      };
      const buttons = findDayButtons();
      Object.entries(dayMap).forEach(([day, abbr]) => {
        const btn = buttons[abbr];
        if (!btn) return;
        const desired = data.entryDays.includes(day);
        const isOn = /ooGreen/.test(btn.className || "");
        if (desired !== isOn) btn.click();
      });
    }
  }

  function applyToForm(jsonText) {
    if (!jsonText) return setStatus("Nothing to apply");
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setStatus("Invalid JSON");
      return;
    }

    const isInputSchema = parsed.dates && parsed.ticker;

    if (isInputSchema) {
      applyDateRange(parsed.dates);
      applyTicker({ title: parsed.ticker });
      applyLegs(parsed.legs);

      applyDerivedInputs(parsed);

      if (parsed.startingFunds) setInputValue(findLabeledInput("Starting Funds"), parsed.startingFunds);
      if (parsed.marginAllocationPct) setInputValue(findLabeledInput("Margin Allocation"), parsed.marginAllocationPct);
      if (parsed.maxContractsPerTrade) setInputValue(findLabeledInput("Max Contracts Per Trade"), parsed.maxContractsPerTrade);
      if (parsed.entrySlippage !== undefined) setInputValue(findLabeledInput("Entry Slippage"), parsed.entrySlippage);
      if (parsed.exitSlippage !== undefined) setInputValue(findLabeledInput("Exit Slippage"), parsed.exitSlippage);
      if (parsed.openingFees !== undefined) setInputValue(findLabeledInput("Opening"), parsed.openingFees);
      if (parsed.closingFees !== undefined) setInputValue(findLabeledInput("Closing"), parsed.closingFees);
      if (parsed.roundStrikesTo !== undefined) setInputValue(findLabeledInput("Round Strikes"), parsed.roundStrikesTo);

      if (parsed.entryTime) setInputValue(findLabeledInput("Entry Time"), parsed.entryTime);
      if (parsed.entryFrequency) {
        const freqBtn = Array.from(document.querySelectorAll("button.selectInput")).find((b) => /frequency/i.test(b.closest("div")?.previousElementSibling?.textContent || ""));
        setSelectText(freqBtn, parsed.entryFrequency);
      }

      const toggleMap = [
        ["Use Exact DTE", parsed.useExactDTE],
        ["Use Floating Entry Time", parsed.useFloatingEntryTime],
        ["Use VIX", parsed.useVix],
        ["Use Technical Indicators", parsed.useTechnicalIndicators || parsed.exitUseTechIndicators],
        ["Use Gaps", parsed.useGaps],
        ["Use Intraday Movement", parsed.useIntradayMovement],
        ["Use Opening Range Breakout", parsed.useOpeningRangeBreakout],
        ["Use Leg Groups", parsed.useLegGroups],
        ["Use Commissions & Fees", parsed.useFees],
        ["Use Slippage", parsed.useSlippage],
        ["Ignore Trades with Wide Bid-Ask Spread", parsed.ignoreWideBidAsk],
        ["Close Open Trades on Test Completion", parsed.closeOnCompletion],
        ["Use Min/Max Entry Premium", parsed.useMinMaxEntryPremium],
        ["Use Entry Short/Long Ratio", parsed.useEntryShortLongRatio],
        ["Use Blackout Days", parsed.useBlackoutDays],
        ["Re-Enter Trades After Exit", parsed.reenterAfterExit],
        ["Use Profit Actions", parsed.useProfitActions],
        ["Use Early Exit", parsed.useEarlyExit],
        ["Use Delta", parsed.exitUseDelta],
        ["Use Underlying Price Movement", parsed.exitUseUnderlyingMovement],
        ["Use Short/Long Ratio", parsed.exitUseShortLongRatio],
        ["Use VIX", parsed.exitUseVix]
      ];

      toggleMap.forEach(([label, value]) => {
        if (value === undefined) return;
        const toggle = findToggle(label);
        if (!toggle) return;
        const isOn = toggle.getAttribute("aria-checked") === "true";
        if (isOn !== Boolean(value)) toggle.click();
      });

      setStatus("Applied (input schema)");
    } else {
      applyDateRange(parsed.dateRange);
      applyTicker(parsed.header);
      applyLegs(parsed.legs);
      applyMiscMetrics(parsed);
      applyDerivedInputs(parsed);
      setStatus("Applied (result payload)");
    }
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

  applyButton.addEventListener("click", () => {
    applyToForm(textArea.value);
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
