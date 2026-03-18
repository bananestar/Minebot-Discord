const Logger = require('./logger');
const { goTo } = require('./pathfinder');

const FOOD_THRESHOLD = 18; // mange en dessous de 18/20
const HEAL_THRESHOLD = 14; // soigne en dessous de 7 coeurs (14/20)
const HEAL_ITEMS = ['golden_apple', 'enchanted_golden_apple'];

async function consumeItem(bot, item) {
  await bot.equip(item, 'hand');
  await bot.consume();
}

function setupAutoEat(bot) {
  let enabled = true;
  let isEating = false;

  bot.on('health', async () => {
    if (!enabled) return;
    if (isEating) return;
    if (bot.food >= FOOD_THRESHOLD) return;

    const foodItem = bot.inventory.items().find((item) => bot.isFood(item));
    if (!foodItem) return;

    isEating = true;
    try {
      await consumeItem(bot, foodItem);
      Logger.success(
        `🍗 Auto-eat: ${foodItem.name} mangé (faim: ${Math.round(bot.food)}/20).`,
      );
    } catch (err) {
      Logger.warn(`🍗 Auto-eat erreur: ${err.message}`);
    } finally {
      isEating = false;
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
  let isHealing = false;

  bot.on('health', async () => {
    if (!enabled) return;
    if (isHealing) return;
    if (bot.health >= HEAL_THRESHOLD) return;

    isHealing = true;
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
      const foodItem = bot.inventory.items().find((item) => bot.isFood(item));
      if (!foodItem) {
        Logger.warn('💊 Auto-heal: aucun item de soin ni nourriture disponible.');
        return;
      }

      await consumeItem(bot, foodItem);
      Logger.info(`🍗 Auto-heal via nourriture: ${foodItem.name} mangé.`);
    } catch (err) {
      Logger.warn(`💊 Auto-heal erreur: ${err.message}`);
    } finally {
      isHealing = false;
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

function setupAutoSleep(bot) {
  let enabled = false;
  let isRunning = false;
  let savePosition = null;
  let lastAttempt = 0;

  bot.on('time', async () => {
    if (!enabled) return;
    if (isRunning) return;
    if (bot.isSleeping) return;

    // Nuit : entre 12542 et 23460 (ticks Minecraft)
    const time = bot.time.timeOfDay;
    if (time < 12542 || time > 23460) return;

    const now = Date.now();
    if (now - lastAttempt < SLEEP_RETRY_INTERVAL) return;
    lastAttempt = now;

    isRunning = true;
    savePosition = bot.entity.position.clone();

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
        bot.chat(`Je vais dormir, ${playerNames} ! 😴`);
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
      isRunning = false;
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

    bot.chat(`Bonjour ${player.username} ! 👋`);

    if (!isUserWhitelistedMC(player.username)) return;

    // Petit délai pour ne pas spammer en même temps que le bonjour
    await new Promise((res) => setTimeout(res, 1500));

    const health = Math.round(bot.health ?? 0);
    const food = Math.round(bot.food ?? 0);
    const sat = (bot.foodSaturation ?? 0).toFixed(1);
    const pos = bot.entity?.position;
    const posStr = pos
      ? `(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`
      : 'inconnue';

    bot.chat(
      `/msg ${player.username} [Rapport] ❤ ${health}/20 | 🍖 ${food}/20 | ⚡ ${sat}/5 | Pos: ${posStr}`,
    );
  });
}

module.exports = { setupAutoSleep, setupAutoEat, setupAutoHeal, setupGreeting };
