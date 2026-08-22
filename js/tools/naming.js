/* ============================================================
   tools/naming.js — "Name the Map" tool
   Type a province name; the matching province lights up.
   Depends on: app.js (escapeHtml, setSidebarTitle, showGamesTool,
     _setInfoPanelHtml, requestMapRender, _g, PROVINCE_REGION)
   ============================================================ */
"use strict";

let _namingTargets = null;
let _namingGuessedKeys = new Set();
let _namingGuessedList = []; // { type, id } newest-first
let _namingStartTime = null;
let _namingTimer = null;

// Region → island group, used to organize the found-provinces list
const _NAMING_REGION_ISLAND = {
  "Region I — Ilocos": "Luzon",
  "Region II — Cagayan Valley": "Luzon",
  "Region III — Central Luzon": "Luzon",
  "Region IVA — Calabarzon": "Luzon",
  MIMAROPA: "Luzon",
  "Region V — Bicol": "Luzon",
  "NCR — National Capital Region": "Luzon",
  CAR: "Luzon",
  "Region VI — Western Visayas": "Visayas",
  "Region VII — Central Visayas": "Visayas",
  "Region VIII — Eastern Visayas": "Visayas",
  "Region IX — Zamboanga Peninsula": "Mindanao",
  "Region X — Northern Mindanao": "Mindanao",
  "Region XI — Davao Region": "Mindanao",
  "Region XII — SOCCSKSARGEN": "Mindanao",
  "Region XIII — Caraga": "Mindanao",
  BARMM: "Mindanao",
};
const _NAMING_ISLAND_ORDER = ["Luzon", "Visayas", "Mindanao"];

function _namingIslandGroup(provinceId) {
  return _NAMING_REGION_ISLAND[PROVINCE_REGION[provinceId]] || "Luzon";
}

function _namingNormalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function _namingBuildTargets() {
  if (_namingTargets) return _namingTargets;
  const provinces = Object.keys(PROVINCE_REGION);
  const aliasToTarget = new Map();
  provinces.forEach((p) => {
    aliasToTarget.set(_namingNormalize(p), { type: "province", id: p });
  });
  _namingTargets = { provinces, aliasToTarget, total: provinces.length };
  return _namingTargets;
}

function _namingMarkProvinceFound(id) {
  const grp = _g.selectAll(".province-group").filter((d) => d.id === id).node();
  if (grp) d3.select(grp).classed("is-naming-found", true);
}

function _namingClearFound() {
  if (_g) _g.selectAll(".province-group.is-naming-found").classed("is-naming-found", false);
  _namingGuessedKeys = new Set();
  _namingGuessedList = [];
  requestMapRender();
}

function _namingReset() {
  if (_namingTimer) clearInterval(_namingTimer);
  _namingTimer = null;
  _namingStartTime = null;
  _namingClearFound();
  _namingHideInputWrap();
  document.documentElement.classList.remove("naming-active");
}

// Focus the input the moment the player starts typing anywhere on the page,
// so they don't have to click back into the field between guesses.
function _namingHandleGlobalKeydown(e) {
  if (_activeToolId !== "naming") return;
  const input = document.getElementById("naming-input");
  if (!input || document.activeElement === input) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  input.focus();
}

function _namingBindAutoFocus() {
  if (document.body.dataset.namingAutoFocusBound) return;
  document.body.dataset.namingAutoFocusBound = "true";
  document.addEventListener("keydown", _namingHandleGlobalKeydown);
}

function _namingShowInputWrap() {
  const wrap = document.getElementById("naming-input-wrap");
  const input = document.getElementById("naming-input");
  if (!wrap || !input) return;
  wrap.classList.add("is-active");
  wrap.setAttribute("aria-hidden", "false");
  input.value = "";
  input.addEventListener("keydown", _namingHandleKeydown);
  input.addEventListener("input", _namingHandleInput);
  _namingInitDrag();
  _namingBindAutoFocus();
  _namingUpdateProgress();
  setTimeout(() => input.focus(), 50);
}

function _namingHideInputWrap() {
  const wrap = document.getElementById("naming-input-wrap");
  const input = document.getElementById("naming-input");
  if (!wrap || !input) return;
  wrap.classList.remove("is-active");
  wrap.setAttribute("aria-hidden", "true");
  input.removeEventListener("keydown", _namingHandleKeydown);
  input.removeEventListener("input", _namingHandleInput);
  input.value = "";
}

function _namingFormatTime(elapsed) {
  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, "0");
  return `${String(mins).padStart(2, "0")}:${secs}`;
}

function _namingUpdateTimer() {
  const timer = document.getElementById("naming-timer");
  if (!timer || _namingStartTime === null) return;
  timer.textContent = _namingFormatTime(Math.floor((Date.now() - _namingStartTime) / 1000));
}

function _namingStartTimer() {
  if (_namingStartTime !== null) return;
  _namingStartTime = Date.now();
  _namingUpdateTimer();
  _namingTimer = setInterval(_namingUpdateTimer, 1000);
}

function _namingHandleInput(e) {
  _namingClearInvalid(e);
  if (e.target.value.length > 0) _namingStartTimer();
}

function _namingInitDrag() {
  const wrap = document.getElementById("naming-input-wrap");
  const handle = document.getElementById("naming-drag-handle");
  const mapWrap = document.getElementById("map-wrap");
  if (!wrap || !handle || !mapWrap || handle.dataset.namingDragBound) return;
  handle.dataset.namingDragBound = "true";

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    const wrapRect = wrap.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = wrapRect.left - mapWrap.getBoundingClientRect().left;
    startTop = wrapRect.top - mapWrap.getBoundingClientRect().top;
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const mapRect = mapWrap.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    let left = startLeft + (e.clientX - startX);
    let top = startTop + (e.clientY - startY);
    left = Math.min(Math.max(left, 0), mapRect.width - wrapRect.width);
    top = Math.min(Math.max(top, 0), mapRect.height - wrapRect.height);
    wrap.style.left = `${left}px`;
    wrap.style.top = `${top}px`;
  });

  const stopDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

function _namingUpdateProgress() {
  const t = _namingBuildTargets();
  const scoreVal = document.getElementById("naming-score-val");
  if (scoreVal) scoreVal.textContent = `${_namingGuessedKeys.size} / ${t.total}`;
}

function _namingRenderFoundList() {
  const list = document.getElementById("naming-found-list");
  if (!list) return;

  const grouped = new Map(_NAMING_ISLAND_ORDER.map((g) => [g, []]));
  _namingGuessedList.forEach((g) => {
    grouped.get(_namingIslandGroup(g.id)).push(g);
  });

  list.innerHTML = _NAMING_ISLAND_ORDER.filter((group) => grouped.get(group).length)
    .map((group) => {
      const chips = grouped
        .get(group)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((g) => `<span class="naming-chip naming-chip--${g.type}">${escapeHtml(g.id)}</span>`)
        .join("");
      return `
        <div class="naming-group">
          <div class="naming-group-title">${group} <span class="naming-group-count">${grouped.get(group).length}</span></div>
          <div class="naming-group-chips">${chips}</div>
        </div>
      `;
    })
    .join("");
}

function _namingHandleKeydown(e) {
  if (e.key !== "Enter") return;
  const norm = _namingNormalize(e.target.value);
  if (!norm) return;
  const t = _namingBuildTargets();
  const match = t.aliasToTarget.get(norm);
  const key = match ? `${match.type}:${match.id}` : null;
  if (!match || _namingGuessedKeys.has(key)) {
    _namingFlashInvalid(e.target);
    return;
  }

  _namingGuessedKeys.add(key);
  _namingGuessedList.unshift(match);
  e.target.classList.remove("naming-input--invalid");
  e.target.value = "";

  _namingMarkProvinceFound(match.id);
  requestMapRender();
  _namingUpdateProgress();
  _namingRenderFoundList();

  if (_namingGuessedKeys.size >= t.total) _namingComplete();
}

function _namingFlashInvalid(input) {
  input.classList.remove("naming-input--invalid");
  void input.offsetWidth;
  input.classList.add("naming-input--invalid");
}

function _namingClearInvalid(e) {
  e.target.classList.remove("naming-input--invalid");
}

function _namingRenderPanel(animatePanel = false) {
  const t = _namingBuildTargets();
  setSidebarTitle("Name the Map");
  _setInfoPanelHtml(
    `
    <div class="naming-top-row">
      <button class="tool-back-btn" id="naming-back">‹ Quit</button>
      <span class="naming-timer" id="naming-timer" aria-label="Elapsed time">00:00</span>
    </div>
    <div class="quiz-score-bar">
      <span class="quiz-score-label">Found</span>
      <span class="quiz-score-val" id="naming-score-val">${_namingGuessedKeys.size} / ${t.total}</span>
    </div>
    <p class="naming-hint">Type a province name in the box on the top-left of the map, then press Enter — matching provinces light up instantly.</p>
    <div class="naming-found-list" id="naming-found-list"></div>
  `,
    "left",
    animatePanel,
  );
  document.getElementById("naming-back").addEventListener("click", () => {
    _namingReset();
    showGamesTool("right", true);
  });
  _namingRenderFoundList();
}

function _namingComplete() {
  const elapsed = _namingStartTime === null
    ? 0
    : Math.max(0, Math.round((Date.now() - _namingStartTime) / 1000));
  const elapsedLabel = _namingFormatTime(elapsed);
  if (_namingTimer) clearInterval(_namingTimer);
  _namingTimer = null;
  _namingHideInputWrap();
  setSidebarTitle("Name the Map");
  _setInfoPanelHtml(
    `
    <div class="naming-top-row">
      <button class="tool-back-btn" id="naming-back">‹ Quit</button>
      <span class="naming-timer" aria-label="Elapsed time">${elapsedLabel}</span>
    </div>
    <div class="quiz-summary">
      <div class="quiz-summary-grade">🏆</div>
      <div class="quiz-summary-tag">All provinces named!</div>
      <div class="quiz-summary-score">${elapsedLabel}</div>
      <button class="quiz-play-again-btn" id="naming-play-again">Play Again</button>
    </div>
  `,
    "left",
    false,
  );
  document.getElementById("naming-back").addEventListener("click", () => {
    _namingReset();
    showGamesTool("right", true);
  });
  document.getElementById("naming-play-again").addEventListener("click", () => {
    showNamingTool(false);
  });
}

function showNamingTool(animatePanel = false) {
  _activeToolId = "naming";
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
  }
  if (typeof window._resetZoom === "function") window._resetZoom();
  document.documentElement.classList.add("naming-active");
  _namingClearFound();
  _namingStartTime = null;
  requestMapRender();
  _namingRenderPanel(animatePanel);
  _namingShowInputWrap();
}
