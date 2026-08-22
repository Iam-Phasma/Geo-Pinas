/* ============================================================
   TERRALYFT — app.js
   Core: map rendering, interaction, navigation, and helpers.
   Tool logic lives in js/tools/. Boot logic in js/boot.js.
   Load order: data.js → app.js → tools/*.js → boot.js
   ============================================================ */

"use strict";

const CONVEX_SITE_URL = "https://industrious-heron-706.convex.site";

function scheduleVisitorTrack() {
  const run = () => {
    (async function trackVisitor() {
      try {
        const el = document.getElementById("visitor-count");
        const res = await fetch(`${CONVEX_SITE_URL}/track`, { method: "POST" });
        if (!res.ok) return;
        const { count } = await res.json();
        if (el) el.textContent = count.toLocaleString();
      } catch {}
    })();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1000 });
  } else {
    window.setTimeout(run, 300);
  }
}

scheduleVisitorTrack();

// ── State ──────────────────────────────────────────────────────
let _selectedGroup = null;
let _hoveredGroup = null;
let _wasDragging = false;
let _zoom = null;
let _svg = null;
let _g = null;
let _activeToolId = null;
let _exploreTab = "info"; // "info" | "weather"
let _exploreListState = { region: "", query: "" };
let _pendingZoomTransform = null;
let _zoomFrame = null;
let _resizeFrame = null;
let _mapRenderFrame = null;
let _seaTextureOpacityBeforeInteraction = null;
let _mapCanvas = null;
let _mapHitCanvas = null;
let _mapCtx = null;
let _mapHitCtx = null;
let _provinceColorMap = new Map();
let _provinceGroupMap = new Map();
const DRAG_CLICK_THRESHOLD_PX = 6;
let _dragStartClientX = null;
let _dragStartClientY = null;
let _zoomStartTransform = null;
let _dragGestureActive = false;

function _setSeaTextureVisibilityDuringInteraction(isInteracting) {
  const pattern = document.getElementById("ocean-pattern");
  if (!pattern) return;
  if (document.documentElement.classList.contains("no-sea-texture")) {
    pattern.style.opacity = "0";
    pattern.setAttribute("opacity", "0");
    _seaTextureOpacityBeforeInteraction = null;
    return;
  }

  if (isInteracting) {
    const current = pattern.style.opacity || "1";
    if (current !== "0") {
      _seaTextureOpacityBeforeInteraction = current;
      pattern.style.opacity = "0";
    }
  } else {
    if (_seaTextureOpacityBeforeInteraction != null) {
      pattern.style.opacity = _seaTextureOpacityBeforeInteraction;
    }
    _seaTextureOpacityBeforeInteraction = null;
  }
}

function _eventClientPoint(sourceEvent) {
  if (!sourceEvent) return null;
  if (
    Number.isFinite(sourceEvent.clientX) &&
    Number.isFinite(sourceEvent.clientY)
  ) {
    return { x: sourceEvent.clientX, y: sourceEvent.clientY };
  }
  const t =
    sourceEvent.touches && sourceEvent.touches[0]
      ? sourceEvent.touches[0]
      : sourceEvent.changedTouches && sourceEvent.changedTouches[0]
        ? sourceEvent.changedTouches[0]
        : null;
  if (t && Number.isFinite(t.clientX) && Number.isFinite(t.clientY)) {
    return { x: t.clientX, y: t.clientY };
  }
  return null;
}

// ── Helpers ────────────────────────────────────────────────────
function fitTransform(w, h) {
  const scale = Math.min(w / MAP_W, h / MAP_H) * 0.92;
  // Offset so the map centers in the *visible* viewport (= #map-wrap) rather than
  // the full SVG canvas. The bleed is CSS left:-22%, top:-30% on #map-tilt-frame.
  const ox = w * 0.22;
  const oy = h * 0.4;
  return d3.zoomIdentity
    .translate(ox + (w - MAP_W * scale) / 2, oy + (h - MAP_H * scale) / 2)
    .scale(scale);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _getCssColor(varName, fallback) {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return val || fallback;
}

function _getProvinceFill(groupEl) {
  const classList = groupEl.classList;
  if (_activeToolId === "naming") {
    return classList.contains("is-naming-found")
      ? _getCssColor("--province-fill", "#166e3e")
      : "#ffffff";
  }
  if (classList.contains("is-selected"))
    return _getCssColor("--province-selected", "#ecd344");
  if (classList.contains("is-hovered"))
    return _getCssColor("--province-hover", "#8b8c8d");
  if (classList.contains("is-quiz")) return "#f59e0b";
  if (classList.contains("is-roulette-winner")) return "#ef4444";
  if (classList.contains("is-roulette")) return "#3b82f6";
  if (classList.contains("is-tl-lived")) return "#7c3aed";
  if (classList.contains("is-tl-stayed")) return "#2563eb";
  if (classList.contains("is-tl-visited")) return "#0891b2";
  if (classList.contains("is-tl-alighted")) return "#16a34a";
  if (classList.contains("is-tl-passed")) return "#d97706";
  return _getCssColor("--province-fill", "#166e3e");
}

function _getProvinceStroke(groupEl) {
  if (_activeToolId === "naming") return "#000000";
  return document.documentElement.classList.contains("no-borders")
    ? _getProvinceFill(groupEl)
    : _getCssColor("--province-border", "#000000");
}

function clearHoveredProvince() {
  if (!_hoveredGroup) return;
  d3.select(_hoveredGroup).classed("is-hovered", false);
  _hoveredGroup = null;
  requestMapRender();
}

function requestMapRender() {
  if (_mapRenderFrame) return;
  _mapRenderFrame = window.requestAnimationFrame(() => {
    _mapRenderFrame = null;
    renderMap();
  });
}

window.requestMapRender = requestMapRender;

function _setInfoPanelHtml(html, direction = "left", animate = false) {
  const panel = document.getElementById("info-panel");
  if (!panel) return;

  panel.classList.remove("panel-slide-in-left", "panel-slide-in-right");
  panel.innerHTML = html;

  if (!animate) return;

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const cls =
    direction === "right" ? "panel-slide-in-right" : "panel-slide-in-left";
  // Force reflow so consecutive same-direction transitions still replay.
  void panel.offsetWidth;
  panel.classList.add(cls);
}

window._setInfoPanelHtml = _setInfoPanelHtml;

function _syncSwitcherPill(switcherEl) {
  if (!switcherEl) return;
  const btns = Array.from(switcherEl.querySelectorAll(".gg-map-sw-btn"));
  if (!btns.length) return;
  const activeIdx = Math.max(
    0,
    btns.findIndex((btn) => btn.classList.contains("is-active")),
  );
  switcherEl.style.setProperty("--gg-pill-count", String(btns.length));
  switcherEl.style.setProperty("--gg-pill-index", String(activeIdx));
}

window._syncSwitcherPill = _syncSwitcherPill;

function _refreshMapVisuals() {
  requestMapRender();
  if (typeof updateWeatherEmojiPosition === "function") {
    updateWeatherEmojiPosition();
  }
}

window._refreshMapVisuals = _refreshMapVisuals;

function renderMap(transform = d3.zoomTransform(_svg.node())) {
  if (!_mapCanvas || !_mapCtx || !_mapHitCanvas || !_mapHitCtx) return;
  const frame = document.getElementById("map-tilt-frame");
  // offsetWidth/Height (not getBoundingClientRect) — rotateX foreshortens the
  // bounding rect when tilted, which would shrink the canvas below the frame.
  const width = frame.offsetWidth;
  const height = frame.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  if (
    _mapCanvas.width !== Math.round(width * dpr) ||
    _mapCanvas.height !== Math.round(height * dpr)
  ) {
    _mapCanvas.width = Math.round(width * dpr);
    _mapCanvas.height = Math.round(height * dpr);
    _mapHitCanvas.width = Math.round(width * dpr);
    _mapHitCanvas.height = Math.round(height * dpr);
    _mapCanvas.style.width = `${width}px`;
    _mapCanvas.style.height = `${height}px`;
    _mapHitCanvas.style.width = `${width}px`;
    _mapHitCanvas.style.height = `${height}px`;
  }

  _mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _mapCtx.clearRect(0, 0, width, height);
  _mapHitCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _mapHitCtx.clearRect(0, 0, width, height);

  _mapCtx.save();
  _mapHitCtx.save();
  _mapCtx.translate(transform.x, transform.y);
  _mapCtx.scale(transform.k, transform.k);
  _mapHitCtx.translate(transform.x, transform.y);
  _mapHitCtx.scale(transform.k, transform.k);

  _provinceColorMap.clear();
  const groups = _g.selectAll(".province-group").nodes();
  groups.forEach((groupEl, index) => {
    const datum = d3.select(groupEl).datum();
    if (!datum) return;
    const pathEl = groupEl.querySelector(".province");
    if (!pathEl) return;
    const color = _getProvinceFill(groupEl);
    const stroke = _getProvinceStroke(groupEl);
    const tx = parseFloat(
      groupEl
        .getAttribute("transform")
        ?.match(/translate\(([-\d.]+),\s*([-\d.]+)/)?.[1] || 0,
    );
    const ty = parseFloat(
      groupEl
        .getAttribute("transform")
        ?.match(/translate\(([-\d.]+),\s*([-\d.]+)/)?.[2] || 0,
    );
    const hitColor = `#${(index + 1).toString(16).padStart(6, "0")}`;
    _provinceColorMap.set(hitColor, datum);

    const path2d = new Path2D(pathEl.getAttribute("d") || "");

    _mapCtx.save();
    _mapCtx.translate(tx, ty);
    _mapCtx.fillStyle = color;
    _mapCtx.strokeStyle = stroke;
    _mapCtx.lineWidth = 1.1;
    _mapCtx.lineJoin = "round";
    _mapCtx.lineCap = "round";
    _mapCtx.fill(path2d);
    _mapCtx.stroke(path2d);
    _mapCtx.restore();

    _mapHitCtx.save();
    _mapHitCtx.translate(tx, ty);
    _mapHitCtx.fillStyle = hitColor;
    _mapHitCtx.fill(path2d);
    _mapHitCtx.restore();
  });

  _mapCtx.restore();
  _mapHitCtx.restore();
}

function _getProvinceAtPoint(clientX, clientY) {
  if (!_mapHitCanvas || !_mapHitCtx) return null;
  const rect = _mapCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const scaleX = _mapHitCanvas.width / rect.width;
  const scaleY = _mapHitCanvas.height / rect.height;
  const px = Math.min(
    Math.max(Math.round(x * scaleX), 0),
    _mapHitCanvas.width - 1,
  );
  const py = Math.min(
    Math.max(Math.round(y * scaleY), 0),
    _mapHitCanvas.height - 1,
  );
  const data = _mapHitCtx.getImageData(px, py, 1, 1).data;
  const hitColor = `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return _provinceColorMap.get(hitColor) || null;
}

// ── Flag URL helpers ──────────────────────────────────────────
const _CRW = "https://www.crwflags.com/fotw/images/p/";

// Province → crwflags GIF filename (null = no crwflags image, fall through to Wikipedia/region)
const _PROV_FLAG = {
  "Ilocos Norte": "ph-iln.gif",
  "Ilocos Sur": "ph-ils.gif",
  "La Union": "ph-lun.gif",
  Pangasinan: "ph-pan.gif",
  Batanes: "ph-btn.gif",
  Cagayan: "ph-cag.gif",
  Isabela: "ph-isa.gif",
  "Nueva Vizcaya": "ph-nuv.gif",
  Quirino: "ph-qui.gif",
  Aurora: "ph-aur.gif",
  Bataan: "ph-ban.gif",
  Bulacan: "ph-bul.gif",
  "Nueva Ecija": "ph-nue.gif",
  Pampanga: "ph-pamp2.gif",
  Tarlac: "ph-tar.gif",
  Zambales: "ph-zmb.gif",
  Batangas: "ph-btg.gif",
  Cavite: "ph-cav.gif",
  Laguna: "ph-lag.gif",
  Quezon: "ph-que.gif",
  Rizal: "ph-riz.gif",
  Marinduque: "ph-mad.gif",
  "Occidental Mindoro": "ph-mdc.gif",
  "Oriental Mindoro": "ph-mdr.gif",
  Palawan: "ph-plw.gif",
  Romblon: "ph-pp.gif",
  Albay: "ph-alb.gif",
  "Camarines Norte": "ph-can.gif",
  "Camarines Sur": "ph-cas.gif",
  Catanduanes: "ph-catan.gif",
  Masbate: "ph-mas.gif",
  Sorsogon: "ph-sor.gif",
  Abra: "ph-abr.gif",
  Kalinga: "ph-kal.gif",
  Benguet: "ph-ben.gif",
  Ifugao: "ph-ifu.gif",
  "Mountain Province": "ph-mou.gif",
  Aklan: "ph-akl.gif",
  Antique: "ph-ant.gif",
  Capiz: "ph-cap.gif",
  Guimaras: "ph-guima.gif",
  Iloilo: "ph-ili.gif",
  "Negros Occidental": "ph-nec.gif",
  Bohol: "ph-boh.gif",
  Cebu: "ph-ceb.gif",
  "Negros Oriental": "ph-ner.gif",
  Siquijor: "ph-sig.gif",
  Biliran: "ph-bil.gif",
  Leyte: "ph-ley.gif",
  "Southern Leyte":
    "https://southernleyte.gov.ph/wp-content/uploads/2023/04/flag-500x288.png",
  Samar: "ph-wsa.gif",
  "Northern Samar": "ph-nsa.gif",
  "Eastern Samar": "ph-eas.gif",
  "Zamboanga del Norte": "ph-zan.gif",
  "Zamboanga del Sur": "ph-zas.gif",
  "Zamboanga Sibugay":
    "https://upload.wikimedia.org/wikipedia/commons/3/3c/Zamboanga_Sibugay_Flag.png",
  Basilan: "ph-bas.gif",
  Bukidnon: "ph-buk2.gif",
  Camiguin: "ph-cam.gif",
  "Lanao del Norte": "ph-lan.gif",
  "Misamis Occidental": "ph-msc.gif",
  "Misamis Oriental": "ph-msr.gif",
  "Davao del Norte": "ph-dav.gif",
  "Davao del Sur": "ph-das.gif",
  "Davao Oriental": "ph-dao.gif",
  "Davao de Oro":
    "https://upload.wikimedia.org/wikipedia/commons/9/94/Davao_De_Oro_Flag.jpg",
  "Davao Occidental":
    "https://upload.wikimedia.org/wikipedia/commons/0/0e/PH-DVO_Flag.png",
  Cotabato: "ph-nco.gif",
  "South Cotabato": "ph-sco.gif",
  "Sultan Kudarat": "ph-suk.gif",
  Sarangani:
    "https://upload.wikimedia.org/wikipedia/commons/7/76/Flag_of_Sarangani.png",
  "Metro Manila": "ph-mw.gif",
  "Agusan del Norte": "ph-agn.gif",
  "Agusan del Sur": "ph-ags.gif",
  "Dinagat Islands":
    "https://upload.wikimedia.org/wikipedia/commons/5/51/PH-DIN_Flag.png",
  "Surigao del Norte": "ph-sun.gif",
  "Surigao del Sur": "ph-sur.gif",
  "Lanao del Sur": "ph-las.gif",
  "Maguindanao del Norte": "ph-mag.gif",
  "Maguindanao del Sur": "ph-mag.gif",
  Sulu: "ph-slu.gif",
  "Tawi-Tawi": "ph-taw.gif",
  Apayao: "https://upload.wikimedia.org/wikipedia/commons/3/31/PH-APA_Flag.png",
};

const _REGION_FLAG_FILE = {
  "Region I — Ilocos": "Ilocos_Region",
  "Region II — Cagayan Valley": "Cagayan_Valley",
  "Region III — Central Luzon": "Central_Luzon",
  "Region IVA — Calabarzon": "CALABARZON",
  MIMAROPA: "MIMAROPA_Region",
  "Region V — Bicol": "Bicol_Region",
  "Region VI — Western Visayas": "Western_Visayas",
  "Region VII — Central Visayas": "Central_Visayas",
  "Region VIII — Eastern Visayas": "Eastern_Visayas",
  "Region IX — Zamboanga Peninsula": "Zamboanga_Peninsula",
  "Region X — Northern Mindanao": "Northern_Mindanao",
  "Region XI — Davao Region": "Davao_Region",
  "Region XII — SOCCSKSARGEN": "SOCCSKSARGEN",
  "NCR — National Capital Region": "Metro_Manila",
  CAR: "Cordillera_Administrative_Region",
  "Region XIII — Caraga": "Caraga",
  BARMM: "Bangsamoro",
};

function _provFlagUrl(id) {
  const file = _PROV_FLAG[id];
  if (!file) return null;
  return file.startsWith("http") ? file : _CRW + file;
}

function _regionFlagUrl(region) {
  const file = _REGION_FLAG_FILE[region];
  return file
    ? `https://en.wikipedia.org/wiki/Special:FilePath/Flag_of_${file}.svg`
    : null;
}

// ── Sidebar title helper ───────────────────────────────────────
function setSidebarTitle(text) {
  const el = document.getElementById("sidebar-title");
  if (el) el.textContent = text;
}

// ── Tools home ─────────────────────────────────────────────────
const TOOLS = [
  {
    id: "explore",
    icon: "🗺️",
    color: "#dbeafe",
    title: "Explore",
    desc: "Search and browse all 81 provinces by region.",
  },
  {
    id: "travel",
    icon: "✈️",
    color: "#f0fdf4",
    title: "Travel Level",
    desc: "Track how well you've explored.",
  },
  {
    id: "roulette",
    icon: "🎲",
    color: "#fff7ed",
    title: "Province Roulette",
    desc: "Spin to randomly pick a province.",
  },
  {
    id: "games",
    icon: "🎮",
    color: "#ede9fe",
    title: "Games",
    desc: "Play and test your knowledge.",
  },
];

// ── Games sub-menu ─────────────────────────────────────────────
const GAMES = [
  {
    id: "geoguesser",
    icon: "📍",
    color: "#fce7f3",
    title: "Local Guesser",
    desc: "Guess the province from a map view.",
  },
  {
    id: "quiz",
    icon: "🧠",
    color: "#ede9fe",
    title: "Province Quiz",
    desc: "Test how well you know Philippine geography.",
  },
  {
    id: "naming",
    icon: "📝",
    color: "#dcfce7",
    title: "Name the Map",
    desc: "Name every province on the map.",
  },
];

function showGamesTool(direction = "left", animatePanel = false) {
  _activeToolId = null;
  _exploreTab = "info";
  clearWeatherEmoji();
  _clearQuizHighlight();
  _clearTravelColors();
  _rouletteClearHighlight();
  _ggClearHighlights();
  if (typeof _namingReset === "function") _namingReset();
  setSidebarTitle("Games");
  _setInfoPanelHtml(`
    <button class="tool-back-btn" id="games-back">‹ Back</button>
    <div class="tools-list">
      ${GAMES.map((t) => `
        <button class="tool-card" data-tool="${t.id}">
          <span class="tool-icon" style="background:${t.color}">
            <span class="tool-emoji">${t.icon}</span>
          </span>
          <span class="tool-body">
            <span class="tool-title">${t.title}</span>
            <span class="tool-desc">${t.desc}</span>
          </span>
          <span class="tool-chevron">›</span>
        </button>
      `).join("")}
    </div>
  `, direction, animatePanel);
  document.getElementById("games-back").addEventListener("click", () => showToolsHome("right", true));
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.tool === "quiz") showQuizTool(true);
      else if (card.dataset.tool === "geoguesser") showGeoGuesserTool(true);
      else if (card.dataset.tool === "naming") showNamingTool(true);
    });
  });
}

function showToolsHome(direction = "left", animatePanel = false) {
  _activeToolId = null;
  _exploreTab = "info";
  clearWeatherEmoji();
  _clearQuizHighlight();
  _clearTravelColors();
  _rouletteClearHighlight();
  _ggClearHighlights();
  if (typeof _namingReset === "function") _namingReset();
  setSidebarTitle("Tools");
  _setInfoPanelHtml(
    `
    <div class="tools-list">
      ${TOOLS.map(
        (t) => `
        <button class="tool-card" data-tool="${t.id}">
          <span class="tool-icon" style="background:${t.color}">
            <span class="tool-emoji">${t.icon}</span>
          </span>
          <span class="tool-body">
            <span class="tool-title">${t.title}</span>
            <span class="tool-desc">${t.desc}</span>
          </span>
          <span class="tool-chevron">›</span>
        </button>
      `,
      ).join("")}
    </div>
    <button class="about-btn" id="about-btn">About Terralyft</button>
  `,
    direction,
    animatePanel,
  );
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.tool === "explore") showIdlePanel("left", true);
      else if (card.dataset.tool === "travel") showTravelTool(true);
      else if (card.dataset.tool === "roulette") showRouletteTool(true);
      else if (card.dataset.tool === "games") showGamesTool("left", true);
    });
  });

  document
    .getElementById("about-btn")
    .addEventListener("click", showAboutPanel);
}

// ── About panel ────────────────────────────────────────────────
function showAboutPanel(direction = "left", animatePanel = false) {
  setSidebarTitle("About");
  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="about-back">‹ Back</button>
    <div class="about-panel">
      <div class="about-logo-row">
        <img src="favicon.svg" alt="Terralyft" class="about-logo" aria-hidden="true"/>
        <div>
          <div class="about-app-name">Terralyft</div>
          <div class="about-app-tagline">Interactive Philippine Province Map</div>
        </div>
      </div>
      <p class="about-desc">An interactive Philippine province map built for fun, free and open source.</p>

      <div class="about-section-title">Features</div>
      <ul class="about-list">
        <li>All 81 provinces + NCR across Luzon, Visayas, Mindanao</li>
        <li><strong>Explore</strong> — browse provinces by region, Wikipedia summaries &amp; flags</li>
        <li><strong>Weather</strong> — live conditions per province via Open-Meteo with Meteocons icons</li>
        <li><strong>Travel Level</strong> — track &amp; score your provincial visits</li>
        <li><strong>Travel Snapshot</strong> — downloadable postcard PNG of your travel map</li>
        <li><strong>Province Quiz</strong> — test your Philippine geography knowledge</li>
        <li><strong>Local Guesser</strong> — guess the province from its map shape</li>
        <li><strong>Roulette</strong> — spin to pick a random province</li>
        <li>Map customization: colors, borders, sea texture, dark mode</li>
        <li>3D tilt &amp; perspective view</li>
      </ul>

      <div class="about-section-title">Credits</div>
      <p class="about-credit">Weather icons from <a href="https://meteocons.com/icons" target="_blank" rel="noopener">Meteocons</a> by <a href="https://bas.dev/" target="_blank" rel="noopener">Bas Milius</a>.</p>
      <p class="about-credit">Travel Level concept inspired by <a href="https://my-philippines-travel-level.com/" target="_blank" rel="noopener">My Philippines Travel Level</a>.</p>
      <p class="about-credit">Province map shapes adapted from <a href="https://github.com/OSSPhilippines/philippines-travel-level-map" target="_blank" rel="noopener">OSSPhilippines / philippines-travel-level-map</a> (GPL-3.0).</p>
      <p class="about-credit">Built with <a href="https://github.com/features/copilot" target="_blank" rel="noopener">GitHub Copilot</a> (Claude). Any random features are strictly the author's own doing.</p>

      <div class="about-section-title">License</div>
      <p class="about-credit">Distributed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GPL-3.0</a>. Source code is publicly available.</p>

      <a class="about-github-btn" href="https://github.com/Iam-Phasma/Geo-Pinas" target="_blank" rel="noopener">
        View on GitHub ↗
      </a>
    </div>
  `,
    direction,
    animatePanel,
  );
  document
    .getElementById("about-back")
    .addEventListener("click", () => showToolsHome("right", true));
}

// ── Map init ───────────────────────────────────────────────────
function initMap() {
  const container = document.getElementById("map-wrap");
  // Visible viewport dims — used for fitTransform and pan extents
  const { width: wrapW, height: wrapH } = container.getBoundingClientRect();
  // Full SVG canvas dims (frame bleeds beyond wrap) — used for SVG attr sizing
  const { width, height } = document
    .getElementById("map-tilt-frame")
    .getBoundingClientRect();

  _svg = d3.select("#map").attr("width", width).attr("height", height);

  // ── Ocean background: solid base + chevron wave pattern ──────
  const defs = _svg.append("defs");

  // Chevron wave tile: 32×16px, sparse subtle ripple
  const pat = defs
    .append("pattern")
    .attr("id", "ocean-wave")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 32)
    .attr("height", 16)
    .attr("patternUnits", "userSpaceOnUse");

  // Base fill for the tile (transparent — lets ocean-bg show through)
  pat.append("rect").attr("width", 32).attr("height", 16).attr("fill", "none");

  // Chevron path: /\/\ drawn as a stroke
  pat
    .append("path")
    .attr("d", "M0 12 L8 4 L16 12 L24 4 L32 12")
    .attr("fill", "none")
    .attr("stroke", "#5087df")
    .attr("stroke-opacity", "0.35")
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round");

  _svg
    .append("rect")
    .attr("id", "ocean-bg")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#1b3a6b");

  _svg
    .append("rect")
    .attr("id", "ocean-pattern")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "url(#ocean-wave)");

  _mapCanvas = document.createElement("canvas");
  _mapCanvas.id = "map-canvas";
  _mapCanvas.setAttribute("aria-hidden", "true");
  _mapHitCanvas = document.createElement("canvas");
  _mapHitCanvas.id = "map-hit-canvas";
  _mapHitCanvas.setAttribute("aria-hidden", "true");
  document.getElementById("map-tilt-frame").appendChild(_mapCanvas);
  document.getElementById("map-tilt-frame").appendChild(_mapHitCanvas);
  _mapCtx = _mapCanvas.getContext("2d");
  _mapHitCtx = _mapHitCanvas.getContext("2d", { willReadFrequently: true });

  _g = _svg.append("g").attr("id", "provinces-layer");

  PROVINCES.forEach((prov) => {
    const grp = _g
      .append("g")
      .datum(prov)
      .attr("class", "province-group")
      .attr("transform", prov.transform)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", prov.id);

    grp.append("path").attr("class", "province").attr("d", prov.d);
    _provinceGroupMap.set(prov.id, grp.node());
  });

  _g.selectAll(".province-group")
    .on("mousemove", function (event, d) {
      if (_zoomFrame) return;
      onMouseMove(event, d);
    })
    .on("mouseleave", onMouseLeave)
    .on("click", function (event, d) {
      event.stopPropagation();
      onProvinceClick.call(this, event, d);
    })
    .on("keydown", function (event, d) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onProvinceClick.call(this, event, d);
      }
    });

  _svg.on("click.ocean", (event) => {
    if (event.target.closest(".province-group")) return;
    handleOceanClick();
  });

  // ── D3 Zoom & Pan ─────────────────────────────────────────
  const initT = fitTransform(wrapW, wrapH);

  // Pad in data-space so at the fit zoom the map can slide ~85% of
  // a viewport dimension off-screen in any direction before clamping.
  function calcPad(w, h, k) {
    return { x: (w * 0.85) / k, y: (h * 0.85) / k };
  }
  let pad = calcPad(wrapW, wrapH, initT.k);

  function applyTranslateExtent(w, h, k) {
    const p = calcPad(w, h, k);
    pad = p;
    _zoom.translateExtent([
      [-p.x, -p.y],
      [MAP_W + p.x, MAP_H + p.y],
    ]);
  }

  _zoom = d3
    .zoom()
    .clickDistance(DRAG_CLICK_THRESHOLD_PX)
    .scaleExtent([initT.k * 0.75, initT.k * 15])
    .on("start", (event) => {
      _wasDragging = false;
      _zoomStartTransform = d3.zoomTransform(_svg.node());
      _dragGestureActive =
        !!event.sourceEvent &&
        (event.sourceEvent.type === "mousedown" ||
          event.sourceEvent.type === "pointerdown" ||
          event.sourceEvent.type === "touchstart");
      const startPoint = _eventClientPoint(event.sourceEvent);
      _dragStartClientX = startPoint ? startPoint.x : null;
      _dragStartClientY = startPoint ? startPoint.y : null;
      container.classList.add("is-dragging");
      _setSeaTextureVisibilityDuringInteraction(true);
    })
    .on("zoom", (event) => {
      if (
        event.sourceEvent &&
        (event.sourceEvent.type === "mousemove" ||
          event.sourceEvent.type === "pointermove" ||
          event.sourceEvent.type === "touchmove")
      ) {
        if (_zoomStartTransform) {
          const dx = event.transform.x - _zoomStartTransform.x;
          const dy = event.transform.y - _zoomStartTransform.y;
          if (
            dx * dx + dy * dy >=
            DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX
          ) {
            _wasDragging = true;
          }
        } else {
          const p = _eventClientPoint(event.sourceEvent);
          if (p) {
            if (_dragStartClientX == null || _dragStartClientY == null) {
              _dragStartClientX = p.x;
              _dragStartClientY = p.y;
            }
            const dx = p.x - _dragStartClientX;
            const dy = p.y - _dragStartClientY;
            if (
              dx * dx + dy * dy >=
              DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX
            ) {
              _wasDragging = true;
            }
          }
        }
        if (_wasDragging) {
          tooltip.classList.remove("is-visible");
          if (_activeToolId === "travel") _closeTravelPicker();
        }
      }

      _pendingZoomTransform = event.transform;
      if (_zoomFrame) return;

      tooltip.classList.remove("is-visible");

      _zoomFrame = window.requestAnimationFrame(() => {
        _zoomFrame = null;
        if (_pendingZoomTransform) {
          const t = _pendingZoomTransform;
          _pendingZoomTransform = null;
          _g.attr("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
          renderMap(t);
          updateWeatherEmojiPosition();
          if (typeof _ggSyncLineOverlay === "function") _ggSyncLineOverlay();
        }
      });
    })
    .on("end", (event) => {
      if (_dragGestureActive && !_wasDragging && _zoomStartTransform) {
        _svg.call(_zoom.transform, _zoomStartTransform);
      }
      _dragStartClientX = null;
      _dragStartClientY = null;
      _zoomStartTransform = null;
      _dragGestureActive = false;
      container.classList.remove("is-dragging");
      _setSeaTextureVisibilityDuringInteraction(false);
    });

  _svg.call(_zoom).on("dblclick.zoom", null);
  applyTranslateExtent(wrapW, wrapH, initT.k);
  _svg.call(_zoom.transform, initT);
  renderMap(initT);
  _svg.on("dblclick", resetZoom);

  function zoomBy(factor) {
    _svg
      .transition()
      .duration(180)
      .ease(d3.easeCubicOut)
      .call(_zoom.scaleBy, factor);
  }

  function resetZoom() {
    const { width: w, height: h } = container.getBoundingClientRect();
    const t = fitTransform(w, h);
    _zoom.scaleExtent([t.k * 0.75, t.k * 15]);
    applyTranslateExtent(w, h, t.k);
    _svg
      .transition()
      .duration(240)
      .ease(d3.easeCubicOut)
      .call(_zoom.transform, t);
  }
  window._resetZoom = resetZoom;

  document
    .getElementById("zoom-in")
    .addEventListener("click", () => zoomBy(1.6));
  document
    .getElementById("zoom-out")
    .addEventListener("click", () => zoomBy(1 / 1.6));
  document.getElementById("zoom-reset").addEventListener("click", resetZoom);

  // ── Tilt control ───────────────────────────────────────────
  const tiltFrame = document.getElementById("map-tilt-frame");
  const tiltSlider = document.getElementById("tilt-slider");
  const tiltResetBtn = document.getElementById("tilt-reset");

  function applyTilt(deg) {
    tiltFrame.style.transform = `rotateX(${deg}deg)`;
  }

  tiltSlider.addEventListener("input", () =>
    applyTilt(Number(tiltSlider.value)),
  );

  tiltResetBtn.addEventListener("click", () => {
    tiltSlider.value = 0;
    applyTilt(0);
  });

  // Sync transform to slider on init — browser may restore previous slider
  // value from form cache on refresh, which would mismatch the CSS default.
  applyTilt(Number(tiltSlider.value));

  // Exposed so other modules (boot.js mobile sheet) can reset tilt
  window._resetTilt = () => {
    tiltSlider.value = 0;
    applyTilt(0);
  };

  window.addEventListener("resize", () => {
    if (_resizeFrame) return;

    _resizeFrame = window.requestAnimationFrame(() => {
      _resizeFrame = null;
      // offsetWidth/Height (not getBoundingClientRect) to avoid tilt foreshortening.
      const w = tiltFrame.offsetWidth;
      const h = tiltFrame.offsetHeight;
      _svg.attr("width", w).attr("height", h);
      _svg.select("#ocean-bg").attr("width", w).attr("height", h);
      _svg.select("#ocean-pattern").attr("width", w).attr("height", h);
      const { width: ww, height: wh } = container.getBoundingClientRect();
      const t = fitTransform(ww, wh);
      _zoom.scaleExtent([t.k * 0.75, t.k * 15]);
      applyTranslateExtent(ww, wh, t.k);
      _svg.call(_zoom.transform, t);
      renderMap(t);
      if (typeof _ggSyncLineOverlay === "function") _ggSyncLineOverlay();
    });
  });
}

// ── Interaction ────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function onMouseMove(event, d) {
  const groupEl = _provinceGroupMap.get(d.id) || null;
  if (groupEl && _hoveredGroup !== groupEl) {
    if (_hoveredGroup) d3.select(_hoveredGroup).classed("is-hovered", false);
    d3.select(groupEl).classed("is-hovered", true);
    _hoveredGroup = groupEl;
    requestMapRender();
  }

  // Hide province name tooltip during the naming game to avoid giving away the answer.
  if (_activeToolId === "naming") {
    tooltip.classList.remove("is-visible");
    return;
  }

  tooltip.textContent = d.id;
  const wrap = document.getElementById("map-wrap");
  const rect = wrap.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  if (!tooltip.classList.contains("is-visible")) {
    tooltip.classList.add("is-visible");
  }
}

function onMouseLeave() {
  if (_hoveredGroup) {
    d3.select(_hoveredGroup).classed("is-hovered", false);
    _hoveredGroup = null;
    requestMapRender();
  }
  tooltip.classList.remove("is-visible");
}

function handleOceanClick() {
  if (_wasDragging) {
    _wasDragging = false;
    return;
  }
  if (_activeToolId === "travel") {
    _closeTravelPicker();
  }
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
    requestMapRender();
    if (_activeToolId === "explore") {
      clearWeatherEmoji();
      _lastWeatherInfo = null;
      showIdlePanel();
    } else if (_activeToolId === "roulette") {
      // keep roulette panel
    } else if (_activeToolId === "geoguesser") {
      // keep geoguesser panel
    } else {
      showToolsHome();
    }
  } else if (_activeToolId === "explore") {
    showIdlePanel();
  }
}

function onProvinceClick(event, d) {
  if (_wasDragging) {
    _wasDragging = false;
    return;
  }
  event.stopPropagation();

  // Quiz, Roulette, and Naming manage province visuals themselves; ignore manual map selection.
  if (_activeToolId === "quiz" || _activeToolId === "roulette" || _activeToolId === "naming") {
    return;
  }

  const groupEl = _provinceGroupMap.get(d.id) || null;
  const isSame = _selectedGroup === groupEl;
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
  }
  if (!groupEl) return;
  d3.select(groupEl).classed("is-selected", !isSame);
  _selectedGroup = isSame ? null : groupEl;
  requestMapRender();
  if (isSame) {
    if (_activeToolId === "explore") {
      clearWeatherEmoji();
      _lastWeatherInfo = null;
      showIdlePanel();
    } else if (_activeToolId === "travel") {
      _closeTravelPicker();
    } else if (_activeToolId === "roulette") {
      if (!_rouletteSpinning) showRouletteTool();
    } else if (_activeToolId === "geoguesser") {
      _ggGuess(d.id);
    } else {
      showToolsHome();
    }
    return;
  }

  if (_activeToolId === "explore") {
    showProvinceInfo(d, true, false, "left", false);
  } else if (_activeToolId === "travel") {
    _renderTravelPicker(d, event);
  } else if (_activeToolId === "roulette") {
    if (!_rouletteSpinning) showProvinceInfo(d);
  } else if (_activeToolId === "geoguesser") {
    _ggGuess(d.id);
  } else {
    showProvinceInfo(d);
  }
}

// ── Sidebar ────────────────────────────────────────────────────
function showIdlePanel(direction = "left", animatePanel = false) {
  _activeToolId = "explore";
  clearWeatherEmoji();
  _lastWeatherInfo = null;
  setSidebarTitle("Explore");
  // Build region → sorted provinces map
  const regionMap = {};
  Object.entries(PROVINCE_REGION).forEach(([prov, region]) => {
    if (!regionMap[region]) regionMap[region] = [];
    regionMap[region].push(prov);
  });
  const sortedRegions = Object.keys(regionMap).sort();
  const allProvs = Object.keys(PROVINCE_REGION).sort();

  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="explore-back">‹ Back</button>
    <div class="idle-sticky">
      <div class="idle-search-wrap">
        <svg class="idle-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8.5" cy="8.5" r="5.5"/><line x1="13.5" y1="13.5" x2="18" y2="18"/>
        </svg>
        <input id="idle-search" class="idle-search" type="text"
          placeholder="Search province…" autocomplete="off" spellcheck="false" />
        <ul id="idle-suggestions" class="idle-suggestions" role="listbox" hidden></ul>
      </div>
      <div class="idle-filter-wrap">
        <button class="idle-dropdown-btn" id="idle-dropdown-btn" aria-haspopup="listbox" aria-expanded="false">
          <span class="idle-dropdown-prefix">Region</span>
            <span class="idle-dropdown-value" id="idle-dropdown-label">${_exploreListState.region ? escapeHtml(_exploreListState.region.replace(/^Region\s*/i, "").trim() || _exploreListState.region) : "All"}</span>
          <span class="idle-dropdown-chevron">›</span>
        </button>
        <ul class="idle-dropdown-list" id="idle-dropdown-list" role="listbox" hidden>
            <li><button class="idle-dropdown-option${_exploreListState.region ? "" : " is-active"}" data-region="">All Regions</button></li>
          ${sortedRegions.map((r) => `<li><button class="idle-dropdown-option" data-region="${escapeHtml(r)}">${escapeHtml(r)}</button></li>`).join("")}
        </ul>
      </div>
    </div>
    <div class="idle-prov-header">
      <span class="idle-prov-count" id="idle-prov-count">${allProvs.length} provinces</span>
    </div>
    <ul class="idle-prov-list" id="idle-prov-list"></ul>
  `,
    direction,
    animatePanel,
  );

  let activeRegion = _exploreListState.region || "";

  function renderProvList(filter = "", query = "") {
    const list = document.getElementById("idle-prov-list");
    const countEl = document.getElementById("idle-prov-count");
    const base = filter ? (regionMap[filter] || []).slice().sort() : allProvs;
    const q = query.trim().toLowerCase();
    const provs = q ? base.filter((p) => p.toLowerCase().includes(q)) : base;
    if (countEl)
      countEl.textContent = `${provs.length} province${provs.length !== 1 ? "s" : ""}`;
    list.innerHTML = provs
      .map(
        (p) =>
          `<li><button class="idle-prov-btn" data-province="${escapeHtml(p)}"><span class="idle-prov-name">${escapeHtml(p)}</span><span class="idle-prov-arrow">›</span></button></li>`,
      )
      .join("");
    list.querySelectorAll(".idle-prov-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectProvinceById(btn.dataset.province, true),
      );
    });
  }

  renderProvList(activeRegion, _exploreListState.query || "");

  document
    .getElementById("explore-back")
    .addEventListener("click", () => showToolsHome("right", true));

  // ── Region dropdown ──────────────────────────────────────
  const dropBtn = document.getElementById("idle-dropdown-btn");
  const dropList = document.getElementById("idle-dropdown-list");
  const dropLabel = document.getElementById("idle-dropdown-label");
  const searchInput = document.getElementById("idle-search");
  const suggBox = document.getElementById("idle-suggestions");

  searchInput.value = _exploreListState.query || "";

  dropList
    .querySelectorAll(".idle-dropdown-option")
    .forEach((o) =>
      o.classList.toggle("is-active", o.dataset.region === activeRegion),
    );

  function closeDropdown() {
    dropList.hidden = true;
    dropBtn.setAttribute("aria-expanded", "false");
    dropBtn.classList.remove("is-open");
  }

  dropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !dropList.hidden;
    if (open) {
      closeDropdown();
    } else {
      dropList.hidden = false;
      dropBtn.setAttribute("aria-expanded", "true");
      dropBtn.classList.add("is-open");
    }
  });

  dropList.querySelectorAll(".idle-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      activeRegion = opt.dataset.region;
      _exploreListState.region = activeRegion;
      dropLabel.textContent = activeRegion
        ? activeRegion.replace(/^Region\s*/i, "").trim() || activeRegion
        : "All";
      dropList
        .querySelectorAll(".idle-dropdown-option")
        .forEach((o) =>
          o.classList.toggle("is-active", o.dataset.region === activeRegion),
        );
      closeDropdown();
      _exploreListState.query = searchInput.value;
      renderProvList(activeRegion, searchInput.value);
      suggBox.hidden = true;
    });
  });

  document.addEventListener("click", closeDropdown, { once: false });

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    _exploreListState.query = searchInput.value;
    renderProvList(activeRegion, searchInput.value);
    if (!q) {
      suggBox.hidden = true;
      return;
    }
    const pool = activeRegion ? regionMap[activeRegion] || [] : allProvs;
    const matches = pool.filter((p) => p.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) {
      suggBox.hidden = true;
      return;
    }
    suggBox.innerHTML = matches
      .map(
        (p) =>
          `<li role="option"><button class="idle-sugg-btn" data-province="${escapeHtml(p)}">${escapeHtml(p)}</button></li>`,
      )
      .join("");
    suggBox.hidden = false;
    suggBox.querySelectorAll(".idle-sugg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        searchInput.value = "";
        _exploreListState.query = "";
        suggBox.hidden = true;
        renderProvList(activeRegion, "");
        selectProvinceById(btn.dataset.province, true);
      });
    });
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      _exploreListState.query = "";
      suggBox.hidden = true;
      renderProvList(activeRegion, "");
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".idle-search-wrap")) suggBox.hidden = true;
  });
}

function selectProvinceById(id, fromExplore = false) {
  const grp = _g
    .selectAll(".province-group")
    .filter((d) => d.id === id)
    .node();
  if (!grp) return;
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
  }
  _selectedGroup = grp;
  d3.select(grp).classed("is-selected", true).raise();
  requestMapRender();
  showProvinceInfo(d3.select(grp).datum(), fromExplore, true, "left", true);
}

async function _fetchProvinceWiki(provName) {
  const section = document.getElementById("explore-wiki-section");
  if (!section) return;

  const attempts = [
    `${provName}, Philippines`,
    provName,
    `${provName} (province)`,
  ];

  // Strip HTML tags (including <style>/<script> text) to plain text
  const stripHtml = (html) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp
      .querySelectorAll(
        "h1, h2, h3, h4, h5, h6, " +
          "style, script, sup, figure, figcaption, svg, canvas, img, " +
          "table, .reference, .mw-editsection, .noprint, .thumb, " +
          ".gallery, .wikitable, .infobox, .navbox, .mbox, .ambox, " +
          ".mw-empty-elt, .sistersitebox, .hatnote, .toc",
      )
      .forEach((el) => el.remove());
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  };

  // First N sentences of plain text
  const firstSentences = (text, n = 3) =>
    text
      .split(/(?<=[.!?])\s+/)
      .slice(0, n)
      .join(" ");

  // ── 1. Fetch summary (proven reliable for lead text) ─────────
  let sumData = null,
    canonicalTitle = null;
  for (const title of attempts) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(res.status);
      sumData = await res.json();
      // Use the normalised title returned by Wikipedia (handles redirects)
      canonicalTitle = sumData.titles?.normalized || sumData.title || title;
      break;
    } catch {
      /* try next */
    }
  }

  if (!sumData) {
    section.innerHTML = "";
    return;
  }

  const leadText = firstSentences(
    sumData.extract?.replace(/\n/g, " ") || "",
    3,
  );
  const description = sumData.description || "";
  const wikiUrl =
    sumData.content_urls?.desktop?.page ||
    `https://en.wikipedia.org/wiki/${encodeURIComponent(canonicalTitle)}`;

  // ── 2. Fetch section list via action API (reliable) ──────────
  let wikiSections = [];
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(canonicalTitle)}&prop=sections&format=json&origin=*`;
    const res = await fetch(apiUrl);
    const json = await res.json();
    const ALLOWED_SECTIONS =
      /etymology|history|geography|demograph|economy|economic|biodiversity|wildlife|flora|fauna|attraction|tourism|tourist|culture|cultural|arts|heritage|government|politics|infrastructure|transport|climate|environment|natural/i;
    wikiSections = (json.parse?.sections || []).filter(
      (s) =>
        s.toclevel === 1 &&
        s.line &&
        ALLOWED_SECTIONS.test(stripHtml(s.line).trim()),
    );
  } catch {
    /* no chips, render without them */
  }

  // ── 3. Render ─────────────────────────────────────────────────
  function renderSection(text, activeIdx, loading = false) {
    // Preserve chips scroll position across re-renders
    const prevChips = section.querySelector(".exp-wiki-chips");
    const chipsScroll = prevChips ? prevChips.scrollLeft : 0;

    const chips = [
      `<button class="exp-wiki-chip${activeIdx === -1 ? " is-active" : ""}" data-sec="-1">Overview</button>`,
      ...wikiSections.map(
        (s, i) =>
          `<button class="exp-wiki-chip${activeIdx === i ? " is-active" : ""}" data-sec="${i}">${escapeHtml(stripHtml(s.line))}</button>`,
      ),
    ].join("");

    section.innerHTML = `
      ${wikiSections.length ? `<div class="exp-wiki-chips">${chips}</div>` : ""}
      ${description && activeIdx === -1 ? `<div class="exp-wiki-desc">${escapeHtml(description)}</div>` : ""}
      <p class="exp-wiki-extract">${loading ? "" : escapeHtml(text)}</p>
      ${
        loading
          ? `
        <div class="exp-wiki-skeleton"></div>
        <div class="exp-wiki-skeleton" style="width:90%"></div>
        <div class="exp-wiki-skeleton" style="width:75%"></div>
        <div class="exp-wiki-skeleton" style="width:85%"></div>
      `
          : ""
      }
      <a class="exp-wiki-link" href="${escapeHtml(wikiUrl)}"
         target="_blank" rel="noopener noreferrer">Read more on Wikipedia ↗</a>
      <button class="exp-map-link" id="exp-map-btn">View on Maps ↗</button>
    `;

    const mapBtn = section.querySelector("#exp-map-btn");
    if (mapBtn)
      mapBtn.addEventListener("click", () => _showProvMapModal(provName));

    const newChips = section.querySelector(".exp-wiki-chips");
    if (newChips && chipsScroll) newChips.scrollLeft = chipsScroll;

    section.querySelectorAll(".exp-wiki-chip").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = parseInt(btn.dataset.sec, 10);
        if (i === -1) {
          renderSection(leadText, -1);
        } else {
          renderSection("", i, true);
          try {
            const s = wikiSections[i];
            const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(canonicalTitle)}&prop=text&section=${s.index}&format=json&origin=*`;
            const res = await fetch(apiUrl);
            const json = await res.json();
            const sectionText = firstSentences(
              stripHtml(json.parse?.text?.["*"] || ""),
              4,
            );
            renderSection(sectionText || "No content available.", i);
          } catch {
            renderSection("Could not load section.", i);
          }
        }
      });
    });
  }

  renderSection(leadText, -1);
}

function _showProvMapModal(provName) {
  const existing = document.getElementById("prov-map-overlay");
  if (existing) existing.remove();

  const loc =
    typeof _ggProvCentroid === "function" ? _ggProvCentroid(provName) : null;
  const center = loc ? [loc.lat, loc.lng] : [12.8797, 121.774];
  const zoom = 9;

  const overlay = document.createElement("div");
  overlay.id = "prov-map-overlay";
  overlay.className = "gg-modal-overlay";
  overlay.innerHTML = `
    <div class="gg-modal-inner">
      <button class="gg-modal-close" id="prov-map-close" aria-label="Close">✕</button>
      <div class="prov-map-tile-toggle gg-map-switcher" id="prov-map-toggle">
        <button class="prov-map-tile-btn gg-map-sw-btn is-active" data-mode="map">Map</button>
        <button class="prov-map-tile-btn gg-map-sw-btn" data-mode="sat">Satellite</button>
      </div>
      <div id="prov-map-leaflet"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  let provMap = null;
  let isSat = false;

  const OV_LABELS_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";
  const OV_ATT = "&copy; OpenStreetMap &copy; CARTO";

  setTimeout(() => {
    const mapEl = document.getElementById("prov-map-leaflet");
    if (!mapEl || !window.L) return;

    const tileUrl =
      typeof _ggTileUrl === "function"
        ? _ggTileUrl()
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
    const tileAtt = "&copy; OpenStreetMap &copy; CARTO";
    const satUrl =
      typeof _GG_TILE_SAT !== "undefined"
        ? _GG_TILE_SAT
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const satAtt =
      typeof _GG_TILE_SAT_ATT !== "undefined"
        ? _GG_TILE_SAT_ATT
        : "Tiles &copy; Esri";

    provMap = L.map(mapEl, {
      center,
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      maxBounds:
        typeof _GG_PH_BOUNDS !== "undefined" ? _GG_PH_BOUNDS : undefined,
      maxBoundsViscosity: 1.0,
    });
    const baseLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: tileAtt,
    });
    baseLayer.options._isBase = true;
    baseLayer.addTo(provMap);

    const labelsLayer = L.tileLayer(OV_LABELS_URL, {
      maxZoom: 19,
      attribution: OV_ATT,
      pane: "overlayPane",
    });
    labelsLayer.addTo(provMap);

    const swapBase = () => {
      provMap.eachLayer((l) => {
        if (l.options && l.options._isBase) provMap.removeLayer(l);
      });
      const bl = L.tileLayer(isSat ? satUrl : tileUrl, {
        maxZoom: 19,
        attribution: isSat ? satAtt : tileAtt,
      });
      bl.options._isBase = true;
      bl.addTo(provMap);
      labelsLayer.addTo(provMap); // keep labels on top
    };

    const tileToggle = document.getElementById("prov-map-toggle");
    _syncSwitcherPill(tileToggle);

    overlay.querySelectorAll(".prov-map-tile-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        isSat = btn.dataset.mode === "sat";
        overlay
          .querySelectorAll(".prov-map-tile-btn")
          .forEach((b) => b.classList.toggle("is-active", b === btn));
        _syncSwitcherPill(tileToggle);
        swapBase();
      });
    });
  }, 50);

  const close = () => {
    overlay.classList.add("is-closing");
    overlay.addEventListener(
      "animationend",
      () => {
        if (provMap) {
          try {
            provMap.remove();
          } catch {}
        }
        overlay.remove();
      },
      { once: true },
    );
  };

  document.getElementById("prov-map-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });
}

function showProvinceInfo(
  prov,
  fromExplore = false,
  preserveExploreListState = true,
  panelDirection = "left",
  animatePanel = false,
) {
  if (_exploreTab === "info") {
    clearWeatherEmoji();
    _lastWeatherInfo = null;
  }
  _activeToolId = fromExplore ? "explore" : null;
  setSidebarTitle(prov.id);
  _clearQuizHighlight();

  const region = PROVINCE_REGION[prov.id] || "";
  const provFlagSrc = _provFlagUrl(prov.id);
  const regFlagSrc = region ? _regionFlagUrl(region) : null;
  const initialSrc = provFlagSrc ?? regFlagSrc;

  const tabBar = `
    <div class="gg-map-switcher province-tab-bar">
      <button class="gg-map-sw-btn${_exploreTab === "info" ? " is-active" : ""}" data-tab="info">Info</button>
      <button class="gg-map-sw-btn${_exploreTab === "weather" ? " is-active" : ""}" data-tab="weather">Weather</button>
    </div>`;

  const infoSection = `
    <div class="info-header">
      <div class="info-flag-card${initialSrc ? " flag-loading" : ""}" id="info-flag-card"${!initialSrc ? ' style="display:none"' : ""}>
        <img class="info-flag-img" id="info-flag-img"
          src="${escapeHtml(initialSrc ?? "")}"
          alt="Flag of ${escapeHtml(prov.id)}" />
      </div>
      <div class="info-name">${escapeHtml(prov.id)}</div>
    </div>
    <hr class="info-divider" />
    ${region ? `<div class="info-row"><div class="info-label">REGION</div><div class="info-value">${escapeHtml(region)}</div></div>` : ""}
    <div id="explore-wiki-section" class="explore-wiki-section">
      <div class="exp-wiki-skeleton"></div>
      <div class="exp-wiki-skeleton" style="width:85%"></div>
      <div class="exp-wiki-skeleton" style="width:65%"></div>
    </div>`;

  const weatherSection = `<div id="explore-weather-section" class="explore-weather-section"></div>`;

  const tabContentHost = `<div id="province-tab-content"></div>`;

  _setInfoPanelHtml(
    `
    <button class="tool-back-btn" id="province-info-back" aria-label="Back">‹ Back</button>
    ${tabBar}
    ${tabContentHost}
  `,
    panelDirection,
    animatePanel,
  );

  const tabBarEl = document.querySelector(".province-tab-bar");
  _syncSwitcherPill(tabBarEl);

  function renderProvinceTabContent() {
    const host = document.getElementById("province-tab-content");
    if (!host) return;

    if (_exploreTab === "info") {
      clearWeatherEmoji();
      _lastWeatherInfo = null;
      host.innerHTML = infoSection;

      _fetchProvinceWiki(prov.id);
      if (!initialSrc) return;

      const flagImg = document.getElementById("info-flag-img");
      const flagCard = document.getElementById("info-flag-card");
      if (!flagImg || !flagCard) return;

      const revealFlag = () => flagCard.classList.remove("flag-loading");
      if (flagImg.complete && flagImg.naturalWidth > 0) {
        revealFlag();
      } else {
        flagImg.addEventListener("load", revealFlag, { once: true });
      }
      flagImg.addEventListener(
        "error",
        () => {
          if (provFlagSrc && regFlagSrc) {
            flagImg.onerror = () => {
              flagCard.style.display = "none";
            };
            flagImg.src = regFlagSrc;
          } else {
            flagCard.style.display = "none";
          }
        },
        { once: true },
      );
      return;
    }

    _lastWeatherInfo = null;
    _currentWeatherProv = null;
    host.innerHTML = weatherSection;
    _renderExploreWeatherSection();
    fetchAndShowWeather(prov);
  }

  document
    .querySelectorAll(".province-tab-bar .gg-map-sw-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const newTab = btn.dataset.tab;
        if (newTab === _exploreTab) return;

        document
          .querySelectorAll(".province-tab-bar .gg-map-sw-btn")
          .forEach((b) => {
            b.classList.toggle("is-active", b === btn);
          });
        _syncSwitcherPill(tabBarEl);

        _exploreTab = newTab;
        renderProvinceTabContent();
      });
    });

  document
    .getElementById("province-info-back")
    .addEventListener("click", () => {
      if (_selectedGroup) {
        d3.select(_selectedGroup).classed("is-selected", false);
        _selectedGroup = null;
        _refreshMapVisuals();
      }
      clearWeatherEmoji();
      _lastWeatherInfo = null;
      _exploreTab = "info";
      if (fromExplore) {
        if (!preserveExploreListState) {
          _exploreListState = { region: "", query: "" };
        }
        showIdlePanel("right", true);
      } else showToolsHome("right", true);
    });

  renderProvinceTabContent();
}
