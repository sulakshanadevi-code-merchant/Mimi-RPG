// Pure deterministic game rules. No DOM, storage, network or AI.
import { BALANCE } from "./config.js";

export const APP_VERSION = "0.4.0";

export const ATTRIBUTE_DEFINITIONS = [
  ["STR", "Strength"], ["INT", "Intellect"], ["VIT", "Vitality"], ["WIS", "Wisdom"],
  ["CHA", "Charm"], ["DISCIPLINE", "Discipline"], ["WILLPOWER", "Willpower"],
  ["FOCUS", "Focus"], ["COURAGE", "Courage"], ["RESILIENCE", "Resilience"]
];
export const ATTR_LABELS = {
  STR: "STR", INT: "INT", VIT: "VIT", WIS: "WIS", CHA: "CHA", DISCIPLINE: "DISC",
  WILLPOWER: "WILL", FOCUS: "FOCUS", COURAGE: "COUR", RESILIENCE: "RES"
};

export const CATEGORIES = [
  "Health", "Study", "Fitness", "Personal care", "Discipline", "Kindness", "Recovery",
  "Courage", "Focus", "Creativity", "Learning", "Planning", "Mindfulness", "Digital attention"
];

// Named progression ladders: tier 1 keeps its original name, higher tiers get
// distinct names instead of "Name 2", "Name 3". The `prefix` keeps legacy
// achievement ids stable across renames so earned unlocks never break.
const tierFamily = (prefix, family, kind, icon, thresholds, names, emojis = [], images = {}, rarities = ["common", "common", "rare", "rare", "epic", "epic", "legendary", "legendary", "mythic"]) =>
  thresholds.map((threshold, index) => ({
    id: `${prefix}-${threshold}`,
    name: names[index],
    family,
    tier: index + 1,
    rarity: rarities[index] || rarities[rarities.length - 1],
    kind,
    threshold,
    title: names[index],
    icon: emojis[index] || icon,
    image: images[index] || null,
    description: family === "point"
      ? `${names[index]} — reach ${threshold.toLocaleString()} points on this progression.`
      : `${names[index]} — reach a ${threshold.toLocaleString()}-day streak of this path.`
  }));

export const ACHIEVEMENTS = [
  { id: "first-step", name: "First Step", family: "first-time", tier: 1, rarity: "common", kind: "completedTotal", threshold: 1, title: "Initiate", icon: "🌱", description: "Complete your first meaningful quest." },
  { id: "seven-days-realm", name: "Seven Days in the Realm", family: "chapter", tier: 1, rarity: "rare", kind: "activeDays", threshold: 7, title: "Present", icon: "🗓️", description: "Record meaningful action on seven different days." },
  { id: "perfect-soldier", name: "Locked In", family: "perfection", tier: 1, rarity: "epic", kind: "perfectSoldierDays", threshold: 1, title: "Locked In", icon: "🎯", image: "milestones/study_lock_in.webp", description: "Complete every active daily work quest in one day." },
  { id: "perfect-commander", name: "Holy Peak", family: "perfection", tier: 2, rarity: "legendary", kind: "perfectCommanderDays", threshold: 1, title: "Holy Peak", icon: "🏔️", image: "milestones/study_holy_peak.webp", description: "Complete every active daily work quest and every daily random quest in one day." },
  { id: "mahoraga", name: "Mahoraga", family: "perfection", tier: 3, rarity: "god", kind: "perfectSoldierStreak", threshold: 7, title: "Mahoraga", icon: "☸️", image: "milestones/study_mahoraga.webp", description: "Seven perfect days in a row. Mahoraga adapts to everything — and so did you. One of the highest honors of the realm." },

  ...tierFamily("masturbation", "private-streak", "masturbationStreak", "🔥", [1, 3, 7, 14, 30, 60, 90],
    ["Discipline", "Self-Mastery", "Iron Discipline", "Unbreakable Will", "Absolute Discipline", "Iron Forged Will", "Mountains of Resilience"],
    ["🔥", "⛓️", "⚔️", "🛡️", "🗡️", "⚒️", "⛰️"],
    { 4: "traits/trait_absolute_discipline.webp", 5: "traits/trait_iron_forged.webp", 6: "traits/trait_mountains_of_resilience.webp" },
    ["common", "rare", "epic", "epic", "legendary", "legendary", "mythic"]),
  ...tierFamily("porn-free", "private-streak", "pornStreak", "👁️", [1, 3, 7, 14, 30, 60, 90],
    ["Attention", "Guarded Mind", "Focused Mind", "Keeper of Attention", "Unshaken Mind", "Eternal Guard", "Absolute Attention"],
    ["👁️", "🛡️", "🎯", "👁️‍🗨️", "🧊", "🌌", "✨"],
    { 3: "traits/trait_keeper_of_attention.webp", 4: "traits/trait_unbroken_mind.webp" },
    ["common", "common", "rare", "epic", "epic", "legendary", "mythic"]),
  ...tierFamily("study-streak", "study-streak", "studyStreak", "📖", [1, 3, 7, 15, 30, 60, 90, 180, 365],
    ["Novice Scholar", "Learned Scholar", "Scholar Achievement", "Master Scholar", "Grand Teacher", "Proud of You", "We Love You", "Peace", "Peace Everlasting"],
    ["📖", "📗", "📘", "📕", "🎓", "🌟", "💖", "🕊️", "🌅"],
    { 5: "milestones/study_proud_of_you.webp", 6: "milestones/study_we_love_you.webp", 7: "milestones/study_peace.webp" },
    ["common", "common", "rare", "rare", "epic", "epic", "legendary", "legendary", "mythic"]),
  ...tierFamily("meditation-streak", "meditation-streak", "meditationStreak", "🪷", [1, 3, 7, 15, 30, 60, 90],
    ["Stillness", "Quiet Mind", "Growing Pond", "Calm", "Inner Peace", "Glad", "Buddha Teaching"],
    ["🌙", "🪷", "💧", "🍃", "🪷", "😊", "🧘"],
    { 0: "traits/trait_stillness.webp", 4: "traits/trait_inner_calm.webp", 6: "traits/trait_enlightened_mind.webp" },
    ["common", "common", "rare", "rare", "epic", "epic", "legendary"]),
  ...tierFamily("great-discipline", "point", "greatDisciplinePoints", "🛡️", [10, 30, 70, 140, 200],
    ["Great Discipline", "Great Discipline II", "Great Discipline III", "Great Discipline IV", "Great Discipline V"],
    ["🛡️", "⚔️", "🏋️", "💠", "👑"],
    { 2: "rank_badges/rank_epic.webp", 3: "rank_badges/rank_legendary.webp", 4: "rank_badges/rank_god.webp" }),
  ...tierFamily("good-doctor", "point", "goodDoctorPoints", "⚕️", [25, 50, 100, 200, 350, 550, 750],
    ["Good Doctor", "Good Doctor II", "Good Doctor III", "Good Doctor IV", "Good Doctor V", "Good Doctor VI", "Good Doctor GOD"],
    ["⚕️", "🏛️", "🩺", "💉", "🕊️", "😇", "👑"],
    { 2: "rank_badges/rank_god_doctor_01.webp", 3: "rank_badges/rank_god_doctor_02.webp", 4: "rank_badges/rank_god_doctor_03.webp", 5: "rank_badges/rank_god_doctor_04.webp", 6: "rank_badges/rank_god.webp" },
    ["common", "rare", "rare", "epic", "epic", "legendary", "god"]),

  { id: "skincare-1", name: "Careful Hand", family: "self-care", tier: 1, rarity: "common", kind: "skincareDays", threshold: 1, title: "Careful Hand", icon: "🌿", description: "Complete a skin care routine on one day." },
  { id: "skincare-7", name: "Steady Ritual", family: "self-care", tier: 2, rarity: "rare", kind: "skincareDays", threshold: 7, title: "Steady Ritual", icon: "🌸", description: "Complete a skin care routine on seven different days." },
  { id: "skincare-30", name: "Master of Ritual", family: "self-care", tier: 3, rarity: "epic", kind: "skincareDays", threshold: 30, title: "Master of Ritual", icon: "✨", description: "Complete a skin care routine on thirty different days." },

  { id: "study-hour-session-10", name: "Ten-Hour Study Day", family: "study-performance", tier: 1, rarity: "legendary", kind: "studySingleSession", threshold: 600, title: "Scholar of the Long Watch", icon: "⌛", description: "Record a single study session of ten hours." },
  { id: "study-10h", name: "Ten Hours Studied", family: "study-volume", tier: 1, rarity: "rare", kind: "studyMinutes", threshold: 600, title: "Focused Scholar", icon: "📚", description: "Study for ten total hours." },
  { id: "study-50h", name: "Fifty Hours Studied", family: "study-volume", tier: 2, rarity: "epic", kind: "studyMinutes", threshold: 3000, title: "Deep Scholar", icon: "🔭", description: "Study for fifty total hours." },
  { id: "study-100h", name: "Hundred Hours Studied", family: "study-volume", tier: 3, rarity: "legendary", kind: "studyMinutes", threshold: 6000, title: "Clinical Scholar", icon: "📜", description: "Study for one hundred total hours." },
  { id: "anki-25", name: "Card Initiate", family: "anki-volume", tier: 1, rarity: "common", kind: "ankiCards", threshold: 25, title: "Card Initiate", icon: "🃏", description: "Solve twenty-five Anki cards." },
  { id: "anki-250", name: "Card Smith", family: "anki-volume", tier: 2, rarity: "rare", kind: "ankiCards", threshold: 250, title: "Card Smith", icon: "🂠", description: "Solve two hundred fifty Anki cards." },
  { id: "anki-1000", name: "Card Forge", family: "anki-volume", tier: 3, rarity: "epic", kind: "ankiCards", threshold: 1000, title: "Card Forge", icon: "🎴", description: "Solve one thousand Anki cards." },
  { id: "anki-5000", name: "Memory Forge", family: "anki-volume", tier: 4, rarity: "legendary", kind: "ankiCards", threshold: 5000, title: "Memory Forger", icon: "🧠", description: "Solve five thousand Anki cards." },
  { id: "meditation-1000", name: "A Thousand Quiet Minutes", family: "meditation-volume", tier: 1, rarity: "legendary", kind: "meditationMinutes", threshold: 1000, title: "Stillwater", icon: "🧘", description: "Meditate for one thousand minutes." },
  { id: "protein-7", name: "Protein Discipline", family: "nutrition", tier: 1, rarity: "rare", kind: "proteinDays", threshold: 7, title: "Protein Disciple", icon: "🥩", description: "Reach your protein target on seven days." },
  { id: "protein-30", name: "Thirty Fueled Days", family: "nutrition", tier: 2, rarity: "epic", kind: "proteinDays", threshold: 30, title: "Well Fueled", icon: "🍗", description: "Reach your protein target on thirty days." },
  { id: "exercise-7", name: "Seven Trainings", family: "fitness", tier: 1, rarity: "common", kind: "exerciseSessions", threshold: 7, title: "Training Initiate", icon: "🏋️", description: "Complete seven exercise sessions." },
  { id: "exercise-30", name: "Thirty Trainings", family: "fitness", tier: 2, rarity: "rare", kind: "exerciseSessions", threshold: 30, title: "Gym Veteran", icon: "💪", description: "Complete thirty exercise sessions." },
  { id: "exercise-100", name: "Hundred Trainings", family: "fitness", tier: 3, rarity: "legendary", kind: "exerciseSessions", threshold: 100, title: "Iron Will", icon: "🏆", description: "Complete one hundred exercise sessions." },
  { id: "kindness-5", name: "Kind Hand", family: "kindness", tier: 1, rarity: "common", kind: "kindnessActions", threshold: 5, title: "Kind Hand", icon: "💗", description: "Perform five kindness actions." },
  { id: "kindness-25", name: "Gentle Strength", family: "kindness", tier: 2, rarity: "rare", kind: "kindnessActions", threshold: 25, title: "Gentle Strength", icon: "🌷", description: "Perform twenty-five kindness actions." },
  { id: "courage-5", name: "First Courage", family: "courage", tier: 1, rarity: "common", kind: "courageActions", threshold: 5, title: "Courageous One", icon: "🦁", description: "Perform five acts of courage." },
  { id: "courage-25", name: "Brave Professional", family: "courage", tier: 2, rarity: "epic", kind: "courageActions", threshold: 25, title: "Brave Professional", icon: "⚔️", description: "Perform twenty-five acts of courage." },
  { id: "recovery-1", name: "First Return", family: "recovery", tier: 1, rarity: "rare", kind: "recoveryCount", threshold: 1, title: "The Returning", icon: "🌅", description: "Complete your first recovery quest." },
  { id: "recovery-5", name: "Returned Five Times", family: "recovery", tier: 2, rarity: "epic", kind: "recoveryCount", threshold: 5, title: "The Returning II", icon: "✨", description: "Complete five recovery quests." },
  { id: "recovery-10", name: "Master of Returning", family: "recovery", tier: 3, rarity: "legendary", kind: "recoveryCount", threshold: 10, title: "Master of Returning", icon: "💫", description: "Complete ten recovery quests." },
  { id: "active-days-30", name: "Month of Presence", family: "consistency", tier: 1, rarity: "epic", kind: "activeDays", threshold: 30, title: "Present", icon: "📆", description: "Record meaningful action on thirty different days." }
];

export function makeId(prefix = "id") { return `${prefix}_${crypto.randomUUID()}`; }
export function gameDate(clock = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(clock);
}
export function now(clock = new Date()) { return clock.toISOString(); }
export function levelForXp(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1); }
export function xpForLevel(level) { return Math.pow(Math.max(1, level), 2) * 100; }
export function nextLevelXp(xp) { return xpForLevel(levelForXp(xp) + 1); }
export function rewardFor(quest) { return { xp: Number(quest.reward?.xp ?? 20), gold: Number(quest.reward?.gold ?? 5), attributes: quest.reward?.attributes || {} }; }

export function dayState(clock = new Date()) {
  const h = clock.getHours();
  if (h >= 21) return { phase: "recovery", label: "Recovery window" };
  if (h >= 19) return { phase: "warning", label: "Evening warning" };
  return { phase: "normal", label: "The day is open" };
}
export function nextGameEvent(clock = new Date()) {
  const t = new Date(clock), candidates = [
    [19, "Evening warning"], [21, "Recovery opens"], [24, "New day"]
  ];
  for (const [hour, label] of candidates) {
    const d = hour === 24 ? new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0) : new Date(t.getFullYear(), t.getMonth(), t.getDate(), hour, 0, 0);
    if (d > t) {
      const ms = d - t, h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      return { label, at: d.toISOString(), inText: h ? `${h}h ${m}m` : `${m}m` };
    }
  }
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 19, 0, 0);
  const ms = d - t, h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return { label: "Evening warning", at: d.toISOString(), inText: `${h}h ${m}m` };
}

export function emptyProjection() {
  return {
    version: 3, lifetimeXp: 0, currentXp: 0, gold: 0, level: 1, nextLevelXp: 100,
    attributes: Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(([id]) => [id, 0])),
    totals: { completed: 0, recoveries: 0, studySessions: 0, studyMinutes: 0, longestStudyMinutes: 0, proteinDays: 0, exerciseSessions: 0, skincareDays: 0 },
    metricTotals: {}, streaks: {}, unlockedAchievementIds: [], unlockedTitleIds: [],
    perfectSoldierDays: 0, perfectCommanderDays: 0, perfectSoldierStreak: 0, activeDays: [], categoryTotals: {},
    greatDisciplinePoints: 0, goodDoctorPoints: 0, updatedAt: null,
    recovery: { available: false, reason: null, task: null, sourceQuestId: null }
  };
}
function dateDistance(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000); }

export function calculateStreaks(events, quests, today = gameDate()) {
  const byQuest = {}, questMap = new Map(quests.map(q => [q.id, q]));
  for (const event of events) {
    if (event.type !== "quest_completed" || !questMap.get(event.questId)?.recurring) continue;
    (byQuest[event.questId] ||= []).push(event.gameDate);
  }
  const answer = {};
  for (const [questId, rawDates] of Object.entries(byQuest)) {
    const dates = [...new Set(rawDates)].sort(); let best = 0, run = 0, previous = null;
    for (const date of dates) { run = previous && dateDistance(previous, date) === 1 ? run + 1 : 1; best = Math.max(best, run); previous = date; }
    const lastDate = dates.at(-1);
    answer[questId] = { current: dateDistance(lastDate, today) > 1 ? 0 : run, best, lastDate };
  }
  return answer;
}

export function activeDays(events) {
  const meaningful = new Set(["quest_completed", "study_completed", "quantity_logged", "quantity_target_reached", "recovery_completed", "study_started"]);
  return [...new Set(events.filter(e => meaningful.has(e.type)).map(e => e.gameDate))].sort();
}

function maxNumeric(values) { return Math.max(0, ...values.filter(Number.isFinite)); }
function countMetricDays(events, metric) {
  return new Set(events.filter(e => e.type === "quantity_target_reached" && e.metric === metric).map(e => e.gameDate)).size;
}
function metricTotal(events, metric) { return events.filter(e => e.type === "quantity_logged" && e.metric === metric).reduce((sum, e) => sum + Number(e.amount || 0), 0); }
function studySingleBest(events) { return maxNumeric(events.filter(e => e.type === "study_completed").map(e => Number(e.minutes || 0))); }
function questCompletedOn(events, questIds, date) { const set = new Set(questIds); return new Set(events.filter(e => e.type === "quest_completed" && e.gameDate === date && set.has(e.questId)).map(e => e.questId)); }

export function rebuildProjection({ events, grants, quests, achievements = [] }) {
  const p = emptyProjection();
  const grantByEvent = new Map(grants.map(g => [g.eventId, g]));
  const reversed = new Set(events.filter(e => e.type === "quest_undone").map(e => e.reversesEventId));
  const live = events.filter(e => !reversed.has(e.id));

  for (const event of live) {
    if (event.type === "quest_completed") {
      p.totals.completed += 1;
      if (event.category) p.categoryTotals[event.category] = (p.categoryTotals[event.category] || 0) + 1;
      if (event.category === "Fitness") p.totals.exerciseSessions += 1;
    }
    if (event.type === "recovery_completed") p.totals.recoveries += 1;
    if (event.type === "study_completed") {
      const minutes = Number(event.minutes || 0); p.totals.studySessions += 1; p.totals.studyMinutes += minutes; p.totals.longestStudyMinutes = Math.max(p.totals.longestStudyMinutes, minutes);
    }
    if (event.type === "quantity_logged") {
      const key = event.metric; p.metricTotals[key] = (p.metricTotals[key] || 0) + Number(event.amount || 0);
      if (key === "meditation") p.metricTotals.meditationSessions = (p.metricTotals.meditationSessions || 0) + 1;
    }
    const g = grantByEvent.get(event.id);
    if (g) {
      p.lifetimeXp += Number(g.xp || 0);
      p.currentXp += Number(g.xp || 0);
      p.gold += Number(g.gold || 0);
      p.goodDoctorPoints += Number(g.goodDoctorPoints || 0);
      p.greatDisciplinePoints += Number(g.greatDisciplinePoints || 0);
      for (const [attribute, value] of Object.entries(g.attributes || {})) p.attributes[attribute] = Math.max(0, (p.attributes[attribute] || 0) + Number(value));
    }
  }

  p.totals.proteinDays = countMetricDays(live, "protein");
  p.totals.skincareDays = countMetricDays(live, "skincare");
  p.activeDays = activeDays(live);
  p.metricTotals.anki = metricTotal(live, "anki");
  p.metricTotals.meditation = metricTotal(live, "meditation");
  p.metricTotals.protein = metricTotal(live, "protein");
  p.metricTotals.calories = metricTotal(live, "calories");
  p.metricTotals.sleep = metricTotal(live, "sleep");
  p.metricTotals.skincare = metricTotal(live, "skincare");
  p.metricTotals.exerciseSessions = p.totals.exerciseSessions;

  p.streaks = calculateStreaks(live, quests);

  const daily = quests.filter(q => q.kind === "daily" && q.enabled !== false);
  const random = quests.filter(q => q.kind === "random");
  const dates = [...new Set(live.map(e => e.gameDate).filter(Boolean))].sort();
  let perfectStreak = 0, bestPerfectStreak = 0, prevDate = null;
  for (const date of dates) {
    const workIds = daily.map(q => q.id);
    const randomOfDay = random.filter(q => q.dailyDate === date).map(q => q.id);
    const workDone = questCompletedOn(live, workIds, date).size;
    const randomDone = questCompletedOn(live, randomOfDay, date).size;
    if (workIds.length && workDone >= workIds.length) p.perfectSoldierDays += 1;
    if (workIds.length && randomOfDay.length && workDone >= workIds.length && randomDone >= randomOfDay.length) p.perfectCommanderDays += 1;
    // Consecutive perfect days (Mahoraga). A day with no dailies configured doesn't break the chain.
    if (workIds.length && workDone >= workIds.length) {
      perfectStreak = (prevDate && dateDistance(prevDate, date) === 1) ? perfectStreak + 1 : 1;
      bestPerfectStreak = Math.max(bestPerfectStreak, perfectStreak);
      prevDate = date;
    } else if (workIds.length) { perfectStreak = 0; prevDate = null; }
  }
  p.perfectSoldierStreak = bestPerfectStreak;

  p.level = levelForXp(p.currentXp); p.nextLevelXp = nextLevelXp(p.currentXp);
  p.unlockedAchievementIds = achievements.map(a => a.achievementId);
  p.unlockedTitleIds = achievements.map(a => a.title).filter(Boolean);
  p.updatedAt = new Date().toISOString();
  return p;
}

export function achievementValue(kind, projection) {
  switch (kind) {
    case "completedTotal": return projection.totals.completed;
    case "activeDays": return projection.activeDays.length;
    case "perfectSoldierDays": return projection.perfectSoldierDays;
    case "perfectCommanderDays": return projection.perfectCommanderDays;
    case "perfectSoldierStreak": return projection.perfectSoldierStreak || 0;
    case "greatDisciplinePoints": return projection.greatDisciplinePoints;
    case "goodDoctorPoints": return projection.goodDoctorPoints;
    case "studyStreak": return projection.streaks["daily-study"]?.best || 0;
    case "meditationStreak": return projection.streaks["daily-meditation"]?.best || 0;
    case "masturbationStreak": return projection.streaks["daily-no-masturbation"]?.best || 0;
    case "pornStreak": return projection.streaks["daily-no-porn"]?.best || 0;
    case "studyMinutes": return projection.totals.studyMinutes;
    case "studySingleSession": return projection.totals.longestStudyMinutes;
    case "ankiCards": return projection.metricTotals.anki || 0;
    case "meditationMinutes": return projection.metricTotals.meditation || 0;
    case "proteinDays": return projection.totals.proteinDays || 0;
    case "exerciseSessions": return projection.totals.exerciseSessions || 0;
    case "kindnessActions": return projection.categoryTotals.Kindness || 0;
    case "courageActions": return projection.categoryTotals.Courage || 0;
    case "recoveryCount": return projection.totals.recoveries || 0;
    case "skincareDays": return projection.totals.skincareDays || 0;
    default: return 0;
  }
}

export function achievementProgressFor(achievement, projection) {
  const current = Number(achievementValue(achievement.kind, projection) || 0);
  const target = Number(achievement.threshold || 0);
  return { current, target, ratio: target ? Math.min(1, current / target) : 0, remaining: Math.max(0, target - current) };
}

// How far a point line is from its next tier (for the progress bars).
export function nextThresholdProgress(value, thresholds) {
  const next = thresholds.find(t => value < t);
  if (next == null) return { current: value, target: value, ratio: 1, label: "MAX" };
  return { current: value, target: next, ratio: Math.min(1, value / next), label: `${next - value} to next tier` };
}

export function achievementCandidates(projection) {
  return ACHIEVEMENTS.filter(a => achievementValue(a.kind, projection) >= a.threshold);
}

export function nearestAchievements(projection, limit = 3) {
  return ACHIEVEMENTS.filter(a => !projection.unlockedAchievementIds.includes(a.id))
    .map(a => ({ achievement: a, ...achievementProgressFor(a, projection) }))
    .sort((a, b) => b.ratio - a.ratio || a.remaining - b.remaining)
    .slice(0, limit);
}

export function personalBests(events) {
  const live = events.filter(e => e.type !== "quest_undone" && !events.some(u => u.type === "quest_undone" && u.reversesEventId === e.id));
  const byDay = {};
  for (const e of live) if (e.gameDate) byDay[e.gameDate] = (byDay[e.gameDate] || 0) + 1;
  const ankiByDay = {};
  let longestStudy = 0;
  for (const e of live) {
    if (e.type === "study_completed") longestStudy = Math.max(longestStudy, Number(e.minutes || 0));
    if (e.type === "quantity_logged" && e.metric === "anki") ankiByDay[e.gameDate] = (ankiByDay[e.gameDate] || 0) + Number(e.amount || 0);
  }
  return {
    longestStudySessionMinutes: longestStudy,
    mostAnkiCardsInOneDay: Math.max(0, ...Object.values(ankiByDay)),
    mostActionsInOneDay: Math.max(0, ...Object.values(byDay))
  };
}

export function weeklyReport(events, clock = new Date()) {
  const reversed = new Set(events.filter(e => e.type === "quest_undone").map(e => e.reversesEventId));
  const cutoff = new Date(clock); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 6);
  const inWeek = events.filter(e => !reversed.has(e.id) && e.occurredAt && new Date(e.occurredAt) >= cutoff);
  const studyMinutes = inWeek.filter(e => e.type === "study_completed").reduce((s, e) => s + Number(e.minutes || 0), 0);
  const fitness = inWeek.filter(e => e.type === "quest_completed" && e.category === "Fitness").length;
  const meditation = inWeek.filter(e => e.type === "quantity_logged" && e.metric === "meditation").reduce((s, e) => s + Number(e.amount || 0), 0);
  const completions = inWeek.filter(e => e.type === "quest_completed").length;
  const recoveries = inWeek.filter(e => e.type === "recovery_completed").length;
  const days = new Set(inWeek.filter(e => ["quest_completed", "study_completed", "quantity_logged", "recovery_completed"].includes(e.type)).map(e => e.gameDate)).size;
  return { studyMinutes, fitness, meditation, completions, recoveries, activeDays: days };
}

export function assertSafeShopReward(name) {
  if (/(food|meal|medicine|medication|doctor|medical|hygiene|shower|sleep|necessit)/i.test(name)) throw new Error("Mimi protects necessities: this cannot be a shop reward.");
}

// ---- Tiered display names for measured quests ---------------------------
// Quests with a point system advance through named tiers as the lifetime
// total grows, so the name itself shows progress. Good Doctor keeps its name
// and only grows a tier number.
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export function roman(n) { return ROMAN[n - 1] || String(n); }

export const GOOD_DOCTOR_THRESHOLDS = [25, 50, 100, 200, 350, 550, 750];
export function goodDoctorTier(points) {
  const t = GOOD_DOCTOR_THRESHOLDS.filter(th => points >= th).length;
  return t === 0 ? "Good Doctor" : `Good Doctor ${roman(t)}`;
}
export const GREAT_DISCIPLINE_THRESHOLDS = [10, 30, 70, 140, 200, 300, 400, 500];
export function greatDisciplineTier(points) {
  const t = GREAT_DISCIPLINE_THRESHOLDS.filter(th => points >= th).length;
  return t === 0 ? "Great Discipline" : `Great Discipline ${roman(t)}`;
}

// Each ladder: [cumulativeThreshold, displayName]. The first entry is tier 1.
const METRIC_NAME_LADDERS = {
  study: [[0, "Study — Novice Scholar"], [600, "Study — Focused Scholar"], [3000, "Study — Deep Scholar"], [6000, "Study — Clinical Scholar"], [12000, "Study — Scholar of the Realm"]],
  anki: [[0, "Anki — Card Initiate"], [250, "Anki — Card Smith"], [1000, "Anki — Card Master"], [5000, "Anki — Memory Forge"], [10000, "Anki — Grand Archivist"]],
  meditation: [[0, "Meditation — Stillness"], [100, "Meditation — Stillness II"], [300, "Meditation — Deep Stillness"], [1000, "Meditation — Stillwater"], [3000, "Meditation — Unmoving Lake"]],
  protein: [[0, "Protein — Fuel Initiate"], [7, "Protein — Fueled"], [30, "Protein — Well Fueled"], [100, "Protein — Iron Furnace"]],
  calories: [[0, "Calories — Keeper of the Table"], [7, "Calories — Faithful Table"], [30, "Calories — Master of the Table"]],
  sleep: [[0, "Sleep — Rest Seeker"], [7, "Sleep — Kept Rest"], [30, "Sleep — Sacred Rest"]],
  skincare: [[0, "Skin Care — Careful Hand"], [14, "Skin Care — Steady Hand"], [60, "Skin Care — Master of Ritual"]]
};
export function metricQuestDisplayName(quest, projection) {
  const ladder = METRIC_NAME_LADDERS[quest.metric];
  if (!ladder) return quest.name;
  const total = projection?.metricTotals?.[quest.metric] || 0;
  let name = ladder[0][1];
  for (const [threshold, label] of ladder) if (total >= threshold) name = label;
  return name;
}

// ---- Specific recovery tasks ---------------------------------------------
// A fallen run offers ONE concrete, still-possible action instead of a vague
// "recovery". Chosen deterministically from the day's remaining work.
const RECOVERY_TASKS = [
  { title: "Open the book and study for 10 minutes", hint: "The hardest minute is the first one. Ten minutes still counts.", metric: "study", amount: 10 },
  { title: "Solve 5 Anki cards", hint: "Five cards is a doorway, not a chore.", metric: "anki", amount: 5 },
  { title: "Do 3 sets of any exercise", hint: "Push-ups, squats, or whatever you have. Three sets.", category: "Fitness" },
  { title: "Jog or walk briskly for 5 minutes", hint: "Movement first, motivation later.", category: "Fitness" },
  { title: "Do one full skin care routine", hint: "Care for the body that carries you.", metric: "skincare", amount: 1 },
  { title: "Meditate for 5 minutes", hint: "Sit, breathe, return.", metric: "meditation", amount: 5 },
  { title: "Brush your teeth and tidy one surface", hint: "The smallest reset still resets.", category: "Personal care" },
  { title: "Write tomorrow's first task on paper", hint: "One line. Tomorrow starts tonight.", category: "Planning" }
];
export function pickRecoveryTask(date, events = [], quests = []) {
  const r = seededRandomIndex(`recovery:${date}`);
  const dayMetricTotals = new Map();
  for (const e of events) {
    if (e.gameDate !== date) continue;
    if (e.type === "study_completed") dayMetricTotals.set("study", (dayMetricTotals.get("study") || 0) + Number(e.minutes || 0));
    if (e.type === "quantity_logged") dayMetricTotals.set(e.metric, (dayMetricTotals.get(e.metric) || 0) + Number(e.amount || 0));
  }
  // Prefer tasks whose metric is still untouched today, so recovery is always feasible.
  const undoneWork = new Set(quests.filter(q => q.kind === "daily").map(q => q.metric).filter(Boolean));
  let pool = RECOVERY_TASKS.filter(t => !t.metric || !(dayMetricTotals.get(t.metric) >= (t.amount || 1) && undoneWork.has(t.metric)));
  if (!pool.length) pool = RECOVERY_TASKS;
  return pool[r() % pool.length];
}
function seededRandomIndex(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
}

export function dailyQuestTarget(quest) { return quest.target || quest.meta?.target || 0; }

export function rewardPointDescription(quest) {
  if (quest.id === "daily-no-masturbation") return "+3 Discipline · +10 Great Discipline points";
  if (quest.id === "daily-meditation") return "+1 WIS · +1 Discipline · points from meditation";
  if (quest.id === "daily-study") return "+1 INT · +1 Focus · Good Doctor progress";
  return "";
}

export { BALANCE };
