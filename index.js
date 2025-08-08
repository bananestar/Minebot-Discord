require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { deploy } = require('./commands');
const whitelist = require('./whitelist.json');
const { startBot, stopBot, getStatus, sendTpaRequest } = require('./bot');
const { configureNotifier } = require('./utils/discordNotifier');
const Logger = require('./utils/logger');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/**
 *
 * @param {string} discordId
 * @returns
 * @description vérification si l'id du User est dans la Whistelist
 */
function isUserWhitelisted(discordId) {
  return whitelist.some((user) => user.id === discordId);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  const subcommand = options.getSubcommand();
  const user = interaction.user;

  if (commandName === 'bot') {
    if (
      !interaction.member.roles.cache.some(
        (role) => role.name === process.env.DISCORD_ROLE
      ) ||
      !isUserWhitelisted(user.id)
    ) {
      await interaction.reply({
        content: '⛔ Tu n’as pas la permission.',
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'start') {
      startBot();
      await interaction.reply('✅ Bot Minecraft lancé.');
    } else if (subcommand === 'stop') {
      stopBot();
      await interaction.reply('🛑 Bot Minecraft arrêté.');
    } else if (subcommand === 'status') {
      const status = getStatus();
      await interaction.reply(status);
    } else if (subcommand === 'logs') {
      Logger.info('Logs demandés via Discord');
      await interaction.reply('⚠️ Fonction pas disponible ⚠️');
    } else if (subcommand === 'tpa') {
      sendTpaRequest(user.id);
      await interaction.reply('📨 Demande de TPA envoyée.');
    }
  }
});

// Étapes : 1. Déploiement des commandes, 2. Connexion du bot Discord
(async () => {
  await deploy(); // Déploie les commandes via commands.js
  await client.login(process.env.DISCORD_TOKEN); // Ensuite démarre le bot Discord

  configureNotifier(client, {
    defaultChannelId: process.env.DISCORD_CHANNEL_ID,
  });
})();
