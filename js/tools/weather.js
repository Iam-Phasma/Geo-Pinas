/* ============================================================
   tools/weather.js — Weather tool
   Depends on: app.js (escapeHtml, setSidebarTitle, showToolsHome,
     _activeToolId, _selectedGroup, _g, _svg, PROVINCE_REGION,
     _clearQuizHighlight)
   ============================================================ */
"use strict";

// ── Weather state ──────────────────────────────────────────────
let _currentWeatherProv = null;
let _lastWeatherInfo = null;
let _weatherEmojiEnabled = true;

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

function _isWeatherContext() {
  return _exploreTab === "weather";
}

function updateWeatherEmojiPosition() {
  if (!_currentWeatherProv || !_isWeatherContext() || !_weatherEmojiEnabled) return;
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

  if (_isWeatherContext()) {
    _renderExploreWeatherSection();
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

    if (_isWeatherContext()) {
      _renderExploreWeatherSection();
    }
  } catch {
    _setTwemoji(overlay, "🌡️");
    if (_isWeatherContext()) {
      _renderExploreWeatherSection();
    }
  }
}

function clearWeatherEmoji() {
  _currentWeatherProv = null;
  _lastWeatherInfo = null;
  const overlay = document.getElementById("weather-overlay");
  if (overlay) overlay.classList.remove("is-visible");
}


// ── Weather section renderer (embedded in Explore) ────────────
function _renderExploreWeatherSection() {
  const section = document.getElementById("explore-weather-section");
  if (!section) return;

  const emojiChecked = _weatherEmojiEnabled ? "true" : "false";

  const toggleRow = `
    <div class="weather-tool-row explore-weather-toggle-row">
      <span class="weather-tool-label">Show emoji on map</span>
      <button class="sp-toggle" id="weather-emoji-toggle" role="switch"
        aria-checked="${emojiChecked}" title="Toggle map emoji">
        <span class="sp-toggle-track"><span class="sp-toggle-thumb"></span></span>
      </button>
    </div>
  `;

  // Loading state
  if (!_lastWeatherInfo) {
    section.innerHTML = toggleRow + `<p class="weather-tool-hint">Loading weather…</p>`;
    _attachEmojiToggle();
    return;
  }

  // Province weather card
  section.innerHTML = toggleRow + `
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
    `;
    const emojiEl = document.getElementById("weather-prov-emoji-el");
    if (emojiEl && typeof twemoji !== "undefined") {
      twemoji.parse(emojiEl, { folder: "svg", ext: ".svg" });
    }
    _attachEmojiToggle();
}

function _attachEmojiToggle() {
  const btn = document.getElementById("weather-emoji-toggle");
  if (!btn) return;
  btn.addEventListener("click", function () {
    _weatherEmojiEnabled = !_weatherEmojiEnabled;
    this.setAttribute("aria-checked", String(_weatherEmojiEnabled));
    const overlay = document.getElementById("weather-overlay");
    if (_weatherEmojiEnabled && _currentWeatherProv) {
      if (overlay) overlay.classList.add("is-visible");
      _positionWeatherOverlay(_currentWeatherProv);
    } else {
      if (overlay) overlay.classList.remove("is-visible");
    }
  });
}

