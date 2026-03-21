require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { deploy } = require('./commands');
const whitelist = require('./whitelist.json');
const { startBot, stopBot, getStatus } = require('./bot');
const { configureNotifier } = require('./utils/discordNotifier');
const Logger = require('./utils/logger');
const { sendTpaRequestFromDiscord } = require('./features/tpa');
const { dumpState } = require('./utils/stateDumper');

process.on('uncaughtException', (err) => {
  Logger.error('💥 uncaughtException:', err);
  dumpState('uncaughtException', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('💥 unhandledRejection:', reason);
  dumpState('unhandledRejection', String(reason));
});

process.on('SIGTERM', () => {
  Logger.warn('⚠️ SIGTERM reçu, sauvegarde de l\'état...');
  dumpState('SIGTERM', 'Process terminated');
  process.exit(0);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/**
 * Vérifie si un utilisateur Discord est dans la whitelist.
 *
 * @param {string} discordId - L'identifiant Discord de l'utilisateur
 * @returns {boolean} `true` si l'utilisateur est whitelisté, `false` sinon
 */

function isUserWhitelisted(discordId) {
  return whitelist.some((user) => user.id === discordId);
}

/**
 * Vérifie si l'utilisateur a le rôle requis.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - L'interaction Discord reçue
 * @returns {boolean}
 */
function hasRole(interaction) {
  return interaction.member.roles.cache.some(
    (role) => role.name === process.env.DISCORD_ROLE,
  );
}

/**
 * Gère les sous-commandes du slash command `/bot` reçues depuis Discord.
 * Vérifie les permissions avant d'exécuter l'action demandée (start, stop, status, tpa, logs).
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - L'interaction Discord reçue
 * @returns {Promise<void>}
 */
async function handleBotCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const user = interaction.user;

  if (!hasRole(interaction) || !isUserWhitelisted(user.id))
    return interaction.reply({
      content: "⛔ Tu n'as pas la permission.",
      ephemeral: true,
    });

  if (sub === 'start') {
    startBot();
    return interaction.reply('✅ Bot Minecraft lancé.');
  }
  if (sub === 'stop') {
    stopBot();
    return interaction.reply('🛑 Bot Minecraft arrêté.');
  }
  if (sub === 'status') return interaction.reply(getStatus());
  if (sub === 'logs') return interaction.reply('⚠️ Fonction pas disponible ⚠️');

  if (sub === 'tpa') {
    const res = sendTpaRequestFromDiscord({
      discordId: user.id,
      Logger,
      whitelist,
    });
    if (res.ok)
      return interaction.reply(
        `📨 Demande de TPA envoyée à **${res.mcUsername}**.`,
      );
    if (res.reason === 'NOT_WHITELISTED')
      return interaction.reply("⛔ Tu n'es pas whitelisté.");
    return interaction.reply("❌ Le bot Minecraft n'est pas connecté.");
  }
}

/**
 * Routeur principal des slash commands Discord.
 * Dispatche l'interaction vers le handler approprié et gère les erreurs.
 */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'bot')
      return await handleBotCommand(interaction);
  } catch (err) {
    Logger.error('Erreur interactionCreate:', err);
    const msg = '❌ Une erreur interne est survenue.';
    if (interaction.deferred) interaction.editReply(msg);
    else interaction.reply({ content: msg, ephemeral: true });
  }
});

/**
 *  Point d'entrée principal
 *
 */
(async () => {
  await deploy();
  await client.login(process.env.DISCORD_TOKEN);
  configureNotifier(client, {
    defaultChannelId: process.env.DISCORD_CHANNEL_ID,
  });
})();
