const state = require('../../state');
const { stopMovement } = require('../../utils/pathfinder');

/**
 * Annule l'action en cours (goto, scan...).
 * Positionne le flag abort et remet le state à idle.
 *
 * @param {object} bot - Instance mineflayer
 * @returns {{ok: true, action: string} | {ok: false, reason: 'IDLE'}}
 */
function stopAction(bot) {
  const action = state.getCurrentAction();
  if (action === 'idle') return { ok: false, reason: 'IDLE' };

  stopMovement(bot);
  state.setAbortCurrentAction(true);
  state.setCurrentAction('idle');
  state.setCurrentActionArgs(null);
  return { ok: true, action };
}

module.exports = { stopAction };
