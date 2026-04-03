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
    <div class="tl-top-row">
      <button class="tool-back-btn" id="tl-back">‹ Back</button>
      <button class="tl-snap-btn" id="tl-snap-btn" title="Snap">📸 Snap</button>
    </div>
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

  document.getElementById("tl-snap-btn").addEventListener("click", () => {
    _snapTravel();
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
      _closeTravelPicker();
    });
  });

  popup.querySelector("#tl-clear")?.addEventListener("click", (e) => {
    e.stopPropagation();
    _travelSetLevel(provId, null);
    _renderTravelOverview();
    _renderTravelPicker(d, null);
  });
}

// ── Snap / Postcard ────────────────────────────────────────────
function _snapTravel() {
  const btn = document.getElementById("tl-snap-btn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Rendering…"; }

  // Read live CSS variables so the snapshot matches the current canvas theme exactly
  const rootStyle   = getComputedStyle(document.documentElement);
  const getVar      = (v) => rootStyle.getPropertyValue(v).trim();
  const oceanColor  = getVar("--ocean")          || "#1b3a6b";
  const provFill    = getVar("--province-fill")  || "#166e3e";
  const provBorder  = getVar("--province-border")|| "#95ffc1";

  const COLOR_MAP = {};
  TRAVEL_LEVELS.forEach(l => { COLOR_MAP[l.id] = l.color; });

  const provPaths = PROVINCES.map(p => {
    const level = _travelMap[p.id];
    const fill  = level ? COLOR_MAP[level] : provFill;
    return `<g transform="${p.transform}">` +
      `<path d="${p.d}" fill="${fill}" stroke="${provBorder}" stroke-width="1" stroke-linejoin="round"/>` +
      `</g>`;
  }).join("");

  const svgStr = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="0 0 ${MAP_W} ${MAP_H}" width="${MAP_W}" height="${MAP_H}">`,
    `<defs>`,
    `<pattern id="ocean-wave" x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse">`,
    `<rect width="32" height="16" fill="none"/>`,
    `<path d="M0 12 L8 4 L16 12 L24 4 L32 12" fill="none" stroke="#5087df"`,
    ` stroke-opacity="0.35" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</pattern>`,
    `</defs>`,
    `<rect width="${MAP_W}" height="${MAP_H}" fill="${oceanColor}"/>`,
    `<rect width="${MAP_W}" height="${MAP_H}" fill="url(#ocean-wave)"/>`,
    provPaths,
    `</svg>`,
  ].join("");

  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl  = URL.createObjectURL(svgBlob);

  const done = (err) => {
    URL.revokeObjectURL(svgUrl);
    if (err) console.error("Snap failed:", err);
    if (btn) { btn.disabled = false; btn.innerHTML = "📸 Snap"; }
  };

  const mapImg = new Image();
  mapImg.onerror = () => done(new Error("map load failed"));
  mapImg.onload = () => {
    const bgImg = new Image();
    bgImg.onerror = () => done(new Error("bg load failed"));
    bgImg.onload = () => {
      const compassImg = new Image();
      compassImg.onerror = () => {
        try   { _showPostcardPreview(_buildPostcardCanvas(mapImg, bgImg, null, oceanColor)); done(null); }
        catch (e) { done(e); }
      };
      compassImg.onload = () => {
        try   { _showPostcardPreview(_buildPostcardCanvas(mapImg, bgImg, compassImg, oceanColor)); done(null); }
        catch (e) { done(e); }
      };
      compassImg.src = "assets/postcard/compass.webp";
    };
    bgImg.src = "assets/postcard/postcar-bg.webp";
  };
  mapImg.src = svgUrl;
}

function _buildPostcardCanvas(mapImg, bgImg, compassImg, oceanColor) {
  oceanColor = oceanColor || '#1b3a6b';
  // Stamp sits at (148,744)→(2327,2405) inside the 2475×3500 bg PNG.
  const SRC_X = 148, SRC_Y = 744, SRC_W = 2179, SRC_H = 1661;
  const CARD_W = 1310;
  const CARD_H = 1000;

  // Render at 2× for crisp edges on rotated elements, then downscale
  const SCALE = 2;
  const canvas = document.createElement("canvas");
  canvas.width  = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ── 1. Draw bg PNG cropped to stamp area ─────────────────────
  ctx.drawImage(bgImg, SRC_X, SRC_Y, SRC_W, SRC_H, 0, 0, CARD_W, CARD_H);

  // ── 2. Map photo box ──────────────────────────────────────────
  // Teeth zone inset ~7.8% each side; border = 18px uniform white; extra inset so mosaic shows
  const OUTER     = Math.round(CARD_H * 0.078);  // 78px — teeth boundary
  const MAP_EXTRA = 44;                           // extra gap: mosaic visible around map
  const INSET     = OUTER + MAP_EXTRA;            // 122px each edge
  const BORDER    = 18;
  const mapAR     = MAP_W / MAP_H;                // 840/1221 ≈ 0.688  (portrait)

  // Derive frame from map height so border is equal on all 4 sides
  const mapRH  = CARD_H - INSET * 2 - BORDER * 2;  // rendered map height
  const mapRW  = Math.round(mapRH * mapAR);           // rendered map width
  const FRAME_H = mapRH + BORDER * 2;
  const FRAME_W = mapRW + BORDER * 2;
  const FRAME_X = INSET;
  const FRAME_Y = INSET;

  // ── Rotate map frame + compass slightly counter-clockwise ────
  const TILT_DEG = -3.5;
  const tiltRad  = TILT_DEG * Math.PI / 180;
  const pivotX   = FRAME_X + FRAME_W / 2;
  const pivotY   = FRAME_Y + FRAME_H / 2;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(tiltRad);
  ctx.translate(-pivotX, -pivotY);

  // Shadow on the white frame
  ctx.shadowColor   = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur    = 50;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
  // Clear shadow so it doesn't affect subsequent draws
  ctx.shadowColor   = "transparent";
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(FRAME_X + BORDER, FRAME_Y + BORDER, mapRW, mapRH);
  ctx.clip();
  ctx.drawImage(mapImg, FRAME_X + BORDER, FRAME_Y + BORDER, mapRW, mapRH);
  ctx.restore();

  // ── 2b. Compass overlay — top-left of map ────────────────────
  if (compassImg) {
    // Determine tint: use Canvas to parse any CSS color format reliably
    const _cc = document.createElement('canvas');
    _cc.width = _cc.height = 1;
    const _cx = _cc.getContext('2d');
    _cx.fillStyle = oceanColor;
    _cx.fillRect(0, 0, 1, 1);
    const [cr, cg, cb] = _cx.getImageData(0, 0, 1, 1).data;
    const lum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
    const tint = lum < 128 ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.33)';

    // Compass bbox in full 2475x3500 src space: (622,872)→(1851,2304)
    const COMP_SX = 622, COMP_SY = 872, COMP_SW = 1229, COMP_SH = 1432;
    const compSize = Math.round(mapRH * 0.13);  // ~13% of map height
    const compX = FRAME_X + BORDER + 10;
    const compY = FRAME_Y + BORDER + 14;

    // Build tinted compass on a temp canvas
    const tmp = document.createElement('canvas');
    tmp.width = compSize; tmp.height = compSize;
    const tCtx = tmp.getContext('2d');
    tCtx.fillStyle = tint;
    tCtx.fillRect(0, 0, compSize, compSize);
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.drawImage(compassImg, COMP_SX, COMP_SY, COMP_SW, COMP_SH, 0, 0, compSize, compSize);

    ctx.globalAlpha = 0.82;
    ctx.drawImage(tmp, compX, compY);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore(); // end tilt

  // ── 3. Info panel — evenly distributed ───────────────────────
  const { score, logged, total } = _travelScore();
  const usedLevels = TRAVEL_LEVELS.filter(l =>
    Object.values(_travelMap).some(v => v === l.id)
  );
  const nLevels = usedLevels.length;

  // Font metrics (relative to CARD_H)
  const fs = (f) => Math.round(CARD_H * f);
  const titleH    = fs(0.120);
  const subtitleH = fs(0.040);
  const scoreH    = fs(0.120);
  const countH    = fs(0.040);
  const levHdrH   = fs(0.050);
  const levRowH   = fs(0.042);
  const dateH     = fs(0.070);

  // 4 content sections, 5 equal gaps (top, between each, bottom)
  const secA = titleH + subtitleH;
  const secB = scoreH + countH;
  const secC = nLevels > 0 ? levHdrH + nLevels * levRowH : 0;
  const secD = dateH;
  const activeSections = [secA, secB, secC, secD].filter(s => s > 0);
  const totalSec = activeSections.reduce((a, b) => a + b, 0);
  const nGaps = activeSections.length + 1;
  const gap   = Math.round((FRAME_H - totalSec) / nGaps);

  const ix     = FRAME_X + FRAME_W + Math.round(CARD_W * 0.034);
  const iRight = CARD_W - OUTER;
  let cy = FRAME_Y + gap;

  // Geo Pinas
  ctx.fillStyle = "#c13724";
  ctx.font = `900 ${fs(0.110)}px 'Impact', sans-serif`;
  ctx.fillText("Philippines", ix, cy + titleH);
  cy += titleH;

  // My Travel Level Postcard
  ctx.fillStyle = "#e1503d";
  ctx.font = `600  ${fs(0.026)}px Georgia, serif`;
  ctx.fillText("#My-Travel-Level-Postcard", ix, cy + subtitleH * 0.82);
  cy += subtitleH + gap;

  // Score %
  ctx.fillStyle = "#0e6b25";
  ctx.font = `900  ${fs(0.110)}px 'Impact', sans-serif`;
  ctx.fillText(`${score}%`, ix, cy + scoreH);
  cy += scoreH;

  // Province count 
  ctx.fillStyle = "#198c36";
  ctx.font = `bold  ${fs(0.026)}px Georgia, serif`;
  ctx.fillText(`Got ${logged} of ${total} provinces explored`, ix, cy + countH * 0.78);
  cy += countH + gap + 20;

  // Levels
  if (nLevels > 0) {
    ctx.fillStyle = "#313131da";
    ctx.font = `bold  ${fs(0.030)}px Georgia, serif`;
    ctx.fillText("Legend", ix, cy + levHdrH * 0.82);
    cy += levHdrH;
    const R = fs(0.014);
    usedLevels.forEach(l => {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(ix + R, cy + levRowH * 0.50, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#424242";
      ctx.font = ` ${fs(0.026)}px Georgia, serif`;
      ctx.fillText(l.label, ix + R * 2 + 10, cy + levRowH * 0.72);
      cy += levRowH;
    });
    cy += gap;
  }

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  ctx.fillStyle = "#313131aa";
  ctx.font = `bold italic ${fs(0.026)}px Georgia, serif`;
  ctx.textAlign = "right";
  ctx.fillText(`as of ${dateStr}`, iRight - 80, cy + dateH * 0.82);
  ctx.textAlign = "left";

  // Downscale the 2× canvas to final output size
  const out = document.createElement("canvas");
  out.width  = CARD_W;
  out.height = CARD_H;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(canvas, 0, 0, CARD_W, CARD_H);
  return out;
}

function _showPostcardPreview(canvas) {
  const dataUrl = canvas.toDataURL("image/png");

  document.getElementById("snap-preview-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "snap-preview-overlay";
  overlay.innerHTML = `
    <div class="snap-preview-modal">
      <div class="snap-preview-header">
        <span class="snap-preview-title">Postcard Preview</span>
        <button class="snap-preview-close" id="snap-preview-close" aria-label="Close">✕</button>
      </div>
      <div class="snap-preview-img-wrap">
        <img src="${dataUrl}" class="snap-preview-img" alt="Travel postcard preview" draggable="false">
      </div>
      <div class="snap-preview-actions">
        <button class="snap-preview-cancel" id="snap-preview-cancel">Cancel</button>
        <button class="snap-preview-download" id="snap-preview-dl">Download</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.getElementById("snap-preview-close").addEventListener("click", close);
  document.getElementById("snap-preview-cancel").addEventListener("click", close);
  document.getElementById("snap-preview-dl").addEventListener("click", () => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], "geo-pinas-travel.png", { type: "image/png" });
      // On mobile, use Web Share API so the image goes to the photo gallery
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Geo Pinas Travel Postcard" });
          close();
          return;
        } catch (e) {
          if (e.name === "AbortError") { close(); return; }
          // fall through to normal download on share failure
        }
      }
      // Desktop / fallback: trigger a normal file download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "geo-pinas-travel.png";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      close();
    }, "image/png");
  });
}

function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
