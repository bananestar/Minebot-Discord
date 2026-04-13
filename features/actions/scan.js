const state = require('../../state');
const { scanChests } = require('../../utils/scanner');

/**
 * Scanne les coffres/barils dans une zone cubique.
 * Gère le state (action, args) et retourne un résultat structuré.
 * Note : setCurrentAction('idle') est à la charge de l'appelant,
 * après la boucle d'affichage (qui peut être interrompue par abort).
 *
 * @param {object} bot - Instance mineflayer
 * @param {{x: number, y: number, z: number}} pos1
 * @param {{x: number, y: number, z: number}} pos2
 * @param {string[]} rawArgs - Args bruts pour le state (résumabilité)
 * @returns {{ok: true, results: Array} | {ok: false, error: string}}
 */
function scanAction(bot, pos1, pos2, rawArgs) {
  state.setAbortCurrentAction(false);
  state.setCurrentActionArgs(rawArgs);
  state.setCurrentAction('scanning');
  try {
    const results = scanChests(bot, pos1, pos2);
    return { ok: true, results };
  } catch (err) {
    state.setCurrentAction('idle');
    return { ok: false, error: err.message };
  }
}

module.exports = { scanAction };
