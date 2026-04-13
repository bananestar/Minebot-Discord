const { EmbedBuilder } = require('discord.js');
const state = require('../state');
const { getStatus } = require('../bot');
const { fetchServerInfo } = require('./mcServerStatus');

/**
 * Formate la durée en millisecondes en "Xh Ym Zs".
 *
 * @param {number} ms
 * @returns {string}
 */
function formatUptime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

/**
 * Construit l'embed de statut du bot Minecraft.
 * Récupère les infos serveur en parallèle du reste.
 *
 * @returns {Promise<EmbedBuilder>}
 */
async function buildStatusEmbed() {
  const bot = state.getBot();
  const connected = !!bot?.player;
  const pos = state.getPosition();
  const connectedTime = state.getConnectedTime();

  const [serverInfo] = await Promise.all([fetchServerInfo()]);

  const uptime =
    connected && connectedTime
      ? formatUptime(Date.now() - connectedTime.getTime())
      : 'N/A';

  const serverName = process.env.SERVER_MC ?? 'inconnu';
  const serverValue = serverInfo
    ? serverInfo.online
      ? `\`${serverName}\` — En ligne — ${serverInfo.players.online}/${serverInfo.players.max} joueurs`
      : `\`${serverName}\` — Hors ligne`
    : `\`${serverName}\` — Indisponible`;

  return new EmbedBuilder()
    .setTitle('Statut du bot Minecraft')
    .setColor(connected ? 0x57f287 : 0xed4245)
    .addFields(
      { name: '🔌 Connexion', value: getStatus(), inline: false },
      {
        name: '🌐 Serveur',
        value: serverValue,
        inline: false,
      },
      {
        name: '❤️ Santé',
        value: connected ? `${bot.health ?? '?'}/20` : 'N/A',
        inline: true,
      },
      {
        name: '🍖 Faim',
        value: connected ? `${bot.food ?? '?'}/20` : 'N/A',
        inline: true,
      },
      { name: '⏱️ Uptime', value: uptime, inline: true },
      {
        name: '📍 Position',
        value: pos
          ? `X: ${Math.round(pos.x)} Y: ${Math.round(pos.y)} Z: ${Math.round(pos.z)}`
          : 'N/A',
        inline: true,
      },
      {
        name: '⚙️ Action',
        value: state.getCurrentAction() ?? 'idle',
        inline: true,
      },
      {
        name: '🤖 Auto',
        value: [
          `Sommeil: ${state.getAutoSleepInstance()?.isEnabled() ? '✅' : '❌'}`,
          `Manger: ${state.getIsEating() ? '🔄' : '—'}`,
          `Soigner: ${state.getIsHealing() ? '🔄' : '—'}`,
        ].join('\n'),
        inline: true,
      },
    )
    .setTimestamp();
}

module.exports = { buildStatusEmbed };
