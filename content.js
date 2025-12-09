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
  panel.open = true;
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

  function extractLegsTable() {
    const legs = [];
    const legsDt = Array.from(document.querySelectorAll("dt")).find((el) => /Legs/i.test(el.textContent || ""));
    const table = legsDt?.nextElementSibling?.querySelector("table");
    if (!table) return legs;
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (!isReadable(row)) return;
      const text = cleanText(row.textContent || "");
      if (text) legs.push(text);
    });
    return legs;
  }

  function buildPayload() {
    const header = extractHeader();
    const definitionPairs = extractDefinitionPairs();
    const labeledValues = extractLabeledValues();
    const headingPairs = extractHeadingPairs();
    const lists = extractLists();
    const legs = extractLegsTable();

    const combined = { ...definitionPairs, ...headingPairs, ...labeledValues };

    const payload = {
      url: location.href,
      title: document.title,
      scrapedAt: new Date().toISOString(),
      header,
      labeledValues: combined,
      lists,
      legs,
    };

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

  render();
})();
