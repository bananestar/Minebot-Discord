const state = require('../state');
const { goTo } = require('../utils/pathfinder');
const { scanChests, EMPTY_SIGN_LABEL } = require('../utils/scanner');

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

/**
 * Retourne true si le type correspond a un double coffre.
 *
 * @param {string} type
 * @returns {boolean}
 */
function isDoubleChestType(type) {
  return type === 'large_chest' || type === 'large_trapped_chest';
}

/**
 * Retourne un libelle lisible pour l'etat du panneau.
 *
 * @param {string | null} sign
 * @returns {string}
 */
function getSignDebugLabel(sign) {
  if (sign === null) return 'aucun panneau';
  if (sign === EMPTY_SIGN_LABEL) return 'panneau vide';
  return `panneau texte="${sign}"`;
}

/**
 * Log detaille d'un coffre scanne.
 *
 * @param {object} Logger
 * @param {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }} chest
 * @param {number} index
 */
function logChestScanResult(Logger, chest, index) {
  const { position: p, type, sign } = chest;
  const doubleChest = isDoubleChestType(type);

  Logger.info(
    `[scan][${index + 1}] type=${type} | double=${doubleChest ? 'oui' : 'non'} | position=(${p.x}, ${p.y}, ${p.z}) | ${getSignDebugLabel(sign)}`,
  );
}

/**
 * Retourne le texte a afficher en chat pour un coffre.
 *
 * @param {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }} chest
 * @param {number} index
 * @returns {string}
 */
function formatChestChatLine(chest, index) {
  const { position: p, type, sign } = chest;
  const label = sign ? `panneau: ${sign}` : 'sans panneau';
  return `Coffre ${index + 1}: ${type} (${p.x} ${p.y} ${p.z}) | ${label}`;
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

  scan: {
    description:
      'Scanne les coffres. Usage: !bot scan <rayon> OU !bot scan <x1> <y1> <z1> <x2> <y2> <z2>',
    async run({ bot, args, Logger }) {
      let pos1;
      let pos2;
      let scanLabel;

      // Mode 1 : scan autour du bot
      if (args.length === 1) {
        const radius = Number(args[0]);

        if (isNaN(radius) || radius < 1) {
          bot.chat('Usage: !bot scan <rayon>');
          return;
        }

        const p = bot.entity.position.floored();

        pos1 = {
          x: p.x - radius,
          y: p.y - radius,
          z: p.z - radius,
        };

        pos2 = {
          x: p.x + radius,
          y: p.y + radius,
          z: p.z + radius,
        };

        scanLabel = `rayon=${radius} autour du bot (${p.x}, ${p.y}, ${p.z})`;
      }

      // Mode 2 : scan d'une zone definie
      else if (args.length === 6) {
        const [x1, y1, z1, x2, y2, z2] = args.map(Number);

        if ([x1, y1, z1, x2, y2, z2].some(isNaN)) {
          bot.chat('Les coordonnees doivent etre des nombres.');
          return;
        }

        pos1 = { x: x1, y: y1, z: z1 };
        pos2 = { x: x2, y: y2, z: z2 };

        scanLabel = `zone=(${x1}, ${y1}, ${z1}) -> (${x2}, ${y2}, ${z2})`;
      }

      // Mauvais usage
      else {
        bot.chat(
          'Usage: !bot scan <rayon> OU !bot scan <x1> <y1> <z1> <x2> <y2> <z2>',
        );
        return;
      }

      Logger.info(`[scan] Debut du scan | ${scanLabel}`);

      const results = scanChests(bot, pos1, pos2);

      Logger.info(
        `[scan] Fin du scan brut | ${scanLabel} | total=${results.length}`,
      );

      if (results.length === 0) {
        bot.chat('Aucun coffre trouve dans la zone.');
        Logger.info('[scan] Aucun coffre detecte.');
        return;
      }

      bot.chat(`${results.length} coffre(s) trouve(s):`);

      for (let i = 0; i < results.length; i++) {
        const chest = results[i];
        const { position: p, type, sign, meta } = chest;

        const isDouble =
          meta?.isDouble ??
          (type === 'large_chest' || type === 'large_trapped_chest');

        let signState = 'aucun panneau';
        if (sign === EMPTY_SIGN_LABEL) signState = 'panneau vide';
        else if (sign) signState = `panneau texte="${sign}"`;

        const partnerText = meta?.partner
          ? `(${meta.partner.x}, ${meta.partner.y}, ${meta.partner.z})`
          : 'none';

        Logger.info(
          `[scan][${i + 1}] type=${type}` +
            ` | double=${isDouble ? 'oui' : 'non'}` +
            ` | methode=${meta?.scanMethod ?? 'unknown'}` +
            ` | facing=${meta?.facing ?? 'null'}` +
            ` | chestType=${meta?.chestType ?? 'unknown'}` +
            ` | position=(${p.x}, ${p.y}, ${p.z})` +
            ` | partner=${partnerText}` +
            ` | ${signState}`,
        );

        const label = sign ? `panneau: ${sign}` : 'sans panneau';

        await new Promise((res) => setTimeout(res, 1000));
        bot.chat(`Coffre ${i + 1}: ${type} (${p.x} ${p.y} ${p.z}) | ${label}`);
      }

      Logger.info(
        `[scan] Scan termine | ${scanLabel} | total=${results.length}`,
      );
    },
  },

  signdbg: {
    description:
      'Debug: affiche les donnees brutes du panneau a une position (ex: !bot signdbg x y z)',
    run({ bot, args, Logger }) {
      if (args.length !== 3) {
        bot.chat('Usage: !bot signdbg <x> <y> <z>');
        return;
      }

      const [x, y, z] = args.map(Number);
      if ([x, y, z].some(isNaN)) {
        bot.chat('Coordonnees invalides.');
        return;
      }

      const Vec3 = require('vec3');
      const pos = new Vec3(x, y, z);
      const block = bot.blockAt(pos);
      const entityJson = JSON.stringify(block?.entity ?? null);

      Logger.info(
        `[signdbg] Position=(${x}, ${y}, ${z}) | Block=${block?.name ?? 'null'} | Entity=${entityJson}`,
      );

      bot.chat(`Block: ${block?.name ?? 'null'}`);
      bot.chat(`Entity(200): ${entityJson.slice(0, 200)}`);
    },
  },

  goto: {
    description:
      'Deplace le bot vers des coordonnees XYZ (ex: !bot goto 100 64 -200)',
    async run({ bot, args, Logger }) {
      if (args.length !== 3) {
        bot.chat('Usage: !bot goto <x> <y> <z>');
        return;
      }

      const [x, y, z] = args.map(Number);
      if ([x, y, z].some(isNaN)) {
        bot.chat(
          'Usage: !bot goto <x> <y> <z> (x, y, z doivent etre des nombres)',
        );
        return;
      }

      try {
        await goTo(bot, x, y, z);
        bot.chat(`Deplace vers ${x} ${y} ${z} termine.`);
        Logger.info(`Deplace vers ${x} ${y} ${z} via commande MC.`);
      } catch (err) {
        bot.chat(`Erreur de deplacement: ${err.message}`);
        Logger.error(`Erreur de deplacement vers ${x} ${y} ${z}:`, err);
      }
    },
  },
};

/**
 * Gere les commandes !bot envoyees dans le chat Minecraft.
 * Seuls les joueurs de la whitelist peuvent les utiliser.
 *
 * @param {string} msg - Message brut du chat Minecraft
 * @param {{ Logger: object, isUserWhitelistedMC: (username: string) => boolean, botUsername?: string }} ctx
 * @returns {boolean} true si une commande a ete traitee
 */
function handleMcCommand(msg, { Logger, isUserWhitelistedMC, botUsername }) {
  if (!msg.includes(PREFIX)) return false;

  const parsed = parseMcCommand(msg);
  if (!parsed) return false;

  const { sender, args } = parsed;

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
    bot.chat('Utilise !bot help pour voir les commandes.');
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
