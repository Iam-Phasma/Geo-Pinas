/* ============================================================
   tools/travel.js — Travel Level tool
   Defines: _LUZON_REGIONS, _VISAYAS_REGIONS, _MINDANAO_REGIONS
            (also referenced by roulette.js — must load first)
   Depends on: app.js (escapeHtml, setSidebarTitle, showToolsHome,
     PROVINCE_REGION, _g, _selectedGroup, _activeToolId,
     _clearQuizHighlight, clearWeatherEmoji, _getProvScreenPos)
   ============================================================ */
"use strict";

// ── Travel state ───────────────────────────────────────────────
let _travelMap = {};

// ── Travel Level tool ──────────────────────────────────────────
const TRAVEL_LEVELS = [
  { id: "lived",    label: "Lived",    color: "#7c3aed", weight: 5, desc: "Spent a significant part of life here" },
  { id: "stayed",   label: "Stayed",   color: "#2563eb", weight: 4, desc: "Slept at least one night" },
  { id: "visited",  label: "Visited",  color: "#0891b2", weight: 3, desc: "Spent hours exploring" },
  { id: "alighted", label: "Alighted", color: "#16a34a", weight: 2, desc: "Short stopover or transfer" },
  { id: "passed",   label: "Passed",   color: "#d97706", weight: 1, desc: "Passed through, never set foot" },
];

const _LUZON_REGIONS    = ["Region I — Ilocos","Region II — Cagayan Valley","Region III — Central Luzon","Region IVA — Calabarzon","MIMAROPA","Region V — Bicol","NCR — National Capital Region","CAR"];
const _VISAYAS_REGIONS  = ["Region VI — Western Visayas","Region VII — Central Visayas","Region VIII — Eastern Visayas"];
const _MINDANAO_REGIONS = ["Region IX — Zamboanga Peninsula","Region X — Northern Mindanao","Region XI — Davao Region","Region XII — SOCCSKSARGEN","Region XIII — Caraga","BARMM"];

// Ordered region list with group membership (defined after the region arrays above)
const _RL_GROUPS = [
  {
    key: "luzon", label: "Luzon", regions: _LUZON_REGIONS,
    regionLabels: {
      "NCR — National Capital Region": "NCR",
      "CAR": "CAR",
      "Region I — Ilocos": "Region I",
      "Region II — Cagayan Valley": "Region II",
      "Region III — Central Luzon": "Region III",
      "Region IVA — Calabarzon": "Region IV-A",
      "MIMAROPA": "MIMAROPA",
      "Region V — Bicol": "Region V",
    },
  },
  {
    key: "visayas", label: "Visayas", regions: _VISAYAS_REGIONS,
    regionLabels: {
      "Region VI — Western Visayas": "Region VI",
      "Region VII — Central Visayas": "Region VII",
      "Region VIII — Eastern Visayas": "Region VIII",
    },
  },
  {
    key: "mindanao", label: "Mindanao", regions: _MINDANAO_REGIONS,
    regionLabels: {
      "Region IX — Zamboanga Peninsula": "Region IX",
      "Region X — Northern Mindanao": "Region X",
      "Region XI — Davao Region": "Region XI",
      "Region XII — SOCCSKSARGEN": "Region XII",
      "Region XIII — Caraga": "Region XIII",
      "BARMM": "BARMM",
    },
  },
];

function _travelProvsByRegions(regions) {
  return Object.entries(PROVINCE_REGION).filter(([, r]) => regions.includes(r)).map(([p]) => p);
}

const TRAVEL_ACHIEVEMENTS = [
  { id: "first",   icon: "👣", title: "First Steps",        desc: "Log your first province",
    progress: m => ({ n: Math.min(Object.keys(m).length, 1), total: 1 }) },
  { id: "ten",     icon: "🗺️", title: "Wanderer",           desc: "Log 10 provinces",
    progress: m => ({ n: Math.min(Object.keys(m).length, 10), total: 10 }) },
  { id: "twenty5", icon: "🌟", title: "Trailblazer",        desc: "Log 25 provinces",
    progress: m => ({ n: Math.min(Object.keys(m).length, 25), total: 25 }) },
  { id: "fifty",   icon: "🏅", title: "Half the Map",       desc: "Log 50 provinces",
    progress: m => ({ n: Math.min(Object.keys(m).length, 50), total: 50 }) },
  { id: "home",    icon: "🏠", title: "Called It Home",     desc: "Mark at least one province as Lived",
    progress: m => ({ n: Object.values(m).some(v => v === "lived") ? 1 : 0, total: 1 }) },
  { id: "luzon",   icon: "🚗", title: "Luzon Explorer",     desc: "Log all Luzon provinces",
    progress: m => { const p = _travelProvsByRegions(_LUZON_REGIONS);    return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "visayas", icon: "⛵", title: "Visayas Voyager",    desc: "Log all Visayas provinces",
    progress: m => { const p = _travelProvsByRegions(_VISAYAS_REGIONS);  return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "mndnao",  icon: "🦅", title: "Mindanao Eagle",     desc: "Log all Mindanao provinces",
    progress: m => { const p = _travelProvsByRegions(_MINDANAO_REGIONS); return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "car",     icon: "⛰️", title: "Highland Bound",     desc: "Log all Cordillera provinces",
    progress: m => { const p = _travelProvsByRegions(["CAR"]);   return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "barmm",   icon: "🕌", title: "BARMM Brave",        desc: "Log all BARMM provinces",
    progress: m => { const p = _travelProvsByRegions(["BARMM"]); return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "legend",  icon: "🇵🇭", title: "Philippine Legend", desc: "Log all 83 provinces",
    progress: m => { const t = Object.keys(PROVINCE_REGION).length; return { n: Math.min(Object.keys(m).length, t), total: t }; } },
];

function _travelLoad() {
  try {
    const raw = localStorage.getItem("geopinas-travel");
    if (raw) _travelMap = JSON.parse(raw);
  } catch { /* ignore */ }
}

function _travelSave() {
  try { localStorage.setItem("geopinas-travel", JSON.stringify(_travelMap)); } catch { /* ignore */ }
}

function _travelSetLevel(provId, levelId) {
  if (levelId) _travelMap[provId] = levelId;
  else delete _travelMap[provId];
  _travelSave();
  _applyTravelColors();
}

function _applyTravelColors() {
  if (!_g) return;
  _g.selectAll(".province-group").each(function(d) {
    const lvl = _travelMap[d.id];
    TRAVEL_LEVELS.forEach(l => d3.select(this).classed(`is-tl-${l.id}`, lvl === l.id));
  });
}

function _clearTravelColors() {
  if (!_g) return;
  _g.selectAll(".province-group").each(function() {
    TRAVEL_LEVELS.forEach(l => d3.select(this).classed(`is-tl-${l.id}`, false));
  });
  _closeTravelPicker();
}

function _travelScore() {
  const all = Object.keys(PROVINCE_REGION);
  const logged = all.filter(p => _travelMap[p]).length;
  return { score: Math.round(logged / all.length * 1000) / 10, logged, total: all.length };
}

function showTravelTool() {
  _activeToolId = "travel";
  _clearQuizHighlight();
  clearWeatherEmoji();
  _applyTravelColors();
  setSidebarTitle("Travel Level");
  _renderTravelOverview();
}

function _renderTravelOverview() {
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
  }

  const { score, logged, total } = _travelScore();

  const legendHtml = TRAVEL_LEVELS.map(l => `
    <span class="tl-legend-item">
      <span class="tl-legend-dot" style="background:${l.color}"></span>
      <span class="tl-legend-label">${l.label}</span>
    </span>
  `).join("");

  const achieveHtml = TRAVEL_ACHIEVEMENTS.map(a => {
    const { n, total: t } = a.progress(_travelMap);
    const unlocked = n >= t;
    return `
      <div class="tl-achieve${unlocked ? " is-unlocked" : ""}">
        <span class="tl-achieve-icon">${a.icon}</span>
        <div class="tl-achieve-body">
          <span class="tl-achieve-title">${escapeHtml(a.title)}</span>
          <span class="tl-achieve-desc">${escapeHtml(a.desc)}</span>
        </div>
        <span class="tl-achieve-progress">${n}/${t}</span>
      </div>
    `;
  }).join("");

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="tl-back">‹ Back</button>
    <div class="tl-body">
      <div class="tl-score-wrap">
        <span class="tl-score-num">${score}<span class="tl-score-pct">%</span></span>
        <span class="tl-score-label">${logged} of ${total} provinces logged</span>
      </div>
      <div class="tl-progress-bar-wrap">
        <div class="tl-progress-bar">
          <div class="tl-progress-fill" style="width:${score}%"></div>
        </div>
      </div>
      <div class="tl-legend">${legendHtml}</div>
      <p class="tl-hint">Tap a province on the map to set your travel level.</p>
      <div class="tl-achieve-header">Achievements</div>
      <div class="tl-achieve-list">${achieveHtml}</div>
      <div class="tl-reset-wrap">
        <button class="tl-reset-btn" id="tl-reset-btn" title="Hold to reset all travel data">
          <span class="tl-reset-label">Hold to Reset</span>
          <span class="tl-reset-bar"><span class="tl-reset-fill" id="tl-reset-fill"></span></span>
        </button>
      </div>
    </div>
  `;

  document.getElementById("tl-back").addEventListener("click", () => {
    _activeToolId = null;
    _clearTravelColors();
    showToolsHome();
  });

  // Hold-to-reset: 3 seconds
  const resetBtn = document.getElementById("tl-reset-btn");
  const resetFill = document.getElementById("tl-reset-fill");
  const HOLD_MS = 3000;
  let _holdStart = null;
  let _holdRaf = null;

  function _holdTick() {
    const elapsed = Date.now() - _holdStart;
    const pct = Math.min(elapsed / HOLD_MS * 100, 100);
    resetFill.style.width = pct + "%";
    if (pct < 100) {
      _holdRaf = requestAnimationFrame(_holdTick);
    } else {
      _travelMap = {};
      _travelSave();
      _applyTravelColors();
      _renderTravelOverview();
    }
  }

  function _startHold() {
    _holdStart = Date.now();
    resetBtn.classList.add("is-holding");
    _holdRaf = requestAnimationFrame(_holdTick);
  }

  function _cancelHold() {
    if (_holdRaf) cancelAnimationFrame(_holdRaf);
    _holdRaf = null;
    _holdStart = null;
    resetFill.style.width = "0%";
    resetBtn.classList.remove("is-holding");
  }

  resetBtn.addEventListener("mousedown", _startHold);
  resetBtn.addEventListener("touchstart", (e) => { e.preventDefault(); _startHold(); }, { passive: false });
  resetBtn.addEventListener("mouseup", _cancelHold);
  resetBtn.addEventListener("mouseleave", _cancelHold);
  resetBtn.addEventListener("touchend", _cancelHold);
  resetBtn.addEventListener("touchcancel", _cancelHold);
}

function _closeTravelPicker() {
  const popup = document.getElementById("tl-picker-popup");
  if (popup) {
    popup.classList.remove("is-visible");
    popup.innerHTML = "";
  }
}

function _renderTravelPicker(d, event) {
  const provId = d.id;
  const current = _travelMap[provId];
  const region = PROVINCE_REGION[provId] ?? "";

  const levelsHtml = TRAVEL_LEVELS.map(l => `
    <button class="tl-level-btn${current === l.id ? " is-active" : ""}" data-level="${l.id}"
      style="--tl-color:${l.color}">
      <span class="tl-level-dot"></span>
      <span class="tl-level-body">
        <span class="tl-level-label">${l.label}</span>
        <span class="tl-level-desc">${l.desc}</span>
      </span>
      ${current === l.id ? `<span class="tl-level-check">✓</span>` : ""}
    </button>
  `).join("");

  const popup = document.getElementById("tl-picker-popup");
  popup.innerHTML = `
    <div class="tl-popup-header">
      <div class="tl-popup-prov">
        <span class="tl-picker-name">${escapeHtml(provId)}</span>
        <span class="tl-picker-region">${escapeHtml(region)}</span>
      </div>
      <button class="tl-popup-close" id="tl-popup-close" aria-label="Close">✕</button>
    </div>
    <div class="tl-levels-list">${levelsHtml}</div>
    ${current ? `<button class="tl-clear-btn" id="tl-clear">Remove level</button>` : ""}
  `;

  // Position near clicked province, keeping popup inside map bounds
  const wrap = document.getElementById("map-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const popupW = 240;
  const popupH = 320;
  let x, y;

  if (event) {
    x = event.clientX - wrapRect.left + 12;
    y = event.clientY - wrapRect.top - 20;
  } else {
    const pos = _getProvScreenPos(d);
    x = pos ? pos.x + 12 : wrapRect.width / 2;
    y = pos ? pos.y - 20 : wrapRect.height / 2;
  }

  // Clamp inside map
  x = Math.min(Math.max(x, 8), wrapRect.width - popupW - 8);
  y = Math.min(Math.max(y, 8), wrapRect.height - popupH - 8);

  popup.style.left = x + "px";
  popup.style.top = y + "px";
  popup.classList.add("is-visible");
  popup.removeAttribute("aria-hidden");

  document.getElementById("tl-popup-close").addEventListener("click", (e) => {
    e.stopPropagation();
    _closeTravelPicker();
    if (_selectedGroup) {
      d3.select(_selectedGroup).classed("is-selected", false);
      _selectedGroup = null;
    }
  });

  popup.querySelectorAll(".tl-level-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      _travelSetLevel(provId, btn.dataset.level);
      _renderTravelOverview();
      _renderTravelPicker(d, null);
    });
  });

  popup.querySelector("#tl-clear")?.addEventListener("click", (e) => {
    e.stopPropagation();
    _travelSetLevel(provId, null);
    _renderTravelOverview();
    _renderTravelPicker(d, null);
  });
}
