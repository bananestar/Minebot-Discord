const mineflayer = require('mineflayer');
const axios = require('axios');
const fs = require('fs');
const Logger = require('./utils/logger');
const whitelist = require('./whitelist.json');
const { sendToDefaultChannel } = require('./utils/discordNotifier');
const { handleTpaMessage } = require('./features/tpa');
const { tpa_rules } = require('./config');
const state = require('./state');

let bot = null;
let connectedTime = null;
let kill = false;
let isReconnecting = false;
let countDisconnection = 0;
let hasAnnouncedOffline = false;
let spawnWatchdog = null;

const SERVER = process.env.SERVER_MC;
const PORT = Number(process.env.PORT);
const VERSION = process.env.VERSION;
const USERNAME = process.env.USERNAME;

function startBot() {
  if (bot && bot.player) {
    Logger.warn('⚠️ Bot déjà en ligne. Ignoré.');
    return;
  }

  if (isReconnecting) {
    Logger.warn('⏳ Reconnexion en cours, startBot ignoré.');
    return;
  }

  bot = mineflayer.createBot({
    host: SERVER,
    port: PORT,
    username: USERNAME,
    auth: 'microsoft',
    version: VERSION,
  });

  state.setBot(bot);

  clearTimeout(spawnWatchdog);
  spawnWatchdog = setTimeout(() => {
    Logger.warn('⏰ Aucune apparition (spawn) en 30s — relance de la reco.');
    try {
      bot?.quit();
    } catch {}
  }, 30 * 1000);

  bot.once('spawn', () => {
    clearTimeout(spawnWatchdog);

    kill = false;
    hasAnnouncedOffline = false;
    countDisconnection = 0;
    connectedTime = new Date();

    Logger.success('Bot Minecraft connecté.');
  });

  bot.on('kicked', (reason) => {
    Logger.warn('🦶 KICKED: ' + JSON.stringify(reason));
  });

  bot.on('error', (err) => {
    Logger.error('Erreur du bot Minecraft:', err);
  });

  bot.on('end', (reason) => {
    clearTimeout(spawnWatchdog);
    Logger.warn('END reason: ' + JSON.stringify(reason));
    if (kill) return;
    bot = null;
    state.clearBot();
    Logger.warn(
      '⚠️ Bot déconnecté. Déclenchement du processus de reconnexion intelligente...',
    );
    waitForServerThenReconnect();
  });

  bot.on('health', () => {
    if (bot.food < 20 && bot.health < 20) {
      const foodItem = bot.inventory.items().find((item) => bot.isFood(item));
      if (foodItem) {
        bot.consume(foodItem);
        Logger.success(`🍗 Bot feed ${foodItem.name} for recoverer.`);
      }
    }
  });

  bot.on('messagestr', (message) => {
    const cleanMsg = cleanMessage(message);
    Logger.info(`💬 ${cleanMsg}`);

    const handled = handleTpaMessage(cleanMsg, {
      Logger,
      tpaRules: tpa_rules,
      isUserWhitelistedMC,
    });
  });
}

function stopBot() {
  if (bot) {
    kill = true;
    clearTimeout(spawnWatchdog);
    try {
      bot.quit();
      bot = null;
      state.clearBot();
      Logger.success('Bot Minecraft arrêté.');
    } catch {}
  }
}

// Envoie les logs en message privé
function sendLogs(discordId) {
  const logFiles = fs.readdirSync('./logs');
  logFiles.forEach((file) => {
    const logData = fs.readFileSync(`./logs/${file}`, 'utf8');
  });
}

function cleanMessage(msg) {
  return msg.replace(/§./g, '');
}

function isUserWhitelistedMC(mcUsername) {
  return whitelist.some((user) => user.mcUsername === mcUsername);
}

function getStatus() {
  if (bot && bot.player) {
    const uptime = new Date() - connectedTime;
    const hours = Math.floor(uptime / 1000 / 60 / 60);
    const minutes = Math.floor((uptime / 1000 / 60) % 60);
    const seconds = Math.floor((uptime / 1000) % 60);
    const dateString = connectedTime.toLocaleString('fr-BE', {
      timeZone: 'Europe/Brussels',
    });
    return `🟢 Bot connecté depuis ${hours}h ${minutes}m ${seconds}s (depuis ${dateString}).`;
  }

  if (kill) return '🛑 Bot stoppé manuellement (stopBot appelé).';
  if (isReconnecting)
    return '⏳ En attente de la reconnexion… (serveur offline ou en redémarrage)';
  if (bot && !bot.player)
    return '🟠 Bot créé, mais pas encore connecté au serveur Minecraft.';
  return '🔴 Bot non connecté.';
}

async function waitForServerThenReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;

  Logger.warn('🔄 En attente du redémarrage du serveur Minecraft...');

  const checkAndReconnect = async () => {
    try {
      const url = `https://api.mcstatus.io/v2/status/java/${SERVER}:${PORT}`;
      const { data } = await axios.get(url);

      if (data.online) {
        if (hasAnnouncedOffline) hasAnnouncedOffline = false;
        sendToDefaultChannel(
          '✅ Serveur en ligne détecté, tentative de reconnexion dans 8s…',
        );
        Logger.success(
          '✅ Serveur en ligne détecté, tentative de reconnexion dans 8s…',
        );

        await sleep(8 * 1000);

        isReconnecting = false;
        countDisconnection = 0;
        startBot();
        return;
      }

      if (!hasAnnouncedOffline) {
        sendToDefaultChannel('❌ Serveur hors ligne ❌');
        hasAnnouncedOffline = true;
      }
      Logger.warn('🌐 Serveur hors ligne, nouvelle tentative dans 15s...');
      setTimeout(checkAndReconnect, 15 * 1000);
    } catch (err) {
      Logger.warn(`🌐 Erreur de ping API, nouvelle tentative dans 15s...`);
      setTimeout(checkAndReconnect, 15 * 1000);
    }
  };
  checkAndReconnect();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = {
  startBot,
  stopBot,
  getStatus,
  sendLogs,
};
