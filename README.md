# Mimi — Life RPG

This is the lightweight Android-first PWA for Mimi.

## Run on Windows
Double-click `START-MIMI.bat`, then open `http://127.0.0.1:8000/` in Chrome.
Do not open `index.html` with `file://` because ES modules and the service worker require HTTP/HTTPS.

## Current iteration
- Fantasy forest background and RPG UI assets
- Character/stat HUD
- Achievement board
- Daily Random Quests and Daily Work Quests
- 7 PM warning / 9 PM recovery window / midnight daily finalization
- Quantity logging for Study, Meditation, Protein, Calories, Anki, Sleep and Skin Care
- Great Discipline and Good Doctor point systems
- Achievement stacking, streaks and recovery
- Completion reward sequence with XP/stats, gold, achievement/proximity and motivational line
- IndexedDB local-first persistence and backups

## Privacy
No accounts, analytics or advertising are included.
Sensitive private-goal data stays local in the browser database.


Current browser cache: service-worker cache v9. If an older PWA is already installed, reload once after replacing the files so the new worker can take control.
