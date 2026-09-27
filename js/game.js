import { tx, getAll, get, put, request } from "./database.js";
import {
  makeId, now, gameDate, rewardFor, rebuildProjection, achievementCandidates,
  dayState, CATEGORIES, ATTRIBUTE_DEFINITIONS, assertSafeShopReward, BALANCE, pickRecoveryTask
} from "./domain.js";
import { DAILY_WORK, dailyRandomQuests, BALANCE as CONFIG_BALANCE } from "./config.js";

const seedQuests = [
  { id: "seed-start-study", name: "Start Study", category: "Study", recurring: true, kind: "study_start", reward: { xp: 15, gold: 3, attributes: { INT: 1, FOCUS: 1 } }, createdAt: "seed" }
];

function metricCategory(metric) {
  if (["study", "anki"].includes(metric)) return "Study";
  if (metric === "meditation") return "Mindfulness";
  if (["protein", "calories", "sleep", "water"].includes(metric)) return "Health";
  if (metric === "skincare") return "Personal care";
  return "Health";
}

async function load(db) {
  const [events, grants, quests, achievements] = await Promise.all([
    getAll(db, "events"), getAll(db, "rewardGrants"), getAll(db, "questDefinitions"), getAll(db, "achievementUnlocks")
  ]);
  return { events, grants, quests, achievements };
}

async function getSettings(db) { return get(db, "settings", "game-config"); }
async function saveSettings(db, settings) { return put(db, "settings", settings); }

function liveEvents(events) {
  const reversed = new Set(events.filter(e => e.type === "quest_undone").map(e => e.reversesEventId));
  return events.filter(e => e.type !== "quest_undone" && !reversed.has(e.id));
}
function liveEvent(events, eventId) {
  return liveEvents(events).find(e => e.id === eventId);
}
function liveQuestCompletedOn(events, questId, date) {
  return liveEvents(events).some(e => e.type === "quest_completed" && e.questId === questId && e.gameDate === date);
}
function liveMetricTotalFromEvents(events, metric, date) {
  const live = liveEvents(events);
  if (metric === "study") return live.filter(e => e.type === "study_completed" && e.gameDate === date).reduce((s, e) => s + Number(e.minutes || 0), 0);
  return live.filter(e => e.type === "quantity_logged" && e.metric === metric && e.gameDate === date).reduce((s, e) => s + Number(e.amount || 0), 0);
}
function streakEndingOn(events, quests, questId, targetDate) {
  const live = liveEvents(events);
  const recurring = quests.find(q => q.id === questId)?.recurring;
  if (!recurring) return 0;
  const dates = new Set(live.filter(e => e.type === "quest_completed" && e.questId === questId && e.gameDate).map(e => e.gameDate));
  let n = 0, cursor = targetDate;
  while (dates.has(cursor)) { n += 1; cursor = dateAdd(cursor, -1); }
  return n;
}

export async function bootstrap(db) {
  const profile = await getAll(db, "profile");
  if (!profile.length) await put(db, "profile", { id: "current", name: "Mimi", title: null, createdAt: now() });

  const quests = await getAll(db, "questDefinitions");
  if (!quests.length) {
    for (const quest of [...seedQuests, ...DAILY_WORK]) await put(db, "questDefinitions", quest);
  } else {
    for (const quest of DAILY_WORK) {
      const existing = quests.find(q => q.id === quest.id);
      if (!existing) await put(db, "questDefinitions", quest);
      else {
        // Bring newly added metadata/targets into existing installations without
        // erasing user enable/disable choices. Names always follow the latest
        // content so renames reach existing saves.
        const merged = { ...quest, ...existing, name: quest.name, reward: quest.reward, target: quest.target, metric: quest.metric, unit: quest.unit, timeTarget: quest.timeTarget, private: quest.private, optional: quest.optional };
        await put(db, "questDefinitions", merged);
      }
    }
  }

  let settings = await getSettings(db);
  const today = gameDate();
  const existingEvents = await getAll(db, "events");
  const latestFinalized = existingEvents.filter(e => e.type === "daily_finalized" && e.sourceDate).map(e => e.sourceDate).sort().at(-1);
  if (!settings) {
    settings = {
      id: "game-config",
      categories: CATEGORIES,
      attributes: ATTRIBUTE_DEFINITIONS,
      balanceVersion: CONFIG_BALANCE.version,
      targets: { ...CONFIG_BALANCE.targets },
      lastFinalizedDate: latestFinalized || dateAdd(today, -1),
      randomCount: 5
    };
    await saveSettings(db, settings);
  } else {
    settings.targets = { ...CONFIG_BALANCE.targets, ...(settings.targets || {}) };
    settings.randomCount = Math.max(3, Math.min(7, Number(settings.randomCount || 5)));
    // Older builds initialized this to today's date before midnight-finalization was implemented.
    // If no finalized event exists, treat yesterday as the most recent completed boundary.
    settings.lastFinalizedDate = latestFinalized || (settings.lastFinalizedDate === today ? dateAdd(today, -1) : (settings.lastFinalizedDate || dateAdd(today, -1)));
    settings.balanceVersion = CONFIG_BALANCE.version;
    await saveSettings(db, settings);
  }

  await finalizePreviousDays(db, new Date());
  await ensureDailyRandomQuests(db, new Date());
  await rebuildAndPersist(db);
  await evaluateDay(db, new Date());
}

export async function ensureDailyRandomQuests(db, clock = new Date()) {
  const today = gameDate(clock);
  const settings = await getSettings(db);
  const count = settings?.randomCount || 5;
  const quests = await getAll(db, "questDefinitions");
  const existing = quests.filter(q => q.kind === "random");
  if (existing.some(q => q.dailyDate === today)) return;
  const recent = existing
    .sort((a, b) => (b.dailyDate || "").localeCompare(a.dailyDate || ""))
    .slice(0, 20).map(q => q.templateId).filter(Boolean);
  for (const template of dailyRandomQuests(today, recent, count)) {
    const id = `daily-random-${today}-${template.id}`;
    await put(db, "questDefinitions", {
      ...template,
      id,
      templateId: template.id,
      recurring: true,
      kind: "random",
      dailyDate: today,
      reward: { xp: 20 + template.difficulty * 10, gold: 3 + template.difficulty * 2, attributes: template.attributes },
      createdAt: today
    });
  }
}

async function rebuildAndPersist(db, options = {}) {
  const data = await load(db);
  const projection = rebuildProjection(data);
  const candidates = achievementCandidates(projection);
  const known = new Set(data.achievements.map(a => a.achievementId));
  const fresh = [];
  for (const definition of candidates) {
    if (!known.has(definition.id)) {
      const unlock = {
        achievementId: definition.id,
        title: definition.title,
        unlockedAt: now(options.clock || new Date()),
        name: definition.name,
        rarity: definition.rarity,
        gameDate: gameDate(options.clock || new Date())
      };
      data.achievements.push(unlock);
      fresh.push(definition);
    }
  }
  projection.unlockedAchievementIds = data.achievements.map(a => a.achievementId);
  projection.unlockedTitleIds = data.achievements.map(a => a.title).filter(Boolean);

  await tx(db, ["projections", "achievementUnlocks", "titleUnlocks", "events"], "readwrite", async s => {
    await request(s.projections.put({ id: "current", ...projection }));
    for (const a of data.achievements) {
      await request(s.achievementUnlocks.put(a));
      if (a.title) await request(s.titleUnlocks.put({ titleId: a.title, achievementId: a.achievementId, unlockedAt: a.unlockedAt }));
    }
    for (const f of fresh) {
      const event = { id: makeId("event"), type: "achievement_unlocked", achievementId: f.id, achievementName: f.name, gameDate: gameDate(options.clock || new Date()), occurredAt: now(options.clock || new Date()), category: "Achievement" };
      await request(s.events.add(event));
    }
  });
  return { projection, fresh };
}

async function isQuestDoneOn(events, questId, date) {
  return events.some(e => e.type === "quest_completed" && e.questId === questId && e.gameDate === date);
}

async function finalizedDates(db) {
  const events = await getAll(db, "events");
  return new Set(events.filter(e => e.type === "daily_finalized").map(e => e.sourceDate));
}

function dateAdd(dateString, days) {
  const d = new Date(`${dateString}T12:00:00`); d.setDate(d.getDate() + days);
  return gameDate(d);
}

function dateCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

async function applyMissedDailyDay(db, missedDate, clock) {
  const [quests, events] = await Promise.all([getAll(db, "questDefinitions"), getAll(db, "events")]);
  const activeDaily = quests.filter(q => q.kind === "daily" && q.enabled !== false);
  const alreadyFinalized = events.some(e => e.type === "daily_finalized" && e.sourceDate === missedDate);
  if (alreadyFinalized) return { missed: [] };

  const live = liveEvents(events);
  const missed = activeDaily.filter(q => !live.some(e => e.type === "quest_completed" && e.questId === q.id && e.gameDate === missedDate));
  const nowIso = now(clock);
  await tx(db, ["events", "rewardGrants", "completionClaims", "audit"], "readwrite", async s => {
    for (const quest of missed) {
      const eventId = makeId("event");
      const claimKey = `missed:${missedDate}:${quest.id}`;
      try {
        await request(s.completionClaims.add({ key: claimKey, eventId, createdAt: nowIso }));
      } catch (error) {
        if (error?.name === "ConstraintError") continue;
        throw error;
      }
      await request(s.events.add({
        id: eventId,
        type: "daily_missed",
        questId: quest.id,
        questName: quest.name,
        sourceDate: missedDate,
        gameDate: gameDate(clock),
        occurredAt: nowIso,
        category: quest.category,
        reason: "midnight",
        private: !!quest.private
      }));
      const negativeAttributes = Object.fromEntries(Object.entries(quest.reward?.attributes || {}).map(([k, v]) => [k, -Math.abs(Number(v || 0))]));
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: 0, gold: 0, attributes: negativeAttributes, grantedAt: nowIso, penalty: true }));
      await request(s.audit.add({ id: makeId("audit"), type: "daily_missed_penalty", questId: quest.id, sourceDate: missedDate, eventId, at: nowIso }));
    }
    await request(s.events.add({ id: makeId("event"), type: "daily_finalized", sourceDate: missedDate, gameDate: gameDate(clock), occurredAt: nowIso, category: "System" }));
  });
  return { missed };
}

export async function finalizePreviousDays(db, clock = new Date()) {
  const settings = await getSettings(db);
  if (!settings) return;
  const today = gameDate(clock);
  const yesterday = dateAdd(today, -1);
  let cursor = settings.lastFinalizedDate || today;
  const target = yesterday;
  if (dateCompare(cursor, target) >= 0) return;
  while (dateCompare(cursor, target) < 0) {
    cursor = dateAdd(cursor, 1);
    if (dateCompare(cursor, target) <= 0) await applyMissedDailyDay(db, cursor, clock);
  }
  settings.lastFinalizedDate = target;
  await saveSettings(db, settings);
  await rebuildAndPersist(db, { clock });
}

export async function evaluateDay(db, clock = new Date()) {
  await finalizePreviousDays(db, clock);
  await ensureDailyRandomQuests(db, clock);
  const date = gameDate(clock);
  const [quests, events, projection] = await Promise.all([getAll(db, "questDefinitions"), getAll(db, "events"), get(db, "projections", "current")]);
  const work = quests.filter(q => q.kind === "daily" && q.enabled !== false);
  const live = liveEvents(events);
  const doneToday = new Set(live.filter(e => e.type === "quest_completed" && e.gameDate === date).map(e => e.questId));
  const unfinishedToday = work.filter(q => !doneToday.has(q.id)).length;
  const phase = dayState(clock).phase;
  const recoveredToday = events.some(e => e.type === "recovery_completed" && e.gameDate === date);
  let recovery = { available: false, reason: null, task: null };
  if (phase === "recovery" && unfinishedToday > 0 && !recoveredToday) {
    recovery = {
      available: true,
      reason: "Your daily work is unfinished. One concrete action can still save the day.",
      task: pickRecoveryTask(date, events, work)
    };
  }
  if (projection) {
    const next = { ...projection, recovery: { available: recovery.available, reason: recovery.reason, task: recovery.task || null, sourceQuestId: null } };
    await put(db, "projections", { id: "current", ...next });
  }
  return { phase, doneToday: doneToday.size, unfinishedToday, workCount: work.length, recovery };
}

function rewardForMetricTier(metric, tier) {
  const attr = ["study", "anki"].includes(metric) ? { INT: 1 } : metric === "meditation" ? { WIS: 1 } : { VIT: 1 };
  // Skin care pays through its actual daily quest (10/20 XP and 2/4 Gold),
  // not through a separate metric threshold grant.
  if (metric === "skincare") return { xp: 0, gold: 0, attributes: {} };
  return { xp: Number(tier.xp || 0), gold: Number(tier.gold || 0), attributes: attr };
}

async function dailyMetricQuests(db, metric, date) {
  const quests = await getAll(db, "questDefinitions");
  return quests.filter(q => q.kind === "daily" && q.enabled !== false && q.mode === "quantity" && q.metric === metric && q.dailyDate === undefined && q.target != null);
}

async function randomMetricQuestsForDay(db, metric, date) {
  const quests = await getAll(db, "questDefinitions");
  return quests.filter(q => q.kind === "random" && q.dailyDate === date && q.actionType === "metric" && q.metric === metric);
}

async function completeMetricBoundQuest(db, quest, date, clock) {
  const events = await getAll(db, "events");
  if (liveQuestCompletedOn(events, quest.id, date)) return null;
  const eventId = makeId("event"), reward = rewardFor(quest), occurredAt = now(clock);
  const live = liveEvents(events);
  const missed = live.find(e => e.type === "daily_missed" && e.questId === quest.id && e.sourceDate === date);
  await tx(db, ["completionClaims", "events", "rewardGrants", "audit"], "readwrite", async s => {
    await request(s.completionClaims.add({ key: `completion:${quest.id}:${date}:${eventId}`, eventId, createdAt: occurredAt }));
    await request(s.events.add({ id: eventId, type: "quest_completed", questId: quest.id, questName: quest.name, category: quest.category, gameDate: date, occurredAt, ruleVersion: CONFIG_BALANCE.version }));
    await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: reward.xp, gold: reward.gold, attributes: reward.attributes, grantedAt: occurredAt }));
    if (missed) {
      // Treat the prior midnight penalty as a reversible event. This removes
      // its negative grant cleanly without double-crediting attributes that
      // had previously been clamped at zero.
      await request(s.events.add({ id: makeId("event"), type: "quest_undone", reversesEventId: missed.id, sourceEventId: eventId, correction: true, gameDate: date, occurredAt }));
    }
    await request(s.audit.add({ id: makeId("audit"), type: "completion", eventId, at: occurredAt }));
  });
  return { eventId, reward, quest };
}
function deltaBetween(before, after) {
  const attributes = {};
  for (const key of Object.keys(after?.attributes || {})) {
    const d = Number(after.attributes[key] || 0) - Number(before?.attributes?.[key] || 0);
    if (d) attributes[key] = d;
  }
  return {
    xp: Number(after?.lifetimeXp || 0) - Number(before?.lifetimeXp || 0),
    gold: Number(after?.gold || 0) - Number(before?.gold || 0),
    attributes,
    greatDisciplinePoints: Number(after?.greatDisciplinePoints || 0) - Number(before?.greatDisciplinePoints || 0),
    goodDoctorPoints: Number(after?.goodDoctorPoints || 0) - Number(before?.goodDoctorPoints || 0)
  };
}

export async function completeQuestOnDate(db, questId, targetDate, clock = new Date()) {
  const quest = await get(db, "questDefinitions", questId);
  if (!quest) throw new Error("Quest not found.");
  if (quest.mode === "quantity" || quest.actionType === "metric") throw new Error("Use the quantity controls for this quest.");
  const date = targetDate || gameDate(clock);
  const events = await getAll(db, "events");
  if (liveQuestCompletedOn(events, questId, date)) throw new Error("Already completed for this date.");
  const eventId = makeId("event");
  const reward = rewardFor(quest);
  const before = await get(db, "projections", "current") || rebuildProjection(await load(db));
  let goodDoctorPoints = 0, greatDisciplinePoints = 0;
  if (quest.id === "daily-no-masturbation") greatDisciplinePoints += CONFIG_BALANCE.pointAwards.noMasturbationDayGreatDiscipline;
  const occurredAt = now(clock);
  const live = liveEvents(events);
  const missed = live.find(e => e.type === "daily_missed" && e.questId === quest.id && e.sourceDate === date);
  try {
    await tx(db, ["completionClaims", "events", "rewardGrants", "audit"], "readwrite", async s => {
      await request(s.completionClaims.add({ key: `completion:${questId}:${date}:${eventId}`, eventId, createdAt: occurredAt }));
      await request(s.events.add({ id: eventId, type: quest.kind === "study_start" ? "study_started" : "quest_completed", questId, questName: quest.name, category: quest.category, gameDate: date, occurredAt, ruleVersion: CONFIG_BALANCE.version, private: !!quest.private }));
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: reward.xp, gold: reward.gold, attributes: reward.attributes, goodDoctorPoints, greatDisciplinePoints, grantedAt: occurredAt }));
      if (missed) {
        await request(s.events.add({ id: makeId("event"), type: "quest_undone", reversesEventId: missed.id, sourceEventId: eventId, correction: true, gameDate: date, occurredAt }));
      }
      await request(s.audit.add({ id: makeId("audit"), type: "completion", eventId, at: occurredAt, sourceDate: date }));
    });
  } catch (error) {
    if (error?.name === "ConstraintError") throw new Error("This completion could not be recorded.");
    throw error;
  }

  if (quest.id === "daily-no-masturbation") await awardStreakBonus(db, quest.id, 7, "greatDisciplinePoints", CONFIG_BALANCE.pointAwards.noMasturbationSevenDayBonus, clock, date);
  const result = await rebuildAndPersist(db, { clock });
  if (date === gameDate(clock)) await evaluateDay(db, clock);
  return { ...result, reward: deltaBetween(before, result.projection), quest, eventId };
}

export async function completeQuest(db, questId, clock = new Date()) {
  return completeQuestOnDate(db, questId, gameDate(clock), clock);
}

async function awardStreakBonus(db, questId, streak, pointField, amount, clock, targetDate = gameDate(clock)) {
  const data = await load(db);
  const current = streakEndingOn(data.events, data.quests, questId, targetDate);
  if (current !== streak) return;
  const date = targetDate, claimKey = `streak-bonus:${pointField}:${questId}:${date}:${streak}`;
  const existing = data.events.some(e => e.type === "streak_bonus" && e.questId === questId && e.streak === streak && e.gameDate === date && e.pointField === pointField);
  if (existing) return;
  const eventId = makeId("event");
  await tx(db, ["completionClaims", "events", "rewardGrants", "audit"], "readwrite", async s => {
    try { await request(s.completionClaims.add({ key: `${claimKey}:${eventId}`, eventId, createdAt: now(clock) })); }
    catch (error) { if (error?.name === "ConstraintError") return; throw error; }
    await request(s.events.add({ id: eventId, type: "streak_bonus", questId, streak, pointField, gameDate: date, occurredAt: now(clock), category: "Achievement" }));
    await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: 0, gold: 0, attributes: {}, [pointField]: amount, grantedAt: now(clock) }));
    await request(s.audit.add({ id: makeId("audit"), type: "streak_bonus", eventId, at: now(clock) }));
  });
}

export async function completeRecovery(db, clock = new Date()) {
  const projection = await get(db, "projections", "current");
  if (!projection?.recovery?.available) throw new Error("No recovery quest is available.");
  const before = projection;
  const date = gameDate(clock), claimKey = `recovery:${date}`, eventId = makeId("event");
  try {
    await tx(db, ["completionClaims", "events", "rewardGrants", "audit"], "readwrite", async s => {
      await request(s.completionClaims.add({ key: claimKey, eventId, createdAt: now(clock) }));
      await request(s.events.add({ id: eventId, type: "recovery_completed", gameDate: date, occurredAt: now(clock), category: "Recovery", description: "Returned to the path." }));
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: 40, gold: 15, attributes: { RESILIENCE: 2, WILLPOWER: 1 }, grantedAt: now(clock) }));
      await request(s.audit.add({ id: makeId("audit"), type: "recovery", eventId, at: now(clock) }));
    });
  } catch (error) {
    if (error?.name === "ConstraintError") throw new Error("Recovery already completed today.");
    throw error;
  }
  const result = await rebuildAndPersist(db, { clock });
  result.projection.recovery = { available: false, reason: null, sourceQuestId: null };
  await put(db, "projections", { id: "current", ...result.projection });
  return { ...result, reward: deltaBetween(before, result.projection), eventId, quest: { name: "Recovery Quest", category: "Recovery" } };
}

async function currentMetricTotal(db, metric, date) {
  const events = await getAll(db, "events");
  return liveMetricTotalFromEvents(events, metric, date);
}

async function logMetricBase(db, metric, amount, clock, targetDate = gameDate(clock)) {
  const date = targetDate, nowIso = now(clock), eventId = makeId("event");
  const before = await get(db, "projections", "current") || rebuildProjection(await load(db));
  const previous = await currentMetricTotal(db, metric, date);
  const total = previous + amount;

  let goodDoctorPoints = 0, greatDisciplinePoints = 0;
  if (metric === "study") {
    goodDoctorPoints = Math.floor(amount / 60) * CONFIG_BALANCE.pointAwards.studyGoodDoctorPerHour;
    if (amount >= 600) goodDoctorPoints += CONFIG_BALANCE.pointAwards.studyTenHourSessionBonus;
  }
  if (metric === "anki") {
    goodDoctorPoints = Math.floor(total / 25) - Math.floor(previous / 25);
    goodDoctorPoints *= CONFIG_BALANCE.pointAwards.ankiGoodDoctorPer25;
  }
  if (metric === "meditation") {
    greatDisciplinePoints += Math.floor(total / 20) * CONFIG_BALANCE.pointAwards.meditationGreatDisciplinePer20Min - Math.floor(previous / 20) * CONFIG_BALANCE.pointAwards.meditationGreatDisciplinePer20Min;
    if (date === gameDate(clock) && clock.getHours() < CONFIG_BALANCE.targets.morningMeditationEndHour) {
      const dayEvents = await getAll(db, "events");
      const alreadyMorning = dayEvents.some(e => e.type === "morning_meditation_bonus" && e.gameDate === date);
      if (!alreadyMorning) greatDisciplinePoints += CONFIG_BALANCE.pointAwards.morningMeditationBonus;
    }
  }

  const tierDefs = CONFIG_BALANCE.quantity[metric] ? [].concat(CONFIG_BALANCE.quantity[metric]) : [];
  const thresholdHits = tierDefs.filter(t => previous < t.at && total >= t.at);
  const eventsToComplete = [];

  await tx(db, ["events", "completionClaims", "rewardGrants", "audit"], "readwrite", async s => {
    await request(s.events.add({ id: eventId, type: metric === "study" ? "study_completed" : "quantity_logged", metric, amount, minutes: metric === "study" ? amount : undefined, gameDate: date, occurredAt: nowIso, category: metricCategory(metric) }));
    if (greatDisciplinePoints || goodDoctorPoints) {
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId, xp: 0, gold: 0, attributes: {}, greatDisciplinePoints, goodDoctorPoints, grantedAt: nowIso }));
    }
    for (const tier of thresholdHits) {
      const tierEventId = makeId("event"), claim = `quantity:${metric}:${date}:${tier.at}:${tierEventId}`;
      try { await request(s.completionClaims.add({ key: claim, eventId: tierEventId, createdAt: nowIso })); }
      catch (error) { if (error?.name === "ConstraintError") continue; throw error; }
      await request(s.events.add({ id: tierEventId, type: "quantity_target_reached", metric, threshold: tier.at, gameDate: date, occurredAt: nowIso, category: metricCategory(metric) }));
      const reward = rewardForMetricTier(metric, tier);
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId: tierEventId, xp: reward.xp, gold: reward.gold, attributes: reward.attributes, grantedAt: nowIso }));
    }
    await request(s.audit.add({ id: makeId("audit"), type: "quantity", eventId, at: nowIso }));
  });

  const dailyQuests = await dailyMetricQuests(db, metric, date);
  const randomQuests = await randomMetricQuestsForDay(db, metric, date);
  const targetQuests = [...dailyQuests, ...randomQuests].filter(q => Number(q.target) > 0 && total >= Number(q.target));
  for (const quest of targetQuests) {
    const completed = await completeMetricBoundQuest(db, quest, date, clock);
    if (completed) eventsToComplete.push(completed);
  }

  if (metric === "study") {
    // Study 7-day consistency contributes Good Doctor points, once at the milestone.
    const data = await load(db); const streak = streakEndingOn(data.events, data.quests, "daily-study", date);
    if (streak === 7) await awardStreakBonus(db, "daily-study", 7, "goodDoctorPoints", CONFIG_BALANCE.pointAwards.studySevenDayBonus, clock, date);
  }
  if (metric === "meditation") {
    const data = await load(db); const streak = streakEndingOn(data.events, data.quests, "daily-meditation", date);
    if (streak === 7) await awardStreakBonus(db, "daily-meditation", 7, "greatDisciplinePoints", CONFIG_BALANCE.pointAwards.meditationSevenDayBonus, clock, date);
    if (date === gameDate(clock) && clock.getHours() < CONFIG_BALANCE.targets.morningMeditationEndHour) {
      const dateEvents = await getAll(db, "events");
      if (!dateEvents.some(e => e.type === "morning_meditation_bonus" && e.gameDate === date)) {
        const bonusEventId = makeId("event");
        await tx(db, ["events", "rewardGrants", "audit"], "readwrite", async s => {
          await request(s.events.add({ id: bonusEventId, type: "morning_meditation_bonus", gameDate: date, occurredAt: nowIso, category: "Mindfulness" }));
          await request(s.rewardGrants.add({ id: makeId("grant"), eventId: bonusEventId, xp: 0, gold: 0, attributes: {}, greatDisciplinePoints: 0, grantedAt: nowIso }));
          await request(s.audit.add({ id: makeId("audit"), type: "morning_meditation", eventId: bonusEventId, at: nowIso }));
        });
      }
    }
  }

  const result = await rebuildAndPersist(db, { clock });
  await evaluateDay(db, clock);
  return { ...result, reward: deltaBetween(before, result.projection), metric, amount, total, eventId, completedQuests: eventsToComplete };
}

export async function logStudyOnDate(db, minutes, targetDate, clock = new Date()) {
  minutes = Math.max(1, Math.min(1440, Number(minutes) || 0));
  if (!minutes) throw new Error("Enter a positive study duration.");
  return logMetricBase(db, "study", minutes, clock, targetDate || gameDate(clock));
}

export async function logStudy(db, minutes, clock = new Date()) {
  return logStudyOnDate(db, minutes, gameDate(clock), clock);
}

export async function logQuantityOnDate(db, metric, amount, targetDate, clock = new Date()) {
  const allowed = new Set(["anki", "meditation", "protein", "calories", "sleep", "skincare", "water"]);
  if (!allowed.has(metric)) throw new Error("Unknown metric.");
  amount = Math.max(0.1, Math.min(100000, Number(amount) || 0));
  if (!amount) throw new Error("Enter a positive amount.");
  return logMetricBase(db, metric, amount, clock, targetDate || gameDate(clock));
}

export async function logQuantity(db, metric, amount, clock = new Date()) {
  return logQuantityOnDate(db, metric, amount, gameDate(clock), clock);
}

export async function logStudyStart(db, clock = new Date()) {
  const date = gameDate(clock), eventId = makeId("event");
  await tx(db, ["events", "audit"], "readwrite", async s => {
    await request(s.events.add({ id: eventId, type: "study_started", gameDate: date, occurredAt: now(clock), category: "Study" }));
    await request(s.audit.add({ id: makeId("audit"), type: "study_start", eventId, at: now(clock) }));
  });
  return { eventId };
}

export async function undoQuest(db, eventId) {
  const event = await get(db, "events", eventId);
  if (!event || !["quest_completed", "study_started", "study_completed", "quantity_logged"].includes(event.type)) throw new Error("That event cannot be corrected.");
  const existing = await getAll(db, "events");
  if (!liveEvent(existing, eventId)) throw new Error("This event is already uncompleted.");

  const additions = [];
  // A quantity/study entry can unlock threshold rewards and metric-bound daily quests.
  // Remove those derived events when the remaining total no longer supports them.
  if (event.type === "quantity_logged" || event.type === "study_completed") {
    const metric = event.metric || "study";
    const date = event.gameDate;
    // The source entry is still live until the undo events are committed; subtract it explicitly for the simulation.
    const sourceAmount = Number(event.amount ?? event.minutes ?? 0);
    const currentTotal = liveMetricTotalFromEvents(existing, metric, date);
    const remainingTotal = Math.max(0, currentTotal - sourceAmount);
    for (const derived of liveEvents(existing)) {
      if (derived.type === "quantity_target_reached" && derived.metric === metric && derived.gameDate === date && Number(derived.threshold || 0) > remainingTotal) {
        additions.push(derived.id);
      }
      if (derived.type === "quest_completed" && derived.gameDate === date) {
        const q = (await get(db, "questDefinitions", derived.questId));
        if (q && (q.mode === "quantity" || q.actionType === "metric") && q.metric === metric && Number(q.target || 0) > remainingTotal) additions.push(derived.id);
      }
    }
    // Streak bonuses tied to the removed day are valid only while the streak still reaches the threshold.
    if (["study", "meditation"].includes(metric)) {
      const questId = metric === "study" ? "daily-study" : "daily-meditation";
      const questDefs = await getAll(db, "questDefinitions");
      const candidateEvents = liveEvents(existing).filter(e => e.id !== eventId);
      const derivedIds = new Set(additions);
      const simulatedEvents = candidateEvents.filter(e => !derivedIds.has(e.id));
      const remainingStreak = streakEndingOn(simulatedEvents, questDefs, questId, date);
      if (remainingStreak < 7) {
        for (const bonus of liveEvents(existing).filter(e => e.type === "streak_bonus" && e.questId === questId && e.gameDate === date && Number(e.streak) === 7)) additions.push(bonus.id);
      }
    }
  }
  if (event.type === "quest_completed" && event.questId === "daily-no-masturbation") {
    for (const bonus of liveEvents(existing).filter(e => e.type === "streak_bonus" && e.questId === event.questId && e.gameDate === event.gameDate && e.pointField === "greatDisciplinePoints" && Number(e.streak) === 7)) additions.push(bonus.id);
  }
  const unique = [...new Set(additions)].filter(id => id !== eventId);
  const undoIds = [eventId, ...unique];
  await tx(db, ["events", "audit"], "readwrite", async s => {
    for (const target of undoIds) {
      const undo = { id: makeId("event"), type: "quest_undone", reversesEventId: target, sourceEventId: eventId, gameDate: gameDate(), occurredAt: now() };
      await request(s.events.add(undo));
      await request(s.audit.add({ id: makeId("audit"), type: "undo", eventId: undo.id, reversedEventId: target, at: undo.occurredAt }));
    }
  });
  return { ...(await rebuildAndPersist(db)), silent: true, undoneEventIds: undoIds };
}

export async function toggleQuest(db, questId, enabled) {
  const quest = await get(db, "questDefinitions", questId); if (!quest) throw new Error("Quest not found.");
  quest.enabled = !!enabled; await put(db, "questDefinitions", quest); return quest;
}

export async function equipTitle(db, title) {
  const profile = await get(db, "profile", "current"); profile.title = title || null; await put(db, "profile", profile); return profile;
}

export async function setQuestOrderRandomCount(db, count) {
  const settings = await getSettings(db); settings.randomCount = Math.max(3, Math.min(7, Number(count) || 5)); await saveSettings(db, settings); return settings;
}

export async function createQuest(db, input) {
  const name = String(input.name || "").trim(); if (!name) throw new Error("Name your quest.");
  const quest = { id: makeId("quest"), name: name.slice(0, 80), category: CATEGORIES.includes(input.category) ? input.category : "Discipline", recurring: !!input.recurring, kind: "quest", enabled: true, reward: { xp: Math.max(1, Math.min(500, Number(input.xp) || 20)), gold: Math.max(0, Math.min(500, Number(input.gold) || 5)), attributes: {} }, createdAt: now() };
  await put(db, "questDefinitions", quest); return quest;
}

export async function createShopReward(db, input) {
  const name = String(input.name || "").trim(); assertSafeShopReward(name);
  const item = { id: makeId("shop"), name: name.slice(0, 80), cost: Math.max(1, Math.min(100000, Number(input.cost) || 100)), createdAt: now(), kind: "shop_reward" };
  await put(db, "settings", item); return item;
}

export async function buyShopReward(db, itemId) {
  const item = await get(db, "settings", itemId), p = await get(db, "projections", "current");
  if (!item || item.kind !== "shop_reward") throw new Error("Reward not found.");
  if ((p?.gold || 0) < item.cost) throw new Error("Not enough gold.");
  const id = makeId("event"), date = gameDate();
  try {
    await tx(db, ["completionClaims", "events", "rewardGrants", "audit"], "readwrite", async s => {
      await request(s.completionClaims.add({ key: `purchase:${itemId}:${date}`, eventId: id, createdAt: now() }));
      await request(s.events.add({ id, type: "shop_purchased", itemId, itemName: item.name, gameDate: date, occurredAt: now() }));
      await request(s.rewardGrants.add({ id: makeId("grant"), eventId: id, xp: 0, gold: -item.cost, attributes: {}, grantedAt: now() }));
      await request(s.audit.add({ id: makeId("audit"), type: "purchase", eventId: id, at: now() }));
    });
  } catch (error) { if (error?.name === "ConstraintError") throw new Error("This reward was already claimed today."); throw error; }
  return rebuildAndPersist(db);
}

function dailyMetricTotalFromEvents(events, metric, date) {
  if (metric === "study") return events.filter(e => e.type === "study_completed" && e.gameDate === date).reduce((s, e) => s + Number(e.minutes || 0), 0);
  return events.filter(e => e.type === "quantity_logged" && e.metric === metric && e.gameDate === date).reduce((s, e) => s + Number(e.amount || 0), 0);
}

export async function dashboard(db, clock = new Date(), options = {}) {
  if (options.evaluate !== false) await evaluateDay(db, clock);
  const [profile, projection, quests, events, achievements, settings] = await Promise.all([
    get(db, "profile", "current"), get(db, "projections", "current"), getAll(db, "questDefinitions"), getAll(db, "events"), getAll(db, "achievementUnlocks"), getAll(db, "settings")
  ]);
  const date = gameDate(clock);
  const live = liveEvents(events);
  const liveQuests = quests.filter(q => !q.archived);
  const doneToday = new Set(live.filter(e => e.type === "quest_completed" && e.gameDate === date).map(e => e.questId));
  const missed = new Set(live.filter(e => e.type === "daily_missed" && e.sourceDate === date).map(e => e.questId));
  const work = liveQuests.filter(q => q.kind === "daily" && q.enabled !== false);
  const randoms = liveQuests.filter(q => q.kind === "random" && q.dailyDate === date);
  const custom = liveQuests.filter(q => (q.kind === "quest" || q.kind === "study_start") && (q.recurring || !doneToday.has(q.id)));
  const disabled = liveQuests.filter(q => q.kind === "daily" && q.enabled === false);
  const enrich = q => {
    if (q.mode === "quantity" || q.actionType === "metric") {
      const total = liveMetricTotalFromEvents(events, q.metric, date);
      return { ...q, progressValue: total, progressTarget: Number(q.target || 0), doneToday: doneToday.has(q.id), missedToday: missed.has(q.id), doneEventId: live.find(e => e.type === "quest_completed" && e.questId === q.id && e.gameDate === date)?.id || null, missedEventId: live.find(e => e.type === "daily_missed" && e.questId === q.id && e.sourceDate === date)?.id || null };
    }
    return { ...q, doneToday: doneToday.has(q.id), missedToday: missed.has(q.id), doneEventId: live.find(e => e.type === "quest_completed" && e.questId === q.id && e.gameDate === date)?.id || null, missedEventId: live.find(e => e.type === "daily_missed" && e.questId === q.id && e.sourceDate === date)?.id || null };
  };
  const evaluate = options.evaluate === false ? {
    phase: dayState(clock).phase,
    doneToday: doneToday.size,
    unfinishedToday: work.filter(q => !doneToday.has(q.id)).length,
    workCount: work.length,
    recovery: { available: false, reason: null, task: null }
  } : await evaluateDay(db, clock);
  return {
    profile, projection,
    quests: liveQuests,
    work: work.map(enrich),
    randoms: randoms.map(enrich),
    custom: custom.map(enrich),
    disabled,
    events: events.slice().sort((a, b) => String(b.occurredAt || "").localeCompare(String(a.occurredAt || ""))),
    achievements,
    shop: settings.filter(s => s.kind === "shop_reward"),
    day: evaluate,
    settings: settings.find(s => s.id === "game-config") || {},
    viewDate: date
  };
}
