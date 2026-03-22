const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

/**
 * Charge le plugin pathfinder sur le bot.
 * A appeler une seule fois apres la creation du bot.
 *
 * @param {import('mineflayer').Bot} bot
 */
function setupPathfinder(bot) {
  bot.loadPlugin(pathfinder);
}

/**
 * Cree un objet Movements configure pour le bot.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Movements}
 */
function createMovements(bot) {
  const movements = new Movements(bot);
  movements.canDig = false;
  movements.canPlace = false;
  movements.canOpenDoors = true;
  movements.allow1by1towers = false;
  movements.allowFreeMotion = true;
  movements.allowParkour = false;

  return movements;
}

/**
 * Deplace le bot vers des coordonnees XYZ.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [range=0] - Distance d'arret en blocs
 * @returns {Promise<void>}
 */
async function goTo(bot, x, y, z, range = 0) {
  bot.pathfinder.setMovements(createMovements(bot));
  try {
    await bot.pathfinder.goto(new goals.GoalNear(x, y, z, range));
  } catch (err) {
    const isNoPath =
      err.name === 'NoPath' ||
      err.message?.toLowerCase().includes('no path') ||
      err.message?.toLowerCase().includes('pathfinding failed');
    if (isNoPath && range < 5) {
      // Réessaye avec une tolérance de 5 blocs
      await bot.pathfinder.goto(new goals.GoalNear(x, y, z, 5));
    } else {
      throw err;
    }
  }
}

/**
 * Suit un joueur en continu.
 * Appeler stopMovement() pour arreter.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} username
 * @param {number} [range=2]
 */
function followPlayer(bot, username, range = 2) {
  const player = bot.players[username]?.entity;
  if (!player) throw new Error(`Joueur introuvable: ${username}`);

  bot.pathfinder.setMovements(createMovements(bot));
  bot.pathfinder.setGoal(new goals.GoalFollow(player, range), true);
}

/**
 * Arrete tout deplacement en cours.
 *
 * @param {import('mineflayer').Bot} bot
 */
function stopMovement(bot) {
  bot.pathfinder.setGoal(null);
}

module.exports = { setupPathfinder, createMovements, goTo, followPlayer, stopMovement };
