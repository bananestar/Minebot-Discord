const state = require('../state');

const PREFIX = '!bot';

/**
 * Parse un message Minecraft pour en extraire l'auteur et la commande !bot.
 * Supporte les formats : `<Pseudo> !bot cmd` et `Pseudo: !bot cmd`
 *
 * @param {string} msg - Le message brut du chat Minecraft
 * @returns {{ sender: string, args: string[] } | null}
 */
function parseMcCommand(msg) {
  const match =
    msg.match(/^<(\w+)>\s*!bot\s*(.*)/i) || msg.match(/^(\w+):\s*!bot\s*(.*)/i);

  if (!match) return null;

  const sender = match[1];
  const args = match[2].trim().split(/\s+/).filter(Boolean);

  return { sender, args };
}

const COMMANDS = {
  help: {
    description: 'Affiche cette aide',
    async run({ bot }) {
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        bot.chat(`!bot ${name} => ${cmd.description}`);
        await new Promise((res) => setTimeout(res, 1000));
      }
    },
  },

  status: {
    description: 'Affiche la sante et la faim du bot',
    run({ bot }) {
      const health = Math.round(bot.health ?? 0);
      const food = Math.round(bot.food ?? 0);
      bot.chat(`Sante: ${health}/20 | Faim: ${food}/20`);
    },
  },

  ping: {
    description: 'Repond pong',
    run({ bot }) {
      bot.chat('Pong !');
    },
  },

  inv: {
    description: "Affiche l'inventaire du bot",
    run({ bot }) {
      const items = bot.inventory.items();
      if (items.length === 0) {
        bot.chat('Inventaire vide.');
        return;
      }
      const counts = {};
      for (const item of items) {
        counts[item.name] = (counts[item.name] ?? 0) + item.count;
      }
      const list = Object.entries(counts)
        .map(([name, count]) => `${name}x${count}`)
        .join(', ');
      // Tronquer si > 250 chars pour rester sous la limite MC
      bot.chat(list.length > 250 ? list.slice(0, 247) + '...' : list);
    },
  },

  drop: {
    description: "Droppe tout l'inventaire du bot",
    async run({ bot, Logger }) {
      const items = bot.inventory.items();
      if (items.length === 0) {
        bot.chat('Inventaire deja vide.');
        return;
      }
      bot.chat(`Drop de ${items.length} stacks...`);
      for (const item of items) {
        await bot.tossStack(item);
      }
      bot.chat('Inventaire droppe.');
      Logger.info('Inventaire droppe via commande MC.');
    },
  },
};

/**
 * Gere les commandes !bot envoyees dans le chat Minecraft.
 * Seuls les joueurs de la whitelist peuvent les utiliser.
 *
 * @param {string} msg - Message brut du chat Minecraft
 * @param {{ Logger: object, isUserWhitelistedMC: (username: string) => boolean }} ctx
 * @returns {boolean} true si une commande a ete traitee
 */
function handleMcCommand(msg, { Logger, isUserWhitelistedMC, botUsername }) {
  if (!msg.includes(PREFIX)) return false;

  const parsed = parseMcCommand(msg);
  if (!parsed) return false;

  const { sender, args } = parsed;

  // Ignorer les propres messages du bot pour eviter les boucles
  if (botUsername && sender === botUsername) return false;
  const cmdName = args[0]?.toLowerCase();

  if (!isUserWhitelistedMC(sender)) {
    const bot = state.getBot();
    bot?.chat(`/msg ${sender} Tu n'es pas dans la whitelist.`);
    Logger.warn(`Commande MC refusee pour ${sender} (non whiteliste)`);
    return true;
  }

  const bot = state.getBot();
  if (!bot) return false;

  if (!cmdName) {
    bot.chat(`Utilise !bot help pour voir les commandes.`);
    return true;
  }

  const cmd = COMMANDS[cmdName];
  if (!cmd) {
    bot.chat(`Commande inconnue: ${cmdName}. Utilise !bot help.`);
    Logger.warn(`Commande MC inconnue: ${cmdName} par ${sender}`);
    return true;
  }

  Logger.info(`Commande MC: !bot ${cmdName} par ${sender}`);
  cmd.run({ bot, sender, args: args.slice(1), Logger });
  return true;
}

module.exports = { handleMcCommand };
