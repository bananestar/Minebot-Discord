const mineflayer = require('mineflayer');
const axios = require('axios');
const Logger = require('./utils/logger');
const whitelist = require('./whitelist.json');
const { sendToDefaultChannel } = require('./utils/discordNotifier');
const { handleTpaMessage } = require('./features/tpa');
const { handleMcCommand } = require('./features/mcCommands');
const { setupPathfinder } = require('./utils/pathfinder');
const { tpa_rules } = require('./config');
const state = require('./state');
const {
  applyPacketSanitizer,
  isPartialReadError,
} = require('./utils/packetSanitizer');

let connectedTime = null;
let kill = false;
let isReconnecting = false;
let hasAnnouncedOffline = false;
let spawnWatchdog = null;

const SERVER = process.env.TEST;
const PORT = Number(process.env.TESTPORT);
const VERSION = process.env.VERSION;
const USERNAME = process.env.USERNAME;

function startBot() {
  if (state.hasBot()) {
    Logger.warn('⚠️ Bot déjà en ligne. Ignoré.');
    return;
  }

  if (isReconnecting) {
    Logger.warn('⏳ Reconnexion en cours, startBot ignoré.');
    return;
  }

  const bot = mineflayer.createBot({
    host: SERVER,
    port: PORT,
    username: USERNAME,
    auth: 'microsoft',
    version: VERSION,
  });

  state.setBot(bot);
  applyPacketSanitizer(bot);

  clearTimeout(spawnWatchdog);
  spawnWatchdog = setTimeout(() => {
    Logger.warn('⏰ Aucune apparition (spawn) en 30s — relance de la reco.');
    try {
      state.getBot()?.quit();
    } catch {}
  }, 30 * 1000);

  bot.once('spawn', () => {
    clearTimeout(spawnWatchdog);
    setupPathfinder(bot);

    kill = false;
    hasAnnouncedOffline = false;
    connectedTime = new Date();

    Logger.success('Bot Minecraft connecté.');
  });

  bot.on('kicked', (reason) => {
    Logger.warn('🦶 KICKED: ' + JSON.stringify(reason));
  });

  bot.on('error', (err) => {
    if (isPartialReadError(err)) return; // Géré par packetSanitizer
    Logger.error('Erreur du bot Minecraft:', err);
  });

  bot.on('end', (reason) => {
    clearTimeout(spawnWatchdog);
    Logger.warn('END reason: ' + JSON.stringify(reason));
    if (kill) return;
    state.clearBot();
    Logger.warn(
      '⚠️ Bot déconnecté. Déclenchement du processus de reconnexion intelligente...',
    );
    waitForServerThenReconnect();
  });

  bot.on('health', () => {
    const b = state.getBot();
    if (!b) return;
    if (b.food < 20 && b.health < 20) {
      const foodItem = b.inventory.items().find((item) => b.isFood(item));
      if (foodItem) {
        b.consume(foodItem);
        Logger.success(`🍗 Bot nourri avec ${foodItem.name}.`);
      }
    }
  });

  bot.on('messagestr', (message) => {
    const cleanMsg = cleanMessage(message);
    Logger.info(`💬 ${cleanMsg}`);

    handleTpaMessage(cleanMsg, {
      Logger,
      tpaRules: tpa_rules,
      isUserWhitelistedMC,
    });

    handleMcCommand(cleanMsg, {
      Logger,
      isUserWhitelistedMC,
      botUsername: bot.username,
    });
  });
}

function stopBot() {
  const bot = state.getBot();
  if (bot) {
    kill = true;
    clearTimeout(spawnWatchdog);
    try {
      bot.quit();
      state.clearBot();
      Logger.success('Bot Minecraft arrêté.');
    } catch {}
  }
}

function cleanMessage(msg) {
  return msg.replace(/§./g, '');
}

function isUserWhitelistedMC(mcUsername) {
  return whitelist.some((user) => user.mcUsername === mcUsername);
}

function getStatus() {
  const bot = state.getBot();

  if (bot?.player) {
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

  // En dev (localhost), l'API externe ne peut pas ping le serveur — on retente directement
  if (SERVER === 'localhost' || SERVER === '127.0.0.1') {
    Logger.warn(
      '🛠️ Mode dev détecté, reconnexion sans vérification API dans 5s...',
    );
    await sleep(5 * 1000);
    isReconnecting = false;
    startBot();
    return;
  }

  const checkAndReconnect = async () => {
    try {
      const url = `https://api.mcstatus.io/v2/status/java/${SERVER}:${PORT}`;
      const { data } = await axios.get(url);

      if (data.online) {
        hasAnnouncedOffline = false;
        sendToDefaultChannel(
          '✅ Serveur en ligne détecté, tentative de reconnexion dans 8s…',
        );
        Logger.success(
          '✅ Serveur en ligne détecté, tentative de reconnexion dans 8s…',
        );

        await sleep(8 * 1000);

        isReconnecting = false;
            startBot();
        return;
      }

      if (!hasAnnouncedOffline) {
        sendToDefaultChannel('❌ Serveur hors ligne ❌');
        hasAnnouncedOffline = true;
      }
      Logger.warn('🌐 Serveur hors ligne, nouvelle tentative dans 15s...');
      setTimeout(checkAndReconnect, 15 * 1000);
    } catch {
      Logger.warn('🌐 Erreur de ping API, nouvelle tentative dans 15s...');
      setTimeout(checkAndReconnect, 15 * 1000);
    }
  };

  checkAndReconnect();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = { startBot, stopBot, getStatus };
