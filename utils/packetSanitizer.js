/**
 * packetSanitizer.js
 *
 * Intercepte les paquets Minecraft malformés envoyés par des plugins serveur
 * non-standard (ex: Armored Elytra — operation=101, slot=108 hors spec vanilla).
 *
 *
 * Ce module pose deux protections sur bot._client :
 *  1. listener 'error'  → absorbe les PartialReadError réseau
 *  2. wrapper emit()    → catch les erreurs de parsing synchrones
 */

const Logger = require('./logger');

/**
 * Détecte si une erreur est un PartialReadError de protodef.
 * @param {Error} err
 * @returns {boolean}
 */
function isPartialReadError(err) {
  if (!err) return false;
  return (
    err.name === 'PartialReadError' ||
    err.constructor?.name === 'PartialReadError' ||
    (typeof err.message === 'string' &&
      err.message.includes('Unexpected buffer end while reading VarInt'))
  );
}

/**
 * Applique le sanitizer sur le client réseau du bot mineflayer.
 * À appeler juste après mineflayer.createBot().
 * @param {import('mineflayer').Bot} bot
 */
function applyPacketSanitizer(bot) {
  suppressProtodefLogs();

  // 1. Erreurs réseau classiques (async)
  bot._client.on('error', (err) => {
    if (isPartialReadError(err)) {
      Logger.warn(
        `[PacketSanitizer] Paquet malformé ignoré (plugin serveur) : ${err.message}`,
      );
      return;
    }
    // Laisse remonter les vraies erreurs réseau
    Logger.error('[PacketSanitizer] Erreur client réseau :', err);
  });

  // 2. Erreurs de parsing synchrones levées pendant l'émission d'un paquet
  const originalEmit = bot._client.emit.bind(bot._client);
  bot._client.emit = function (event, ...args) {
    try {
      return originalEmit(event, ...args);
    } catch (err) {
      if (isPartialReadError(err)) {
        Logger.warn(
          `[PacketSanitizer] PartialReadError sur paquet "${event}" — ignoré (plugin serveur)`,
        );
        return false;
      }
      throw err;
    }
  };

  Logger.info('[PacketSanitizer] Sanitizer actif.');
}

function suppressProtodefLogs() {
  const FILTERS = [
    (msg) =>
      msg.includes('Chunk size is') &&
      msg.includes('but only') &&
      msg.includes('was read'),
    (msg) => msg.includes('PartialReadError'),
  ];

  function shouldSuppress(...args) {
    const msg = args[0];
    return typeof msg === 'string' && FILTERS.some((f) => f(msg));
  }

  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);

  console.log = function (...args) {
    if (shouldSuppress(...args)) return;
    originalLog(...args);
  };

  console.error = function (...args) {
    if (shouldSuppress(...args)) return;
    originalError(...args);
  };
}

module.exports = { applyPacketSanitizer, isPartialReadError };
