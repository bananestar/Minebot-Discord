const state = require('../../state');
const { goTo } = require('../../utils/pathfinder');

/**
 * Déplace le bot vers des coordonnées XYZ.
 * Gère le state (action, args, abort) et retourne un résultat structuré.
 *
 * @param {object} bot - Instance mineflayer
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Promise<{ok: true} | {ok: false, aborted: true} | {ok: false, error: string}>}
 */
async function gotoAction(bot, x, y, z) {
  state.setAbortCurrentAction(false);
  state.setCurrentActionArgs([String(x), String(y), String(z)]);
  state.setCurrentAction('navigating');
  try {
    await goTo(bot, x, y, z);
    return { ok: true };
  } catch (err) {
    if (state.getAbortCurrentAction()) return { ok: false, aborted: true };
    return { ok: false, error: err.message };
  } finally {
    state.setAbortCurrentAction(false);
    if (state.getCurrentAction() === 'navigating') state.setCurrentAction('idle');
  }
}

module.exports = { gotoAction };
