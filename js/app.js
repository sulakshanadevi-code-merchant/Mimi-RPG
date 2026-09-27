import { openDatabase, diagnostics, requestPersistentStorage, getAll } from "./database.js";
import {
  bootstrap, dashboard, completeQuest, completeQuestOnDate, completeRecovery, logStudy, logStudyOnDate, logQuantity, logQuantityOnDate, logStudyStart,
  undoQuest, toggleQuest, equipTitle, createQuest, createShopReward, buyShopReward
} from "./game.js";
import { downloadBackup, restoreBackup } from "./backup.js";
import {
  ACHIEVEMENTS, ATTR_LABELS, nextLevelXp, xpForLevel, personalBests, weeklyReport, gameDate, dayState,
  nextGameEvent, achievementProgressFor, nearestAchievements, BALANCE, achievementValue,
  metricQuestDisplayName, goodDoctorTier, greatDisciplineTier, roman,
  nextThresholdProgress, GOOD_DOCTOR_THRESHOLDS, GREAT_DISCIPLINE_THRESHOLDS
} from "./domain.js";
import { runSelfTests } from "./selftest.js";
import { BALANCE as CONFIG } from "./config.js";

const app = document.querySelector("#app");
const navLinks = [...document.querySelectorAll("[data-route]")];
const ASSET = (path) => `./assets/mimi_rpg_ui_asset_pack/${path}`;
const ACH_IMG = (file) => `./assets/achievements/${file}`;
// Achievement icon: uses the dedicated cropped artwork when one exists, emoji otherwise.
function achIconHtml(a, unlocked = true, cls = "ach-ico") {
  if (a?.image) {
    const kind = String(a.image);
    const artType = kind.includes("/milestones/") ? "milestone" : kind.includes("/traits/") ? "trait" : kind.includes("/rank_badges/") ? "rank" : "art";
    return `<img class="${cls} img art-${artType}" src="${ACH_IMG(a.image)}" alt="">`;
  }
  return `<span class="${cls} emoji" aria-hidden="true">${esc(a?.icon || "✦")}</span>`;
}
const STAT_ASSETS = {
  STR: "stats/strength.webp", INT: "stats/intelligence.webp", VIT: "stats/vitality.webp", WIS: "stats/wisdom.webp",
  CHA: "stats/charisma.webp", DISCIPLINE: "stats/discipline.webp", WILLPOWER: "stats/willpower.webp",
  FOCUS: "stats/discipline.webp", COURAGE: "stats/willpower.webp", RESILIENCE: "stats/resilience.webp"
};
const NAV_ASSETS = {
  home: "navigation/home.webp", quests: "navigation/quests.webp", progress: "navigation/progress.webp",
  collection: "navigation/collection.webp", history: "navigation/history.webp", profile: "navigation/profile.webp"
};
const CAT_ICON = {
  Study: "📖", Anki: "▦", Knowledge: "✦", Literature: "📚", Courage: "⚔", Kindness: "♥", Social: "♧",
  "Self-care": "🌿", Fitness: "⚔", "Digital attention": "◈", Organization: "⌂", Punctuality: "⌛",
  Creativity: "✒", Mindfulness: "☾", Nutrition: "◆", Recovery: "↻", Health: "✚", Discipline: "🛡",
  "Personal care": "✿", Focus: "✦", Learning: "📜", Planning: "✦"
};
const attrBars = { STR: "a-str", INT: "a-int", VIT: "a-vit", WIS: "a-wis", CHA: "a-cha", DISCIPLINE: "a-disc", WILLPOWER: "a-will", FOCUS: "a-focus", COURAGE: "a-courage", RESILIENCE: "a-res" };
const ROUTES = ["home", "quests", "progress", "collection", "history", "profile"];
const route = () => ROUTES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (clock = new Date()) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(clock);
const fmtTime = (clock = new Date()) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(clock);
const fmtMinutes = m => {
  m = Number(m || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
};
const catIcon = c => CAT_ICON[c] || "◈";
const meter = (v, max, cls = "") => `<div class="meter ${cls}"><i style="width:${max > 0 ? Math.min(100, Math.round(Number(v || 0) / max * 100)) : 0}%"></i></div>`;

const COLLECTION_GROUPS = [
  { id: "milestones", title: "Milestones", subtitle: "Moments that changed the run", bar: "bars/bar_compass.webp", families: ["first-time", "chapter", "perfection"] },
  { id: "discipline", title: "Discipline & Attention", subtitle: "The habits that protect your focus", bar: "bars/bar_flame.webp", families: ["private-streak"] },
  { id: "attention", title: "Guarded Mind", subtitle: "Attention kept under your control", bar: "bars/bar_brain.webp", families: ["porn-free"] },
  { id: "study", title: "Study & Memory", subtitle: "Scholarship, Anki, and long sessions", bar: "bars/bar_cube.webp", families: ["study-streak", "study-performance", "study-volume", "anki-volume"] },
  { id: "mind", title: "Mindfulness", subtitle: "Stillness and quiet strength", bar: "bars/bar_moon.webp", families: ["meditation-streak", "meditation-volume"] },
  { id: "body", title: "Body & Recovery", subtitle: "Training, nourishment, and returning", bar: "bars/bar_leaf.webp", families: ["nutrition", "fitness", "recovery", "self-care"] },
  { id: "character", title: "Character", subtitle: "Kindness, courage, and presence", bar: "bars/bar_heart.webp", families: ["kindness", "courage", "consistency"] },
  { id: "ranks", title: "Ranks", subtitle: "Named progression lines", bar: "bars/bar_star.webp", families: [], kinds: ["greatDisciplinePoints", "goodDoctorPoints"] }
];
const notice = (s, k = "") => `<div class="notice ${k}">${esc(s)}</div>`;

let db, state;
let collapsed = { random: false, work: false };
let panelMessage = null;
let seenAchievements = new Set();
let currentRewardSequence = false;
let lastRenderedDay = null;
let selectedHomeDate = gameDate();

const clockForGameDate = date => { const [y,m,d] = date.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
const shiftGameDate = (date, days) => { const d = clockForGameDate(date); d.setDate(d.getDate() + days); return gameDate(d); };
const dateBounds = () => {
  const dates = state?.events?.map(e => e.gameDate || e.sourceDate).filter(Boolean) || [];
  dates.push(gameDate());
  return { min: dates.sort()[0], max: gameDate() };
};

async function refresh() {
  const current = gameDate();
  if (!selectedHomeDate || selectedHomeDate > current) selectedHomeDate = current;
  const isHistoricalHome = route() === "home" && selectedHomeDate !== current;
  state = await dashboard(db, route() === "home" ? clockForGameDate(selectedHomeDate) : new Date(), { evaluate: !isHistoricalHome });
  state.viewDate = route() === "home" ? selectedHomeDate : current;
  lastRenderedDay = current;
  render();
}

function titleForCharacter() {
  return state.profile?.title || "Novice Adventurer";
}

function questTargetReward(q) {
  if (q.mode !== "quantity" && q.actionType !== "metric") return q.reward || {};
  const base = q.reward || {};
  // Skin care has explicit quest rewards (10/2 and 20/4). Do not add the
  // underlying quantity-tier table a second time in the preview.
  if (q.metric === "skincare") return { xp: Number(base.xp || 0), gold: Number(base.gold || 0), attributes: base.attributes || {} };
  const target = Number(q.target || 0), tiers = CONFIG.quantity[q.metric] || [];
  const milestone = tiers.filter(t => t.at <= target).reduce((acc, t) => ({ xp: acc.xp + Number(t.xp || 0), gold: acc.gold + Number(t.gold || 0) }), { xp: 0, gold: 0 });
  return { xp: milestone.xp + Number(base.xp || 0), gold: milestone.gold + Number(base.gold || 0), attributes: base.attributes || {} };
}

function questProgressText(q) {
  if (q.missedToday && !q.doneToday) return "⚠ Recorded as missed — tap to correct";
  if (q.mode === "quantity" || q.actionType === "metric") {
    const value = Number(q.progressValue || 0), target = Number(q.progressTarget || q.target || 0);
    const unit = q.unit || (q.metric === "study" || q.metric === "meditation" ? "min" : q.metric === "protein" ? "g" : q.metric === "calories" ? "kcal" : q.metric === "sleep" ? "h" : q.metric === "skincare" ? "x" : "cards");
    return `${value} / ${target} ${unit}`;
  }
  return q.doneToday ? "Task completed" : "Not yet complete";
}

// Points earned so far in each named progression line (for the quest hall header).
function pointsSummary() {
  const p = state.projection;
  const streak = id => p.streaks[id]?.current || 0;
  return [
    { icon: "🛡", label: greatDisciplineTier(p.greatDisciplinePoints), value: p.greatDisciplinePoints, sub: "Great Discipline pts", progress: nextThresholdProgress(Number(p.greatDisciplinePoints||0), GREAT_DISCIPLINE_THRESHOLDS) },
    { icon: "⚕", label: goodDoctorTier(p.goodDoctorPoints), value: p.goodDoctorPoints, sub: "Good Doctor pts", progress: nextThresholdProgress(Number(p.goodDoctorPoints||0), GOOD_DOCTOR_THRESHOLDS) },
    { icon: "🔥", label: "The Hard Road", value: `Day ${streak("daily-no-masturbation")}`, sub: "private streak" },
    { icon: "✧", label: "Clean Attention", value: `Day ${streak("daily-no-porn")}`, sub: "private streak" },
    { icon: "📖", label: "Scholar Streak", value: `${streak("daily-study")} days`, sub: "study" },
    { icon: "🪷", label: "Stillness Streak", value: `${streak("daily-meditation")} days`, sub: "meditation" }
  ];
}

function nextAchievementFor(quest) {
  const p = state.projection;
  const relevant = ACHIEVEMENTS.filter(a => !p.unlockedAchievementIds.includes(a.id)).filter(a => {
    if (quest.category === "Study") return ["studyStreak", "studyMinutes", "goodDoctorPoints", "studySingleSession", "ankiCards"].includes(a.kind);
    if (quest.category === "Mindfulness") return ["meditationStreak", "greatDisciplinePoints", "meditationMinutes"].includes(a.kind);
    if (quest.id === "daily-no-masturbation") return a.kind === "masturbationStreak" || a.kind === "greatDisciplinePoints";
    if (quest.id === "daily-no-porn") return a.kind === "pornStreak";
    if (quest.category === "Kindness") return a.kind === "kindnessActions";
    if (quest.category === "Courage") return a.kind === "courageActions";
    return true;
  });
  const list = relevant.map(a => ({ achievement: a, ...achievementProgressFor(a, p) })).sort((a,b)=>b.ratio-a.ratio||a.remaining-b.remaining);
  return list[0] || nearestAchievements(p, 1)[0] || null;
}

function rewardPreviewHtml(q) {
  const reward = questTargetReward(q);
  const attrs = Object.entries(reward.attributes || {}).filter(([,v]) => Number(v) !== 0).map(([k,v]) => `<span class="reward-attr">+${v} ${esc(ATTR_LABELS[k] || k)}</span>`).join("");
  return `<span class="q-reward"><b>+${reward.xp} XP</b><b>+${reward.gold} G</b>${attrs}</span>`;
}

function questRow(q, kind) {
  const atRisk = !q.doneToday && state.viewDate === gameDate() && kind === "work" && dayState().phase !== "normal";
  const progress = questProgressText(q);
  const isQuantity = q.mode === "quantity" || q.actionType === "metric";
  const reward = questTargetReward(q);
  const privateClass = q.private ? "private-quest" : "";
  const canQuick = isQuantity && !q.doneToday;
  const canUndo = !!q.doneToday && !!q.doneEventId;
  const displayName = isQuantity ? metricQuestDisplayName(q, state.projection) : q.name;
  return `<li class="quest-row ${q.doneToday ? "done" : ""} ${atRisk ? "risk" : ""} ${privateClass}">
    <button class="q-check" ${canUndo ? `data-undo="${esc(q.doneEventId)}"` : `data-complete="${esc(q.id)}"`} aria-label="${canUndo ? "Uncomplete" : "Complete"} ${esc(displayName)}" ${isQuantity && !q.doneToday ? "disabled" : ""}>
      <span class="check ${q.doneToday ? "checked" : "empty"}">${q.doneToday ? "✓" : ""}</span>
    </button>
    <button class="q-body" data-detail="${esc(q.id)}">
      <span class="q-icon">${catIcon(q.category)}</span>
      <span class="q-text"><b>${esc(displayName)}</b><small>${q.doneToday ? "✓ Task completed" : esc(progress)} · ${esc(q.category)}${q.timeTarget ? ` · target ${esc(q.timeTarget)}` : ""}</small></span>
      ${rewardPreviewHtml(q)}
      ${canQuick ? `<span class="mini-stepper" aria-hidden="true"><span>±</span></span>` : ""}
    </button>
  </li>`;
}

function questSection(id, title, subtitle, list, kind, doneCount) {
  const open = !collapsed[id];
  return `<section class="rpg-panel quest-panel ${kind === "work" ? "quest-work" : "quest-random"}">
    <button class="panel-head" data-collapse="${id}" aria-expanded="${open}">
      <span class="panel-orb ${kind}">${kind === "work" ? "☼" : "✧"}</span>
      <span class="ph-text"><b>${title}</b><small>${subtitle}</small></span>
      <span class="ph-count">${doneCount} / ${list.length}</span>
      <span class="chev">${open ? "⌄" : "›"}</span>
    </button>
    ${open ? `<ul class="quest-rows">${list.map(q => questRow(q, kind)).join("") || '<li class="empty-state">No quests remain.</li>'}</ul>` : ""}
  </section>`;
}

function statRows() {
  return Object.entries(state.projection.attributes).map(([k,v]) => `
    <div class="stat-row ${attrBars[k] || ""}">
      <img class="stat-icon" src="${ASSET(STAT_ASSETS[k] || STAT_ASSETS.DISCIPLINE)}" alt="">
      <span class="stat-name">${esc(ATTR_LABELS[k] || k)}</span>
      ${meter(v, Math.max(20, v + 10), "stat-meter")}
      <b>${v}</b>
    </div>`).join("");
}

function recentAchievements() {
  const earned = state.achievements.slice(-6).reverse();
  if (!earned.length) return '<div class="achievement-empty">Your first achievement will appear here.</div>';
  return earned.map(a => {
    const def = ACHIEVEMENTS.find(x => x.id === a.achievementId);
    return `<button class="achievement-medal ${def?.rarity || "common"}" data-route-to="collection" data-ach="${esc(a.achievementId)}" title="${esc(def?.description || "Achievement")}">
      ${def ? achIconHtml(def, true, "medal-gem") : `<span class="medal-gem">✦</span>`}<span>${esc(def?.name || a.name)}</span>
    </button>`;
  }).join("");
}

function home() {
  const p = state.projection;
  const currentDate = gameDate();
  const viewDate = state.viewDate || currentDate;
  const viewingPast = viewDate !== currentDate;
  const clockNow = viewingPast ? clockForGameDate(viewDate) : new Date();
  const next = viewingPast ? null : nextGameEvent(clockNow);
  const phase = viewingPast ? { phase: "history" } : dayState(clockNow);
  const workDone = state.work.filter(q => q.doneToday).length, randomDone = state.randoms.filter(q => q.doneToday).length;
  const unfinished = state.day.unfinishedToday;
  const bounds = dateBounds();
  const warnings = [];
  if (!viewingPast) {
    if (state.day.recovery.available) {
      const task = state.day.recovery.task;
      warnings.push(`<section class="status-box recovery-box"><span class="status-glyph">↻</span><div><b>Your recovery quest is open.</b>${task ? `<p class="recovery-task"><b>Do this now:</b> ${esc(task.title)}<br><small>${esc(task.hint)}</small></p>` : `<p>Your active run can still be brought back. Your historical proof remains.</p>`}</div><button class="rpg-action recovery-action" data-recover>Mark Done</button></section>`);
    } else if (phase.phase === "warning" && unfinished > 0) {
      warnings.push(`<section class="status-box risk-box"><span class="status-glyph">⚠</span><div><b>Daily work is at risk.</b><p>It's after 7 PM. Finish the remaining work before 9 PM to avoid entering the recovery window.</p></div><button class="rpg-action" data-jump="work">View Work</button></section>`);
    } else if (phase.phase === "recovery" && unfinished === 0) {
      warnings.push(`<section class="status-box calm-box"><span class="status-glyph">☾</span><div><b>The day's work is complete.</b><p>Rest. A new realm-day begins at midnight.</p></div></section>`);
    }
  }
  const levelFloor = p.level <= 1 ? 0 : xpForLevel(p.level);
  const levelCeil = nextLevelXp(p.currentXp);
  const xpPercent = Math.max(0, Math.min(100, Math.round(((p.currentXp - levelFloor) / Math.max(1, levelCeil - levelFloor)) * 100)));
  return `<div class="world-scene">
    ${viewingPast ? `<section class="home-date-nav rpg-panel"><button class="date-step" data-date-step="-1" ${viewDate<=bounds.min?'disabled':''}>‹</button><div class="home-date-copy"><span class="eyebrow">Chronicle date</span><strong>${esc(fmtDate(clockNow))}</strong><small>Historical tally — changes here are added to the ledger and affect your totals.</small></div><input type="date" data-home-date value="${esc(viewDate)}" min="${esc(bounds.min)}" max="${esc(bounds.max)}"><button class="date-step" data-date-step="1" ${viewDate>=bounds.max?'disabled':''}>›</button><button class="date-today" data-date-today>Today</button></section>` : `<section class="home-date-nav rpg-panel"><button class="date-step" data-date-step="-1" ${viewDate<=bounds.min?'disabled':''}>‹</button><div class="home-date-copy"><span class="eyebrow">Today</span><strong>${esc(fmtDate(clockNow))}</strong><small>Switch dates to review or correct an older realm-day.</small></div><input type="date" data-home-date value="${esc(viewDate)}" min="${esc(bounds.min)}" max="${esc(bounds.max)}"><button class="date-step" data-date-step="1" disabled>›</button></section>`}
    <section class="hero-hud">
      <div class="character-art-wrap"><div class="character-halo"></div><img class="character-art" src="${ASSET("character/mimi-portrait.webp")}" alt="Mimi character portrait"><span class="character-level">LV. ${p.level}</span></div>
      <div class="character-info rpg-panel glass-dark"><div class="character-name-row"><div><p class="eyebrow">Adventurer</p><h1>${esc(state.profile?.name || "Mimi")}</h1><p class="character-title">${esc(titleForCharacter())}</p></div><span class="gold-pill">✦ ${p.gold}</span></div>
        <div class="xp-title"><span>Character XP</span><b>${p.currentXp.toLocaleString()} / ${levelCeil.toLocaleString()}</b></div>
        <div class="xp-track" role="progressbar" aria-label="Character XP progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${xpPercent}"><i style="width:${xpPercent}%"></i><span></span></div>
        <p class="character-quote">“A better me, one day at a time.”</p></div>
      <section class="stats-card rpg-panel glass-dark"><div class="panel-title"><span>Attributes</span><small>Character</small></div>${statRows()}</section>
      <section class="meta-card rpg-panel glass-dark"><div class="meta-tile"><span class="meta-icon">✦</span><b>${state.achievements.length}</b><small>Achievements</small></div><div class="meta-tile"><span class="meta-icon">♛</span><b>${new Set(p.unlockedTitleIds).size}</b><small>Titles</small></div><div class="meta-tile"><span class="meta-icon">✧</span><b>${p.greatDisciplinePoints}</b><small>Discipline pts</small></div></section>
    </section>
    <section class="achievement-board rpg-panel"><div class="board-heading"><div><p class="eyebrow">Permanent proof</p><h2>Recent Achievements</h2></div><a href="#collection">View all →</a></div><div class="achievement-strip">${recentAchievements()}</div></section>
    <section class="datetime-grid"><div class="date-box asset-box"><span class="eyebrow">Realm day</span><strong>${esc(fmtDate(clockNow))}</strong></div>${viewingPast ? `<div class="clock-box asset-box"><span class="moon-disc">◈</span><div><span class="eyebrow">Archive</span><strong>Historical view</strong><small>Tap a quest to tally or correct it.</small></div></div><div class="next-event-box asset-box"><span class="eyebrow">Quest ledger</span><strong>${workDone + randomDone} actions recorded</strong><small>Reconcile anything missed.</small></div>` : `<div class="clock-box asset-box"><span class="moon-disc">☾</span><div><span class="eyebrow">Local time</span><strong id="live-clock">${esc(fmtTime(clockNow))}</strong></div></div><div class="next-event-box asset-box"><span class="eyebrow">Next event</span><strong>${esc(next.label)}</strong><small>in <b class="clock-next">${esc(next.inText)}</b></small></div>`}</section>
    ${warnings.join("")}
    <div id="work-anchor"></div>
    ${questSection("work", "Daily Work Quests", viewingPast ? "Historical tally — click a quest to reconcile the day." : "The foundation of a stronger tomorrow.", state.work, "work", workDone)}
    ${questSection("random", "Daily Random Quests", viewingPast ? "Random contracts from this realm-day.": "Finite opportunities chosen by the day's seed.", state.randoms, "random", randomDone)}
    ${viewingPast ? "" : `<section class="rpg-panel quick-log-panel"><div class="panel-title"><span>Quick Measure</span><small>Record without leaving Today</small></div><div class="quick-log-grid">${quickLogButton("daily-study", "📖", "Study", "daily-study", fmtMinutes(state.work.find(q=>q.id==="daily-study")?.progressValue || 0))}${quickLogButton("daily-meditation", "☾", "Meditation", "daily-meditation", `${state.work.find(q=>q.id==="daily-meditation")?.progressValue || 0} min`)}${quickLogButton("daily-protein", "◆", "Protein", "daily-protein", `${state.work.find(q=>q.id==="daily-protein")?.progressValue || 0} g`)}${quickLogButton("daily-anki", "▦", "Anki", "daily-anki", `${state.work.find(q=>q.id==="daily-anki")?.progressValue || 0} cards`)}${quickLogButton("daily-skin-1", "🌿", "Skin Care", "daily-skin-1", `${state.work.find(q=>q.id==="daily-skin-1")?.progressValue || 0}×`)}</div><p class="muted quick-note">Rewards scale with what you log — tap a card to record an amount.</p></section>`}
  </div>`;
}
function quickLogButton(questId, symbol, label, metric, valueText) {
  const q = state.work.find(x => x.id === questId);
  const done = !!q?.doneToday;
  return `<button data-detail="${questId}" class="${done ? "quick-done" : ""}">
    <span class="quick-symbol">${done ? "✓" : symbol}</span><b>${label}</b>
    <small>${done ? "Task completed" : valueText}</small></button>`;
}

function quests() {
  const rows = state.quests.filter(q => q.kind === "daily" || q.kind === "quest" || q.kind === "study_start").map(q => `
    <div class="quest-admin-row"><div><b>${catIcon(q.category)} ${esc(q.name)}</b><small>${q.kind === "daily" ? "Daily work" : q.recurring ? "Recurring" : "One-time"}${q.enabled === false ? " · disabled" : ""}</small></div>
      ${q.kind === "daily" ? `<label class="switch"><input type="checkbox" data-toggle="${esc(q.id)}" ${q.enabled !== false ? "checked" : ""}><i></i></label>` : ""}
    </div>`).join("");
  return `<div class="page-scene">${pageHeader("Quest Hall", "Quests", "Your contracts, routines, and optional adventures.")}
    <section class="rpg-panel points-header"><div class="panel-title"><span>Progression Points</span><small>Everything you have banked</small></div>
      <div class="points-grid">${pointsSummary().map(pt => `
        <div class="point-tile"><span class="point-icon">${pt.icon}</span><div><b>${esc(String(pt.value))}</b><span class="point-name">${esc(pt.label)}</span><small>${esc(pt.sub)}</small>${pt.progress ? `<div class="point-meter"><i style="width:${Math.round(pt.progress.ratio*100)}%"></i></div><em>${esc(pt.progress.label)}</em>` : ""}</div></div>`).join("")}
      </div>
    </section>
    <section class="rpg-panel">${rows}</section>
    <section class="rpg-panel"><div class="panel-title"><span>Create a quest</span><small>Optional custom content</small></div>
      <form data-quest class="form-grid"><input name="name" maxlength="80" placeholder="Quest name" required><select name="category">${["Discipline","Health","Study","Fitness","Personal care","Kindness","Courage","Creativity","Mindfulness"].map(c=>`<option>${c}</option>`).join("")}</select>
      <label class="checkline"><input name="recurring" type="checkbox" checked> Daily recurring</label><div class="form-pair"><input name="xp" type="number" min="1" value="20" aria-label="XP reward"><input name="gold" type="number" min="0" value="5" aria-label="Gold reward"></div><button class="rpg-action">Create quest</button></form></section>
  </div>`;
}

function pageHeader(eyebrow, title, text) { return `<section class="page-header"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(text)}</p></section>`; }

function progress() {
  const p = state.projection, bests = personalBests(state.events), week = weeklyReport(state.events);
  const stats = Object.entries(p.attributes).map(([k,v]) => `<div class="stat-big"><img src="${ASSET(STAT_ASSETS[k] || STAT_ASSETS.DISCIPLINE)}" alt=""><div><span>${esc(ATTR_LABELS[k] || k)}</span><b>${v}</b>${meter(v, Math.max(20, v + 10), attrBars[k] || "")}</div></div>`).join("");
  const metric = (label, value, unit="") => `<div class="metric-tile"><span>${esc(label)}</span><b>${value}${unit}</b></div>`;
  return `<div class="page-scene">${pageHeader("Character Hall", "Progress", "The ledger of what Mimi has actually done.")}
    <section class="rpg-panel stats-grid">${stats}</section>
    <section class="rpg-panel"><div class="panel-title"><span>Lifetime</span><small>Measured proof</small></div><div class="metric-grid">
      ${metric("Character XP", p.lifetimeXp.toLocaleString())}${metric("Gold", p.gold.toLocaleString())}${metric("Study", fmtMinutes(p.totals.studyMinutes))}${metric("Study sessions", p.totals.studySessions)}${metric("Anki cards", p.metricTotals.anki || 0)}${metric("Meditation", `${p.metricTotals.meditation || 0}`, " min")}${metric("Exercise sessions", p.totals.exerciseSessions)}${metric("Protein target days", p.totals.proteinDays)}${metric("Recoveries", p.totals.recoveries)}${metric("Great Discipline", p.greatDisciplinePoints)}${metric("Good Doctor", p.goodDoctorPoints)}${metric("Perfect days", p.perfectSoldierDays)}
    </div></section>
    <section class="rpg-panel"><div class="panel-title"><span>Personal Records</span><small>Beat yesterday, not someone else</small></div><div class="metric-grid">
      ${metric("Longest study session", fmtMinutes(bests.longestStudySessionMinutes))}${metric("Most Anki/day", bests.mostAnkiCardsInOneDay)}${metric("Most actions/day", bests.mostActionsInOneDay)}
      ${metric("Current week study", fmtMinutes(week.studyMinutes))}${metric("Week workouts", week.fitness)}${metric("Week meditation", `${week.meditation} min`)}${metric("Week active days", week.activeDays)}
    </div></section>
  </div>`;
}

function streakQuestIdForKind(kind) {
  return { studyStreak: "daily-study", meditationStreak: "daily-meditation", masturbationStreak: "daily-no-masturbation", pornStreak: "daily-no-porn" }[kind] || null;
}
function achievementState(a, unlock) {
  if (!unlock) return "locked";
  const qid = streakQuestIdForKind(a.kind);
  if (!qid) return "earned";
  const current = state.projection.streaks[qid]?.current || 0;
  return current >= a.threshold ? "active" : "fallen";
}

function collection() {
  const got = new Map(state.achievements.map(a => [a.achievementId, a]));

  const cardsFor = (familyList = [], kindList = []) => ACHIEVEMENTS
    .filter(a => familyList.includes(a.family) || kindList.includes(a.kind))
    .map(a => {
      const unlock = got.get(a.id);
      const progressInfo = achievementProgressFor(a, state.projection);
      const ratio = Math.round(progressInfo.ratio * 100);
      const status = achievementState(a, unlock);
      const badge = unlock && ["active", "fallen"].includes(status)
        ? `<span class="achievement-status ${status}">${status}</span>`
        : "";
      return `<article class="collection-card ${unlock ? "unlocked" : "locked"} ${a.rarity} ${status} ${a.image ? "has-art" : "emoji-card"}"
          data-ach="${esc(a.id)}" role="button" tabindex="0">
        <div class="collection-art">${achIconHtml(a, !!unlock, "collection-medal")}</div>
        <div class="collection-copy">
          <h2>${esc(a.name)} ${badge}</h2>
          <div class="tiny-progress">${meter(progressInfo.current, progressInfo.target)}</div>
          <p>${a.kind === "goodDoctorPoints" || a.kind === "greatDisciplinePoints" ? (progressInfo.current >= progressInfo.target ? "Tier reached" : `${progressInfo.remaining.toLocaleString()} points till next tier`) : esc(a.description)}</p>
          <small>${esc(a.rarity)}${unlock ? ` · ${esc((unlock.unlockedAt || "").slice(0,10))}` : ` · ${ratio}%`}</small>
        </div>
      </article>`;
    }).join("");

  const groups = COLLECTION_GROUPS.map(group => {
    const groupAchievements = ACHIEVEMENTS.filter(a => (group.families || []).includes(a.family) || (group.kinds || []).includes(a.kind));
    const unlocked = groupAchievements.filter(a => got.has(a.id)).length;
    const total = groupAchievements.length;
    if (!total) return "";
    return `<section class="collection-path">
      <div class="collection-heading">
        <div class="collection-heading-copy"><span class="collection-bar-eyebrow">${esc(group.subtitle)}</span><strong>${esc(group.title)}</strong><b>${unlocked} / ${total}</b></div>
        <div class="collection-bar" aria-hidden="true"><img src="${ACH_IMG(group.bar)}" alt=""></div>
      </div>
      <div class="collection-grid">${cardsFor(group.families, group.kinds)}</div>
    </section>`;
  }).join("");

  const titles = [...new Set(state.projection.unlockedTitleIds)]
    .map(t => `<div class="line"><span>🏷️ ${esc(t)}</span><button class="${state.profile?.title === t ? "active" : "ghost"}" data-equip="${esc(t)}">${state.profile?.title === t ? "Equipped" : "Equip"}</button></div>`)
    .join("") || '<p class="muted">Earn titles through achievements.</p>';

  const shop = state.shop
    .map(i => `<div class="line"><span>🎁 ${esc(i.name)}<small>${i.cost} gold</small></span><button data-buy="${esc(i.id)}">Claim</button></div>`)
    .join("") || '<p class="muted">No optional rewards yet.</p>';

  return `<div class="collection-page page-scene">
    ${pageHeader("Constellation of Proof", "Collection", "Milestones, ranks, and the small victories that stay with you.")}
    <section class="collection-intro">
      <span class="collection-sigil">✦</span>
      <div><b>${state.achievements.length} achievements recorded</b><small>Every card is a piece of your run. Locked cards remain visible as future paths.</small></div>
    </section>
    ${groups}
    <section class="collection-panel">
      <div class="panel-title"><span>🏷️ Titles</span><small>One active title</small></div>${titles}
    </section>
    <section class="collection-panel">
      <div class="panel-title"><span>🎁 Reward Shop</span><small>Optional leisure only</small></div>
      ${shop}
      <form data-shop class="inline-form"><input name="name" maxlength="80" placeholder="Optional leisure reward" required><input name="cost" type="number" min="1" placeholder="Gold" required><button>Add</button></form>
      <small class="muted">Food, medication, medical care, hygiene, sleep, and other necessities can never be locked behind gold.</small>
    </section>
  </div>`;
}

function history() {
  const rows = state.events.slice(0, 120).map(e => {
    const icon = { quest_completed: "✦", study_completed: "📖", quantity_logged: "◈", recovery_completed: "↻", run_fallen: "✖", achievement_unlocked: "🏆", quest_undone: "↺", shop_purchased: "🪙", daily_missed: "⚠" }[e.type] || "·";
    const name = { daily_missed: `Missed: ${e.questName}`, recovery_completed: "Recovery completed", achievement_unlocked: `Achievement: ${e.achievementName}`, study_completed: `Study — ${fmtMinutes(e.minutes)}`, quantity_logged: `${e.metric} +${e.amount}`, run_fallen: `Active run fell — ${e.sourceDate}`, shop_purchased: `Reward claimed — ${e.itemName}` }[e.type] || e.questName || e.type.replaceAll("_", " ");
    const canCorrect = ["quest_completed","study_completed","study_started","quantity_logged"].includes(e.type);
    return `<article class="history-row"><span class="history-icon">${icon}</span><div><b>${esc(name)}</b><small>${esc(e.gameDate || "")} · ${esc(e.category || "system")}</small></div>${canCorrect ? `<button class="text-button" data-undo="${esc(e.id)}">Correct</button>` : ""}</article>`;
  }).join("") || '<p class="empty-state">The chronicle is waiting.</p>';
  return `<div class="page-scene">${pageHeader("Chronicle", "History", "Every meaningful change has a recorded reason.")}<section class="rpg-panel history-list">${rows}</section></div>`;
}

function profile() {
  const settings = state.settings || {};
  return `<div class="page-scene">${pageHeader("Character", "Profile", "Keep your name, save files, and local configuration under your control.")}
    <section class="rpg-panel"><div class="panel-title"><span>Character</span><small>Identity</small></div><form data-profile class="form-grid"><input name="name" maxlength="40" placeholder="Character name" value="${esc(state.profile?.name || "")}" required><button>Save name</button></form></section>
    <section class="rpg-panel"><div class="panel-title"><span>Save data</span><small>Local-first</small></div><div class="button-row"><button data-export>Export save</button><label class="file-button">Import save<input data-import type="file" accept="application/json,.json" hidden></label></div><p class="muted">Export a backup before major changes. Import replaces this device after validation and makes a pre-import backup.</p></section>
    <section class="rpg-panel"><div class="panel-title"><span>Integrity</span><small>Diagnostics</small></div><div id="diagnostics">${panelMessage ? notice(panelMessage.text, panelMessage.kind) : "Run a diagnostic to inspect stored relationships."}</div><div class="button-row"><button data-diagnostics>Run diagnostic</button><button data-tests>Run self-tests</button></div></section>
    <section class="rpg-panel"><div class="panel-title"><span>Game configuration</span><small>Provisional</small></div>
      <div class="settings-grid"><div><span>Study target</span><b>${settings.targets?.study ?? CONFIG.targets.study} min</b></div><div><span>Meditation target</span><b>${settings.targets?.meditation ?? CONFIG.targets.meditation} min</b></div><div><span>Protein target</span><b>${settings.targets?.protein ?? CONFIG.targets.protein} g</b></div><div><span>Calories</span><b>${settings.targets?.calories ?? CONFIG.targets.calories} kcal</b></div><div><span>Anki</span><b>${settings.targets?.anki ?? CONFIG.targets.anki} cards</b></div><div><span>Wake target</span><b>${String(settings.targets?.wakeHour ?? CONFIG.targets.wakeHour).padStart(2,"0")}:00</b></div></div>
    </section>
  </div>`;
}

function render() {
  // Hash changes can fire while the asynchronous local database is still loading.
  // Do not render any route until the dashboard state exists.
  if (!state) return;
  const r = route();
  document.title = `${r[0].toUpperCase() + r.slice(1)} — Mimi`;
  document.body.classList.toggle("collection-route", r === "collection");
  const renderer = { home, quests, progress, collection, history, profile }[r];
  app.innerHTML = renderer();
  navLinks.forEach(a => a.classList.toggle("is-active", a.dataset.route === r));
}

function closeQuestModal() { document.querySelector(".quest-modal-backdrop")?.remove(); }

function metricQuickValues(q) {
  if (q.metric === "study") return [10, 30, 60, 120, 180];
  if (q.metric === "meditation") return [5, 10, 20, 30];
  if (q.metric === "protein") return [30, 60, 80, 90, 120];
  if (q.metric === "calories") return [500, 1000, 1500, 2000, 2800];
  if (q.metric === "anki") return [25, 50, 100, 200];
  if (q.metric === "sleep") return [6, 7, 8, 9];
  if (q.metric === "skincare") return [1, 2];
  return [10, 30, 60];
}
function metricUnit(metric) { return metric === "study" || metric === "meditation" ? "min" : metric === "protein" ? "g" : metric === "calories" ? "kcal" : metric === "sleep" ? "hours" : metric === "skincare" ? "times" : "cards"; }

function estimateRewardForAmount(q, amount) {
  const metric = q.metric, current = Number(q.progressValue || 0), after = current + amount;
  const tiers = CONFIG.quantity[metric] || [];
  const gained = tiers.filter(t => current < t.at && after >= t.at);
  const PA = CONFIG.pointAwards || {};
  let goodDoctor = 0, greatDiscipline = 0;
  if (metric === "study") goodDoctor = (Math.floor(after / 60) - Math.floor(current / 60)) * (PA.studyGoodDoctorPerHour || 0);
  if (metric === "anki") goodDoctor = (Math.floor(after / 25) - Math.floor(current / 25)) * (PA.ankiGoodDoctorPer25 || 0);
  if (metric === "meditation") greatDiscipline = (Math.floor(after / 20) - Math.floor(current / 20)) * (PA.meditationGreatDisciplinePer20Min || 0);
  return {
    xp: gained.reduce((s, t) => s + Number(t.xp || 0), 0),
    gold: gained.reduce((s, t) => s + Number(t.gold || 0), 0),
    goodDoctor, greatDiscipline
  };
}

function questModal(q) {
  const reward = questTargetReward(q), next = nextAchievementFor(q), isMetric = q.mode === "quantity" || q.actionType === "metric";
  closeQuestModal();
  const current = Number(q.progressValue || 0), target = Number(q.progressTarget || q.target || 0), unit = metricUnit(q.metric);
  const defaultValue = isMetric ? (q.metric === "study" ? 30 : q.metric === "meditation" ? 10 : q.metric === "protein" ? Math.max(0, target - current) : q.metric === "calories" ? Math.max(0, target - current) : q.metric === "anki" ? 25 : q.metric === "sleep" ? Math.max(0, target - current) : 1) : 1;
  const attrs = Object.entries(reward.attributes || {}).filter(([,v])=>Number(v)!==0).map(([k,v])=>`<span class="reward-attr">+${v} ${esc(ATTR_LABELS[k]||k)}</span>`).join("");
  const doneBlock = q.doneToday ? `<div class="task-completed-block"><span class="done-gem">✓</span><div><b>Task completed</b><small>This quest is recorded for ${esc(state.viewDate || gameDate())}.</small></div></div>` : q.missedToday ? `<div class="task-completed-block missed"><span class="done-gem">⚠</span><div><b>Recorded as missed</b><small>Complete it now to correct this historical day and restore its reward.</small></div></div>` : "";
  const displayName = isMetric ? metricQuestDisplayName(q, state.projection) : q.name;
  const div = document.createElement("div");
  div.className = "quest-modal-backdrop";
  div.innerHTML = `<div class="quest-modal rpg-panel" role="dialog" aria-modal="true">
    <div class="modal-frame-top"><span class="eyebrow">${esc(q.category)} · ${q.kind === "random" ? "Random quest" : q.kind === "daily" ? "Daily work" : "Quest"}</span><button class="close-modal" data-close>×</button></div>
    <h2>${esc(displayName)}</h2>
    <p class="modal-description">${q.private ? "Private self-report goal. Keep this information on your device." : "A concrete action that becomes part of Mimi's history."}</p>
    ${doneBlock}
    ${isMetric ? `<div class="modal-progress"><span>Today's progress</span><b>${esc(questProgressText(q))}</b>${meter(current, target || Math.max(current, 1))}</div>
      <div class="quantity-editor"><button type="button" data-qminus>−</button><input id="quest-amount" type="number" min="0.1" step="0.1" value="${defaultValue}" aria-label="Amount"><span>${unit}</span><button type="button" data-qplus>+</button></div>
      <div class="quick-selects">${metricQuickValues(q).map(v=>`<button type="button" data-qquick="${v}">${v}${unit === "min" ? "m" : unit === "hours" ? "h" : unit === "times" ? "×" : unit}</button>`).join("")}</div>` : `<div class="modal-progress simple"><span>Current state</span><b>${q.doneToday ? "Task completed" : "Incomplete"}</b></div>`}
    <div class="reward-preview"><p class="eyebrow">What this will increase</p><div class="reward-line" id="reward-line"><b>+${reward.xp} XP</b><b>+${reward.gold} Gold</b>${attrs}</div></div>
    ${next ? `<div class="achievement-proximity"><p class="eyebrow">Next achievement</p><b>${esc(next.achievement.name)}</b><span>${Math.min(next.current, next.target)} / ${next.target} · ${Math.round(next.ratio*100)}%</span></div>` : ""}
    <div class="modal-actions"><button class="ghost" data-close>Close</button>${q.doneToday ? `<button class="ghost danger-action" data-modal-undo="${esc(q.doneEventId || "")}">Uncomplete</button><span class="completed-note">✓ Recorded</span>` : isMetric ? `<button class="rpg-action" data-modal-log="${esc(q.id)}">Record ${unit}</button>` : `<button class="rpg-action" data-modal-complete="${esc(q.id)}">${q.kind === "study_start" ? "Begin" : "Complete"}</button>`}</div>
  </div>`;
  // Live scaled reward preview: the estimate grows with the logged amount.
  div.addEventListener("input", () => {
    const input = div.querySelector("#quest-amount"); if (!input || !isMetric) return;
    const est = estimateRewardForAmount(q, Math.max(0, Number(input.value) || 0));
    const line = div.querySelector("#reward-line");
    if (line) line.innerHTML = `<b>+${est.xp} XP</b><b>+${est.gold} Gold</b>${est.goodDoctor ? `<span class="reward-attr gold-chip">+${est.goodDoctor} Good Doctor</span>` : ""}${est.greatDiscipline ? `<span class="reward-attr purple-chip">+${est.greatDiscipline} Great Discipline</span>` : ""}${attrs}`;
  });
  div.addEventListener("click", e => {
    if (e.target === div || e.target.closest("[data-close]")) div.remove();
    const quick = e.target.closest("[data-qquick]"); if (quick) { const inp = div.querySelector("#quest-amount"); inp.value = quick.dataset.qquick; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    const plus = e.target.closest("[data-qplus]"); if (plus) adjustQuestAmount(div, q, 1);
    const minus = e.target.closest("[data-qminus]"); if (minus) adjustQuestAmount(div, q, -1);
    const c = e.target.closest("[data-modal-complete]"); if (c) { div.remove(); performAction(() => state.viewDate === gameDate() ? completeQuest(db, c.dataset.modalComplete) : completeQuestOnDate(db, c.dataset.modalComplete, state.viewDate)); }
    const u = e.target.closest("[data-modal-undo]"); if (u?.dataset.modalUndo) { div.remove(); performAction(() => undoQuest(db, u.dataset.modalUndo)); }
    const l = e.target.closest("[data-modal-log]"); if (l) {
      const amount = Number(div.querySelector("#quest-amount")?.value || 0); if (!amount) return;
      div.remove(); performAction(() => q.metric === "study" ? (state.viewDate === gameDate() ? logStudy(db, amount) : logStudyOnDate(db, amount, state.viewDate)) : (state.viewDate === gameDate() ? logQuantity(db, q.metric, amount) : logQuantityOnDate(db, q.metric, amount, state.viewDate)));
    }
  });
  document.body.appendChild(div);
}
function adjustQuestAmount(div, q, direction) {
  const input = div.querySelector("#quest-amount"); if (!input) return;
  const step = q.metric === "study" ? 10 : q.metric === "meditation" ? 5 : q.metric === "protein" ? 5 : q.metric === "calories" ? 100 : q.metric === "anki" ? 5 : q.metric === "sleep" ? 0.5 : q.metric === "water" ? 0.25 : 1;
  input.value = Math.max(0, Number(input.value || 0) + step * direction);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// ---- Achievement detail dialog -------------------------------------------
const FAMILY_MEANING = {
  "first-time": "Every long road begins with one honest step. This one is yours.",
  "chapter": "Presence is the root skill — showing up is already the win.",
  "perfection": "A complete day is built from many small kept promises.",
  "private-streak": "This path is private, and it is measured in days of quiet strength.",
  "study-streak": "Knowledge compounds like interest; every studied day pays forward.",
  "meditation-streak": "A trained mind is a shelter you carry everywhere.",
  "point": "These points are earned through repeated, measured effort.",
  "study-volume": "Hours in the book become instinct at the bedside.",
  "study-performance": "Deep focus is a trainable superpower.",
  "anki-volume": "Memory is forged, not given.",
  "meditation-volume": "Stillness, accumulated.",
  nutrition: "A well-fueled body makes every other quest easier.",
  fitness: "Strength is stored confidence.",
  kindness: "A stronger character is a kinder one.",
  courage: "Courage is action despite the fear, not the absence of it.",
  recovery: "Returning is a skill — maybe the most important one.",
  consistency: "Consistency beats intensity."
};
function howToText(a) {
  const unit = { studyStreak: "days of study streak", meditationStreak: "days of meditation streak", masturbationStreak: "days on this private path", pornStreak: "days of clean attention", goodDoctorPoints: "Good Doctor points", greatDisciplinePoints: "Great Discipline points", ankiCards: "Anki cards solved", studyMinutes: "minutes studied", meditationMinutes: "minutes meditated", proteinDays: "protein target days", exerciseSessions: "training sessions", perfectSoldierStreak: "perfect days in a row", perfectSoldierDays: "perfect days", perfectCommanderDays: "holy-peak days", kindnessActions: "kindness actions", courageActions: "acts of courage", recoveryCount: "recovery quests completed", activeDays: "active days", completedTotal: "quests completed" }[a.kind] || "progress";
  return `Reach ${Number(a.threshold).toLocaleString()} ${unit}.`;
}
function achievementDialog(a) {
  const unlock = state.achievements.find(x => x.achievementId === a.id);
  const progress = achievementProgressFor(a, state.projection);
  const family = ACHIEVEMENTS.filter(x => x.family === a.family).sort((x, y) => x.tier - y.tier);
  const idx = family.findIndex(x => x.id === a.id);
  const nextTier = family[idx + 1] || null;
  const prevTier = idx > 0 ? family[idx - 1] : null;
  document.querySelector(".ach-dialog-backdrop")?.remove();
  const div = document.createElement("div");
  div.className = "ach-dialog-backdrop";
  div.innerHTML = `<div class="ach-dialog rpg-panel" role="dialog" aria-modal="true">
    <div class="modal-frame-top"><span class="eyebrow">${esc(a.family)} · tier ${a.tier} · ${a.rarity}</span><button class="close-modal" data-close>×</button></div>
    <div class="ach-dialog-hero ${unlock ? "earned" : ""}">${achIconHtml(a, !!unlock, "ach-dialog-medal")}</div>
    <h2>${esc(a.name)}</h2>
    <p class="ach-dialog-desc">${esc(a.description)}</p>
    <div class="ach-dialog-grid">
      <div><span class="eyebrow">How to earn it</span><p>${esc(howToText(a))}</p></div>
      <div><span class="eyebrow">What it means</span><p>${esc(FAMILY_MEANING[a.family] || "Proof of consistent real-world effort.")}</p></div>
      <div><span class="eyebrow">${unlock ? "Earned on" : "Progress"}</span><p>${unlock ? esc((unlock.unlockedAt || "").slice(0, 10)) : `${progress.current.toLocaleString()} / ${progress.target.toLocaleString()} (${Math.round(progress.ratio * 100)}%)`}</p>${!unlock ? meter(progress.current, progress.target, "ach-dialog-meter") : ""}</div>
      <div><span class="eyebrow">Path</span><p>${prevTier ? `${esc(prevTier.name)} → ` : ""}<b>${esc(a.name)}</b>${nextTier ? ` → ${esc(nextTier.name)}` : " (final tier)"}</p></div>
      ${nextTier ? `<div class="ach-next"><span class="eyebrow">Next tier</span><div>${achIconHtml(nextTier, false, "ach-next-medal")}<div><b>${esc(nextTier.name)}</b><small>${esc(howToText(nextTier))}</small></div></div></div>` : ""}
    </div>
    <div class="modal-actions"><button class="ghost" data-close>Close</button></div>
  </div>`;
  div.addEventListener("click", e => { if (e.target === div || e.target.closest("[data-close]")) div.remove(); });
  document.body.appendChild(div);
}

async function performAction(fn) {
  if (currentRewardSequence) return;
  const before = structuredClone(state?.projection || {});
  try {
    const result = await fn();
    await refresh();
    if (result?.projection) await playCompletionSequence(result, before, state.projection);
  } catch (e) {
    app.insertAdjacentHTML("afterbegin", notice(e.message, "error"));
  }
}

function completionMotivation(result, delta) {
  const lines = [
    "We are proud of you, Mimi.",
    "You kept a promise to yourself.",
    "That counted. Mimi showed up.",
    "One more piece of proof.",
    "You are building this one action at a time.",
    "Future Mimi will inherit this choice."
  ];
  if (delta.greatDisciplinePoints > 0) return "Discipline is being built, one proof at a time.";
  if (delta.goodDoctorPoints > 0) return "A little more knowledge, a little more capable.";
  if (result.quest?.category === "Kindness") return "A stronger character is a kinder one.";
  return lines[Math.floor(Math.random()*lines.length)];
}

function renderRewardOverlay(stage, result, delta, after) {
  const overlay = document.querySelector(".reward-sequence");
  if (!overlay) return;
  const next = nearestAchievements(after, 2);
  const fresh = result.fresh || [];
  const questName = result.quest?.name || "Action";
  const continueBtn = `<button class="rpg-action reward-continue" data-reward-next>${stage === 4 ? "Finish" : "Continue"}</button><small class="stage-hint">${stage} / 4</small>`;
  if (stage === 1) {
    const attrs = Object.entries(delta.attributes || {}).filter(([,v])=>v!==0).map(([k,v])=>`<div class="gain-stat"><img src="${ASSET(STAT_ASSETS[k] || STAT_ASSETS.DISCIPLINE)}" alt=""><span>${esc(ATTR_LABELS[k] || k)}</span><b>${v>0?"+":""}${v}</b></div>`).join("");
    overlay.innerHTML = `<div class="reward-card stage-one tarot-scene"><div class="reward-rays"></div><div class="tarot-particles">${tarotParticles()}</div><div class="reward-card-inner"><div class="reward-kicker">${esc(questName)} complete</div><div class="reward-icon big">✦</div><h2>Proof Recorded</h2><div class="big-gain"><span>+</span><b data-anim-num="${Math.max(0,delta.xp)}">0</b><span>XP</span></div><div class="gain-stats">${attrs || '<span class="muted">Character progress recorded.</span>'}</div>${delta.goodDoctorPoints||delta.greatDisciplinePoints ? `<div class="point-gain">${delta.goodDoctorPoints?`+${delta.goodDoctorPoints} Good Doctor points`:""}${delta.greatDisciplinePoints?`+${delta.greatDisciplinePoints} Great Discipline points`:""}</div>`:""}${continueBtn}</div></div>`;
  } else if (stage === 2) {
    overlay.innerHTML = `<div class="reward-card stage-two tarot-scene"><div class="reward-rays"></div><div class="tarot-particles">${tarotParticles()}</div><div class="reward-card-inner"><div class="reward-kicker">The purse grows</div><div class="reward-icon gold">✦</div><h2>Gold Earned</h2><div class="gold-gain"><span>+${Math.max(0,delta.gold)}</span> Gold</div><p>Current balance <b>${after.gold}</b></p>${continueBtn}</div></div>`;
  } else if (stage === 3) {
    let content = "";
    if (fresh.length) content = `<img class="achievement-banner" src="./assets/images/achievement_unlock_box.png" alt="Achievement Unlocked!"><div class="unlocked-stack">${fresh.map(a=>`<div class="unlock-mini ${a.rarity}"><span class="unlock-mini-gem">${esc(a.icon)}</span><div><small>${a.rarity.toUpperCase()}</small><b>${esc(a.name)}</b><span>${esc(a.description)}</span></div></div>`).join("")}</div>`;
    else if (next.length) content = `<div class="near-stack">${next.map(n=>`<div class="near-ach"><span class="near-gem">${esc(n.achievement.icon)}</span><div><b>${esc(n.achievement.name)}</b><span>${n.current} / ${n.target} · ${Math.round(n.ratio*100)}%</span>${meter(n.current,n.target)}</div></div>`).join("")}</div>`;
    else content = `<p class="muted">Every current achievement has been recorded. There is always another chapter.</p>`;
    overlay.innerHTML = `<div class="reward-card stage-three tarot-scene"><div class="reward-rays"></div><div class="tarot-particles">${tarotParticles()}</div><div class="reward-card-inner"><div class="reward-kicker">${fresh.length?"ACHIEVEMENT UNLOCKED":"NEXT MILESTONE"}</div><div class="reward-icon trophy">♛</div><h2>${fresh.length?"Achievement Unlocked":"How close are you?"}</h2>${content}${continueBtn}</div></div>`;
  } else {
    overlay.innerHTML = `<div class="reward-card stage-four tarot-scene"><div class="reward-rays"></div><div class="tarot-particles">${tarotParticles()}</div><div class="reward-card-inner"><div class="reward-icon heart">♥</div><h2>${esc(completionMotivation(result, delta))}</h2><p>${esc(questName)} is now part of your chronicle.</p>${continueBtn}</div></div>`;
  }
}

// Slow-drifting tarot-style sparks: stars, motes and glints behind the card.
function tarotParticles() {
  const glyphs = ["✦", "✧", "★", "·", "◆", "❖"];
  let html = "";
  for (let i = 0; i < 26; i++) {
    const g = glyphs[i % glyphs.length];
    html += `<span class="tp" style="--px:${(Math.random()*100).toFixed(1)}%;--py:${(Math.random()*100).toFixed(1)}%;--td:${(2.4+Math.random()*3.4).toFixed(2)}s;--ts:${(0.7+Math.random()*1.3).toFixed(2)};--tz:${(6+Math.random()*14).toFixed(0)}px">${g}</span>`;
  }
  return html;
}

function animateNumber(el, from, to, duration=700) {
  const start = performance.now();
  const frame = t => {
    const p = Math.min(1, (t-start)/duration); const eased = 1 - Math.pow(1-p,3);
    el.textContent = Math.round(from + (to-from)*eased).toLocaleString();
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function burstConfetti() {
  const layer = document.createElement("div"); layer.className = "confetti-layer";
  for(let i=0;i<110;i++){
    const bit=document.createElement("span"); bit.style.setProperty("--x", `${(Math.random()*100).toFixed(1)}%`); bit.style.setProperty("--h", `${Math.round(160+Math.random()*180)}`); bit.style.setProperty("--r", `${Math.round(Math.random()*360)}deg`); bit.style.setProperty("--d", `${(0.8+Math.random()*1.1).toFixed(2)}s`); bit.textContent = i%4===0?"✦":i%4===1?"◆":i%4===2?"•":"❖"; layer.appendChild(bit);
  }
  document.body.appendChild(layer); setTimeout(()=>layer.remove(), 2200);
}

async function playCompletionSequence(result, before, after) {
  const delta = {
    xp: Number(after.lifetimeXp||0)-Number(before.lifetimeXp||0),
    gold: Number(after.gold||0)-Number(before.gold||0),
    greatDisciplinePoints: Number(after.greatDisciplinePoints||0)-Number(before.greatDisciplinePoints||0),
    goodDoctorPoints: Number(after.goodDoctorPoints||0)-Number(before.goodDoctorPoints||0),
    attributes: Object.fromEntries(Object.keys(after.attributes||{}).map(k=>[k,Number(after.attributes[k]||0)-Number(before.attributes?.[k]||0)]))
  };
  currentRewardSequence = true;
  const overlay=document.createElement("div"); overlay.className="reward-sequence"; document.body.appendChild(overlay);
  burstConfetti();
  // Each stage waits for the player's own tap: nothing important flashes by.
  for(const stage of [1,2,3,4]){
    renderRewardOverlay(stage,result,delta,after);
    const num=overlay.querySelector("[data-anim-num]"); if(num) animateNumber(num,0,Number(delta.xp||0),900);
    await new Promise(resolve => {
      const handler = e => {
        if (e.target.closest("[data-reward-next]") || e.target === overlay) {
          overlay.removeEventListener("click", handler);
          resolve();
        }
      };
      overlay.addEventListener("click", handler);
    });
  }
  overlay.remove(); currentRewardSequence = false;
}

function toast(html) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = html;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}

app.addEventListener("click", e => {
  const b=e.target.closest("button,a"); if(!b) return;
  if(b.dataset.ach){ const a=ACHIEVEMENTS.find(x=>x.id===b.dataset.ach); if(a){ achievementDialog(a); return; } }
  if(b.matches("[data-route-to]")){ location.hash="collection"; return; }
  if(b.dataset.detail){ const q=state.quests.find(x=>x.id===b.dataset.detail); if(q) questModal(q); return; }
  if(b.dataset.complete){ performAction(()=>state.viewDate === gameDate() ? completeQuest(db,b.dataset.complete) : completeQuestOnDate(db,b.dataset.complete,state.viewDate)); return; }
  if(b.dataset.dateStep){ const next = shiftGameDate(state.viewDate || gameDate(), Number(b.dataset.dateStep)); const bounds = dateBounds(); if(next >= bounds.min && next <= bounds.max){ selectedHomeDate = next; refresh(); } return; }
  if("dateToday" in b.dataset){ selectedHomeDate = gameDate(); refresh(); return; }
  if("recover" in b.dataset){ performAction(()=>completeRecovery(db)); return; }
  if(b.dataset.jump==="work"){ document.querySelector("#work-anchor")?.scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if(b.dataset.collapse){ collapsed[b.dataset.collapse]=!collapsed[b.dataset.collapse]; render(); return; }
  if(b.dataset.undo){ performAction(()=>undoQuest(db,b.dataset.undo)); return; }
  if(b.dataset.buy){ performAction(()=>buyShopReward(db,b.dataset.buy)); return; }
  if(b.dataset.equip){ performAction(()=>equipTitle(db,b.dataset.equip===state.profile?.title?null:b.dataset.equip)); return; }
  if("export" in b.dataset){ downloadBackup(db); return; }
  if("diagnostics" in b.dataset){ (async()=>{try{const d=await diagnostics(db);panelMessage={text:d.ok?`Healthy: ${Object.values(d.counts).reduce((a,x)=>a+x,0)} records checked.`:`Problems found: ${JSON.stringify(d)}`,kind:d.ok?"ok":"error"};render();}catch(err){panelMessage={text:err.message,kind:"error"};render();}})();return; }
  if("tests" in b.dataset){ const r=runSelfTests(),f=r.filter(x=>!x[1]); panelMessage={text:f.length?f.map(x=>`${x[0]}: ${x[2]}`).join(" · "):`${r.length}/${r.length} tests passed.`,kind:f.length?"error":"ok"}; render(); return; }
});

app.addEventListener("submit", e => {
  e.preventDefault(); const f=e.target;
  if(f.matches("[data-study]")){ performAction(()=>logStudy(db,new FormData(f).get("minutes"))); return; }
  if(f.matches("[data-quantity]")){ performAction(()=>logQuantity(db,f.dataset.quantity,new FormData(f).get("amount"))); return; }
  if(f.matches("[data-quest]")){ performAction(async()=>{const q=await createQuest(db,Object.fromEntries(new FormData(f)));f.reset();return {projection:state.projection,quest:q,reward:{xp:0,gold:0,attributes:{}}};});return; }
  if(f.matches("[data-shop]")){ performAction(async()=>{await createShopReward(db,Object.fromEntries(new FormData(f)));return {projection:state.projection};});return; }
  if(f.matches("[data-profile]")){ (async()=>{const name=String(new FormData(f).get("name")||"").trim().slice(0,40);if(name){state.profile.name=name;const mod=await import("./database.js");await mod.put(db,"profile",state.profile);await refresh();}})();return; }
});

app.addEventListener("change", e => {
  if(e.target.matches("[data-home-date]")){ const bounds=dateBounds(); const value=e.target.value; if(value && value>=bounds.min && value<=bounds.max){ selectedHomeDate=value; refresh(); } return; }
  if(e.target.matches("[data-toggle]")) performAction(()=>toggleQuest(db,e.target.dataset.toggle,e.target.checked));
  if(e.target.matches("[data-import]")){const file=e.target.files[0];if(file) (async()=>{try{const backup=JSON.parse(await file.text());await downloadBackup(db,"mimi-pre-import-backup.json");await restoreBackup(db,backup);await refresh();}catch(err){app.insertAdjacentHTML("afterbegin",notice(err.message,"error"));}})();}
});

setInterval(async()=>{
  if(!db) return;
  const d=new Date(); const clock=document.querySelector("#live-clock"); if(clock) clock.textContent=fmtTime(d); const next=nextGameEvent(d), el=document.querySelector(".clock-next"); if(el) el.textContent=next.inText;
  const currentDay=gameDate(d); if(currentDay!==lastRenderedDay){ await refresh(); }
},1000);
window.addEventListener("hashchange",()=>{ if(state) refresh(); });

async function start(){
  try{
    db=await openDatabase(); await bootstrap(db); await requestPersistentStorage();
    const p=await dashboard(db); seenAchievements=new Set(p.projection.unlockedAchievementIds); state=p; selectedHomeDate=gameDate(); render(); lastRenderedDay=gameDate();
  }catch(e){ app.innerHTML=`<section class="rpg-panel boot-error"><h2>Mimi could not open its local vault</h2>${notice(e.message,"error")}</section>`; }
}
if(!location.hash) location.hash="home";
start();
if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
