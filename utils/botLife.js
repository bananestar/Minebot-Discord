const Logger = require('./logger');
const { goTo } = require('./pathfinder');
const state = require('../state');
const {
  randomGreeting,
  randomSleepMessage,
  randomDailyMessage,
} = require('./messages');

const FOOD_THRESHOLD = 18; // mange en dessous de 18/20
const HEAL_THRESHOLD = 14; // soigne en dessous de 7 coeurs (14/20)
const HEAL_ITEMS = ['golden_apple', 'enchanted_golden_apple'];

async function consumeItem(bot, item) {
  const previousGoal = bot.pathfinder?.goal ?? null;
  bot.pathfinder?.setGoal(null);
  await bot.equip(item, 'hand');
  await bot.consume();
  if (previousGoal) bot.pathfinder.setGoal(previousGoal);
}

function setupAutoEat(bot) {
  let enabled = true;

  bot.on('health', async () => {
    if (!enabled) return;
    if (state.getIsEating()) return;
    if (bot.food >= FOOD_THRESHOLD) return;

    const foodItem = bot.inventory.items().find((item) => bot.registry.foodsByName[item.name]);
    if (!foodItem) return;

    state.setIsEating(true);
    state.setCurrentAction('eating');
    try {
      await consumeItem(bot, foodItem);
      Logger.success(
        `🍗 Auto-eat: ${foodItem.name} mangé (faim: ${Math.round(bot.food)}/20).`,
      );
    } catch (err) {
      if (!err.message?.includes('timed out')) {
        Logger.warn(`Auto-eat erreur: ${err.message}`);
      }
    } finally {
      state.setIsEating(false);
      if (state.getCurrentAction() === 'eating') state.setCurrentAction('idle');
    }
  });

  return {
    enable: () => {
      enabled = true;
      Logger.info('🍗 Auto-eat activé.');
    },
    disable: () => {
      enabled = false;
      Logger.info('🍗 Auto-eat désactivé.');
    },
    isEnabled: () => enabled,
  };
}

function setupAutoHeal(bot) {
  let enabled = true;

  bot.on('health', async () => {
    if (!enabled) return;
    if (state.getIsHealing()) return;
    if (bot.health >= HEAL_THRESHOLD) return;

    state.setIsHealing(true);
    state.setCurrentAction('healing');
    try {
      // Cherche un item de soin en priorité
      const healItem = bot.inventory
        .items()
        .find((item) => HEAL_ITEMS.includes(item.name));

      if (healItem) {
        await consumeItem(bot, healItem);
        Logger.success(
          `💊 Auto-heal: ${healItem.name} utilisé (santé: ${Math.round(bot.health)}/20).`,
        );
        return;
      }

      // Pas d'item de soin → mange pour déclencher la régénération naturelle
      Logger.warn(
        `💊 Auto-heal: pas d'item de soin, mange pour régénérer (santé: ${Math.round(bot.health)}/20).`,
      );
      const foodItem = bot.inventory.items().find((item) => bot.registry.foodsByName[item.name]);
      if (!foodItem) {
        Logger.warn(
          '💊 Auto-heal: aucun item de soin ni nourriture disponible.',
        );
        return;
      }

      await consumeItem(bot, foodItem);
      Logger.info(`🍗 Auto-heal via nourriture: ${foodItem.name} mangé.`);
    } catch (err) {
      Logger.warn(`💊 Auto-heal erreur: ${err.message}`);
    } finally {
      state.setIsHealing(false);
      if (state.getCurrentAction() === 'healing') state.setCurrentAction('idle');
    }
  });

  return {
    enable: () => {
      enabled = true;
      Logger.info('💊 Auto-heal activé.');
    },
    disable: () => {
      enabled = false;
      Logger.info('💊 Auto-heal désactivé.');
    },
    isEnabled: () => enabled,
  };
}

const SLEEP_RETRY_INTERVAL = 30_000; // réessaye toutes les 30s si pas de lit

function setupAutoSleep(bot, isUserWhitelistedMC) {
  let enabled = false;
  let savePosition = null;
  let lastAttempt = 0;

  bot.on('time', async () => {
    if (!enabled) return;
    if (state.getIsSleeping()) return;
    if (bot.isSleeping) return;

    // Nuit : entre 12542 et 23460 (ticks Minecraft)
    const time = bot.time.timeOfDay;
    if (time < 12542 || time > 23460) return;

    // Ne dort que si un joueur whitelisté est connecté (peut désactiver si besoin)
    const whitelistedOnline = Object.values(bot.players).some(
      (p) => p.username !== bot.username && isUserWhitelistedMC(p.username),
    );
    if (!whitelistedOnline) return;

    const now = Date.now();
    if (now - lastAttempt < SLEEP_RETRY_INTERVAL) return;
    lastAttempt = now;

    state.setIsSleeping(true);
    savePosition = bot.entity.position.clone();
    state.setCurrentAction('sleeping');
    state.setCurrentActionArgs([
      String(Math.round(savePosition.x)),
      String(Math.round(savePosition.y)),
      String(Math.round(savePosition.z)),
    ]);

    try {
      // Cherche un lit libre dans un rayon de 32 blocs
      const bed = bot.findBlock({
        matching: (block) => block.name.endsWith('_bed'),
        maxDistance: 32,
        useExtraInfo: (block) => !block.getProperties().occupied,
      });

      if (!bed) {
        Logger.warn('🛏️ Aucun lit disponible pour dormir.');
        return;
      }

      // Message aux joueurs connectés
      const players = Object.values(bot.players).filter(
        (p) => p.username !== bot.username,
      );

      if (players.length > 0) {
        const playerNames = players.map((p) => p.username).join(', ');
        bot.chat(randomSleepMessage(playerNames));
        await new Promise((res) => setTimeout(res, 1000));
      }

      // Se dirige vers le lit (range 2 = adjacent)
      await goTo(bot, bed.position.x, bed.position.y, bed.position.z, 2);

      await bot.sleep(bed);
      await new Promise((resolve) => bot.once('wake', resolve));

      Logger.info('☀️ Réveil, retour à la position initiale.');

      await goTo(bot, savePosition.x, savePosition.y, savePosition.z);
    } catch (err) {
      Logger.error(`💤 Erreur auto-sleep: ${err.message}`);
    } finally {
      state.setIsSleeping(false);
      if (state.getCurrentAction() === 'sleeping') state.setCurrentAction('idle');
      savePosition = null;
    }
  });

  return {
    enable: () => {
      enabled = true;
      Logger.info('💤 Auto-sleep activé.');
    },
    disable: () => {
      enabled = false;
      Logger.info('💤 Auto-sleep désactivé.');
    },
    isEnabled: () => enabled,
  };
}

function setupGreeting(bot, isUserWhitelistedMC) {
  const greetedToday = new Set();

  function scheduleReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    setTimeout(() => {
      greetedToday.clear();
      Logger.info('🌅 Reset des salutations journalières.');
      scheduleReset();
    }, midnight - now);
  }
  scheduleReset();

  bot.on('playerJoined', async (player) => {
    if (player.username === bot.username) return;
    if (greetedToday.has(player.username)) return;
    greetedToday.add(player.username);

    if (isUserWhitelistedMC(player.username)) {
      const health = Math.round(bot.health ?? 0);
      const food = Math.round(bot.food ?? 0);
      const sat = (bot.foodSaturation ?? 0).toFixed(1);
      const pos = bot.entity?.position;
      const posStr = pos
        ? `(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`
        : 'inconnue';

      bot.chat(
        `${randomGreeting(player.username)} [HP:${health}/20 | Food:${food}/20 | Sat:${sat}/5 | Pos:${posStr}]`,
      );
    } else {
      bot.chat(randomGreeting(player.username));
    }
  });
}

// ---------------------------------------------------------------------------
// Message quotidien aléatoire entre 12h00 et 02h00 (nuit suivante)
// ---------------------------------------------------------------------------

const DAILY_MSG_START_H = 12;
const DAILY_MSG_END_H = 2;

let dailyMessageTimer = null;

function computeNextFireTime() {
  const now = new Date();

  const windowStart = new Date(now);
  windowStart.setHours(DAILY_MSG_START_H, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 1);
  windowEnd.setHours(DAILY_MSG_END_H, 0, 0, 0);

  let start, end;
  if (now < windowStart) {
    // Avant midi : fenêtre complète d'aujourd'hui
    start = windowStart;
    end = windowEnd;
  } else if (now < windowEnd) {
    // Dans la fenêtre : de maintenant jusqu'à 2h
    start = now;
    end = windowEnd;
  } else {
    // Après 2h : fenêtre de demain
    start = new Date(windowStart);
    start.setDate(start.getDate() + 1);
    end = new Date(windowEnd);
    end.setDate(end.getDate() + 1);
  }

  const randomMs = Math.floor(Math.random() * (end - start));
  return new Date(start.getTime() + randomMs);
}

function setupDailyMessage(bot) {
  if (dailyMessageTimer) {
    clearTimeout(dailyMessageTimer);
    dailyMessageTimer = null;
  }

  function schedule() {
    const fireAt = computeNextFireTime();
    const delay = fireAt - Date.now();

    Logger.info(
      `[DailyMessage] Prochain message prevu a ${fireAt.toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' })}`,
    );

    dailyMessageTimer = setTimeout(() => {
      try {
        bot.chat(randomDailyMessage());
        Logger.info('[DailyMessage] Message quotidien envoye.');
      } catch (err) {
        Logger.warn(
          `[DailyMessage] Impossible d'envoyer le message : ${err.message}`,
        );
      }
      schedule();
    }, delay);
  }

  schedule();
}

module.exports = {
  setupAutoSleep,
  setupAutoEat,
  setupAutoHeal,
  setupGreeting,
  setupDailyMessage,
};
