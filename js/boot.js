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

  let settingsHoverFrame = null;

  // Show gear button when cursor is within ~90px of top-right corner
  mapWrap.addEventListener("mousemove", (e) => {
    if (settingsHoverFrame) return;

    settingsHoverFrame = window.requestAnimationFrame(() => {
      settingsHoverFrame = null;
      const rect = mapWrap.getBoundingClientRect();
      const dx = rect.right - e.clientX;
      const dy = e.clientY - rect.top;
      const near = Math.sqrt(dx * dx + dy * dy) < 90;
      settingsTrigger.classList.toggle("is-near", near);
    });
  });

  mapWrap.addEventListener("mouseleave", () => {
    if (settingsHoverFrame) {
      window.cancelAnimationFrame(settingsHoverFrame);
      settingsHoverFrame = null;
    }
    settingsTrigger.classList.remove("is-near");
  });

  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = settingsTrigger.classList.toggle("panel-open");
    settingsBtn.classList.toggle("is-active", open);
  });

  document.addEventListener("click", (e) => {
    if (!settingsTrigger.contains(e.target)) {
      settingsTrigger.classList.remove("panel-open");
      settingsBtn.classList.remove("is-active");
    }
  });

  // ── Sea texture toggle ────────────────────────────────────────
  const seaToggle = document.getElementById("sea-texture-toggle");
  const _initSeaTex = localStorage.getItem("terralyft-sea-texture");
  function applySeaTextureState(isEnabled) {
    seaToggle.setAttribute("aria-checked", String(isEnabled));
    if (isEnabled) {
      document.documentElement.classList.remove("no-sea-texture");
    } else {
      document.documentElement.classList.add("no-sea-texture");
    }
    const pattern = document.getElementById("ocean-pattern");
    if (pattern) {
      const nextOpacity = isEnabled ? "1" : "0";
      pattern.style.opacity = nextOpacity;
      pattern.setAttribute("opacity", nextOpacity);
    }
    localStorage.setItem("terralyft-sea-texture", String(isEnabled));
  }

  applySeaTextureState(_initSeaTex === "true");
  seaToggle.addEventListener("click", () => {
    const on = seaToggle.getAttribute("aria-checked") === "true";
    applySeaTextureState(!on);
  });

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
    if (typeof window.requestMapRender === "function") window.requestMapRender();
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
    if (typeof window.requestMapRender === "function") window.requestMapRender();
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
    if (typeof window.requestMapRender === "function") window.requestMapRender();
  });

  // ── Sidebar mobile bottom sheet ─────────────────────────────
  const sidebar = document.getElementById("sidebar");
  const mobileBackdrop = document.getElementById("mobile-backdrop");
  let sidebarResizeFrame = null;

  function requestSidebarResize() {
    if (sidebarResizeFrame) return;
    sidebarResizeFrame = window.requestAnimationFrame(() => {
      sidebarResizeFrame = null;
      window.dispatchEvent(new Event("resize"));
    });
  }

  function isMobile() { return window.innerWidth <= 640; }

  function openMobileSheet() {
    // Reset + disable tilt while the bottom sheet is open
    if (typeof window._resetTilt === "function") window._resetTilt();
    if (typeof window._resetZoom === "function") window._resetZoom();
    document.getElementById("tilt-controls").setAttribute("inert", "");
    document.getElementById("tilt-controls").style.opacity = "0.35";
    document.getElementById("tilt-controls").style.pointerEvents = "none";
    sidebar.classList.remove("is-collapsed");
    sidebar.classList.add("is-mobile-open");
    mobileBackdrop.classList.add("is-visible");
  }
  window._openMobileSheet = openMobileSheet;

  function closeMobileSheet() {
    document.getElementById("tilt-controls").removeAttribute("inert");
    document.getElementById("tilt-controls").style.opacity = "";
    document.getElementById("tilt-controls").style.pointerEvents = "";
    sidebar.classList.remove("is-mobile-open");
    mobileBackdrop.classList.remove("is-visible");
  }

  document.getElementById("mobile-fab").addEventListener("click", openMobileSheet);
  mobileBackdrop.addEventListener("click", closeMobileSheet);

  // Restore desktop state on resize out of mobile
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      sidebar.classList.remove("is-mobile-open");
      mobileBackdrop.classList.remove("is-visible");
    }
  });
})();
