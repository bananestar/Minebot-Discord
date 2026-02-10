//! ---- Fonction pour MC ----

const state = require('../state');

function isTpaRequest(msg, tpaRules) {
  if (!tpaRules.enabled) return false;
  return tpaRules.patterns.some((p) => msg.includes(p.testIncludes));
}

function extractTpaSender(msg, tpaRules) {
  const pattern = tpaRules.patterns.find((p) => msg.includes(p.testIncludes));

  if (!pattern) return null;

  const m = msg.match(pattern.regex);

  return m?.[1] ?? null;
}

function tpaAccept(bot, Logger, sender, tpaRules) {
  bot.chat(`${tpaRules.commands.accept} ${sender}`);
  Logger.success(`:) TPA acceptée de ${sender}`);
}

function tpaDeny(bot, Logger, sender, tpaRules) {
  bot.chat(`${tpaRules.commands.deny} ${sender}`);
  Logger.warn(`:( TPA refusée pour ${sender}`);
}

function sendTpaRequest(bot, Logger, mcUsername) {
  if (!bot) {
    Logger.error(`Bot Error : ${bot}`);
    return false;
  }
  if (!mcUsername) {
    Logger.error(`mcUsername Error : ${mcUsername}`);
    return false;
  }

  bot.chat(`/tpa ${mcUsername}`);
  Logger.info(`📨 TPA envoyée à ${mcUsername}`);

  return true;
}

function handleTpaMessage(msg, { Logger, tpaRules, isUserWhitelistedMC }) {
  const bot = state.getBot();
  if (!bot) return false;

  if (!isTpaRequest(msg, tpaRules)) {
    if (!tpaRules.enabled) {
      bot.chat(`tpaRules : ${tpaRules.enabled}`);
      Logger.warn(`tpaRules : ${tpaRules.enabled}`);
    }
    return false;
  }

  const sender = extractTpaSender(msg, tpaRules);
  if (!sender) {
    Logger.error(`TPA détectée mais pseudo introuvable: ${msg}`);
    return true;
  }

  if (isUserWhitelistedMC(sender)) tpaAccept(bot, Logger, sender, tpaRules);
  else {
    tpaDeny(bot, Logger, sender, tpaRules);
    bot.chat(`/msg ${sender} Tu n'es pas dans la whitelist.`);
  }

  return true;
}

//! ---- Fonction Discord ----

function getMcUsernameFromDiscordId(discordId, whitelist) {
  const user = whitelist.find((u) => u.id === discordId);
  return user?.mcUsername ?? null;
}

function sendTpaRequestFromDiscord({ discordId, Logger, whitelist }) {
  const mcUsername = getMcUsernameFromDiscordId(discordId, whitelist);

  if (!mcUsername) {
    Logger.warn(`DiscordId non whitelisté: ${discordId}`);
    return { ok: false, reason: 'NOT_WHITELISTED' };
  }

  const bot = state.getBot();
  if (!bot) return { ok: false, reason: 'BOT_OFFLINE' };

  const ok = sendTpaRequest(bot, Logger, mcUsername);
  return ok ? { ok: true, mcUsername } : { ok: false, reason: 'BOT_OFFLINE' };
}

module.exports = {
  handleTpaMessage,
  sendTpaRequestFromDiscord,
};
