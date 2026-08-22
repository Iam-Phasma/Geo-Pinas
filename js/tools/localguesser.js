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
const _GG_TIMER_SECS = 45;
const _GG_TILE_LIGHT =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const _GG_TILE_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const _GG_TILE_ATT = "&copy; OpenStreetMap &copy; CARTO";
const _GG_TILE_SAT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const _GG_TILE_SAT_ATT = "Tiles &copy; Esri";
// Tight bounding box around the Philippine archipelago
const _GG_PH_BOUNDS = L.latLngBounds([4.5, 116.0], [21.5, 127.5]);

function _ggTileUrl() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? _GG_TILE_DARK
    : _GG_TILE_LIGHT;
}

function _ggSwapTiles(map) {
  if (!map) return;
  map.eachLayer((l) => {
    if (l instanceof L.TileLayer) map.removeLayer(l);
  });
  const sat = _ggSatellite;
  L.tileLayer(sat ? _GG_TILE_SAT : _ggTileUrl(), {
    maxZoom: 19,
    attribution: sat ? _GG_TILE_SAT_ATT : _GG_TILE_ATT,
  }).addTo(map);
}

// Watch for theme changes and swap tiles on any live map.
new MutationObserver(() => {
  _ggSwapTiles(_ggLeafletPrev);
  _ggSwapTiles(_ggLeafletModal);
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

// ── State ──────────────────────────────────────────────────────
let _ggRound = null;
let _ggAnswered = false;
let _ggScore = { correct: 0, total: 0 };
const _GG_HALF_DIST = 100; // km threshold for half-point
let _ggRoundNum = 0;
let _ggStreak = 0;
let _ggBestStreak = 0;
let _ggTimerSec = _GG_TIMER_SECS;
let _ggTimerInterval = null;
let _ggHistory = [];
let _ggHighlights = [];
let _ggLeafletPrev = null;
let _ggLeafletModal = null;
let _ggMode = null; // 'roam' | 'timed'
let _ggMaxTimerSec = _GG_TIMER_SECS;
let _ggSatellite = false;
let _ggLinePair = null; // { correctId, guessId }

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
  if (area < 200) return 15;
  if (area < 800) return 14;
  if (area < 3000) return 13;
  if (area < 10000) return 12;
  if (area < 40000) return 11;
  return 10;
}

// Generate a random on-land point inside provId's SVG shape,
// then convert to lat/lng + estimate zoom.
function _ggRandomPoint(provId) {
  const grp = _g
    .selectAll(".province-group")
    .filter((d) => d.id === provId)
    .node();
  if (!grp) return { lat: 12, lng: 122, z: 13 };

  const m = (grp.getAttribute("transform") || "").match(
    /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/,
  );
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;

  const pathEl = grp.querySelector(".province");
  if (!pathEl) {
    return { ..._ggSvgToLatLng(tx, ty), z: 13 };
  }

  const bbox = pathEl.getBBox();
  const z = _ggZoomFromArea(bbox.width * bbox.height);
  const pt = _svg.node().createSVGPoint();

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
  return {
    ..._ggSvgToLatLng(
      tx + bbox.x + bbox.width / 2,
      ty + bbox.y + bbox.height / 2,
    ),
    z,
  };
}

// Get the geographic centroid of a province (for distance calculation).
function _ggProvCentroid(provId) {
  const grp = _g
    .selectAll(".province-group")
    .filter((d) => d.id === provId)
    .node();
  if (!grp) return null;
  const m = (grp.getAttribute("transform") || "").match(
    /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/,
  );
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;
  const pathEl = grp.querySelector(".province");
  if (!pathEl) return _ggSvgToLatLng(tx, ty);
  const bbox = pathEl.getBBox();
  return _ggSvgToLatLng(
    tx + bbox.x + bbox.width / 2,
    ty + bbox.y + bbox.height / 2,
  );
}

// Haversine distance in km between two lat/lng points.
function _ggHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dG / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Timer ──────────────────────────────────────────────────────
function _ggStartTimer() {
  _ggStopTimer();
  _ggTimerInterval = setInterval(_ggTickTimer, 1000);
}

function _ggStopTimer() {
  if (_ggTimerInterval) {
    clearInterval(_ggTimerInterval);
    _ggTimerInterval = null;
  }
}

function _ggTickTimer() {
  _ggTimerSec--;
  const timerEl = document.getElementById("gg-timer");
  const fillEl = document.getElementById("gg-timer-fill");
  if (timerEl) {
    timerEl.textContent = `${_ggTimerSec}s`;
    timerEl.classList.toggle("is-urgent", _ggTimerSec <= 5);
  }
  if (fillEl) {
    fillEl.style.width = `${Math.max(0, (_ggTimerSec / _ggMaxTimerSec) * 100)}%`;
    fillEl.classList.toggle("is-urgent", _ggTimerSec <= 5);
  }
  if (_ggTimerSec <= 0) {
    _ggStopTimer();
    _ggGuess(null);
  }
}

// ── Score pop ─────────────────────────────────────────────────
// result: 'correct' | 'half' | 'wrong'
function _ggScorePop(result) {
  const el = document.createElement("div");
  el.className =
    "gg-score-pop " +
    (result === "correct"
      ? "is-correct"
      : result === "half"
        ? "is-half"
        : "is-wrong");
  el.textContent = result === "correct" ? "+1" : result === "half" ? "+½" : "✕";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// ── Reset ─────────────────────────────────────────────────────
function _ggReset() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggClearHighlights();
  _ggStopTimer();
  _ggRound = null;
  _ggAnswered = false;
  _ggScore = { correct: 0, half: 0, total: 0 };
  _ggRoundNum = 0;
  _ggStreak = 0;
  _ggBestStreak = 0;
  _ggTimerSec = _GG_TIMER_SECS;
  _ggMaxTimerSec = _GG_TIMER_SECS;
  _ggMode = null;
  _ggSatellite = false;
  _ggHistory = [];
  _ggUsed = [];
}

let _ggUsed = [];

// ── Leaflet helpers ────────────────────────────────────────────
function _ggDestroyPreview() {
  if (_ggLeafletPrev) {
    try {
      _ggLeafletPrev.remove();
    } catch {}
    _ggLeafletPrev = null;
  }
}

function _ggSetSidebarSwitcherVisible(visible) {
  const switcher = document.getElementById("gg-map-switcher");
  if (!switcher) return;
  switcher.style.display = visible ? "" : "none";
}

function _ggSyncTileSwitcher(switcherEl) {
  if (!switcherEl) return;
  const targetSat = _ggSatellite ? "1" : "0";
  switcherEl.querySelectorAll(".gg-map-sw-btn").forEach((btn) => {
    const isActive = btn.dataset.sat === targetSat;
    btn.classList.toggle("is-active", isActive);
  });
  _syncSwitcherPill(switcherEl);
}

function _ggSyncAllTileSwitchers() {
  _ggSyncTileSwitcher(document.getElementById("gg-map-switcher"));
  _ggSyncTileSwitcher(document.getElementById("gg-map-toggle-modal"));
}

function _ggDestroyModal() {
  const existing = document.getElementById("gg-modal-overlay");
  if (!existing) return;
  existing.classList.add("is-closing");
  existing.addEventListener(
    "animationend",
    () => {
      if (_ggLeafletModal) {
        try {
          _ggLeafletModal.remove();
        } catch {}
        _ggLeafletModal = null;
      }
      existing.remove();
      _ggSetSidebarSwitcherVisible(true);
    },
    { once: true },
  );
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
  L.marker([loc.lat, loc.lng], {
    icon: _GG_PIN_ICON,
    interactive: false,
  }).addTo(map);
}

function _ggResetMapView(map, loc) {
  if (!map || !loc) return;
  const targetZoom = Number.isFinite(loc.z) ? loc.z : map.getZoom();
  const targetCenter = [loc.lat, loc.lng];
  if (typeof map.flyTo === "function") {
    map.flyTo(targetCenter, targetZoom, {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.3,
    });
  } else {
    map.setView(targetCenter, targetZoom);
  }
}

function _ggAttachResetButton(map, loc) {
  if (!map || !loc) return;
  const container = map.getContainer();
  if (!container || container.querySelector(".gg-reset-view-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gg-reset-view-btn";
  btn.title = "Reset view";
  btn.setAttribute("aria-label", "Reset view");
  btn.innerHTML = `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 2.4a5.6 5.6 0 1 1-4.55 2.35M8 2.4V5M3.45 4.75l1.9-2.35" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    _ggResetMapView(map, loc);
  });
  container.appendChild(btn);
}

function _ggInitPreview(loc) {
  const el = document.getElementById("gg-map-preview");
  if (!el || !window.L) return;
  _ggLeafletPrev = L.map(el, {
    center: [loc.lat, loc.lng],
    zoom: loc.z,
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
    maxBounds: _GG_PH_BOUNDS,
    maxBoundsViscosity: 1.0,
  });
  const useSat = _ggSatellite;
  L.tileLayer(useSat ? _GG_TILE_SAT : _ggTileUrl(), {
    maxZoom: 19,
    attribution: useSat ? _GG_TILE_SAT_ATT : _GG_TILE_ATT,
  }).addTo(_ggLeafletPrev);
  _ggAttachResetButton(_ggLeafletPrev, loc);
  if (_ggAnswered) _ggAddPin(_ggLeafletPrev, loc);
}

function _ggOpenModal(loc) {
  _ggDestroyModal();
  _ggSetSidebarSwitcherVisible(false);
  const overlay = document.createElement("div");
  overlay.id = "gg-modal-overlay";
  overlay.className = "gg-modal-overlay";
  overlay.innerHTML = `
    <div class="gg-modal-inner">
      <button class="gg-modal-close" id="gg-modal-close" aria-label="Close">\u2715</button>
      <div class="gg-modal-map-switcher gg-map-switcher" id="gg-map-toggle-modal">
        <button class="gg-map-sw-btn${!_ggSatellite ? " is-active" : ""}" data-sat="0">Map</button>
        <button class="gg-map-sw-btn${_ggSatellite ? " is-active" : ""}" data-sat="1">Satellite</button>
      </div>
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
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      attributionControl: true,
      maxBounds: _GG_PH_BOUNDS,
      maxBoundsViscosity: 1.0,
    });
    const useSat = _ggSatellite;
    L.tileLayer(useSat ? _GG_TILE_SAT : _ggTileUrl(), {
      maxZoom: 19,
      attribution: useSat ? _GG_TILE_SAT_ATT : _GG_TILE_ATT,
    }).addTo(_ggLeafletModal);
    _ggAttachResetButton(_ggLeafletModal, loc);
    if (_ggAnswered) _ggAddPin(_ggLeafletModal, loc);

    const modalToggle = document.getElementById("gg-map-toggle-modal");
    if (modalToggle) {
      _ggSyncTileSwitcher(modalToggle);
      modalToggle.querySelectorAll(".gg-map-sw-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          _ggSatellite = btn.dataset.sat === "1";
          _ggSwapTiles(_ggLeafletPrev);
          _ggSwapTiles(_ggLeafletModal);
          _ggSyncAllTileSwitchers();
        });
      });
    }
  }, 50);

  document
    .getElementById("gg-modal-close")
    .addEventListener("click", _ggDestroyModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) _ggDestroyModal();
  });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      _ggDestroyModal();
      document.removeEventListener("keydown", onEsc);
    }
  });
}

// ── Highlight helpers ──────────────────────────────────────────
function _ggClearHighlights() {
  _ggHighlights.forEach((node) => {
    d3.select(node)
      .classed("is-gg-correct", false)
      .classed("is-gg-wrong", false)
      .classed("is-gg-half", false);
  });
  _ggHighlights = [];
  _ggLinePair = null;
  _ggRemoveLineOverlay();
  _refreshMapVisuals();
}

function _ggProvSvgCenter(provId) {
  const grp = _g
    .selectAll(".province-group")
    .filter((d) => d.id === provId)
    .node();
  if (!grp) return null;
  const m = (grp.getAttribute("transform") || "").match(
    /translate\(\s*([\d.]+)[,\s]+([\d.]+)/,
  );
  const tx = m ? +m[1] : 0;
  const ty = m ? +m[2] : 0;
  const pathEl = grp.querySelector(".province");
  if (!pathEl) return { x: tx, y: ty };
  const b = pathEl.getBBox();
  return { x: tx + b.x + b.width / 2, y: ty + b.y + b.height / 2 };
}

function _ggDrawGuessingLine(correctId, guessId) {
  if (!guessId || correctId === guessId) {
    _ggLinePair = null;
    _ggRemoveLineOverlay();
    return;
  }
  _ggLinePair = { correctId, guessId };
  _ggRenderLineOverlay();
}

function _ggRemoveLineOverlay() {
  const existing = document.getElementById("gg-line-overlay");
  if (existing) existing.remove();
}

function _ggEnsureLineOverlay() {
  const wrap = document.getElementById("map-wrap");
  if (!wrap) return null;
  let overlay = document.getElementById("gg-line-overlay");
  if (overlay) return overlay;

  overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.setAttribute("id", "gg-line-overlay");
  overlay.setAttribute("width", "100%");
  overlay.setAttribute("height", "100%");
  overlay.setAttribute(
    "viewBox",
    `0 0 ${Math.max(1, wrap.clientWidth)} ${Math.max(1, wrap.clientHeight)}`,
  );
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "14";
  wrap.appendChild(overlay);
  return overlay;
}

function _ggScreenPoint(svgPt) {
  if (!svgPt || !_svg) return null;
  const t = d3.zoomTransform(_svg.node());
  const frame = document.getElementById("map-tilt-frame");
  if (!frame) return null;
  return {
    x: t.applyX(svgPt.x) + frame.offsetLeft,
    y: t.applyY(svgPt.y) + frame.offsetTop,
  };
}

function _ggRenderLineOverlay() {
  if (!_ggLinePair) {
    _ggRemoveLineOverlay();
    return;
  }

  const { correctId, guessId } = _ggLinePair;
  const a = _ggScreenPoint(_ggProvSvgCenter(correctId));
  const b = _ggScreenPoint(_ggProvSvgCenter(guessId));
  if (!a || !b) {
    _ggRemoveLineOverlay();
    return;
  }

  const wrap = document.getElementById("map-wrap");
  const overlay = _ggEnsureLineOverlay();
  if (!wrap || !overlay) return;
  overlay.setAttribute(
    "viewBox",
    `0 0 ${Math.max(1, wrap.clientWidth)} ${Math.max(1, wrap.clientHeight)}`,
  );

  overlay.innerHTML = `
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f97316" stroke-width="5" stroke-dasharray="7 5" opacity="0.9"></line>
    <circle cx="${a.x}" cy="${a.y}" r="3" fill="#f97316" stroke="#fff" stroke-width="1"></circle>
    <circle cx="${b.x}" cy="${b.y}" r="3" fill="#f97316" stroke="#fff" stroke-width="1"></circle>
  `;
}

function _ggSyncLineOverlay() {
  _ggRenderLineOverlay();
}

window._ggSyncLineOverlay = _ggSyncLineOverlay;

function _ggHighlight(provId, cls) {
  const node = _g
    .selectAll(".province-group")
    .filter((d) => d.id === provId)
    .node();
  if (!node) return;
  d3.select(node).classed(cls, true).raise();
  _ggHighlights.push(node);
  _refreshMapVisuals();
}

// ── Public API ─────────────────────────────────────────────────
function showGeoGuesserTool(animatePanel = false) {
  _activeToolId = "geoguesser";
  if (typeof window._resetTilt === "function") window._resetTilt();
  if (typeof window._setTiltControlsVisible === "function") {
    window._setTiltControlsVisible(false);
  }
  _clearQuizHighlight();
  clearWeatherEmoji();
  _clearTravelColors();
  _rouletteClearHighlight();
  setSidebarTitle("Local Guesser");
  _ggReset();
  _ggShowIntro(animatePanel);
}

const _GG_MODE_DESC = {
  roam: "No timer — take your time.",
  timed: `${_GG_TIMER_SECS}s per round.`,
};

function _ggShowIntro(animatePanel = false) {
  let _selected = "roam";
  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="gg-intro-back">‹ Quit</button>
    <div class="gg-intro">
      <div class="gg-intro-icon">📍</div>
      <h2 class="gg-intro-title">Local Guesser</h2>
      <p class="gg-intro-desc">A map view will appear — click the province on the Philippine map that you think it belongs to.</p>
      <div class="gg-map-switcher" id="gg-intro-mode-switcher">
        ${["roam", "timed"]
          .map(
            (m) => `
          <button class="gg-map-sw-btn${_selected === m ? " is-active" : ""}" data-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>
        `,
          )
          .join("")}
      </div>
      <p class="gg-mode-selected-text" id="gg-mode-label">${_GG_MODE_DESC[_selected]}</p>
      <p class="gg-intro-note">⚠️ The pin location is approximate — it's generated from a simplified SVG map, so it may not land exactly at the center of the province.</p>
      <button class="gg-start-btn" id="gg-start-btn">Start Game</button>
    </div>
  `,
    "left",
    animatePanel,
  );

  const modeSwitcher = document.getElementById("gg-intro-mode-switcher");
  _syncSwitcherPill(modeSwitcher);

  document.getElementById("gg-intro-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showGamesTool("right", true);
  });

  document
    .querySelectorAll("#gg-intro-mode-switcher .gg-map-sw-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        _selected = btn.dataset.mode;
        document
          .querySelectorAll("#gg-intro-mode-switcher .gg-map-sw-btn")
          .forEach((b) => {
            b.classList.toggle("is-active", b === btn);
          });
        _syncSwitcherPill(modeSwitcher);
        const label = document.getElementById("gg-mode-label");
        if (label) label.textContent = _GG_MODE_DESC[_selected];
      });
    });

  document.getElementById("gg-start-btn").addEventListener("click", () => {
    _ggMode = _selected;
    _ggNewRound();
  });
}

function _ggNewRound() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggAnswered = false;
  _ggClearHighlights();
  // Clear any province selection left from the guess click
  _g.selectAll(".province-group").classed("is-selected", false);
  _selectedGroup = null;
  _refreshMapVisuals();
  _ggRoundNum++;

  if (_ggRoundNum > _GG_MAX_ROUNDS) {
    _ggShowSummary();
    return;
  }

  const allIds = PROVINCES.map((p) => p.id);
  if (_ggUsed.length >= allIds.length) _ggUsed = [];

  let provId;
  do {
    provId = allIds[Math.floor(Math.random() * allIds.length)];
  } while (_ggUsed.includes(provId));
  _ggUsed.push(provId);

  const loc = _ggRandomPoint(provId);
  _ggRound = { prov: provId, loc };

  if (_ggMode === "timed") {
    _ggTimerSec = _GG_TIMER_SECS;
    _ggMaxTimerSec = _GG_TIMER_SECS;
  } else {
    _ggTimerSec = 0;
    _ggMaxTimerSec = 1;
  }

  _renderGeoGuesser();
  if (_ggMode === "timed") _ggStartTimer();
}

function _renderGeoGuesser(result) {
  _ggDestroyPreview();

  const timerPct =
    _ggMaxTimerSec > 1 ? (_ggTimerSec / _ggMaxTimerSec) * 100 : 0;

  const gameBarHtml = `
    <div class="gg-game-bar">
      <span class="gg-round-label">Round <strong>${_ggRoundNum}</strong><span class="gg-round-of"> / ${_GG_MAX_ROUNDS}</span></span>
      ${
        _ggStreak >= 2
          ? `<span class="gg-streak${_ggStreak >= 4 ? " is-hot" : ""}">🔥 ${_ggStreak}</span>`
          : "<span></span>"
      }
      ${
        _ggMode === "timed"
          ? `<span class="gg-timer${!result && _ggTimerSec <= 5 ? " is-urgent" : ""}" id="gg-timer">${result ? "\u2014" : `${_ggTimerSec}s`}</span>`
          : "<span></span>"
      }
    </div>
    ${
      _ggMode === "timed"
        ? `<div class="gg-timer-bar">
      <div class="gg-timer-fill" id="gg-timer-fill" style="width:${result ? 0 : timerPct}%"></div>
    </div>`
        : ""
    }`;

  const scoreHtml = `
    <div class="gg-score-bar">
      <span class="gg-score-label">Score</span>
      <span class="gg-score-val">${_ggScore.correct % 1 === 0 ? _ggScore.correct : _ggScore.correct.toFixed(1)} / ${_ggScore.total}</span>
    </div>`;

  let resultHtml;
  if (result) {
    const distHtml =
      result.dist != null
        ? `<span class="gg-distance">\u2248 ${Math.round(result.dist).toLocaleString()} km away</span>`
        : "";
    const isLast = _ggRoundNum >= _GG_MAX_ROUNDS;
    const nextLabel = isLast ? "See Results \u2192" : "Next Round \u2192";
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
        <div class="gg-result-card ${result.correct ? "is-correct" : "is-wrong"}">
          <span class="gg-result-icon">${result.correct ? "\u2705" : "\u274C"}</span>
          <div>
            <span class="gg-result-text">${
              result.correct
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

  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="gg-back">\u2039 Quit</button>
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
    <div class="gg-map-switcher" id="gg-map-switcher">
      <button class="gg-map-sw-btn${!_ggSatellite ? " is-active" : ""}" data-sat="0">Map</button>
      <button class="gg-map-sw-btn${_ggSatellite ? " is-active" : ""}" data-sat="1">Satellite</button>
    </div>
    ${resultHtml}
  `,
    "left",
    false,
  );

  setTimeout(() => _ggInitPreview(_ggRound.loc), 0);

  document.getElementById("gg-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showGamesTool("right", true);
  });
  document
    .getElementById("gg-expand-btn")
    .addEventListener("click", () => _ggOpenModal(_ggRound.loc));
  document
    .getElementById("gg-map-preview")
    .addEventListener("click", () => _ggOpenModal(_ggRound.loc));
  document.getElementById("gg-next-btn")?.addEventListener("click", () => {
    _ggDestroyModal();
    _ggNewRound();
  });
  const tileSwitcher = document.getElementById("gg-map-switcher");
  _ggSyncTileSwitcher(tileSwitcher);
  tileSwitcher?.querySelectorAll(".gg-map-sw-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      _ggSatellite = btn.dataset.sat === "1";
      _ggSwapTiles(_ggLeafletPrev);
      _ggSwapTiles(_ggLeafletModal);
      _ggSyncAllTileSwitchers();
    });
  });
}

function _ggShowSummary() {
  _ggDestroyPreview();
  _ggDestroyModal();
  _ggStopTimer();
  _ggClearHighlights();

  const total = _ggHistory.length;
  const correct = _ggScore.correct;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const grade =
    pct >= 90
      ? "\uD83C\uDFC6"
      : pct >= 70
        ? "\uD83C\uDF89"
        : pct >= 50
          ? "\uD83D\uDC4D"
          : "\uD83D\uDCDA";
  const tag =
    pct >= 90
      ? "Expert!"
      : pct >= 70
        ? "Great job!"
        : pct >= 50
          ? "Not bad!"
          : "Keep practicing!";

  const rows = _ggHistory
    .map(
      (h, i) => `
    <div class="gg-summary-row ${h.correct ? "is-correct" : h.half ? "is-half" : "is-wrong"}">
      <span class="gg-summary-num">${i + 1}</span>
      <span class="gg-summary-icon">${h.correct ? "\u2705" : h.half ? "\u00bd" : h.timedOut ? "\u23F0" : "\u274C"}</span>
      <span class="gg-summary-prov">${escapeHtml(h.prov)}</span>
      ${h.dist != null ? `<span class="gg-summary-dist">\u2248 ${Math.round(h.dist).toLocaleString()} km</span>` : ""}
    </div>`,
    )
    .join("");

  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="gg-back">\u2039 Quit</button>
    <div class="gg-summary">
      <div class="gg-summary-grade">${grade}</div>
      <div class="gg-summary-score">${correct % 1 === 0 ? correct : correct.toFixed(1)} <span class="gg-summary-total">/ ${total}</span></div>
      <div class="gg-summary-tag">${tag}</div>
      ${_ggBestStreak >= 2 ? `<div class="gg-summary-streak">\uD83D\uDD25 Best streak: ${_ggBestStreak}</div>` : ""}
      <div class="gg-summary-list">${rows}</div>
      <button class="gg-play-again-btn" id="gg-play-again">Play Again</button>
    </div>
  `,
    "left",
    false,
  );

  document.getElementById("gg-back").addEventListener("click", () => {
    _ggReset();
    _activeToolId = null;
    showGamesTool("right", true);
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
  const correct = !timedOut && guessProvId === _ggRound.prov;

  let dist = null;
  let half = false;
  if (!correct && !timedOut) {
    const correctC = _ggProvCentroid(_ggRound.prov);
    const guessC = _ggProvCentroid(guessProvId);
    if (correctC && guessC) {
      dist = _ggHaversine(guessC.lat, guessC.lng, correctC.lat, correctC.lng);
      half = dist <= _GG_HALF_DIST;
    }
  }

  _ggScore.total++;
  if (correct) {
    _ggScore.correct++;
    _ggStreak++;
    if (_ggStreak > _ggBestStreak) _ggBestStreak = _ggStreak;
  } else if (half) {
    _ggScore.correct += 0.5;
    _ggScore.half++;
    // half-point doesn't reset or extend streak
  } else {
    _ggStreak = 0;
  }

  _ggHistory.push({
    correct,
    half,
    timedOut,
    prov: _ggRound.prov,
    guess: guessProvId,
    dist,
  });

  _ggHighlight(_ggRound.prov, "is-gg-correct");
  if (!timedOut && !correct) {
    _ggHighlight(guessProvId, half ? "is-gg-half" : "is-gg-wrong");
    _ggDrawGuessingLine(_ggRound.prov, guessProvId);
  }

  const popResult = correct ? "correct" : half ? "half" : "wrong";
  _ggScorePop(popResult);
  _renderGeoGuesser({ correct, half, timedOut, prov: _ggRound.prov, dist });

  // Auto-open the panel on mobile so the result is immediately visible
  if (
    window.innerWidth <= 640 &&
    typeof window._openMobileSheet === "function"
  ) {
    window._openMobileSheet();
  }
}
