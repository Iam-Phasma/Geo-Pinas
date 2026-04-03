/* ============================================================
   tools/quiz.js — Province Quiz tool
   Depends on: app.js (escapeHtml, setSidebarTitle, showToolsHome,
     PROVINCE_REGION, _g)
   ============================================================ */
"use strict";

const _QUIZ_MAX = 20;

// ── Province Quiz ──────────────────────────────────────────────
let _quizScore     = { correct: 0, total: 0 };
let _quizHighlight = null;
let _quizHistory   = [];
let _quizUsed      = [];

function _clearQuizHighlight() {
  if (_quizHighlight) {
    d3.select(_quizHighlight).classed("is-quiz", false);
    _quizHighlight = null;
  }
}

function showQuizTool() {
  _quizScore   = { correct: 0, total: 0 };
  _quizHistory = [];
  _quizUsed    = [];
  _renderQuizQuestion();
}

function _renderQuizQuestion() {
  setSidebarTitle("Province Quiz");

  if (_quizScore.total >= _QUIZ_MAX) {
    _renderQuizSummary();
    return;
  }

  const allProvinces = Object.keys(PROVINCE_REGION);
  if (_quizUsed.length >= allProvinces.length) _quizUsed = [];
  let prov;
  do { prov = allProvinces[Math.floor(Math.random() * allProvinces.length)]; }
  while (_quizUsed.includes(prov));
  _quizUsed.push(prov);

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

  const qNum = _quizScore.total + 1;

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="quiz-back">‹ Back</button>
    <div class="quiz-score-bar">
      <span class="quiz-score-label">Question <strong>${qNum}</strong><span style="opacity:.5"> / ${_QUIZ_MAX}</span></span>
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
      _quizHistory.push({ prov, correct });

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

function _renderQuizSummary() {
  _clearQuizHighlight();
  setSidebarTitle("Province Quiz");

  const correct = _quizScore.correct;
  const total   = _quizScore.total;
  const pct     = Math.round(correct / total * 100);
  const grade   = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '📚';
  const tag     = pct >= 90 ? 'Geography Expert!'
                : pct >= 70 ? 'Great job!'
                : pct >= 50 ? 'Not bad!'
                : 'Keep studying!';

  const rows = _quizHistory.map((h, i) => `
    <div class="quiz-summary-row ${h.correct ? 'is-correct' : 'is-wrong'}">
      <span class="quiz-summary-num">${i + 1}</span>
      <span class="quiz-summary-icon">${h.correct ? '✅' : '❌'}</span>
      <span class="quiz-summary-prov">${escapeHtml(h.prov)}</span>
    </div>`).join('');

  document.getElementById("info-panel").innerHTML = `
    <button class="tool-back-btn" id="quiz-back">‹ Back</button>
    <div class="quiz-summary">
      <div class="quiz-summary-grade">${grade}</div>
      <div class="quiz-summary-score">${correct} <span class="quiz-summary-total">/ ${total}</span></div>
      <div class="quiz-summary-tag">${tag}</div>
      <div class="quiz-summary-list">${rows}</div>
      <button class="quiz-play-again-btn" id="quiz-play-again">Play Again</button>
    </div>
  `;

  document.getElementById("quiz-back").addEventListener("click", () => {
    showToolsHome();
  });
  document.getElementById("quiz-play-again").addEventListener("click", () => {
    showQuizTool();
  });
}
