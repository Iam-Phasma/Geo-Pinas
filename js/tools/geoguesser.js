/* ============================================================
   tools/geoguesser.js — GeoGuesser tool
   Shows a Leaflet map (no labels, CartoDB tiles);
   user clicks a province on the map to guess where it is.
   Clicking the preview expands a fullscreen modal.
   Depends on: app.js globals, Leaflet (window.L)
   ============================================================ */
"use strict";

// ── Constants ──────────────────────────────────────────────────
const _GG_MAX_ROUNDS = 10;
const _GG_TIMER_SECS = 30;
const _GG_TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const _GG_TILE_DARK  = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const _GG_TILE_ATT   = "&copy; OpenStreetMap &copy; CARTO";
// Tight bounding box around the Philippine archipelago
const _GG_PH_BOUNDS  = L.latLngBounds([4.5, 116.0], [21.5, 127.5]);

function _ggTileUrl() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? _GG_TILE_DARK : _GG_TILE_LIGHT;
}

function _ggSwapTiles(map) {
  if (!map) return;
  map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
  L.tileLayer(_ggTileUrl(), { maxZoom: 19, attribution: _GG_TILE_ATT }).addTo(map);
}

// Watch for theme changes and swap tiles on any live map.
new MutationObserver(() => {
  _ggSwapTiles(_ggLeafletPrev);
  _ggSwapTiles(_ggLeafletModal);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ── State ──────────────────────────────────────────────────────
let _ggRound         = null;
let _ggAnswered      = false;
let _ggScore         = { correct: 0, total: 0 };
let _ggRoundNum      = 0;
let _ggStreak        = 0;
let _ggBestStreak    = 0;
let _ggTimerSec      = _GG_TIMER_SECS;
let _ggTimerInterval = null;
let _ggHistory       = [];
let _ggHighlights    = [];
let _ggLeafletPrev   = null;
let _ggLeafletModal  = null;

// ── SVG → Lat/Lng calibration ──────────────────────────────────
// Linear approximation calibrated from known province centroids:
//   Batanes     SVG(435, 37.5)   → 20.45 °N, 121.97 °E
//   Tawi-Tawi   SVG(292.5, 1170) →  5.10 °N, 119.93 °E
//   Davao Ori.  SVG(757.5, 1020) →  7.27 °N, 126.54 °E
function _ggSvgToLatLng(svgX, svgY) {
  return {
    lat: 20.958 - 0.013551 * svgY,
    lng: 115.806 + 0.014171 * svgX,
  };
}

function _ggZoomFromArea(area) {
  if (area <    200) return 15;
  if (area <    800) return 14;
  if (area <   3000) return 13;
  if (area <  10000) return 12;
  if (area <  40000) return 11;
  return 10;
}

// Generate a random on-land point inside provId's SVG shape,
// then convert to lat/lng + estimate zoom.
function _ggRandomPoint(provId) {
  const grp = _g.selectAll(".province-group").filter(d => d.id === provId).node();
  if (!grp) return { lat: 12, lng: 122, z: 13 };

  const m = (grp.getAttribute("transform") || "").match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/);
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;

  const pathEl = grp.querySelector(".province");
  if (!pathEl) {
    return { ..._ggSvgToLatLng(tx, ty), z: 13 };
  }

  const bbox = pathEl.getBBox();
  const z    = _ggZoomFromArea(bbox.width * bbox.height);
  const pt   = _svg.node().createSVGPoint();

  for (let i = 0; i < 80; i++) {
    const lx = bbox.x + Math.random() * bbox.width;
    const ly = bbox.y + Math.random() * bbox.height;
    pt.x = lx;
    pt.y = ly;
    if (pathEl.isPointInFill(pt)) {
      return { ..._ggSvgToLatLng(tx + lx, ty + ly), z };
    }
  }

  // Fallback: centre of bbox
  return { ..._ggSvgToLatLng(tx + bbox.x + bbox.width / 2, ty + bbox.y + bbox.height / 2), z };
}

// Get the geographic centroid of a province (for distance calculation).
function _ggProvCentroid(provId) {
  const grp = _g.selectAll(".province-group").filter(d => d.id === provId).node();
  if (!grp) return null;
  const m = (grp.getAttribute("transform") || "").match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/);
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;
  const pathEl = grp.querySelector(".province");
  if (!pathEl) return _ggSvgToLatLng(tx, ty);
  const bbox = pathEl.getBBox();
  return _ggSvgToLatLng(tx + bbox.x + bbox.width / 2, ty + bbox.y + bbox.height / 2);
}

// Haversine distance in km between two lat/lng points.
function _ggHaversine(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dG = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dG / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Timer ──────────────────────────────────────────────────────
function _ggStartTimer() {
  _ggStopTimer();
  _ggTimerInterval = setInterval(_ggTickTimer, 1000);
}

function _ggStopTimer() {
  if (_ggTimerInterval) { clearInterval(_ggTimerInterval); _ggTimerInterval = null; }
}

function _ggTickTimer() {
  _ggTimerSec--;
  const timerEl = document.getElementById("gg-timer");
  const fillEl  = document.getElementById("gg-timer-fill");
  if (timerEl) {
    timerEl.textContent = `${_ggTimerSec}s`;
    timerEl.classList.toggle("is-urgent", _ggTimerSec <= 5);
  }
  if (fillEl) {
    fillEl.style.width = `${Math.max(0, (_ggTimerSec / _GG_TIMER_SECS) * 100)}%`;
    fillEl.classList.toggle("is-urgent", _ggTimerSec <= 5);
  }
  if (_ggTimerSec <= 0) { _ggStopTimer(); _ggGuess(null); }
}

// ── Score pop ─────────────────────────────────────────────────
function _ggScorePop(correct) {
  const el = document.createElement("div");
  el.className = "gg-score-pop " + (correct ? "is-correct" : "is-wrong");
  el.textContent = correct ? "+1" : "\u2715";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// ── Reset ─────────────────────────────────────────────────────
function _ggReset() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggClearHighlights();
  _ggStopTimer();
  _ggRound      = null;
  _ggAnswered   = false;
  _ggScore      = { correct: 0, total: 0 };
  _ggRoundNum   = 0;
  _ggStreak     = 0;
  _ggBestStreak = 0;
  _ggTimerSec   = _GG_TIMER_SECS;
  _ggHistory    = [];
  _ggUsed       = [];
}

let _ggUsed = [];

// ── Leaflet helpers ────────────────────────────────────────────
function _ggDestroyPreview() {
  if (_ggLeafletPrev) {
    try { _ggLeafletPrev.remove(); } catch {}
    _ggLeafletPrev = null;
  }
}

function _ggDestroyModal() {
  const existing = document.getElementById("gg-modal-overlay");
  if (!existing) return;
  existing.classList.add("is-closing");
  existing.addEventListener("animationend", () => {
    if (_ggLeafletModal) {
      try { _ggLeafletModal.remove(); } catch {}
      _ggLeafletModal = null;
    }
    existing.remove();
  }, { once: true });
}

const _GG_PIN_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-6 -8 40 52">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 22 14 22s14-12.75 14-22C28 6.27 21.73 0 14 0z"
          fill="#ef4444" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#fff"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

function _ggAddPin(map, loc) {
  if (!map) return;
  L.marker([loc.lat, loc.lng], { icon: _GG_PIN_ICON, interactive: false }).addTo(map);
}

function _ggInitPreview(loc) {
  const el = document.getElementById("gg-map-preview");
  if (!el || !window.L) return;
  _ggLeafletPrev = L.map(el, {
    center: [loc.lat, loc.lng],
    zoom: loc.z,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
    maxBounds: _GG_PH_BOUNDS,
    maxBoundsViscosity: 1.0,
  });
  L.tileLayer(_ggTileUrl(), { maxZoom: 19, attribution: _GG_TILE_ATT }).addTo(_ggLeafletPrev);
  if (_ggAnswered) _ggAddPin(_ggLeafletPrev, loc);
}

function _ggOpenModal(loc) {
  _ggDestroyModal();
  const overlay = document.createElement("div");
  overlay.id = "gg-modal-overlay";
  overlay.className = "gg-modal-overlay";
  overlay.innerHTML = `
    <div class="gg-modal-inner">
      <button class="gg-modal-close" id="gg-modal-close" aria-label="Close">\u2715</button>
      <div id="gg-map-modal"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    const mapEl = document.getElementById("gg-map-modal");
    if (!mapEl || !window.L) return;
    _ggLeafletModal = L.map(mapEl, {
      center: [loc.lat, loc.lng],
      zoom: loc.z,
      minZoom: _ggAnswered ? 5 : Math.max(5, loc.z - 2),
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      maxBounds: _GG_PH_BOUNDS,
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer(_ggTileUrl(), { maxZoom: 19, attribution: _GG_TILE_ATT }).addTo(_ggLeafletModal);
    if (_ggAnswered) _ggAddPin(_ggLeafletModal, loc);
  }, 50);

  document.getElementById("gg-modal-close").addEventListener("click", _ggDestroyModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) _ggDestroyModal(); });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { _ggDestroyModal(); document.removeEventListener("keydown", onEsc); }
  });
}

// ── Highlight helpers ──────────────────────────────────────────
function _ggClearHighlights() {
  _ggHighlights.forEach(node => {
    d3.select(node).classed("is-gg-correct", false).classed("is-gg-wrong", false);
  });
  _ggHighlights = [];
  _g.select("#gg-line-layer").remove();
}

function _ggProvSvgCenter(provId) {
  const grp = _g.selectAll(".province-group").filter(d => d.id === provId).node();
  if (!grp) return null;
  const m = (grp.getAttribute("transform") || "").match(/translate\(\s*([\d.]+)[,\s]+([\d.]+)/);
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;
  const pathEl = grp.querySelector(".province");
  if (!pathEl) return { x: tx, y: ty };
  const b = pathEl.getBBox();
  return { x: tx + b.x + b.width / 2, y: ty + b.y + b.height / 2 };
}

function _ggDrawGuessingLine(correctId, guessId) {
  _g.select("#gg-line-layer").remove();
  if (!guessId || correctId === guessId) return;
  const a = _ggProvSvgCenter(correctId);
  const b = _ggProvSvgCenter(guessId);
  if (!a || !b) return;

  const layer = _g.append("g").attr("id", "gg-line-layer");

  layer.append("line")
    .attr("x1", a.x).attr("y1", a.y)
    .attr("x2", b.x).attr("y2", b.y)
    .attr("stroke", "#f97316")
    .attr("stroke-width", 5)
    .attr("stroke-dasharray", "7 5")
    .attr("opacity", 0.9);

  [a, b].forEach(p => {
    layer.append("circle")
      .attr("cx", p.x).attr("cy", p.y).attr("r", 3)
      .attr("fill", "#f97316")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);
  });
}

function _ggHighlight(provId, cls) {
  const node = _g.selectAll(".province-group").filter(d => d.id === provId).node();
  if (!node) return;
  d3.select(node).classed(cls, true).raise();
  _ggHighlights.push(node);
}

// ── Public API ─────────────────────────────────────────────────
function showGeoGuesserTool() {
  _activeToolId = "geoguesser";
  _clearQuizHighlight();
  clearWeatherEmoji();
  _clearTravelColors();
  _rouletteClearHighlight();
  setSidebarTitle("Local Guesser");
  _ggReset();
  _ggShowIntro();
}

function _ggShowIntro() {
  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="gg-intro-back">‹ Back</button>
    <div class="gg-intro">
      <div class="gg-intro-icon">📍</div>
      <h2 class="gg-intro-title">Local Guesser</h2>
      <p class="gg-intro-desc">A map view will appear — click the province on the Philippine map that you think it belongs to.</p>
      <ul class="gg-intro-rules">
        <li>🕐 <strong>${_GG_TIMER_SECS}s</strong> per round</li>
        <li>🏁 <strong>${_GG_MAX_ROUNDS} rounds</strong> per game</li>
        <li>🔍 You can zoom in and slightly out for clues</li>
      </ul>
      <p class="gg-intro-note">⚠️ The pin location is approximate — it's generated from a simplified SVG map, so it may not land exactly at the center of the province.</p>
      <button class="gg-start-btn" id="gg-start-btn">Start Game</button>
    </div>
  `;
  document.getElementById("gg-intro-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showToolsHome();
  });
  document.getElementById("gg-start-btn").addEventListener("click", _ggNewRound);
}

function _ggNewRound() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggAnswered = false;
  _ggClearHighlights();
  // Clear any province selection left from the guess click
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
  }
  _ggRoundNum++;

  if (_ggRoundNum > _GG_MAX_ROUNDS) {
    _ggShowSummary();
    return;
  }

  const allIds = PROVINCES.map(p => p.id);
  if (_ggUsed.length >= allIds.length) _ggUsed = [];

  let provId;
  do { provId = allIds[Math.floor(Math.random() * allIds.length)]; }
  while (_ggUsed.includes(provId));
  _ggUsed.push(provId);

  const loc = _ggRandomPoint(provId);
  _ggRound = { prov: provId, loc };
  _ggTimerSec = _GG_TIMER_SECS;
  _renderGeoGuesser();
  _ggStartTimer();
}

function _renderGeoGuesser(result) {
  _ggDestroyPreview();

  const timerPct = (_ggTimerSec / _GG_TIMER_SECS) * 100;

  const gameBarHtml = `
    <div class="gg-game-bar">
      <span class="gg-round-label">Round <strong>${_ggRoundNum}</strong><span class="gg-round-of"> / ${_GG_MAX_ROUNDS}</span></span>
      ${_ggStreak >= 2
        ? `<span class="gg-streak${_ggStreak >= 4 ? ' is-hot' : ''}">🔥 ${_ggStreak}</span>`
        : '<span></span>'}
      <span class="gg-timer${!result && _ggTimerSec <= 5 ? ' is-urgent' : ''}" id="gg-timer">${result ? '\u2014' : `${_ggTimerSec}s`}</span>
    </div>
    <div class="gg-timer-bar">
      <div class="gg-timer-fill" id="gg-timer-fill" style="width:${result ? 0 : timerPct}%"></div>
    </div>`;

  const scoreHtml = `
    <div class="gg-score-bar">
      <span class="gg-score-label">Score</span>
      <span class="gg-score-val">${_ggScore.correct} / ${_ggScore.total}</span>
    </div>`;

  let resultHtml;
  if (result) {
    const distHtml = result.dist != null
      ? `<span class="gg-distance">\u2248 ${Math.round(result.dist).toLocaleString()} km away</span>`
      : '';
    const isLast   = _ggRoundNum >= _GG_MAX_ROUNDS;
    const nextLabel = isLast ? 'See Results \u2192' : 'Next Round \u2192';
    if (result.timedOut) {
      resultHtml = `
        <div class="gg-result-card is-wrong">
          <span class="gg-result-icon">\u23F0</span>
          <div>
            <span class="gg-result-text">Time\u2019s up! It was <strong>${escapeHtml(result.prov)}</strong>.</span>
          </div>
        </div>
        <button class="gg-next-btn" id="gg-next-btn">${nextLabel}</button>`;
    } else {
      resultHtml = `
        <div class="gg-result-card ${result.correct ? 'is-correct' : 'is-wrong'}">
          <span class="gg-result-icon">${result.correct ? '\u2705' : '\u274C'}</span>
          <div>
            <span class="gg-result-text">${result.correct
              ? `Correct! It\u2019s <strong>${escapeHtml(result.prov)}</strong>.`
              : `It was <strong>${escapeHtml(result.prov)}</strong>.`
            }</span>
            ${distHtml}
          </div>
        </div>
        <button class="gg-next-btn" id="gg-next-btn">${nextLabel}</button>`;
    }
  } else {
    resultHtml = `<p class="gg-hint">Click a province on the map to guess.</p>`;
  }

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="gg-back">\u2039 Back</button>
    ${gameBarHtml}
    ${scoreHtml}
    <div class="gg-preview-wrap">
      <div id="gg-map-preview" class="gg-map-preview"></div>
      <button class="gg-expand-btn" id="gg-expand-btn" title="Expand view">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5"/>
        </svg>
      </button>
    </div>
    ${resultHtml}
  `;

  setTimeout(() => _ggInitPreview(_ggRound.loc), 0);

  document.getElementById("gg-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showToolsHome();
  });
  document.getElementById("gg-expand-btn").addEventListener("click", () => _ggOpenModal(_ggRound.loc));
  document.getElementById("gg-map-preview").addEventListener("click", () => _ggOpenModal(_ggRound.loc));
  document.getElementById("gg-next-btn")?.addEventListener("click", () => { _ggDestroyModal(); _ggNewRound(); });
}

function _ggShowSummary() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggStopTimer();
  _ggClearHighlights();

  const total   = _ggHistory.length;
  const correct = _ggScore.correct;
  const pct     = total ? Math.round(correct / total * 100) : 0;
  const grade   = pct >= 90 ? '\uD83C\uDFC6' : pct >= 70 ? '\uD83C\uDF89' : pct >= 50 ? '\uD83D\uDC4D' : '\uD83D\uDCDA';
  const tag     = pct >= 90 ? 'Expert!'
                : pct >= 70 ? 'Great job!'
                : pct >= 50 ? 'Not bad!'
                : 'Keep practicing!';

  const rows = _ggHistory.map((h, i) => `
    <div class="gg-summary-row ${h.correct ? 'is-correct' : 'is-wrong'}">
      <span class="gg-summary-num">${i + 1}</span>
      <span class="gg-summary-icon">${h.correct ? '\u2705' : h.timedOut ? '\u23F0' : '\u274C'}</span>
      <span class="gg-summary-prov">${escapeHtml(h.prov)}</span>
      ${h.dist != null ? `<span class="gg-summary-dist">\u2248 ${Math.round(h.dist).toLocaleString()} km</span>` : ''}
    </div>`).join('');

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="gg-back">\u2039 Back</button>
    <div class="gg-summary">
      <div class="gg-summary-grade">${grade}</div>
      <div class="gg-summary-score">${correct} <span class="gg-summary-total">/ ${total}</span></div>
      <div class="gg-summary-tag">${tag}</div>
      ${_ggBestStreak >= 2 ? `<div class="gg-summary-streak">\uD83D\uDD25 Best streak: ${_ggBestStreak}</div>` : ''}
      <div class="gg-summary-list">${rows}</div>
      <button class="gg-play-again-btn" id="gg-play-again">Play Again</button>
    </div>
  `;

  document.getElementById("gg-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showToolsHome();
  });
  document.getElementById("gg-play-again").addEventListener("click", () => {
    _ggReset();
    _ggShowIntro();
  });
}

function _ggGuess(guessProvId) {
  if (_ggAnswered || !_ggRound) return;
  _ggAnswered = true;
  _ggStopTimer();

  const timedOut = guessProvId === null;
  const correct  = !timedOut && guessProvId === _ggRound.prov;

  _ggScore.total++;
  if (correct) {
    _ggScore.correct++;
    _ggStreak++;
    if (_ggStreak > _ggBestStreak) _ggBestStreak = _ggStreak;
  } else {
    _ggStreak = 0;
  }

  let dist = null;
  if (!correct && !timedOut) {
    const correctC = _ggProvCentroid(_ggRound.prov);
    const guessC   = _ggProvCentroid(guessProvId);
    if (correctC && guessC) {
      dist = _ggHaversine(guessC.lat, guessC.lng, correctC.lat, correctC.lng);
    }
  }

  _ggHistory.push({ correct, timedOut, prov: _ggRound.prov, guess: guessProvId, dist });

  _ggHighlight(_ggRound.prov, "is-gg-correct");
  if (!timedOut && !correct) {
    _ggHighlight(guessProvId, "is-gg-wrong");
    _ggDrawGuessingLine(_ggRound.prov, guessProvId);
  }

  _ggScorePop(correct);
  _renderGeoGuesser({ correct, timedOut, prov: _ggRound.prov, dist });
}
