/* ============================================================
   GEO PINAS — app.js
   Core: map rendering, interaction, navigation, and helpers.
   Tool logic lives in js/tools/. Boot logic in js/boot.js.
   Load order: data.js → app.js → tools/*.js → boot.js
   ============================================================ */

"use strict";

const CONVEX_SITE_URL = "https://industrious-heron-706.convex.site";

(async function trackVisitor() {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/track`, { method: "POST" });
    if (!res.ok) return;
    const { count } = await res.json();
    const el = document.getElementById("visitor-count");
    if (el) el.textContent = count.toLocaleString();
  } catch {}
})();


// ── State ──────────────────────────────────────────────────────
let _selectedGroup = null;
let _wasDragging = false;
let _zoom = null;
let _svg = null;
let _g = null;
let _activeToolId = null;

// ── Helpers ────────────────────────────────────────────────────
function fitTransform(w, h) {
  const scale = Math.min(w / MAP_W, h / MAP_H) * 0.92;
  return d3.zoomIdentity
    .translate((w - MAP_W * scale) / 2, (h - MAP_H * scale) / 2)
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

// ── Flag URL helpers ──────────────────────────────────────
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
    id: "geoguesser",
    icon: "📍",
    color: "#fce7f3",
    title: "Local Guesser",
    desc: "Guess the province from a map view.",
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
    id: "weather",
    icon: "🌤️",
    color: "#e0f2fe",
    title: "Weather",
    desc: "Show live weather on selected provinces.",
  },
  {
    id: "quiz",
    icon: "🧠",
    color: "#ede9fe",
    title: "Province Quiz",
    desc: "Test how well you know Philippine geography.",
  },
];

function showToolsHome() {
  _activeToolId = null;
  clearWeatherEmoji();
  _clearQuizHighlight();
  _clearTravelColors();
  _rouletteClearHighlight();
  _ggClearHighlights();
  setSidebarTitle("Tools");
  document.getElementById("info-panel").innerHTML = `
    <div class="tools-list">
      ${TOOLS.map((t) => `
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
  `;
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.tool === "explore") showIdlePanel();
      else if (card.dataset.tool === "weather") showWeatherTool();
      else if (card.dataset.tool === "quiz") showQuizTool();
      else if (card.dataset.tool === "travel") showTravelTool();
      else if (card.dataset.tool === "roulette") showRouletteTool();
      else if (card.dataset.tool === "geoguesser") showGeoGuesserTool();
    });
  });
}

// ── Map init ───────────────────────────────────────────────────
function initMap() {
  const container = document.getElementById("map-wrap");
  const { width, height } = container.getBoundingClientRect();

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
  pat
    .append("rect")
    .attr("width", 32)
    .attr("height", 16)
    .attr("fill", "none");

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

  // Solid base rect
  _svg
    .append("rect")
    .attr("id", "ocean-bg")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#1b3a6b");

  // Pattern overlay rect
  _svg
    .append("rect")
    .attr("id", "ocean-pattern")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "url(#ocean-wave)");

  _g = _svg.append("g").attr("id", "provinces-layer");

  // Render province groups
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
  });

  // Events attached to province groups
  _g.selectAll(".province-group")
    .on("mousemove", onMouseMove)
    .on("mouseleave", onMouseLeave)
    .on("click", onProvinceClick)
    .on("keydown", function (event, d) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onProvinceClick.call(this, event, d);
      }
    });

  // ── D3 Zoom & Pan ─────────────────────────────────────────
  const initT = fitTransform(width, height);

  // Pad in data-space so at the fit zoom the map can slide ~85% of
  // a viewport dimension off-screen in any direction before clamping.
  function calcPad(w, h, k) {
    return { x: (w * 0.85) / k, y: (h * 0.85) / k };
  }
  let pad = calcPad(width, height, initT.k);

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
    .scaleExtent([initT.k * 0.75, initT.k * 15])
    .on("start", () => {
      _wasDragging = false;
      container.classList.add("is-dragging");
    })
    .on("zoom", (event) => {
      if (
        event.sourceEvent &&
        (event.sourceEvent.type === "mousemove" ||
          event.sourceEvent.type === "pointermove" ||
          event.sourceEvent.type === "touchmove")
      ) {
        _wasDragging = true;
      }
      _g.attr("transform", event.transform);
      updateWeatherEmojiPosition();
    })
    .on("end", () => {
      container.classList.remove("is-dragging");
    });

  _svg.call(_zoom).on("dblclick.zoom", null);
  applyTranslateExtent(width, height, initT.k);
  _svg.call(_zoom.transform, initT);
  _svg.on("dblclick", resetZoom);

  // Clicking the ocean (not a province) deselects any selected province
  _svg.on("click.deselect", () => {
    if (_wasDragging) return;
    // Always close the travel picker on any ocean click
    if (_activeToolId === "travel") {
      _closeTravelPicker();
    }
    if (_selectedGroup) {
      d3.select(_selectedGroup).classed("is-selected", false);
      _selectedGroup = null;
      if (_activeToolId === "weather") {
        clearWeatherEmoji();
        _renderWeatherTool();
      } else if (_activeToolId === "explore") {
        // stay on explore panel, nothing to update
      } else if (_activeToolId === "travel") {
        // already handled above
      } else if (_activeToolId === "roulette") {
        // keep roulette panel
      } else if (_activeToolId === "geoguesser") {
        // keep geoguesser panel
      } else {
        showToolsHome();
      }
    }
  });

  function zoomBy(factor) {
    _svg.transition().duration(280).call(_zoom.scaleBy, factor);
  }

  function resetZoom() {
    const { width: w, height: h } = container.getBoundingClientRect();
    const t = fitTransform(w, h);
    _zoom.scaleExtent([t.k * 0.75, t.k * 15]);
    applyTranslateExtent(w, h, t.k);
    _svg.transition().duration(380).call(_zoom.transform, t);
  }

  document
    .getElementById("zoom-in")
    .addEventListener("click", () => zoomBy(1.6));
  document
    .getElementById("zoom-out")
    .addEventListener("click", () => zoomBy(1 / 1.6));
  document.getElementById("zoom-reset").addEventListener("click", resetZoom);

  document.getElementById("status").textContent = "Ready";
  document.getElementById("status").className = "status status--ready";

  window.addEventListener("resize", () => {
    const { width: w, height: h } = container.getBoundingClientRect();
    _svg.attr("width", w).attr("height", h);
    _svg.select("#ocean-bg").attr("width", w).attr("height", h);
    _svg.select("#ocean-pattern").attr("width", w).attr("height", h);
    const t = fitTransform(w, h);
    _zoom.scaleExtent([t.k * 0.75, t.k * 15]);
    applyTranslateExtent(w, h, t.k);
    _svg.call(_zoom.transform, t);
  });
}

// ── Interaction ────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function onMouseMove(event, d) {
  tooltip.textContent = d.id;
  tooltip.classList.add("is-visible");
  const wrap = document.getElementById("map-wrap");
  const rect = wrap.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left}px`;
  tooltip.style.top = `${event.clientY - rect.top}px`;
}

function onMouseLeave() {
  tooltip.classList.remove("is-visible");
}

function onProvinceClick(event, d) {
  if (_wasDragging) {
    _wasDragging = false;
    return;
  }
  event.stopPropagation();

  const isSame = _selectedGroup === this;
  if (_selectedGroup) {
    d3.select(_selectedGroup).classed("is-selected", false);
    _selectedGroup = null;
  }
  if (isSame) {
    if (_activeToolId === "weather") {
      // Stay on weather tool, just clear the province card
      clearWeatherEmoji();
      _renderWeatherTool();
    } else if (_activeToolId === "explore") {
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

  _selectedGroup = this;
  d3.select(this).classed("is-selected", true).raise();

  if (_activeToolId === "weather") {
    fetchAndShowWeather(d);
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
function showIdlePanel() {
  _activeToolId = "explore";
  clearWeatherEmoji();
  setSidebarTitle("Explore");
  // Build region → sorted provinces map
  const regionMap = {};
  Object.entries(PROVINCE_REGION).forEach(([prov, region]) => {
    if (!regionMap[region]) regionMap[region] = [];
    regionMap[region].push(prov);
  });
  const sortedRegions = Object.keys(regionMap).sort();
  const allProvs = Object.keys(PROVINCE_REGION).sort();

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="explore-back">‹ Back</button>
    <div class="idle-sticky">
      <div class="idle-search-wrap">
        <input id="idle-search" class="idle-search" type="text"
          placeholder="Search province…" autocomplete="off" spellcheck="false" />
        <ul id="idle-suggestions" class="idle-suggestions" role="listbox" hidden></ul>
      </div>
      <div class="idle-filter-wrap">
        <div class="idle-filter-label">Region</div>
        <button class="idle-dropdown-btn" id="idle-dropdown-btn" aria-haspopup="listbox" aria-expanded="false">
          <span id="idle-dropdown-label">All Regions</span>
          <span class="idle-dropdown-chevron">›</span>
        </button>
        <ul class="idle-dropdown-list" id="idle-dropdown-list" role="listbox" hidden>
          <li><button class="idle-dropdown-option is-active" data-region="">All Regions</button></li>
          ${sortedRegions.map((r) => `<li><button class="idle-dropdown-option" data-region="${escapeHtml(r)}">${escapeHtml(r)}</button></li>`).join("")}
        </ul>
      </div>
    </div>
    <ul class="idle-prov-list" id="idle-prov-list"></ul>
  `;

  let activeRegion = "";

  function renderProvList(filter = "") {
    const list = document.getElementById("idle-prov-list");
    const provs = filter ? (regionMap[filter] || []).slice().sort() : allProvs;
    list.innerHTML = provs
      .map(
        (p) =>
          `<li><button class="idle-prov-btn" data-province="${escapeHtml(p)}">${escapeHtml(p)}</button></li>`,
      )
      .join("");
    list.querySelectorAll(".idle-prov-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectProvinceById(btn.dataset.province),
      );
    });
  }

  renderProvList();

  document.getElementById("explore-back").addEventListener("click", showToolsHome);

  // ── Region dropdown ──────────────────────────────────────
  const dropBtn = document.getElementById("idle-dropdown-btn");
  const dropList = document.getElementById("idle-dropdown-list");
  const dropLabel = document.getElementById("idle-dropdown-label");

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
      dropLabel.textContent = activeRegion || "All Regions";
      dropList
        .querySelectorAll(".idle-dropdown-option")
        .forEach((o) =>
          o.classList.toggle("is-active", o.dataset.region === activeRegion),
        );
      closeDropdown();
      renderProvList(activeRegion);
      // clear search
      document.getElementById("idle-search").value = "";
      document.getElementById("idle-suggestions").hidden = true;
    });
  });

  document.addEventListener("click", closeDropdown, { once: false });
  // prevent the listener stacking — use a named teardown on panel replacement
  // (re-running showIdlePanel replaces innerHTML, so old listeners die with the nodes)

  // ── Search / autocomplete ────────────────────────────────
  const searchInput = document.getElementById("idle-search");
  const suggBox = document.getElementById("idle-suggestions");

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      suggBox.hidden = true;
      return;
    }
    const matches = allProvs
      .filter((p) => p.toLowerCase().includes(q))
      .slice(0, 8);
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
        suggBox.hidden = true;
        selectProvinceById(btn.dataset.province);
      });
    });
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      suggBox.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".idle-search-wrap")) suggBox.hidden = true;
  });
}

function selectProvinceById(id) {
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
  showProvinceInfo(d3.select(grp).datum());
}

async function _fetchProvinceWiki(provName) {
  const section = document.getElementById("explore-wiki-section");
  if (!section) return;

  const tryFetch = async (title) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  };

  let data = null;
  const attempts = [`${provName}, Philippines`, provName, `${provName} (province)`];
  for (const title of attempts) {
    try { data = await tryFetch(title); break; } catch { /* try next */ }
  }

  if (!data) {
    section.innerHTML = "";
    return;
  }

  // Trim extract to ~3 sentences
  const sentences = (data.extract || "").replace(/\n/g, " ").split(/(?<=[.!?])\s+/);
  const extract = sentences.slice(0, 3).join(" ");

  section.innerHTML = `
    ${data.description ? `<div class="exp-wiki-desc">${escapeHtml(data.description)}</div>` : ""}
    ${extract ? `<p class="exp-wiki-extract">${escapeHtml(extract)}</p>` : ""}
    <a class="exp-wiki-link" href="${escapeHtml(data.content_urls?.desktop?.page ?? "")}"
       target="_blank" rel="noopener noreferrer">Read more on Wikipedia ↗</a>
  `;
}

function showProvinceInfo(prov) {
  _activeToolId = null;
  setSidebarTitle(prov.id);
  _clearQuizHighlight();
  clearWeatherEmoji();

  const region = PROVINCE_REGION[prov.id] || "";
  const provFlagSrc = _provFlagUrl(prov.id);
  const regFlagSrc = region ? _regionFlagUrl(region) : null;
  // Use province flag first; if null skip straight to region fallback
  const initialSrc = provFlagSrc ?? regFlagSrc;

  document.getElementById("info-panel").innerHTML = `
    <button class="info-back" aria-label="Back to tools">‹ Back</button>
    <div class="info-header">
      <div class="info-flag-card${initialSrc ? " flag-loading" : ""}" id="info-flag-card"${!initialSrc ? ' style="display:none"' : ""}>
        <img class="info-flag-img" id="info-flag-img"
          src="${escapeHtml(initialSrc ?? "")}"
          alt="Flag of ${escapeHtml(prov.id)}" />
      </div>
      <div class="info-name">${escapeHtml(prov.id)}</div>
    </div>
    <hr class="info-divider" />
    ${
      region
        ? `<div class="info-row">
      <div class="info-label">REGION</div>
      <div class="info-value">${escapeHtml(region)}</div>
    </div>`
        : ""
    }
    <div id="explore-wiki-section" class="explore-wiki-section">
      <div class="exp-wiki-skeleton"></div>
      <div class="exp-wiki-skeleton" style="width:85%"></div>
      <div class="exp-wiki-skeleton" style="width:65%"></div>
    </div>
  `;

  _fetchProvinceWiki(prov.id);

  document.querySelector(".info-back").addEventListener("click", () => {
    if (_selectedGroup) {
      d3.select(_selectedGroup).classed("is-selected", false);
      _selectedGroup = null;
    }
    showToolsHome();
  });

  if (!initialSrc) return;

  // Flag fallback: if province flag loaded (provFlagSrc was used), on error try region flag; else hide
  const flagImg = document.getElementById("info-flag-img");
  const flagCard = document.getElementById("info-flag-card");

  // Reveal flag card (triggering slide animation) once image loads
  const revealFlag = () => flagCard.classList.remove("flag-loading");
  if (flagImg.complete && flagImg.naturalWidth > 0) {
    revealFlag();
  } else {
    flagImg.addEventListener("load", revealFlag, { once: true });
  }

  flagImg.addEventListener("error", () => {
    if (provFlagSrc && regFlagSrc) {
      flagImg.removeEventListener("error", arguments.callee);
      flagImg.onerror = () => {
        flagCard.style.display = "none";
      };
      flagImg.src = regFlagSrc;
    } else {
      flagCard.style.display = "none";
    }
  });
}
