const Logger = require('./logger');
const { Client } = require('discord.js');

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

module.exports = {
  configureNotifier,
  sendToDefaultChannel,
};
