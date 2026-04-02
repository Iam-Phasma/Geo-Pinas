/* ============================================================
   GEO PINAS — app.js
   Map rendering, interaction, and UI logic.
   Static data (MAP_W, MAP_H, PROVINCES, PROVINCE_REGION) is
   loaded from data.js, which must be included first.
   ============================================================ */

"use strict";

/*
  {
    id: "Aurora",
    transform: "translate(427.5,375)",
    d: "M-37.5 45l60-60 15-30h-30v15l-45 45z",
  },
  {
    id: "Bataan",
    transform: "translate(330,465)",
    d: "M-15-15L0 0v15h15v-30z",
  },
  {
    id: "Pampanga",
    transform: "translate(352.5,435)",
    d: "M-7.5 15l30-30h-45v30z",
  },
  {
    id: "Bulacan",
    transform: "translate(367.5,435)",
    d: "M-22.5 15h45v-30h-15z",
  },
  { id: "Rizal", transform: "translate(390,465)", d: "M-15 15h30V0L0-15h-15z" },
  {
    id: "Laguna",
    transform: "translate(390,495)",
    d: "M-15 0H0v-15h15V0L0 15h-15z",
  },
  {
    id: "Camarines Norte",
    transform: "translate(487.5,495)",
    d: "M-22.5 15V0l15-15h15l15 15v15h-15z",
  },
  {
    id: "Camarines Sur",
    transform: "translate(532.5,532.5)",
    d: "M-22.5-22.5v15l30-2.262V-22.5l45 15-30 15-15 15h-15l-45-30 15-15z",
  },
  {
    id: "Catanduanes",
    transform: "translate(600,525)",
    d: "M0-15l-15 30h30v-30z",
  },
  {
    id: "Albay",
    transform: "translate(555,562.5)",
    d: "M-30-7.5l15 30h45v-30l-30-15-15 15z",
  },
  {
    id: "Sorsogon",
    transform: "translate(570,600)",
    d: "M15-15h15v30H15V0h-30l-15-15z",
  },
  {
    id: "Occidental Mindoro",
    transform: "translate(345,600)",
    d: "M-30-45h45l15 30v60L0 15v-30z",
  },
  {
    id: "Oriental Mindoro",
    transform: "translate(382.5,600)",
    d: "M-22.5-45h30l15 30v30l-15 30h-15v-60z",
  },
  {
    id: "Iloilo",
    transform: "translate(480,741.63)",
    d: "M-45 38.371l30-45v-15h45L45-38.37 30-6.63l-30 30z",
  },
  {
    id: "Capiz",
    transform: "translate(487.5,712.5)",
    d: "M-22.5 7.5h-15l30-15h45l-15 15z",
  },
  {
    id: "Aklan",
    transform: "translate(457.5,697.5)",
    d: "M22.5 7.5l-45-30 15 45z",
  },
  {
    id: "Antique",
    transform: "translate(450,727.5)",
    d: "M-15-52.5v105l30-45v-15H0z",
  },
  {
    id: "Northern Samar",
    transform: "translate(652.5,630)",
    d: "M-37.5 15h60l15-15-15-15h-60z",
  },
  {
    id: "Eastern Samar",
    transform: "translate(697.5,682.5)",
    d: "M-22.5-37.5v15l15 15v60h30l-15-15v-45l-15-45z",
  },
  {
    id: "Samar",
    transform: "translate(652.5,690)",
    d: "M-37.5-45l45 45-15 15 45 30v-60l-15-15v-15z",
  },
  {
    id: "Negros Occidental",
    transform: "translate(510,795)",
    d: "M30 0l15-30v-15L30-60 0-45v30l-15 30-15 15h-15v15l15 15z",
  },
  {
    id: "Negros Oriental",
    transform: "translate(510,840)",
    d: "M-30 15l15 15L1.947 45H15l15-15-15-15 15-60z",
  },
  {
    id: "Cebu",
    transform: "translate(570,795)",
    d: "M-30 30v45l15-45L15 0l15-75z",
  },
  {
    id: "Bohol",
    transform: "translate(600,832.5)",
    d: "M-30-5.413V7.5l15 15h30l15-15v-30H0z",
  },
  {
    id: "Misamis Occidental",
    transform: "translate(570,937.5)",
    d: "M-15-22.5v45H0l15-15v-15l-15-15z",
  },
  {
    id: "Zamboanga del Norte",
    transform: "translate(495,967.5)",
    d: "M60-52.5H30v30l-60 15-15 30-15 30 45-45h30l30-15v-15h15z",
  },
  {
    id: "Lanao del Norte",
    transform: "translate(600,967.5)",
    d: "M-30-7.5H0v-15h30v15l-45 30-15-15z",
  },
  {
    id: "Lanao del Sur",
    transform: "translate(615,982.5)",
    d: "M-30 7.5l15 15 30-15h15v-15l-15-15z",
  },
  {
    id: "Bukidnon",
    transform: "translate(660,967.5)",
    d: "M-30-22.5l30-15h30v60l-15 15H0l-15-15v-15l-15-15z",
  },
  {
    id: "Misamis Oriental",
    transform: "translate(645,922.5)",
    d: "M-30 22.5v-15h15l15-15v-15h30v30H15l-30 15z",
  },
  {
    id: "Agusan del Norte",
    transform: "translate(697.5,885)",
    d: "M-22.5 15l30-15v-30h15v60h-45z",
  },
  {
    id: "Agusan del Sur",
    transform: "translate(720,915)",
    d: "M0-45l30 75h15v15h-75V15h-15V0H0z",
  },
  {
    id: "Surigao del Sur",
    transform: "translate(750,907.5)",
    d: "M-15-52.5l-15 15 30 75h15v15h15v-15l-15-15-15-15 15-15z",
  },
  {
    id: "Davao Oriental",
    transform: "translate(757.5,1020)",
    d: "M-7.5-60l15 60-30 15 15 45 30-45v-45l-15-30z",
  },
  {
    id: "Davao de Oro",
    transform: "translate(742.5,997.5)",
    d: "M-22.5-37.5v30h15v45l30-15-15-60z",
  },
  {
    id: "Davao del Sur",
    transform: "translate(690,1035)",
    d: "M15-15L0 45h-15V15L0 0v-45h15z",
  },
  {
    id: "Maguindanao del Norte",
    transform: "translate(607.5,1020)",
    d: "M-7.5-15l15 15-30 30 45-15v-45z",
  },
  {
    id: "Maguindanao del Sur",
    transform: "translate(622.5,1050)",
    d: "M7.5-15h30v30h-15l-60-15z",
  },
  {
    id: "Davao Occidental",
    transform: "translate(705,1102.5)",
    d: "M-10.239-37.5L15-7.5v15l-30 30 15-30-15-30z",
  },
  {
    id: "Cotabato",
    transform: "translate(660,1027.5)",
    d: "M30 7.5v-45l-15 15H0l-15-15h-15v45H0v30l15-15z",
  },
  {
    id: "Sarangani",
    transform: "translate(660,1110)",
    d: "M30-30L45 0 30 30 15 15l15-30-15-15zM-15 0h30v15L-45 0v-15h15z",
  },
  {
    id: "Sulu",
    transform: "translate(382.5,1125)",
    d: "M-22.5-15V0l30 15 15-15-15-15z",
  },
  {
    id: "Tawi-Tawi",
    transform: "translate(292.5,1170)",
    d: "M22.5-15l-45 30h45z",
  },
  {
    id: "Basilan",
    transform: "translate(442.5,1080)",
    d: "M-7.5-15h30v30h-30l-15-30z",
  },
  {
    id: "Southern Leyte",
    transform: "translate(660,787.5)",
    d: "M-15 22.5l15-30 15-15v45L0 7.5v15z",
  },
  {
    id: "Leyte",
    transform: "translate(645,757.5)",
    d: "M0 52.5l15-30 15-15-15-15v-30h-30l-15-15v45h15l15 15z",
  },
  {
    id: "Batanes",
    transform: "translate(435,37.5)",
    d: "M0 7.5h15l-15 15zm-15-15l15-15v15z",
  },
  {
    id: "Palawan",
    transform: "translate(195,795)",
    d: "M-120 150l15-30L30-15l15-75 30 75L0 30v15l-75 75zM75-150h15l30 15-30 30z",
  },
  {
    id: "Dinagat Islands",
    transform: "translate(712.5,802.5)",
    d: "M7.5-22.5l-15 15v15l15 15z",
  },
  {
    id: "Metro Manila",
    transform: "translate(367.5,465)",
    d: "M-7.5-15h15v30z",
  },
  {
    id: "Batangas",
    transform: "translate(375,517.5)",
    d: "M30 7.5v15H0l-15-30-15 15v-30l30 15h15v15z",
  },
  { id: "Cavite", transform: "translate(360,495)", d: "M-15 0l30-15v30z" },
  {
    id: "Marinduque",
    transform: "translate(435,555)",
    d: "M0-15L15 0 0 15-15 0z",
  },
  {
    id: "Zambales",
    transform: "translate(315,412.5)",
    d: "M-15-37.5v30l15 45h15v-30L0-7.5v-30z",
  },
  {
    id: "Tarlac",
    transform: "translate(337.5,397.5)",
    d: "M-22.5-7.5v15l15 15h30v-15l-15-30z",
  },
  {
    id: "Pangasinan",
    transform: "translate(322.5,368.62)",
    d: "M22.5 6.378h15v-30h-30v15h-15l-15-27.756-15 12.756 15 60v-30h15v15z",
  },
  {
    id: "Nueva Ecija",
    transform: "translate(367.5,390)",
    d: "M-7.5-30h30v60h-30V15l-15-30h15z",
  },
  {
    id: "Quezon",
    transform: "translate(442.5,487.5)",
    d: "M-37.5-82.5l15 45 2.232 45 42.768 30v-15h30l-15 15 15 45h-15l-15-30-45-30v15h-30v-15l15-15v-30l-15-15v-30zm30 60v-30l45 30-30-15z",
  },
  {
    id: "Ilocos Norte",
    transform: "translate(352.5,210)",
    d: "M-22.5 15l15-45h30v45l-30 15z",
  },
  {
    id: "Apayao",
    transform: "translate(390,217.5)",
    d: "M-15-37.5l30 30v30l-30 15z",
  },
  {
    id: "Kalinga",
    transform: "translate(390,262.5)",
    d: "M-15-7.5l30-15 15 15v15l-30 15h-30z",
  },
  {
    id: "Cagayan",
    transform: "translate(420,187.5)",
    d: "M0-67.5v15h-15v-15zm30 30l-15 15v-15zm-75 30h15l45 30 15-15v-15l15 15v15l-15 15v30H0l-15-15v-30z",
  },
  {
    id: "Isabela",
    transform: "translate(442.73,292.49)",
    d: "M-22.75-37.49l30.006.035 15.513 15.46 15 15L22.277 37.49l-44.921-.053L-37.77 22.62l14.975-30.067z",
  },
  {
    id: "Mountain Province",
    transform: "translate(390,292.5)",
    d: "M-30-7.5v30l15-15 45-15v-15L0-7.5z",
  },
  {
    id: "Ifugao",
    transform: "translate(390,307.5)",
    d: "M-30 7.5v15l30-15h15l15-30-45 15z",
  },
  {
    id: "Benguet",
    transform: "translate(345,322.5)",
    d: "M0 22.5l-15-15v-15l15-15h15v45z",
  },
  {
    id: "La Union",
    transform: "translate(330,322.5)",
    d: "M0 22.5l-15-15v-30l15 15v15l15 15z",
  },
  {
    id: "Biliran",
    transform: "translate(622.5,697.5)",
    d: "M7.5 7.5v-15h-15z",
  },
  {
    id: "Camiguin",
    transform: "translate(652.5,877.5)",
    d: "M-7.5-7.5v15h15z",
  },
  {
    id: "Davao del Norte",
    transform: "translate(712.5,997.5)",
    d: "M7.5-7.5h15v15l-30 15v-30h-15v-30h30zm-15 45l15-15v15z",
  },
  {
    id: "Guimaras",
    transform: "translate(487.5,772.5)",
    d: "M-7.5 7.5l15-15v15z",
  },
  {
    id: "Ilocos Sur",
    transform: "translate(337.5,270)",
    d: "M7.5-30l-15-15-15 30v45l15 15 15-15h15V15l-30-15z",
  },
  {
    id: "Abra",
    transform: "translate(352.5,255)",
    d: "M-7.5-15l-15 30 30 15 15-30v-30z",
  },
  {
    id: "Masbate",
    transform: "translate(555,630)",
    d: "M-15 0l30-15 30 60v15L0 15l-30 30zm-30-45v-15l30 30z",
  },
  {
    id: "Nueva Vizcaya",
    transform: "translate(382.5,352.5)",
    d: "M22.5-37.5l-15 15v15l15 30-15 15v-30h-30v-30l30-15z",
  },
  {
    id: "Quirino",
    transform: "translate(412.5,345)",
    d: "M-7.5-30l-15 15V0l15 30 30-30v-15h-15z",
  },
  {
    id: "Romblon",
    transform: "translate(465,637.5)",
    d: "M-15 22.5l-15-15v-15l15-15zm45-30v15H15L0-7.5z",
  },
  {
    id: "Siquijor",
    transform: "translate(562.5,877.5)",
    d: "M-7.5 7.5l15-15v15z",
  },
  {
    id: "South Cotabato",
    transform: "translate(660,1102.5)",
    d: "M-30-22.5h45l15 15-15 30v-15h-30l-15-15z",
  },
  {
    id: "Sultan Kudarat",
    transform: "translate(630,1080)",
    d: "M-45-30l30 60V15H0V0h45v-30L30-15H15z",
  },
  {
    id: "Surigao del Norte",
    transform: "translate(716.25,840.25)",
    d: "M-26.25 14.75v-15h30l15 15-15 15v-15zm37.5-29.5l15-15v30z",
  },
  {
    id: "Zamboanga Sibugay",
    transform: "translate(495,997.5)",
    d: "M15 22.5v-30H0l-15 15-15-15 15-15h45v15z",
  },
  {
    id: "Zamboanga del Sur",
    transform: "translate(502.5,990)",
    d: "M37.5-30v-15h15v15h15v15h-15v45l-30-30v-15h-15zm-60 45l-30 30-15-15 30-30z",
  },
];

// Province → Region lookup
const PROVINCE_REGION = {
  "Ilocos Norte": "Region I — Ilocos",
  "Ilocos Sur": "Region I — Ilocos",
  "La Union": "Region I — Ilocos",
  Pangasinan: "Region I — Ilocos",
  Cagayan: "Region II — Cagayan Valley",
  Isabela: "Region II — Cagayan Valley",
  "Nueva Vizcaya": "Region II — Cagayan Valley",
  Quirino: "Region II — Cagayan Valley",
  Batanes: "Region II — Cagayan Valley",
  Aurora: "Region III — Central Luzon",
  Bataan: "Region III — Central Luzon",
  Bulacan: "Region III — Central Luzon",
  "Nueva Ecija": "Region III — Central Luzon",
  Pampanga: "Region III — Central Luzon",
  Tarlac: "Region III — Central Luzon",
  Zambales: "Region III — Central Luzon",
  Batangas: "Region IVA — Calabarzon",
  Cavite: "Region IVA — Calabarzon",
  Laguna: "Region IVA — Calabarzon",
  Quezon: "Region IVA — Calabarzon",
  Rizal: "Region IVA — Calabarzon",
  Marinduque: "MIMAROPA",
  "Occidental Mindoro": "MIMAROPA",
  "Oriental Mindoro": "MIMAROPA",
  Palawan: "MIMAROPA",
  Romblon: "MIMAROPA",
  Albay: "Region V — Bicol",
  "Camarines Norte": "Region V — Bicol",
  "Camarines Sur": "Region V — Bicol",
  Catanduanes: "Region V — Bicol",
  Masbate: "Region V — Bicol",
  Sorsogon: "Region V — Bicol",
  Aklan: "Region VI — Western Visayas",
  Antique: "Region VI — Western Visayas",
  Capiz: "Region VI — Western Visayas",
  Guimaras: "Region VI — Western Visayas",
  Iloilo: "Region VI — Western Visayas",
  "Negros Occidental": "Region VI — Western Visayas",
  Bohol: "Region VII — Central Visayas",
  Cebu: "Region VII — Central Visayas",
  "Negros Oriental": "Region VII — Central Visayas",
  Siquijor: "Region VII — Central Visayas",
  Biliran: "Region VIII — Eastern Visayas",
  "Eastern Samar": "Region VIII — Eastern Visayas",
  Leyte: "Region VIII — Eastern Visayas",
  "Northern Samar": "Region VIII — Eastern Visayas",
  Samar: "Region VIII — Eastern Visayas",
  "Southern Leyte": "Region VIII — Eastern Visayas",
  "Zamboanga del Norte": "Region IX — Zamboanga Peninsula",
  "Zamboanga del Sur": "Region IX — Zamboanga Peninsula",
  "Zamboanga Sibugay": "Region IX — Zamboanga Peninsula",
  Basilan: "Region IX — Zamboanga Peninsula",
  "Agusan del Norte": "Region X — Northern Mindanao",
  Bukidnon: "Region X — Northern Mindanao",
  Camiguin: "Region X — Northern Mindanao",
  "Lanao del Norte": "Region X — Northern Mindanao",
  "Misamis Occidental": "Region X — Northern Mindanao",
  "Misamis Oriental": "Region X — Northern Mindanao",
  "Davao de Oro": "Region XI — Davao Region",
  "Davao del Norte": "Region XI — Davao Region",
  "Davao del Sur": "Region XI — Davao Region",
  "Davao Occidental": "Region XI — Davao Region",
  "Davao Oriental": "Region XI — Davao Region",
  Cotabato: "Region XII — SOCCSKSARGEN",
  Sarangani: "Region XII — SOCCSKSARGEN",
  "South Cotabato": "Region XII — SOCCSKSARGEN",
  "Sultan Kudarat": "Region XII — SOCCSKSARGEN",
  "Metro Manila": "NCR — National Capital Region",
  Abra: "CAR",
  Apayao: "CAR",
  Benguet: "CAR",
  Ifugao: "CAR",
  Kalinga: "CAR",
  "Mountain Province": "CAR",
  "Agusan del Sur": "Region XIII — Caraga",
  "Dinagat Islands": "Region XIII — Caraga",
  "Surigao del Norte": "Region XIII — Caraga",
  "Surigao del Sur": "Region XIII — Caraga",
  "Lanao del Sur": "BARMM",
  "Maguindanao del Norte": "BARMM",
  "Maguindanao del Sur": "BARMM",
  Sulu: "BARMM",
  "Tawi-Tawi": "BARMM",
};
*/

// ── State ──────────────────────────────────────────────────────
let _selectedGroup = null;
let _wasDragging = false;
let _zoom = null;
let _svg = null;
let _g = null;

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

// ── Map init ───────────────────────────────────────────────────
function initMap() {
  const container = document.getElementById("map-wrap");
  const { width, height } = container.getBoundingClientRect();

  _svg = d3.select("#map").attr("width", width).attr("height", height);

  // ── Ocean background: solid base + chevron wave pattern ──────
  const defs = _svg.append("defs");

  // Chevron wave tile: 16×8px, two-tone subtle ripple
  const pat = defs
    .append("pattern")
    .attr("id", "ocean-wave")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 16)
    .attr("height", 8)
    .attr("patternUnits", "userSpaceOnUse");

  // Base fill for the tile (slightly lighter stripe)
  pat
    .append("rect")
    .attr("width", 16)
    .attr("height", 8)
    .attr("fill", "#5087df");

  // Chevron path: /\/\ drawn as a stroke
  pat
    .append("path")
    .attr("d", "M0 6 L4 2 L8 6 L12 2 L16 6")
    .attr("fill", "none")
    .attr("stroke", "#3171e0")
    .attr("stroke-width", 1.3)
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

  // Allow panning up to 40% of the map dimensions off-screen in any direction
  const panPadX = MAP_W * 0.4;
  const panPadY = MAP_H * 0.4;

  _zoom = d3
    .zoom()
    .scaleExtent([initT.k * 0.75, initT.k * 15])
    .translateExtent([
      [-panPadX, -panPadY],
      [MAP_W + panPadX, MAP_H + panPadY],
    ])
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
    })
    .on("end", () => {
      container.classList.remove("is-dragging");
    });

  _svg.call(_zoom).on("dblclick.zoom", null);
  _svg.call(_zoom.transform, initT);
  _svg.on("dblclick", resetZoom);

  // Clicking the ocean (not a province) deselects any selected province
  _svg.on("click.deselect", () => {
    if (_wasDragging) return;
    if (_selectedGroup) {
      d3.select(_selectedGroup).classed("is-selected", false);
      _selectedGroup = null;
      showIdlePanel();
    }
  });

  function zoomBy(factor) {
    _svg.transition().duration(280).call(_zoom.scaleBy, factor);
  }

  function resetZoom() {
    const { width: w, height: h } = container.getBoundingClientRect();
    const t = fitTransform(w, h);
    _zoom.scaleExtent([t.k * 0.75, t.k * 15]);
    _zoom.translateExtent([
      [-panPadX, -panPadY],
      [MAP_W + panPadX, MAP_H + panPadY],
    ]);
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
    _zoom.translateExtent([
      [-panPadX, -panPadY],
      [MAP_W + panPadX, MAP_H + panPadY],
    ]);
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
    showIdlePanel();
    return;
  }

  _selectedGroup = this;
  d3.select(this).classed("is-selected", true).raise();
  showProvinceInfo(d);
}

// ── Sidebar ────────────────────────────────────────────────────
function showIdlePanel() {
  // Build region → sorted provinces map
  const regionMap = {};
  Object.entries(PROVINCE_REGION).forEach(([prov, region]) => {
    if (!regionMap[region]) regionMap[region] = [];
    regionMap[region].push(prov);
  });
  const sortedRegions = Object.keys(regionMap).sort();
  const allProvs = Object.keys(PROVINCE_REGION).sort();

  document.getElementById("info-panel").innerHTML = `
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

function showProvinceInfo(prov) {
  const region = PROVINCE_REGION[prov.id] || "";
  const provFlagSrc = _provFlagUrl(prov.id);
  const regFlagSrc = region ? _regionFlagUrl(region) : null;
  // Use province flag first; if null skip straight to region fallback
  const initialSrc = provFlagSrc ?? regFlagSrc;

  document.getElementById("info-panel").innerHTML = `
    <button class="info-back" aria-label="Back to region list">‹ Back</button>
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
  `;

  document.querySelector(".info-back").addEventListener("click", () => {
    if (_selectedGroup) {
      d3.select(_selectedGroup).classed("is-selected", false);
      _selectedGroup = null;
    }
    showIdlePanel();
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
  initMap();
  showIdlePanel();

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
