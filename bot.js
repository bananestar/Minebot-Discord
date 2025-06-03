const mineflayer = require('mineflayer');
const fs = require('fs');
const Logger = require('./utils/logger');
const whitelist = require('./whitelist.json');
const RECONNECT_DELAY_SECONDS = 90;
let bot = null;
let connectedTime = null;
let kill = false;

function startBot() {
  bot = mineflayer.createBot({
    host: process.env.SERVER_MC,
    port: Number(process.env.PORT),
    username: process.env.USERNAME,
    auth: 'microsoft',
    version: process.env.VERSION,
  });

  bot.on('spawn', () => {
    kill = false;
    connectedTime = new Date();
    Logger.success('Bot Minecraft connecté.');
  });

  bot.on('error', (err) => {
    Logger.error('Erreur du bot Minecraft:', err);
  });

  bot.on('end', () => {
    if (kill) return;
    Logger.warn('Bot déconnecté.');
    setTimeout(startBot, RECONNECT_DELAY_SECONDS);
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
  if (!connectedTime) return "Le bot n'est pas connecté.";
  const uptime = new Date() - connectedTime;
  const hours = Math.floor(uptime / 1000 / 60 / 60);
  const minutes = Math.floor((uptime / 1000 / 60) % 60);
  const seconds = Math.floor((uptime / 1000) % 60);
  const dateString = connectedTime.toLocaleString('fr-BE', {
    timeZone: 'Europe/Brussels',
  });

  return `Bot connecté depuis ${hours}:${minutes}:${seconds} (depuis ${dateString}).`;
}

module.exports = {
  startBot,
  stopBot,
  getStatus,
  sendLogs,
  sendTpaRequest,
};
