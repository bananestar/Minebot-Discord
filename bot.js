const mineflayer = require('mineflayer');
const axios = require('axios');
const fs = require('fs');
const Logger = require('./utils/logger');
const whitelist = require('./whitelist.json');
const { sendToDefaultChannel } = require('./utils/discordNotifier');
let bot = null;
let connectedTime = null;
let kill = false;
let isReconnecting = false;
let countDisconnection = 0;
let hasAnnouncedOffline = false;

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
    host: process.env.SERVER_MC,
    port: Number(process.env.PORT),
    username: process.env.USERNAME,
    auth: 'microsoft',
    version: process.env.VERSION,
  });

  bot.once('spawn', () => {
    kill = false;
    connectedTime = new Date();
    Logger.success('Bot Minecraft connecté.');
  });

  bot.on('error', (err) => {
    Logger.error('Erreur du bot Minecraft:', err);
  });

  bot.on('end', () => {
    if (kill) return;
    Logger.warn(
      '⚠️ Bot déconnecté. Déclenchement du processus de reconnexion intelligente...'
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

    if (cleanMsg.includes('has sent you a teleport request')) {
      const match = cleanMsg.match(
        /Player (\w+) has sent you a teleport request/
      );

      if (match && match[1]) {
        const sender = match[1];
        if (isUserWhitelistedMC(sender)) {
          bot.chat(`/tpaccept ${sender}`);
          Logger.success(`✅ TPA acceptée de ${sender}`);
        } else {
          Logger.error('⛔ Joueur non whitelisté.');
        }
      } else {
        Logger.error('❌ Impossible d’extraire le pseudo.');
      }
    }
  });
}

function stopBot() {
  if (bot) {
    kill = true;
    bot.quit();
    bot = null;
    Logger.success('Bot Minecraft arrêté.');
  }
}

// Envoie les logs en message privé
function sendLogs(discordId) {
  const logFiles = fs.readdirSync('./logs');
  logFiles.forEach((file) => {
    const logData = fs.readFileSync(`./logs/${file}`, 'utf8');
    client.users.fetch(discordId).then((user) => {
      user.send(`Logs : ${file}\n\n${logData}`);
    });
  });
}

function sendTpaRequest(discordId) {
  const username = getMcUserNameDiscordId(discordId);
  if (bot) {
    bot.chat(`/tpa ${username}`);
  }
}

function cleanMessage(msg) {
  return msg.replace('§', '');
}

function isUserWhitelistedMC(mcUsername) {
  return whitelist.some((user) => user.mcUsername === mcUsername);
}

function getMcUserNameDiscordId(discordId) {
  const user = whitelist.find((u) => u.id === discordId);
  return user ? user.mcUsername : null;
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
    return `Bot connecté depuis ${hours}:${minutes}:${seconds} (depuis ${dateString}).`;
  }

  if (kill) return '🛑 Bot stoppé manuellement (stopBot appelé).';
  if (isReconnecting)
    return '⏳ En attente de la reconnexion... (le serveur Minecraft est offline ou en train de redémarrer)';
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
      const url = `https://api.mcstatus.io/v2/status/java/${process.env.SERVER_MC}:${process.env.PORT}`;
      const { data } = await axios.get(url);

      if (data.online) {
        if (hasAnnouncedOffline) hasAnnouncedOffline = false;
        sendToDefaultChannel(
          `✅ Serveur en ligne détecté, tentative de reconnexion...`
        );
        Logger.success(
          '✅ Serveur en ligne détecté, tentative de reconnexion...'
        );
        try {
          isReconnecting = false;
          countDisconnection = 0;
          startBot();
          return;
        } catch (err) {
          Logger.error('❌ Échec de la reconnexion du bot :', err);
          countDisconnection++;
          if (countDisconnection % 10 === 0)
            sendToDefaultChannel(
              `⚠️ Le bot Minecraft a échoué à se reconnecter. Tentative : ${countDisconnection}`
            );
          Logger.info('🕐 Nouvelle tentative dans 60s...');
          setTimeout(checkAndReconnect, 60 * 1000);
        }
      } else {
        if (!hasAnnouncedOffline) {
          sendToDefaultChannel(`❌ Serveur hors ligne ❌`);
          hasAnnouncedOffline = true;
        }
        Logger.info('⏳ Serveur hors ligne, nouvelle tentative dans 15s...');
        setTimeout(checkAndReconnect, 15 * 1000);
      }
    } catch (err) {
      Logger.warn(`🌐 Erreur de ping API, nouvelle tentative dans 15s...`);
      setTimeout(checkAndReconnect, 15 * 1000);
    }
  };
  checkAndReconnect();
}

module.exports = {
  startBot,
  stopBot,
  getStatus,
  sendLogs,
  sendTpaRequest,
};
