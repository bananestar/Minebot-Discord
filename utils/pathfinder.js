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
  return new Movements(bot);
}

/**
 * Deplace le bot vers des coordonnees XYZ.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [range=1] - Distance d'arret en blocs
 * @returns {Promise<void>}
 */
async function goTo(bot, x, y, z, range = 1) {
  const movements = createMovements(bot);
  movements.canDig = false;
  bot.pathfinder.setMovements(movements);
  await bot.pathfinder.goto(new goals.GoalNear(x, y, z, range));
}

/**
 * Suit un joueur en continu.
 * Appeler stopFollow() pour arreter.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} username
 * @param {number} [range=2]
 */
function followPlayer(bot, username, range = 2) {
  const player = bot.players[username]?.entity;
  if (!player) throw new Error(`Joueur introuvable: ${username}`);

  const movements = createMovements(bot);
  movements.canDig = false;
  bot.pathfinder.setMovements(movements);
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

module.exports = { setupPathfinder, goTo, followPlayer, stopMovement };
