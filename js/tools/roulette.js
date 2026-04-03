/* ============================================================
   tools/roulette.js — Province Roulette tool
   Must load AFTER travel.js (_LUZON_REGIONS etc. must exist).
   Depends on: app.js (escapeHtml, setSidebarTitle, showToolsHome,
     PROVINCE_REGION, _g, _activeToolId, _clearQuizHighlight,
     clearWeatherEmoji, _clearTravelColors)
   ============================================================ */
"use strict";

// ── Roulette state ─────────────────────────────────────────────
let _rouletteRegions = { luzon: true, visayas: true, mindanao: true };
let _rouletteSelectedRegions = new Set([
  "Region I — Ilocos","Region II — Cagayan Valley","Region III — Central Luzon",
  "Region IVA — Calabarzon","MIMAROPA","Region V — Bicol","NCR — National Capital Region","CAR",
  "Region VI — Western Visayas","Region VII — Central Visayas","Region VIII — Eastern Visayas",
  "Region IX — Zamboanga Peninsula","Region X — Northern Mindanao","Region XI — Davao Region",
  "Region XII — SOCCSKSARGEN","Region XIII — Caraga","BARMM",
]);
let _rouletteHighlight = null;
let _rouletteWinner = null;
let _rouletteTimer = null;
let _rouletteSpinning = false;

// ── Province Roulette ──────────────────────────────────────────

function _rouletteClearHighlight() {
  if (_rouletteTimer) { clearTimeout(_rouletteTimer); _rouletteTimer = null; }
  _rouletteSpinning = false;
  if (_rouletteHighlight) {
    d3.select(_rouletteHighlight)
      .classed("is-roulette", false)
      .classed("is-roulette-winner", false);
    _rouletteHighlight = null;
  }
  _rouletteWinner = null;
}

function _rouletteGetPool() {
  return Object.entries(PROVINCE_REGION)
    .filter(([, r]) => _rouletteSelectedRegions.has(r))
    .map(([p]) => p);
}

function _groupState(group) {
  const all = group.regions.every(r => _rouletteSelectedRegions.has(r));
  const none = group.regions.every(r => !_rouletteSelectedRegions.has(r));
  return all ? "all" : none ? "none" : "partial";
}

function showRouletteTool() {
  _activeToolId = "roulette";
  _clearQuizHighlight();
  clearWeatherEmoji();
  _clearTravelColors();
  setSidebarTitle("Roulette");
  _renderRouletteTool();
}

function _renderRouletteTool() {
  const pool = _rouletteGetPool();
  const spinning = _rouletteSpinning;

  const groupsHtml = _RL_GROUPS.map(g => {
    const state = _groupState(g);
    const checkboxesHtml = Object.entries(g.regionLabels).map(([full, short]) => {
      const checked = _rouletteSelectedRegions.has(full);
      return `
        <label class="rl-check-row${checked ? " is-checked" : ""}" data-full="${escapeHtml(full)}">
          <span class="rl-checkbox${checked ? " is-checked" : ""}">
            ${checked ? `<svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}
          </span>
          <span class="rl-check-label">${escapeHtml(short)}</span>
        </label>`;
    }).join("");

    return `
      <div class="rl-group">
        <button class="rl-group-btn${state === "all" ? " is-all" : state === "partial" ? " is-partial" : ""}" data-group="${g.key}">
          <span class="rl-group-check">
            ${state === "all" ? `<svg viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : state === "partial" ? `<svg viewBox="0 0 10 2" fill="none"><path d="M1 1h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` : ""}
          </span>
          <span class="rl-group-label">${escapeHtml(g.label)}</span>
          <span class="rl-group-count">${g.regions.filter(r => _rouletteSelectedRegions.has(r)).length}/${g.regions.length}</span>
        </button>
        <div class="rl-check-grid">${checkboxesHtml}</div>
      </div>`;
  }).join("");

  const hasResult = _rouletteWinner && !spinning;

  const topHtml = hasResult ? `
    <div class="rl-result-card">
      <div class="rl-result-label">You landed on</div>
      <div class="rl-result-prov">${escapeHtml(_rouletteWinner)}</div>
      <div class="rl-result-region">${escapeHtml(PROVINCE_REGION[_rouletteWinner] ?? "")}</div>
    </div>
  ` : `
    <div class="rl-dice-display">
      <span class="rl-dice-icon${spinning ? " is-spinning" : ""}">🎲</span>
      <span class="rl-spin-prov" id="rl-spin-prov">${spinning ? "…" : ""}</span>
    </div>
  `;

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="roulette-back">‹ Back</button>
    <div class="rl-tool-body">
      ${topHtml}
      <div class="rl-filter-section">
        <div class="rl-filter-header">
          <span class="rl-region-label">Include regions</span>
          <span class="rl-pool-count">${pool.length} province${pool.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="rl-groups">${groupsHtml}</div>
      </div>
      <button class="rl-spin-btn${spinning ? " is-spinning" : ""}${hasResult ? " is-again" : ""}" id="rl-spin-btn"
        ${pool.length < 2 || spinning ? "disabled" : ""}>
        ${spinning ? "Spinning…" : hasResult ? "🎲 Spin Again" : "🎲 Spin!"}
      </button>
    </div>
  `;

  document.getElementById("roulette-back").addEventListener("click", () => {
    _rouletteClearHighlight();
    _activeToolId = null;
    showToolsHome();
  });

  // Group toggle: all → none → all
  document.querySelectorAll(".rl-group-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (spinning) return;
      const g = _RL_GROUPS.find(x => x.key === btn.dataset.group);
      if (!g) return;
      const state = _groupState(g);
      if (state === "all") {
        // Deselect all — but only if at least one other region remains selected
        const otherSelected = _RL_GROUPS
          .filter(x => x.key !== g.key)
          .some(x => x.regions.some(r => _rouletteSelectedRegions.has(r)));
        if (!otherSelected) return;
        g.regions.forEach(r => _rouletteSelectedRegions.delete(r));
      } else {
        g.regions.forEach(r => _rouletteSelectedRegions.add(r));
      }
      _renderRouletteTool();
    });
  });

  // Individual checkbox toggles
  document.querySelectorAll(".rl-check-row").forEach(row => {
    row.addEventListener("click", () => {
      if (spinning) return;
      const full = row.dataset.full;
      if (_rouletteSelectedRegions.has(full)) {
        // Prevent deselecting the very last one
        if (_rouletteSelectedRegions.size === 1) return;
        _rouletteSelectedRegions.delete(full);
      } else {
        _rouletteSelectedRegions.add(full);
      }
      _renderRouletteTool();
    });
  });

  document.getElementById("rl-spin-btn")?.addEventListener("click", () => {
    if (_rouletteWinner) _rouletteClearHighlight();
    _rouletteSpin();
  });
}

function _rouletteSetFlash(provId, isWinner) {
  if (_rouletteHighlight) {
    d3.select(_rouletteHighlight)
      .classed("is-roulette", false)
      .classed("is-roulette-winner", false);
    _rouletteHighlight = null;
  }
  if (!provId) return;
  const grp = _g.selectAll(".province-group").filter(d => d.id === provId).node();
  if (!grp) return;
  d3.select(grp)
    .classed("is-roulette", true)
    .classed("is-roulette-winner", !!isWinner)
    .raise();
  _rouletteHighlight = grp;
  const label = document.getElementById("rl-spin-prov");
  if (label) label.textContent = provId;
}

function _rouletteSpin() {
  if (_rouletteSpinning) return;
  const pool = _rouletteGetPool();
  if (pool.length < 2) return;

  _rouletteWinner = null;
  _rouletteSpinning = true;
  _renderRouletteTool();

  const STEPS = 26;
  const winner = pool[Math.floor(Math.random() * pool.length)];

  // Build sequence: random flashes then winner last
  const sequence = [];
  for (let i = 0; i < STEPS - 1; i++) {
    let pick;
    // Avoid repeating same province twice in a row
    do { pick = pool[Math.floor(Math.random() * pool.length)]; }
    while (sequence.length > 0 && pick === sequence[sequence.length - 1]);
    sequence.push(pick);
  }
  sequence.push(winner);

  let step = 0;
  function tick() {
    const isLast = step === sequence.length - 1;
    _rouletteSetFlash(sequence[step], isLast);
    step++;
    if (step < sequence.length) {
      // Ease-out: starts ~50ms, slows to ~750ms
      const t = step / sequence.length;
      const delay = Math.round(50 + t * t * 700);
      _rouletteTimer = setTimeout(tick, delay);
    } else {
      _rouletteSpinning = false;
      _rouletteWinner = winner;
      _rouletteTimer = null;
      _renderRouletteTool();
    }
  }

  tick();
}
