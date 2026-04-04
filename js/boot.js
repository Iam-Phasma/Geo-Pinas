/* ============================================================
   boot.js — Application bootstrap
   Must load last (after all tool files).
   ============================================================ */
"use strict";

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
  const _savedTheme = localStorage.getItem("terralyft-theme");
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
    localStorage.setItem("terralyft-theme", next);
  });

  // ── Sea texture toggle ────────────────────────────────────────
  const seaToggle = document.getElementById("sea-texture-toggle");
  const _initSeaTex = localStorage.getItem("terralyft-sea-texture");
  if (_initSeaTex === "false") {
    seaToggle.setAttribute("aria-checked", "false");
    // ocean-pattern not in DOM yet; patched after initMap via MutationObserver below
  }
  seaToggle.addEventListener("click", () => {
    const on = seaToggle.getAttribute("aria-checked") === "true";
    seaToggle.setAttribute("aria-checked", String(!on));
    const pattern = document.getElementById("ocean-pattern");
    if (pattern) pattern.style.opacity = on ? "0" : "1";
    localStorage.setItem("terralyft-sea-texture", String(!on));
  });
  // Apply saved sea-texture after initMap (ocean-pattern now exists)
  if (_initSeaTex === "false") {
    const pattern = document.getElementById("ocean-pattern");
    if (pattern) pattern.style.opacity = "0";
  }

  // ── Borders toggle ────────────────────────────────────────────
  const bordersToggle = document.getElementById("borders-toggle");
  const _initBorders = localStorage.getItem("terralyft-borders");
  if (_initBorders === "false") {
    bordersToggle.setAttribute("aria-checked", "false");
    document.documentElement.classList.add("no-borders");
  }
  bordersToggle.addEventListener("click", () => {
    const on = bordersToggle.getAttribute("aria-checked") === "true";
    bordersToggle.setAttribute("aria-checked", String(!on));
    document.documentElement.classList.toggle("no-borders", on);
    localStorage.setItem("terralyft-borders", String(!on));
  });

  // ── Sea color slider ──────────────────────────────────────────
  const SEA_COLOR_STOPS = [
    { v: 0,   r: 255, g: 255, b: 255 },
    { v: 20,  r: 182, g: 225, b: 243 },  // default light blue
    { v: 40,  r: 135, g: 206, b: 235 },  // sky blue
    { v: 70,  r: 27,  g: 58,  b: 107 },  // navy
    { v: 100, r: 2,   g: 8,   b: 18  },
  ];
  const SEA_COLOR_DEFAULT = 20;

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
  const _initSeaVal = Number(localStorage.getItem("terralyft-sea-color") ?? SEA_COLOR_DEFAULT);
  seaColorSlider.value = _initSeaVal;
  _applySeaColor(_initSeaVal);
  seaColorSlider.addEventListener("input", () => {
    const v = Number(seaColorSlider.value);
    _applySeaColor(v);
    localStorage.setItem("terralyft-sea-color", v);
  });
  seaColorReset.addEventListener("click", () => {
    seaColorSlider.value = SEA_COLOR_DEFAULT;
    _applySeaColor(SEA_COLOR_DEFAULT);
    localStorage.setItem("terralyft-sea-color", SEA_COLOR_DEFAULT);
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
  const _initLandVal = Number(localStorage.getItem("terralyft-land-color") ?? LAND_COLOR_DEFAULT);
  landColorSlider.value = _initLandVal;
  _applyLandColor(_initLandVal);
  landColorSlider.addEventListener("input", () => {
    const v = Number(landColorSlider.value);
    _applyLandColor(v);
    localStorage.setItem("terralyft-land-color", v);
  });
  landColorReset.addEventListener("click", () => {
    landColorSlider.value = LAND_COLOR_DEFAULT;
    _applyLandColor(LAND_COLOR_DEFAULT);
    localStorage.setItem("terralyft-land-color", LAND_COLOR_DEFAULT);
  });

  // ── Border color swatches ─────────────────────────────────────
  const BORDER_DEFAULT = "#0a3d1f";
  const _initBorderColor = localStorage.getItem("terralyft-border-color") ?? BORDER_DEFAULT;
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
    localStorage.setItem("terralyft-border-color", color);
  });

  // ── Sidebar collapse / mobile bottom sheet ───────────────────
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileBackdrop = document.getElementById("mobile-backdrop");

  function isMobile() { return window.innerWidth <= 640; }

  function openMobileSheet() {
    sidebar.classList.remove("is-collapsed");
    sidebar.classList.add("is-mobile-open");
    mobileBackdrop.classList.add("is-visible");
    sidebarToggle.textContent = "×";
    sidebarToggle.setAttribute("aria-label", "Close panel");
    sidebarToggle.setAttribute("title", "Close");
  }
  window._openMobileSheet = openMobileSheet;

  function closeMobileSheet() {
    sidebar.classList.remove("is-mobile-open");
    mobileBackdrop.classList.remove("is-visible");
    sidebarToggle.textContent = "‹";
    sidebarToggle.setAttribute("aria-label", "Collapse sidebar");
    sidebarToggle.setAttribute("title", "Collapse");
  }

  sidebarToggle.addEventListener("click", () => {
    if (isMobile()) { closeMobileSheet(); return; }
    const collapsed = sidebar.classList.toggle("is-collapsed");
    sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    sidebar.addEventListener(
      "transitionend",
      () => window.dispatchEvent(new Event("resize")),
      { once: true },
    );
  });

  document.getElementById("mobile-fab").addEventListener("click", openMobileSheet);
  mobileBackdrop.addEventListener("click", closeMobileSheet);

  // Restore desktop state on resize out of mobile
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      sidebar.classList.remove("is-mobile-open");
      mobileBackdrop.classList.remove("is-visible");
      sidebarToggle.textContent = "‹";
      sidebarToggle.setAttribute("aria-label", "Collapse sidebar");
      sidebarToggle.setAttribute("title", "Collapse");
    }
  });
})();
