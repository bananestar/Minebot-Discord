const Logger = require('./logger');
const { Client, ActivityType } = require('discord.js');

/** @type {Client | null} */
let client = null;

let config = {
  defaultChannelId: null,
};

/**
 * Configure le client Discord pour les notifications
 * @param {Client} clientInstance - Instance du client Discord.js
 */
function configureNotifier(clientInstance, options = {}) {
  client = clientInstance;
  config = {
    ...config,
    ...options,
  };
  Logger.info(
    `[DiscordNotifier] Configuré pour le salon : ${config.defaultChannelId}`
  );
}

async function sendToDefaultChannel(message) {
  if (!client || !config.defaultChannelId) {
    Logger.warn('[DiscordNotifier] client ou channel ID manquant.');
    return;
  }

  try {
    const channel = await client.channels.fetch(config.defaultChannelId);
    if (channel && channel.isTextBased()) {
      await channel.send(message);
      Logger.info(
        '[DiscordNotifier] ✅ Message envoyé dans le salon par défaut.'
      );
    } else {
      Logger.error(
        '[DiscordNotifier] ❌ Le salon n’est pas textuel ou introuvable.'
      );
    }
  } catch (err) {
    Logger.error('[DiscordNotifier] ❌ Échec de l’envoi du message :', err);
  }
}

/**
 * Met à jour la présence du bot Discord.
 * @param {'online'|'idle'} status
 * @param {string} text - Texte affiché dans l'activité
 */
function setPresence(status, text) {
  if (!client) return;
  client.user.setPresence({
    status,
    activities: [{ type: ActivityType.Watching, name: text }],
  });
}

/** @type {NodeJS.Timeout | null} */
let presenceInterval = null;

/**
 * Démarre une boucle qui alterne entre plusieurs textes de présence toutes les 30s.
 *
 * @param {Array<() => string>} getTexts - Tableau de fonctions retournant chacune un texte
 */
function startPresenceLoop(getTexts) {
  stopPresenceLoop();
  let index = 0;
  const refresh = () => {
    setPresence('online', getTexts[index % getTexts.length]());
    index++;
  };
  refresh();
  presenceInterval = setInterval(refresh, 30_000);
}

/**
 * Arrête la boucle de rafraîchissement de la présence.
 */
function stopPresenceLoop() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
}

module.exports = {
  configureNotifier,
  sendToDefaultChannel,
  setPresence,
  startPresenceLoop,
  stopPresenceLoop,
};
