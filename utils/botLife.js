const Logger = require('./logger');
const { goTo } = require('./pathfinder');

function setupAutoSleep(bot) {
  let enabled = false;
  let isRunning = false;
  let savePosition = null;

  bot.on('time', async () => {
    if (!enabled) return;
    if (isRunning) return;
    if (bot.isSleeping) return;

    // Nuit : entre 12542 et 23460 (ticks Minecraft)
    const time = bot.time.timeOfDay;
    if (time < 12542 || time > 23460) return;

    isRunning = true;
    savePosition = bot.entity.position.clone();

    try {
      // Cherche un lit libre dans un rayon de 32 blocs
      const bed = bot.findBlock({
        matching: (block) => block.name.endsWith('_bed'),
        maxDistance: 32,
        useExtraInfo: (block) => {
          return block.getProperties().occupied === 'false';
        },
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

module.exports = { setupAutoSleep };
