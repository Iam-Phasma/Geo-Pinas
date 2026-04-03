/* ============================================================
   GEO PINAS — app.js
   Map rendering, interaction, and UI logic.
   Static data (MAP_W, MAP_H, PROVINCES, PROVINCE_REGION) is
   loaded from data.js, which must be included first.
   ============================================================ */

"use strict";

const CONVEX_SITE_URL = "https://brazen-bird-53.convex.site";

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
let _currentWeatherProv = null;
let _activeToolId = null;
let _lastWeatherInfo = null;
let _weatherEmojiEnabled = true;
let _travelMap = {};

// ── Weather helpers ────────────────────────────────────────────
const WMO_EMOJI = {
  0: "☀️",
  1: "🌤️", 2: "⛅", 3: "🌥️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  56: "🌨️", 57: "🌨️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌨️", 67: "🌨️",
  71: "🌨️", 73: "🌨️", 75: "🌨️",
  77: "🌨️",
  80: "🌦️", 81: "🌦️", 82: "⛈️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WMO_DESC = {
  0: "Clear sky",
  1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Freezing drizzle", 57: "Heavy freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};

// Convert SVG data-space coordinates to approximate lat/lng
// Calibrated from: Metro Manila (367.5,465)→14.6°N 121°E,
//   Batanes (435,37.5)→20.5°N 121.9°E, Tawi-Tawi (292.5,1170)→5.1°N 119.7°E
function _svgToLatLng(svgX, svgY) {
  const lat = 20.5 - (svgY - 37.5) * 0.01358;
  const lon = 118.7 + (svgX - 195) * 0.01350;
  return { lat, lon };
}

function _parseTranslate(transform) {
  const m = transform.match(/translate\(\s*([^,]+),\s*([^)]+)\)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function _getProvScreenPos(prov) {
  const pt = _parseTranslate(prov.transform);
  if (!pt || !_svg) return null;
  const t = d3.zoomTransform(_svg.node());
  const [px, py] = t.apply([pt.x, pt.y]);
  return { x: px, y: py };
}

function _positionWeatherOverlay(prov) {
  const overlay = document.getElementById("weather-overlay");
  const pos = _getProvScreenPos(prov);
  if (!pos || !overlay) return;
  // Offset upward so emoji floats above the land
  overlay.style.left = pos.x + "px";
  overlay.style.top = (pos.y - 28) + "px";
}

function updateWeatherEmojiPosition() {
  if (!_currentWeatherProv || _activeToolId !== "weather" || !_weatherEmojiEnabled) return;
  const overlay = document.getElementById("weather-overlay");
  if (overlay && overlay.classList.contains("is-visible")) {
    _positionWeatherOverlay(_currentWeatherProv);
  }
}

function _setTwemoji(overlay, emoji) {
  overlay.innerHTML = emoji;
  if (typeof twemoji !== "undefined") {
    twemoji.parse(overlay, { folder: "svg", ext: ".svg" });
  }
}

async function fetchAndShowWeather(prov) {
  const pt = _parseTranslate(prov.transform);
  if (!pt) return;
  const { lat, lon } = _svgToLatLng(pt.x, pt.y);
  _currentWeatherProv = prov;

  const overlay = document.getElementById("weather-overlay");
  if (!overlay) return;
  if (_weatherEmojiEnabled) {
    _setTwemoji(overlay, "⏳");
    _positionWeatherOverlay(prov);
    overlay.classList.add("is-visible");
  }

  if (_activeToolId === "weather") {
    const hint = document.getElementById("weather-tool-hint");
    if (hint) hint.textContent = `Loading weather for ${prov.id}…`;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=weather_code,temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed");
    const data = await res.json();
    const cur = data.current ?? {};
    const code = cur.weather_code ?? 0;
    const emoji = WMO_EMOJI[code] ?? "🌡️";
    _setTwemoji(overlay, emoji);
    if (_weatherEmojiEnabled) _positionWeatherOverlay(prov);

    _lastWeatherInfo = {
      prov: prov.id,
      region: PROVINCE_REGION[prov.id] ?? "",
      emoji,
      temp: cur.temperature_2m != null ? Math.round(cur.temperature_2m) : "—",
      feelsLike: cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : "—",
      humidity: cur.relative_humidity_2m != null ? cur.relative_humidity_2m : "—",
      wind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : "—",
      condition: WMO_DESC[code] ?? "Unknown",
    };

    if (_activeToolId === "weather") {
      _renderWeatherTool();
    }
  } catch {
    _setTwemoji(overlay, "🌡️");
    if (_activeToolId === "weather") {
      const hint = document.getElementById("weather-tool-hint");
      if (hint) hint.textContent = "Could not load weather data.";
    }
  }
}

function clearWeatherEmoji() {
  _currentWeatherProv = null;
  _lastWeatherInfo = null;
  const overlay = document.getElementById("weather-overlay");
  if (overlay) overlay.classList.remove("is-visible");
}

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
  {
    id: "facts",
    icon: "✨",
    color: "#fef3c7",
    title: "Fun Facts",
    desc: "Discover trivias about the Philippines.",
  },
  {
    id: "travel",
    icon: "✈️",
    color: "#f0fdf4",
    title: "Travel Level",
    desc: "Track how well you've explored.",
  },
];

function showToolsHome() {
  _activeToolId = null;
  clearWeatherEmoji();
  _clearQuizHighlight();
  _clearTravelColors();
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
      else if (card.dataset.tool === "facts") showFactsTool();
      else if (card.dataset.tool === "travel") showTravelTool();
    });
  });
}

// ── Weather tool ───────────────────────────────────────────────
function showWeatherTool() {
  _activeToolId = "weather";
  _lastWeatherInfo = null;
  setSidebarTitle("Weather");
  _clearQuizHighlight();
  _renderWeatherTool();
  // If a province is already selected, fetch its weather right away
  if (_selectedGroup) {
    fetchAndShowWeather(d3.select(_selectedGroup).datum());
  }
}

function _renderWeatherTool() {
  const hintText = "Select a province to see its weather.";
  const emojiChecked = _weatherEmojiEnabled ? "true" : "false";

  const provCard = _lastWeatherInfo ? `
    <div class="weather-prov-card">
      <div class="weather-prov-header">
        <span class="weather-prov-name">${escapeHtml(_lastWeatherInfo.prov)}</span>
        <span class="weather-prov-region">${escapeHtml(_lastWeatherInfo.region)}</span>
      </div>
      <div class="weather-prov-main">
        <span class="weather-prov-emoji-wrap" id="weather-prov-emoji-el">${_lastWeatherInfo.emoji}</span>
        <div class="weather-prov-temp-block">
          <span class="weather-prov-temp">${_lastWeatherInfo.temp}°C</span>
          <span class="weather-prov-cond">${escapeHtml(_lastWeatherInfo.condition)}</span>
        </div>
      </div>
      <div class="weather-prov-grid">
        <div class="weather-prov-stat">
          <span class="weather-prov-stat-label">Feels like</span>
          <span class="weather-prov-stat-val">${_lastWeatherInfo.feelsLike}°C</span>
        </div>
        <div class="weather-prov-stat">
          <span class="weather-prov-stat-label">Humidity</span>
          <span class="weather-prov-stat-val">${_lastWeatherInfo.humidity}%</span>
        </div>
        <div class="weather-prov-stat">
          <span class="weather-prov-stat-label">Wind</span>
          <span class="weather-prov-stat-val">${_lastWeatherInfo.wind} km/h</span>
        </div>
      </div>
    </div>
  ` : "";

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="weather-back">‹ Back</button>
    <div class="weather-tool-body">
      <div class="weather-tool-icon">🌤️</div>
      <div class="weather-tool-row">
        <span class="weather-tool-label">Show emoji on map</span>
        <button class="sp-toggle" id="weather-emoji-toggle" role="switch"
          aria-checked="${emojiChecked}" title="Toggle map emoji">
          <span class="sp-toggle-track"><span class="sp-toggle-thumb"></span></span>
        </button>
      </div>
      <p class="weather-tool-hint" id="weather-tool-hint">${hintText}</p>
      ${provCard}
    </div>
  `;

  if (_lastWeatherInfo) {
    const emojiEl = document.getElementById("weather-prov-emoji-el");
    if (emojiEl && typeof twemoji !== "undefined") {
      twemoji.parse(emojiEl, { folder: "svg", ext: ".svg" });
    }
  }

  document.getElementById("weather-back").addEventListener("click", () => {
    _activeToolId = null;
    _lastWeatherInfo = null;
    showToolsHome();
  });

  document.getElementById("weather-emoji-toggle").addEventListener("click", function () {
    _weatherEmojiEnabled = !_weatherEmojiEnabled;
    this.setAttribute("aria-checked", String(_weatherEmojiEnabled));
    if (_weatherEmojiEnabled && _lastWeatherInfo && _currentWeatherProv) {
      const overlay = document.getElementById("weather-overlay");
      if (overlay) overlay.classList.add("is-visible");
      _positionWeatherOverlay(_currentWeatherProv);
    } else {
      const overlay = document.getElementById("weather-overlay");
      if (overlay) overlay.classList.remove("is-visible");
    }
  });
}

// ── Province Quiz ──────────────────────────────────────────────
let _quizScore = { correct: 0, total: 0 };
let _quizHighlight = null;

function _clearQuizHighlight() {
  if (_quizHighlight) {
    d3.select(_quizHighlight).classed("is-quiz", false);
    _quizHighlight = null;
  }
}

function showQuizTool() {
  _quizScore = { correct: 0, total: 0 };
  _renderQuizQuestion();
}

function _renderQuizQuestion() {
  setSidebarTitle("Province Quiz");
  const allProvinces = Object.keys(PROVINCE_REGION);
  const prov = allProvinces[Math.floor(Math.random() * allProvinces.length)];
  const correctRegion = PROVINCE_REGION[prov];
  const allRegions = [...new Set(Object.values(PROVINCE_REGION))];
  const wrongs = allRegions
    .filter((r) => r !== correctRegion)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const choices = [...wrongs, correctRegion].sort(() => Math.random() - 0.5);

  // Highlight province on map
  _clearQuizHighlight();
  const grp = _g.selectAll(".province-group").filter((d) => d.id === prov).node();
  if (grp) {
    d3.select(grp).classed("is-quiz", true).raise();
    _quizHighlight = grp;
  }

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="quiz-back">‹ Back</button>
    <div class="quiz-score-bar">
      <span class="quiz-score-label">Score</span>
      <span class="quiz-score-val">${_quizScore.correct} / ${_quizScore.total}</span>
    </div>
    <div class="quiz-question">
      <div class="quiz-q-sub">Which region is</div>
      <div class="quiz-q-prov">${escapeHtml(prov)}</div>
      <div class="quiz-q-sub">located in?</div>
    </div>
    <div class="quiz-choices">
      ${choices.map((c) => `
        <button class="quiz-choice" data-correct="${c === correctRegion}">
          ${escapeHtml(c)}
        </button>
      `).join("")}
    </div>
  `;

  document.getElementById("quiz-back").addEventListener("click", () => {
    _clearQuizHighlight();
    showToolsHome();
  });

  document.querySelectorAll(".quiz-choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const correct = btn.dataset.correct === "true";
      _quizScore.total++;
      if (correct) _quizScore.correct++;
      document.querySelectorAll(".quiz-choice").forEach((b) => {
        b.disabled = true;
        if (b.dataset.correct === "true") b.classList.add("is-correct");
        else if (b === btn) b.classList.add("is-wrong");
      });
      setTimeout(() => {
        _clearQuizHighlight();
        _renderQuizQuestion();
      }, 1300);
    });
  });
}

// ── Fun Facts ──────────────────────────────────────────────────
const FUN_FACTS = [
  { prov: "Batanes", fact: "Batanes is the northernmost province of the Philippines. Its iconic stone houses were built to withstand fierce typhoons that tear through the island chain." },
  { prov: "Palawan", fact: "Puerto Princesa Subterranean River in Palawan is one of the New Seven Wonders of Nature — a navigable underground river flowing 8.2 km through a cave to the sea." },
  { prov: "Cebu", fact: "Cebu hosted the first Spanish settlement in the Philippines in 1565, making it the oldest established city in the country." },
  { prov: "Ilocos Norte", fact: "The Bangui Windmills in Ilocos Norte stretch along 1.8 km of coastline and supply a significant portion of the province's electricity needs." },
  { prov: "Ifugao", fact: "The Banaue Rice Terraces in Ifugao are over 2,000 years old, carved into the Cordillera mountains by the Ifugao people — often called the 8th Wonder of the World." },
  { prov: "Camarines Sur", fact: "CamSur Watersports Complex in Camarines Sur is one of the largest cable wakeboarding parks in Asia, drawing athletes from around the world." },
  { prov: "Tawi-Tawi", fact: "Tawi-Tawi is the southernmost province of the Philippines — geographically closer to Malaysia's Sabah state than to Manila." },
  { prov: "Laguna", fact: "The Laguna Copperplate Inscription, found in 1989, is the oldest known written document discovered in the Philippines, dated to 900 CE." },
  { prov: "Pampanga", fact: "Pampanga is the 'Culinary Capital of the Philippines', the origin of beloved dishes like sisig, tocino, and morcon." },
  { prov: "Benguet", fact: "Benguet supplies most of the country's cut flowers and ornamental plants, earning it the nickname 'Salad Bowl of the Philippines'." },
  { prov: "Leyte", fact: "The Battle of Leyte Gulf in October 1944 was the largest naval battle in history by number of ships engaged — a turning point in WWII's Pacific Theater." },
  { prov: "Masbate", fact: "Masbate is known as the 'Rodeo Capital of the Philippines' and holds an annual festival where cowboys compete in cattle-wrangling events." },
  { prov: "Surigao del Norte", fact: "Sohoton Cove in Surigao del Norte is home to millions of stingless jellyfish. At night, the lagoon glows with natural bioluminescence." },
  { prov: "Quezon", fact: "Quezon province is home to the Quezon National Park, a refuge for Philippine wildlife including the endangered Philippine eagle." },
  { prov: "Mountain Province", fact: "Sagada in Mountain Province is famous for its Hanging Coffins — ancient burial practice where coffins are literally suspended on cliff faces." },
];

let _factIndex = 0;

function showFactsTool() {
  _factIndex = Math.floor(Math.random() * FUN_FACTS.length);
  _renderFact();
}

function _renderFact() {
  setSidebarTitle("Fun Facts");
  const f = FUN_FACTS[_factIndex];

  // Highlight the province on the map
  _clearQuizHighlight();
  const grp = _g.selectAll(".province-group").filter((d) => d.id === f.prov).node();
  if (grp) {
    d3.select(grp).classed("is-quiz", true).raise();
    _quizHighlight = grp;
  }

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="facts-back">‹ Back</button>
    <div class="fact-card">
      <div class="fact-prov">${escapeHtml(f.prov)}</div>
      <div class="fact-text">${escapeHtml(f.fact)}</div>
    </div>
    <div class="fact-nav">
      <span class="fact-counter">${_factIndex + 1} / ${FUN_FACTS.length}</span>
      <button class="fact-next-btn" id="fact-next">Next Fact →</button>
    </div>
  `;

  document.getElementById("facts-back").addEventListener("click", () => {
    _clearQuizHighlight();
    showToolsHome();
  });

  document.getElementById("fact-next").addEventListener("click", () => {
    _factIndex = (_factIndex + 1) % FUN_FACTS.length;
    _renderFact();
  });
}

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
  { id: "luzon",   icon: "🏆", title: "Luzon Explorer",     desc: "Log all Luzon provinces",
    progress: m => { const p = _travelProvsByRegions(_LUZON_REGIONS);    return { n: p.filter(x => m[x]).length, total: p.length }; } },
  { id: "visayas", icon: "🏆", title: "Visayas Voyager",    desc: "Log all Visayas provinces",
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
  let sum = 0, logged = 0;
  for (const p of all) {
    const lvl = _travelMap[p];
    if (lvl) { logged++; sum += TRAVEL_LEVELS.find(l => l.id === lvl)?.weight ?? 0; }
  }
  return { score: Math.round(sum / (all.length * 5) * 1000) / 10, logged, total: all.length };
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

// ── Boot ───────────────────────────────────────────────────────
(function boot() {
  _travelLoad();
  initMap();
  showToolsHome();

  // ── Settings panel: proximity reveal + toggle open/close ─────
  const settingsTrigger = document.getElementById("settings-trigger");
  const settingsBtn = document.getElementById("settings-btn");
  const mapWrap = document.getElementById("map-wrap");

  // Show gear button when cursor is within ~90px of top-right corner
  mapWrap.addEventListener("mousemove", (e) => {
    const rect = mapWrap.getBoundingClientRect();
    const dx = rect.right - e.clientX;
    const dy = e.clientY - rect.top;
    const near = Math.sqrt(dx * dx + dy * dy) < 90;
    settingsTrigger.classList.toggle("is-near", near);
  });

  mapWrap.addEventListener("mouseleave", () => {
    settingsTrigger.classList.remove("is-near");
  });

  // Toggle panel open/closed on gear button click
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = settingsTrigger.classList.toggle("panel-open");
    settingsBtn.classList.toggle("is-active", open);
  });

  // Close panel when clicking outside
  document.addEventListener("click", (e) => {
    if (!settingsTrigger.contains(e.target)) {
      settingsTrigger.classList.remove("panel-open");
      settingsBtn.classList.remove("is-active");
    }
  });

  // ── Dark mode toggle ──────────────────────────────────────────
  const darkToggle = document.getElementById("darkmode-toggle");
  const _savedTheme = localStorage.getItem("geopinas-theme");
  const _prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const _initDark = _savedTheme ? _savedTheme === "dark" : _prefersDark;
  if (_initDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    darkToggle.setAttribute("aria-checked", "true");
  }
  darkToggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    darkToggle.setAttribute("aria-checked", String(!isDark));
    localStorage.setItem("geopinas-theme", next);
  });

  // ── Sea texture toggle ────────────────────────────────────────
  const seaToggle = document.getElementById("sea-texture-toggle");
  const _initSeaTex = localStorage.getItem("geopinas-sea-texture");
  if (_initSeaTex === "false") {
    seaToggle.setAttribute("aria-checked", "false");
    // ocean-pattern not in DOM yet; patched after initMap via MutationObserver below
  }
  seaToggle.addEventListener("click", () => {
    const on = seaToggle.getAttribute("aria-checked") === "true";
    seaToggle.setAttribute("aria-checked", String(!on));
    const pattern = document.getElementById("ocean-pattern");
    if (pattern) pattern.style.opacity = on ? "0" : "1";
    localStorage.setItem("geopinas-sea-texture", String(!on));
  });
  // Apply saved sea-texture after initMap (ocean-pattern now exists)
  if (_initSeaTex === "false") {
    const pattern = document.getElementById("ocean-pattern");
    if (pattern) pattern.style.opacity = "0";
  }

  // ── Borders toggle ────────────────────────────────────────────
  const bordersToggle = document.getElementById("borders-toggle");
  const _initBorders = localStorage.getItem("geopinas-borders");
  if (_initBorders === "false") {
    bordersToggle.setAttribute("aria-checked", "false");
    document.documentElement.classList.add("no-borders");
  }
  bordersToggle.addEventListener("click", () => {
    const on = bordersToggle.getAttribute("aria-checked") === "true";
    bordersToggle.setAttribute("aria-checked", String(!on));
    document.documentElement.classList.toggle("no-borders", on);
    localStorage.setItem("geopinas-borders", String(!on));
  });

  // ── Sea color slider ──────────────────────────────────────────
  const SEA_COLOR_STOPS = [
    { v: 0,   r: 255, g: 255, b: 255 },
    { v: 33,  r: 135, g: 206, b: 235 },  // sky blue
    { v: 66,  r: 27,  g: 58,  b: 107 },  // default navy
    { v: 100, r: 2,   g: 8,   b: 18  },
  ];
  const SEA_COLOR_DEFAULT = 66;

  function _seaColor(val) {
    let lo = SEA_COLOR_STOPS[0], hi = SEA_COLOR_STOPS[SEA_COLOR_STOPS.length - 1];
    for (let i = 0; i < SEA_COLOR_STOPS.length - 1; i++) {
      if (val >= SEA_COLOR_STOPS[i].v && val <= SEA_COLOR_STOPS[i + 1].v) {
        lo = SEA_COLOR_STOPS[i]; hi = SEA_COLOR_STOPS[i + 1]; break;
      }
    }
    const t = hi.v === lo.v ? 0 : (val - lo.v) / (hi.v - lo.v);
    const r = Math.round(lo.r + (hi.r - lo.r) * t);
    const g = Math.round(lo.g + (hi.g - lo.g) * t);
    const b = Math.round(lo.b + (hi.b - lo.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function _applySeaColor(val) {
    const color = _seaColor(val);
    document.documentElement.style.setProperty("--ocean", color);
    const bg = document.getElementById("ocean-bg");
    if (bg) bg.setAttribute("fill", color);
  }

  const seaColorSlider = document.getElementById("sea-color-slider");
  const seaColorReset = document.getElementById("sea-color-reset");
  const _initSeaVal = Number(localStorage.getItem("geopinas-sea-color") ?? SEA_COLOR_DEFAULT);
  seaColorSlider.value = _initSeaVal;
  _applySeaColor(_initSeaVal);
  seaColorSlider.addEventListener("input", () => {
    const v = Number(seaColorSlider.value);
    _applySeaColor(v);
    localStorage.setItem("geopinas-sea-color", v);
  });
  seaColorReset.addEventListener("click", () => {
    seaColorSlider.value = SEA_COLOR_DEFAULT;
    _applySeaColor(SEA_COLOR_DEFAULT);
    localStorage.setItem("geopinas-sea-color", SEA_COLOR_DEFAULT);
  });

  // ── Land color slider ─────────────────────────────────────────
  const LAND_COLOR_STOPS = [
    { v: 0,   r: 255, g: 255, b: 255 },
    { v: 50,  r: 22,  g: 110, b: 62  },  // default #166e3e
    { v: 100, r: 5,   g: 30,  b: 15  },
  ];
  const LAND_COLOR_DEFAULT = 50;

  function _landColor(val) {
    let lo = LAND_COLOR_STOPS[0], hi = LAND_COLOR_STOPS[LAND_COLOR_STOPS.length - 1];
    for (let i = 0; i < LAND_COLOR_STOPS.length - 1; i++) {
      if (val >= LAND_COLOR_STOPS[i].v && val <= LAND_COLOR_STOPS[i + 1].v) {
        lo = LAND_COLOR_STOPS[i]; hi = LAND_COLOR_STOPS[i + 1]; break;
      }
    }
    const t = hi.v === lo.v ? 0 : (val - lo.v) / (hi.v - lo.v);
    const r = Math.round(lo.r + (hi.r - lo.r) * t);
    const g = Math.round(lo.g + (hi.g - lo.g) * t);
    const b = Math.round(lo.b + (hi.b - lo.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function _applyLandColor(val) {
    const fill = _landColor(val);
    const t2 = val / 100;
    const hr = Math.round(22 * t2 * 0.6);
    const hg = Math.round(110 * t2 * 0.6 + (1 - t2) * 200);
    const hb = Math.round(62 * t2 * 0.6 + (1 - t2) * 200);
    const hover = val < 5 ? "rgb(200,200,200)" : `rgb(${hr},${hg},${hb})`;
    document.documentElement.style.setProperty("--province-fill", fill);
    document.documentElement.style.setProperty("--province-hover", hover);
  }

  const landColorSlider = document.getElementById("land-color-slider");
  const landColorReset = document.getElementById("land-color-reset");
  const _initLandVal = Number(localStorage.getItem("geopinas-land-color") ?? LAND_COLOR_DEFAULT);
  landColorSlider.value = _initLandVal;
  _applyLandColor(_initLandVal);
  landColorSlider.addEventListener("input", () => {
    const v = Number(landColorSlider.value);
    _applyLandColor(v);
    localStorage.setItem("geopinas-land-color", v);
  });
  landColorReset.addEventListener("click", () => {
    landColorSlider.value = LAND_COLOR_DEFAULT;
    _applyLandColor(LAND_COLOR_DEFAULT);
    localStorage.setItem("geopinas-land-color", LAND_COLOR_DEFAULT);
  });

  // ── Border color swatches ─────────────────────────────────────
  const BORDER_DEFAULT = "#95ffc1";
  const _initBorderColor = localStorage.getItem("geopinas-border-color") ?? BORDER_DEFAULT;
  document.documentElement.style.setProperty("--province-border", _initBorderColor);
  document.querySelectorAll(".sp-swatch").forEach(s => {
    s.setAttribute("aria-pressed", s.dataset.color === _initBorderColor ? "true" : "false");
  });
  document.getElementById("border-swatches").addEventListener("click", (e) => {
    const btn = e.target.closest(".sp-swatch");
    if (!btn) return;
    const color = btn.dataset.color;
    document.documentElement.style.setProperty("--province-border", color);
    document.querySelectorAll(".sp-swatch").forEach(s => s.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    localStorage.setItem("geopinas-border-color", color);
  });

  // Sidebar collapse toggle
  const sidebar = document.getElementById("sidebar");
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-collapsed");
    document
      .getElementById("sidebar-toggle")
      .setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
    // Resize map after the CSS transition finishes
    sidebar.addEventListener(
      "transitionend",
      () => window.dispatchEvent(new Event("resize")),
      { once: true },
    );
  });
})();
