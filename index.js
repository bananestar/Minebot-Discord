require('dotenv').config();
const { setupLogSaver, LOGS_DIR } = require('./utils/logSaver');
setupLogSaver();
const path = require('path');
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const state = require('./state');
const { deploy } = require('./commands');
const whitelist = require('./whitelist.json');
const { startBot, stopBot, getStatus } = require('./bot');
const { configureNotifier } = require('./utils/discordNotifier');
const Logger = require('./utils/logger');
const { sendTpaRequestFromDiscord } = require('./features/tpa');
const { dumpState, CRASHES_DIR } = require('./utils/stateDumper');

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
      flags: MessageFlags.Ephemeral,
    });

  if (sub === 'start') {
    startBot();
    return interaction.reply('✅ Bot Minecraft lancé.');
  }
  if (sub === 'stop') {
    stopBot();
    return interaction.reply('🛑 Bot Minecraft arrêté.');
  }
  if (sub === 'status') {
    const bot = state.getBot();
    const connected = !!bot?.player;
    const pos = state.getPosition();
    const connectedTime = state.getConnectedTime();

    let uptime = 'N/A';
    if (connected && connectedTime) {
      const ms = Date.now() - connectedTime.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      uptime = `${h}h ${m}m ${s}s`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Statut du bot Minecraft')
      .setColor(connected ? 0x57f287 : 0xed4245)
      .addFields(
        { name: '🔌 Connexion', value: getStatus(), inline: false },
        { name: '❤️ Santé', value: connected ? `${bot.health ?? '?'}/20` : 'N/A', inline: true },
        { name: '🍖 Faim', value: connected ? `${bot.food ?? '?'}/20` : 'N/A', inline: true },
        { name: '⏱️ Uptime', value: uptime, inline: true },
        {
          name: '📍 Position',
          value: pos ? `X: ${Math.round(pos.x)} Y: ${Math.round(pos.y)} Z: ${Math.round(pos.z)}` : 'N/A',
          inline: true,
        },
        { name: '⚙️ Action', value: state.getCurrentAction() ?? 'idle', inline: true },
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

    return interaction.reply({ embeds: [embed] });
  }
  if (sub === 'logs') {
    const files = fs.existsSync(LOGS_DIR)
      ? fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.log')).sort().reverse()
      : [];
    if (files.length === 0)
      return interaction.reply({ content: '📭 Aucun fichier de log disponible.', flags: MessageFlags.Ephemeral });
    const select = new StringSelectMenuBuilder()
      .setCustomId('logs_select')
      .setPlaceholder('Choisir un fichier de log...')
      .addOptions(files.slice(0, 25).map((f) => ({
        label: f.replace('.log', ''),
        value: f,
        description: `Log du ${f.replace('.log', '')}`,
      })));
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      content: '📋 Quel fichier de log envoyer dans ce salon ?',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'crashes') {
    const files = fs.existsSync(CRASHES_DIR)
      ? fs.readdirSync(CRASHES_DIR).filter((f) => f.endsWith('.json')).sort().reverse()
      : [];
    if (files.length === 0)
      return interaction.reply({ content: '📭 Aucun crash state disponible.', flags: MessageFlags.Ephemeral });
    const select = new StringSelectMenuBuilder()
      .setCustomId('crashes_select')
      .setPlaceholder('Choisir un crash state...')
      .addOptions(files.slice(0, 25).map((f) => ({
        label: f.replace('.json', ''),
        value: f,
      })));
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      content: '💥 Quel crash state envoyer dans ce salon ?',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

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
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'bot')
        return await handleBotCommand(interaction);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'crashes_select') {
      if (!hasRole(interaction) || !isUserWhitelisted(interaction.user.id))
        return interaction.update({ content: "⛔ Tu n'as pas la permission.", components: [] });
      const filename = interaction.values[0];
      const crashFile = path.join(CRASHES_DIR, filename);
      if (!fs.existsSync(crashFile))
        return interaction.update({ content: '❌ Fichier introuvable.', components: [] });
      const attachment = new AttachmentBuilder(crashFile, { name: filename });
      await interaction.update({ content: `✅ Envoi de **${filename}**...`, components: [] });
      await interaction.followUp({
        content: `💥 Crash state : **${filename.replace('.json', '')}**`,
        files: [attachment],
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'logs_select') {
      if (!hasRole(interaction) || !isUserWhitelisted(interaction.user.id))
        return interaction.update({ content: "⛔ Tu n'as pas la permission.", components: [] });
      const filename = interaction.values[0];
      const logFile = path.join(LOGS_DIR, filename);
      if (!fs.existsSync(logFile))
        return interaction.update({ content: '❌ Fichier introuvable.', components: [] });
      const attachment = new AttachmentBuilder(logFile, { name: filename });
      await interaction.update({ content: `✅ Envoi de **${filename}**...`, components: [] });
      await interaction.followUp({
        content: `📋 Logs du **${filename.replace('.log', '')}**`,
        files: [attachment],
      });
    }
  } catch (err) {
    Logger.error('Erreur interactionCreate:', err);
    const msg = '❌ Une erreur interne est survenue.';
    if (interaction.deferred || interaction.replied) interaction.editReply(msg);
    else interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
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
