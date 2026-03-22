const fs = require('fs');
const path = require('path');
const state = require('../state');

const CRASHES_DIR = path.join(__dirname, '..', 'crashes');

/**
 * Sérialise l'état courant du bot et l'écrit dans crashes/<timestamp>_<event>.json.
 *
 * @param {string} event  - Nom de l'événement déclencheur ('end', 'kicked', 'error', 'uncaughtException', etc.)
 * @param {string|null} reason - Raison du crash/déconnexion
 * @returns {object} Le snapshot écrit
 */
function dumpState(event, reason = null) {
  const bot = state.getBot();
  const pos = state.getPosition();
  const connectedTime = state.getConnectedTime();

  const snapshot = {
    timestamp: new Date().toISOString(),
    event,
    reason: reason ?? null,

    bot: bot
      ? {
          username: bot.username ?? null,
          health: bot.health ?? null,
          food: bot.food ?? null,
          foodSaturation:
            bot.foodSaturation != null
              ? Number(bot.foodSaturation.toFixed(2))
              : null,
          isSleeping: bot.isSleeping ?? false,
        }
      : null,

    position: pos
      ? {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          z: Math.round(pos.z),
        }
      : null,

    state: {
      currentAction: state.getCurrentAction(),
      isEating: state.getIsEating(),
      isHealing: state.getIsHealing(),
      isSleeping: state.getIsSleeping(),
      autoSleepEnabled: state.getAutoSleepInstance()?.isEnabled() ?? false,
      connectedTime: connectedTime?.toISOString() ?? null,
      uptimeMs: connectedTime ? Date.now() - connectedTime.getTime() : null,
    },

    inventory: bot
      ? bot.inventory
          .items()
          .slice(0, 100)
          .map((item) => ({ name: item.name, count: item.count }))
      : [],
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${ts}_${event}.json`;
  const filepath = path.join(CRASHES_DIR, filename);

  try {
    fs.mkdirSync(CRASHES_DIR, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.error(`[StateDumper] État sauvegardé → ${filepath}`);
  } catch (err) {
    console.error(
      `[StateDumper] Impossible d'écrire ${filename}: ${err.message}`,
    );
  }

  return snapshot;
}

const MAX_CRASH_AGE_DAYS = 7;

function cleanOldCrashes() {
  if (!fs.existsSync(CRASHES_DIR)) return;
  const cutoff = Date.now() - MAX_CRASH_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(CRASHES_DIR)) {
    if (!f.endsWith('.json')) continue;
    const fp = path.join(CRASHES_DIR, f);
    try {
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    } catch {}
  }
}

module.exports = { dumpState, cleanOldCrashes, CRASHES_DIR };
