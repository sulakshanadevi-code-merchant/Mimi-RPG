const CACHE_NAME = "mimi-shell-v12";
const APP_SHELL = [
  "./", "./index.html", "./offline.html", "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js", "./js/domain.js", "./js/config.js", "./js/database.js", "./js/game.js", "./js/backup.js", "./js/selftest.js",
  "./assets/icons/mimi-icon.svg", "./assets/icons/mimi-mark.svg",
  "./assets/images/achievement_unlock_box.png",
  "./assets/mimi_rpg_ui_asset_pack/background/forest-background.webp",
  "./assets/mimi_rpg_ui_asset_pack/background/forest.webp",
  "./assets/mimi_rpg_ui_asset_pack/character/mimi-portrait.webp",
"./assets/mimi_rpg_ui_asset_pack/bars/hp-bar.webp", "./assets/mimi_rpg_ui_asset_pack/bars/gold-bar.webp",
  "./assets/mimi_rpg_ui_asset_pack/panels/dark-panel-large.webp", "./assets/mimi_rpg_ui_asset_pack/panels/dark-panel-wide.webp", "./assets/mimi_rpg_ui_asset_pack/panels/hud-strip.webp", "./assets/mimi_rpg_ui_asset_pack/panels/parchment-panel.webp",
  "./assets/mimi_rpg_ui_asset_pack/status/at-risk.webp", "./assets/mimi_rpg_ui_asset_pack/status/recovery.webp", "./assets/mimi_rpg_ui_asset_pack/status/quest-complete.webp", "./assets/mimi_rpg_ui_asset_pack/status/confirm.webp", "./assets/mimi_rpg_ui_asset_pack/status/cancel.webp",
  "./assets/mimi_rpg_ui_asset_pack/navigation/home.webp", "./assets/mimi_rpg_ui_asset_pack/navigation/quests.webp", "./assets/mimi_rpg_ui_asset_pack/navigation/progress.webp", "./assets/mimi_rpg_ui_asset_pack/navigation/collection.webp", "./assets/mimi_rpg_ui_asset_pack/navigation/history.webp", "./assets/mimi_rpg_ui_asset_pack/navigation/profile.webp",
  "./assets/mimi_rpg_ui_asset_pack/stats/strength.webp", "./assets/mimi_rpg_ui_asset_pack/stats/intelligence.webp", "./assets/mimi_rpg_ui_asset_pack/stats/vitality.webp", "./assets/mimi_rpg_ui_asset_pack/stats/wisdom.webp", "./assets/mimi_rpg_ui_asset_pack/stats/charisma.webp", "./assets/mimi_rpg_ui_asset_pack/stats/discipline.webp", "./assets/mimi_rpg_ui_asset_pack/stats/willpower.webp", "./assets/mimi_rpg_ui_asset_pack/stats/resilience.webp",
  "./assets/Design/collection-cosmic-bg.webp",
  "./assets/achievements/bars/bar_brain.webp", "./assets/achievements/bars/bar_compass.webp", "./assets/achievements/bars/bar_cube.webp", "./assets/achievements/bars/bar_flame.webp", "./assets/achievements/bars/bar_heart.webp", "./assets/achievements/bars/bar_leaf.webp", "./assets/achievements/bars/bar_moon.webp", "./assets/achievements/bars/bar_star.webp",
  "./assets/achievements/rank_badges/rank_epic.webp", "./assets/achievements/rank_badges/rank_legendary.webp", "./assets/achievements/rank_badges/rank_god.webp",
  "./assets/achievements/rank_badges/rank_god_doctor_01.webp", "./assets/achievements/rank_badges/rank_god_doctor_02.webp", "./assets/achievements/rank_badges/rank_god_doctor_03.webp", "./assets/achievements/rank_badges/rank_god_doctor_04.webp",
  "./assets/achievements/milestones/study_lock_in.webp", "./assets/achievements/milestones/study_holy_peak.webp", "./assets/achievements/milestones/study_mahoraga.webp", "./assets/achievements/milestones/study_proud_of_you.webp", "./assets/achievements/milestones/study_we_love_you.webp", "./assets/achievements/milestones/study_peace.webp",
  "./assets/achievements/traits/trait_absolute_discipline.webp", "./assets/achievements/traits/trait_enlightened_mind.webp", "./assets/achievements/traits/trait_inner_calm.webp", "./assets/achievements/traits/trait_iron_forged.webp", "./assets/achievements/traits/trait_keeper_of_attention.webp", "./assets/achievements/traits/trait_mountains_of_resilience.webp", "./assets/achievements/traits/trait_stillness.webp", "./assets/achievements/traits/trait_the_summit.webp", "./assets/achievements/traits/trait_unbroken_mind.webp"
];
self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith("mimi-shell-") && k !== CACHE_NAME).map(k => caches.delete(k))
  )).then(() => self.clients.claim())
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") return (await caches.match("./offline.html")) || new Response("Offline", {status: 503});
      return new Response("", {status: 503, statusText: "Asset unavailable"});
    }
  })());
});
