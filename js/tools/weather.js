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
let _currentLottieAnim = null;

// ── Meteocons icon slugs (WMO code → slug) ────────────────────
const _MC = "https://cdn.meteocons.com/3.0.0-next.8";

const WMO_ICON_DAY = {
  0:  "clear-day",
  1:  "mostly-clear-day",           2:  "partly-cloudy-day",        3:  "overcast-day",
  45: "fog-day",                    48: "fog-day",
  51: "mostly-clear-day-drizzle",   53: "partly-cloudy-day-drizzle", 55: "overcast-day-drizzle",
  56: "overcast-day-drizzle",       57: "overcast-day-sleet",
  61: "partly-cloudy-day-rain",     63: "rain",                      65: "extreme-rain",
  66: "sleet",                      67: "extreme-sleet",
  71: "partly-cloudy-day-snow",     73: "snow",                      75: "extreme-snow",
  77: "snow",
  80: "partly-cloudy-day-rain",     81: "rain",                      82: "extreme-rain",
  85: "partly-cloudy-day-snow",     86: "extreme-snow",
  95: "thunderstorms-day",          96: "thunderstorms-day-hail",    99: "thunderstorms-extreme-day",
};

const WMO_ICON_NIGHT = {
  0:  "clear-night",
  1:  "mostly-clear-night",           2:  "partly-cloudy-night",        3:  "overcast-night",
  45: "fog-night",                    48: "fog-night",
  51: "mostly-clear-night-drizzle",   53: "partly-cloudy-night-drizzle", 55: "overcast-night-drizzle",
  56: "overcast-night-drizzle",       57: "overcast-night-sleet",
  61: "partly-cloudy-night-rain",     63: "rain",                        65: "extreme-rain",
  66: "sleet",                        67: "extreme-sleet",
  71: "partly-cloudy-night-snow",     73: "snow",                        75: "extreme-snow",
  77: "snow",
  80: "partly-cloudy-night-rain",     81: "rain",                        82: "extreme-rain",
  85: "partly-cloudy-night-snow",     86: "extreme-snow",
  95: "thunderstorms-night",          96: "thunderstorms-night-hail",    99: "thunderstorms-extreme-night",
};

function _wmoIcon(code, isDay) {
  const map = isDay ? WMO_ICON_DAY : WMO_ICON_NIGHT;
  return map[code] ?? "not-available";
}

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
  // overlay is in #map-wrap space; pos is in SVG/frame space.
  // frame.offsetLeft/Top give the untransformed bleed offset (negative values).
  const frame = document.getElementById("map-tilt-frame");
  overlay.style.left = (pos.x + frame.offsetLeft) + "px";
  overlay.style.top = (pos.y + frame.offsetTop - 28) + "px";
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

function _setMeteoIcon(overlay, slug) {
  overlay.innerHTML = `<img class="meteocon" src="${_MC}/svg/fill/${slug}.svg" alt="" aria-hidden="true">`;
}

async function fetchAndShowWeather(prov) {
  const pt = _parseTranslate(prov.transform);
  if (!pt) return;
  const { lat, lon } = _svgToLatLng(pt.x, pt.y);
  _currentWeatherProv = prov;

  const overlay = document.getElementById("weather-overlay");
  if (!overlay) return;
  if (_weatherEmojiEnabled) {
    _setMeteoIcon(overlay, "thermometer");
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
      `&current=weather_code,temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,is_day&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed");
    const data = await res.json();
    const cur = data.current ?? {};
    const code = cur.weather_code ?? 0;
    const isDay = cur.is_day !== 0;
    const slug = _wmoIcon(code, isDay);
    _setMeteoIcon(overlay, slug);
    if (_weatherEmojiEnabled) _positionWeatherOverlay(prov);

    _lastWeatherInfo = {
      prov: prov.id,
      region: PROVINCE_REGION[prov.id] ?? "",
      slug,
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
    _setMeteoIcon(overlay, "not-available");
    if (_isWeatherContext()) {
      _renderExploreWeatherSection();
    }
  }
}

function clearWeatherEmoji() {
  _currentWeatherProv = null;
  _lastWeatherInfo = null;
  if (_currentLottieAnim) { _currentLottieAnim.destroy(); _currentLottieAnim = null; }
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
          <div class="weather-prov-icon" id="weather-lottie-el"></div>
          <div class="weather-prov-temp-block">
            <span class="weather-prov-temp">${_lastWeatherInfo.temp}°C</span>
            <span class="weather-prov-cond">${escapeHtml(_lastWeatherInfo.condition)}</span>
          </div>
        </div>
        <div class="weather-prov-grid">
          <div class="weather-prov-stat">
            <span class="weather-prov-stat-label">Feels</span>
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
    const lottieEl = document.getElementById("weather-lottie-el");
    if (lottieEl) {
      if (_currentLottieAnim) { _currentLottieAnim.destroy(); _currentLottieAnim = null; }
      _currentLottieAnim = lottie.loadAnimation({
        container: lottieEl,
        path: `${_MC}/lottie/fill/${_lastWeatherInfo.slug}.json`,
        renderer: "svg",
        loop: true,
        autoplay: true,
      });
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

