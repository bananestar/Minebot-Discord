const Vec3 = require('vec3');

const CHEST_NAMES = ['chest', 'trapped_chest', 'barrel'];

const SIGN_NAMES = [
  // Standing signs
  'oak_sign',
  'spruce_sign',
  'birch_sign',
  'jungle_sign',
  'acacia_sign',
  'dark_oak_sign',
  'crimson_sign',
  'warped_sign',
  'mangrove_sign',
  'bamboo_sign',
  'cherry_sign',
  // Wall signs
  'oak_wall_sign',
  'spruce_wall_sign',
  'birch_wall_sign',
  'jungle_wall_sign',
  'acacia_wall_sign',
  'dark_oak_wall_sign',
  'crimson_wall_sign',
  'warped_wall_sign',
  'mangrove_wall_sign',
  'bamboo_wall_sign',
  'cherry_wall_sign',
  // Hanging signs (1.20+)
  'oak_hanging_sign',
  'spruce_hanging_sign',
  'birch_hanging_sign',
  'jungle_hanging_sign',
  'acacia_hanging_sign',
  'dark_oak_hanging_sign',
  'crimson_hanging_sign',
  'warped_hanging_sign',
  'mangrove_hanging_sign',
  'bamboo_hanging_sign',
  'cherry_hanging_sign',
  // Wall hanging signs (1.20+)
  'oak_wall_hanging_sign',
  'spruce_wall_hanging_sign',
  'birch_wall_hanging_sign',
  'jungle_wall_hanging_sign',
  'acacia_wall_hanging_sign',
  'dark_oak_wall_hanging_sign',
  'crimson_wall_hanging_sign',
  'warped_wall_hanging_sign',
  'mangrove_wall_hanging_sign',
  'bamboo_wall_hanging_sign',
  'cherry_wall_hanging_sign',
];

/**
 * Lit le texte d'un panneau depuis les donnees de l'entite de bloc.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {Vec3} pos
 * @returns {string | null}
 */
function readSignText(bot, pos) {
  try {
    const block = bot.blockAt(pos);
    if (!block) return null;

    const entity = block.entity;
    if (!entity) return '(panneau vide)';

    const unwrapAll = (v) => {
      while (
        v !== null &&
        v !== undefined &&
        typeof v === 'object' &&
        'value' in v
      ) {
        v = v.value;
      }
      return v;
    };

    const unwrap = (v) =>
      v !== null && v !== undefined && typeof v === 'object' && 'value' in v
        ? v.value
        : v;

    const get = (obj, key) => unwrapAll(unwrap(obj)?.[key]);

    const lines = [];

    const frontText = get(entity, 'front_text');
    const messages = get(frontText, 'messages');

    if (Array.isArray(messages)) {
      for (let raw of messages) {
        raw = unwrap(raw);
        if (typeof raw !== 'string' || !raw) continue;

        let text = raw;
        try {
          const parsed = JSON.parse(raw);
          text = parsed?.text ?? parsed ?? raw;
        } catch {}

        if (String(text).trim()) lines.push(String(text).trim());
      }
    }

    if (lines.length === 0) {
      for (const key of ['Text1', 'Text2', 'Text3', 'Text4']) {
        const raw = get(entity, key);
        if (typeof raw !== 'string' || !raw) continue;

        let text = raw;
        try {
          const parsed = JSON.parse(raw);
          text = parsed?.text ?? parsed ?? raw;
        } catch {}

        if (String(text).trim()) lines.push(String(text).trim());
      }
    }

    return lines.length > 0 ? lines.join(' | ') : '(panneau vide)';
  } catch {
    return null;
  }
}

/**
 * Cherche un panneau au-dessus d'un coffre (jusqu'a 4 blocs de hauteur).
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Set<number>} signIds
 * @returns {string | null}
 */
function findSignAbove(bot, x, y, z, signIds) {
  for (let dy = 1; dy <= 5; dy++) {
    const signPos = new Vec3(x, y + dy, z);
    const block = bot.blockAt(signPos);

    if (block && signIds.has(block.type)) {
      return readSignText(bot, signPos);
    }
  }

  return null;
}

/**
 * Fusionne les paires de coffres adjacents (double coffres) en un seul resultat.
 * Deux coffres forment un double coffre s'ils sont du meme type, au meme Y,
 * et adjacents en X ou Z (diff de 1).
 *
 * @param {{ position: {x,y,z}, type: string, sign: string|null }[]} results
 * @returns {{ position: {x,y,z}, type: string, sign: string|null }[]}
 */
function deduplicateDoubleChests(results) {
  const merged = new Set();
  const output = [];

  for (let i = 0; i < results.length; i++) {
    if (merged.has(i)) continue;
    const a = results[i];

    // Les barils ne forment pas de double coffre
    if (a.type === 'barrel') {
      output.push(a);
      continue;
    }

    let paired = false;
    for (let j = i + 1; j < results.length; j++) {
      if (merged.has(j)) continue;
      const b = results[j];
      if (b.type !== a.type) continue;
      if (a.position.y !== b.position.y) continue;

      const dx = Math.abs(a.position.x - b.position.x);
      const dz = Math.abs(a.position.z - b.position.z);
      const isAdjacent = (dx === 1 && dz === 0) || (dx === 0 && dz === 1);

      if (isAdjacent) {
        merged.add(j);
        // Conserver le signe de l'un ou l'autre
        const sign = a.sign ?? b.sign;
        output.push({ position: a.position, type: `large_${a.type}`, sign });
        paired = true;
        break;
      }
    }

    if (!paired) output.push(a);
  }

  return output;
}

/**
 * Scanne une zone rectangulaire et retourne tous les coffres trouves
 * avec le texte du panneau situe au-dessus (si present).
 *
 * @param {import('mineflayer').Bot} bot
 * @param {{ x: number, y: number, z: number }} pos1 - Premier coin
 * @param {{ x: number, y: number, z: number }} pos2 - Coin oppose
 * @returns {{ position: {x,y,z}, type: string, sign: string|null }[]}
 */
function scanChests(bot, pos1, pos2) {
  const minX = Math.min(pos1.x, pos2.x);
  const maxX = Math.max(pos1.x, pos2.x);
  const minY = Math.min(pos1.y, pos2.y);
  const maxY = Math.max(pos1.y, pos2.y);
  const minZ = Math.min(pos1.z, pos2.z);
  const maxZ = Math.max(pos1.z, pos2.z);

  const chestIds = new Set(
    CHEST_NAMES.map((name) => bot.registry.blocksByName[name]?.id).filter(
      Boolean,
    ),
  );

  const signIds = new Set(
    SIGN_NAMES.map((name) => bot.registry.blocksByName[name]?.id).filter(
      Boolean,
    ),
  );

  const raw = [];

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block || !chestIds.has(block.type)) continue;

        const sign = findSignAbove(bot, x, y, z, signIds);
        raw.push({ position: { x, y, z }, type: block.name, sign });
      }
    }
  }

  return deduplicateDoubleChests(raw);
}

module.exports = { scanChests };
