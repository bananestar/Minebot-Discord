const Vec3 = require('vec3');

const CHEST_NAMES = ['chest', 'trapped_chest', 'barrel'];
const EMPTY_SIGN_LABEL = '(panneau vide)';

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

  // Hanging signs
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

  // Wall hanging signs
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
 * Depile les objets NBT de type { type, value } jusqu'a la valeur brute.
 *
 * @param {any} v
 * @returns {any}
 */
function unwrapAll(v) {
  while (
    v !== null &&
    v !== undefined &&
    typeof v === 'object' &&
    'value' in v
  ) {
    v = v.value;
  }
  return v;
}

/**
 * Depile un seul niveau { type, value }.
 *
 * @param {any} v
 * @returns {any}
 */
function unwrap(v) {
  return v !== null && v !== undefined && typeof v === 'object' && 'value' in v
    ? v.value
    : v;
}

/**
 * Lit une cle dans une structure NBT mineflayer.
 *
 * @param {any} obj
 * @param {string} key
 * @returns {any}
 */
function getNbt(obj, key) {
  return unwrapAll(unwrap(obj)?.[key]);
}

/**
 * Extrait les lignes de texte d'un JSON de texte Minecraft.
 *
 * @param {string} raw
 * @returns {string | null}
 */
function parseMinecraftText(raw) {
  if (typeof raw !== 'string' || !raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (typeof parsed === 'string') {
      return parsed.trim() || null;
    }

    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.text === 'string' && parsed.text.trim()) {
        return parsed.text.trim();
      }

      if (Array.isArray(parsed.extra)) {
        const joined = parsed.extra
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part.text === 'string') return part.text;
            return '';
          })
          .join('')
          .trim();

        if (joined) return joined;
      }
    }

    const fallback = String(parsed).trim();
    return fallback || null;
  } catch {
    return raw.trim() || null;
  }
}

/**
 * Lit le texte d'un panneau.
 *
 * Retourne :
 * - null si aucun panneau exploitable
 * - '(panneau vide)' si panneau trouve mais sans texte
 * - '...' si texte trouve
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
    if (!entity) {
      return EMPTY_SIGN_LABEL;
    }

    const lines = [];

    // Format 1.20+ : front_text.messages
    const frontText = getNbt(entity, 'front_text');
    const messages = getNbt(frontText, 'messages');

    if (Array.isArray(messages)) {
      for (let raw of messages) {
        raw = unwrap(raw);
        const text = parseMinecraftText(raw);
        if (text) lines.push(text);
      }
    }

    // Ancien format : Text1..Text4
    if (lines.length === 0) {
      for (const key of ['Text1', 'Text2', 'Text3', 'Text4']) {
        const raw = getNbt(entity, key);
        const text = parseMinecraftText(raw);
        if (text) lines.push(text);
      }
    }

    return lines.length > 0 ? lines.join(' | ') : EMPTY_SIGN_LABEL;
  } catch {
    return null;
  }
}

/**
 * Cherche un panneau strictement au-dessus d'un coffre/baril.
 * Ne regarde PAS sur les cotes pour eviter les faux positifs.
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
    const pos = new Vec3(x, y + dy, z);
    const block = bot.blockAt(pos);

    if (!block) continue;
    if (!signIds.has(block.type)) continue;

    return readSignText(bot, pos);
  }

  return null;
}

/**
 * Retourne true si deux coffres peuvent etre fusionnes en double coffre.
 *
 * @param {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }} a
 * @param {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }} b
 * @returns {boolean}
 */
function areAdjacentDoubleChests(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'barrel') return false;
  if (a.position.y !== b.position.y) return false;

  const dx = Math.abs(a.position.x - b.position.x);
  const dz = Math.abs(a.position.z - b.position.z);

  return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
}

/**
 * Choisit la meilleure info de panneau pour un double coffre.
 *
 * Regle :
 * - si un seul a un panneau, on garde celui-la
 * - si les deux ont le meme, on garde cette valeur
 * - si les deux ont des valeurs differentes, on les combine
 *
 * @param {string | null} a
 * @param {string | null} b
 * @returns {string | null}
 */
function mergeSigns(a, b) {
  if (a === null && b === null) return null;
  if (a !== null && b === null) return a;
  if (a === null && b !== null) return b;
  if (a === b) return a;

  const parts = [a, b].filter(Boolean);
  return parts.join(' || ');
}

/**
 * Fusionne les paires de doubles coffres en un seul resultat.
 *
 * @param {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }[]} results
 * @returns {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }[]}
 */
function deduplicateDoubleChests(results) {
  const used = new Set();
  const output = [];

  for (let i = 0; i < results.length; i++) {
    if (used.has(i)) continue;

    const a = results[i];

    if (a.type === 'barrel') {
      output.push(a);
      continue;
    }

    let merged = false;

    for (let j = i + 1; j < results.length; j++) {
      if (used.has(j)) continue;

      const b = results[j];
      if (!areAdjacentDoubleChests(a, b)) continue;

      used.add(j);
      merged = true;

      const leftMost =
        a.position.x < b.position.x ||
        (a.position.x === b.position.x && a.position.z <= b.position.z)
          ? a
          : b;

      output.push({
        position: leftMost.position,
        type:
          a.type === 'trapped_chest' ? 'large_trapped_chest' : 'large_chest',
        sign: mergeSigns(a.sign, b.sign),
      });

      break;
    }

    if (!merged) {
      output.push(a);
    }
  }

  return output;
}

/**
 * Scanne une zone rectangulaire et retourne tous les coffres trouves
 * avec le texte du panneau situe au-dessus si present.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {{ x: number, y: number, z: number }} pos1
 * @param {{ x: number, y: number, z: number }} pos2
 * @returns {{ position: {x:number,y:number,z:number}, type: string, sign: string | null }[]}
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
      (id) => id !== undefined,
    ),
  );

  const signIds = new Set(
    SIGN_NAMES.map((name) => bot.registry.blocksByName[name]?.id).filter(
      (id) => id !== undefined,
    ),
  );

  const raw = [];

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block) continue;
        if (!chestIds.has(block.type)) continue;

        const sign = findSignAbove(bot, x, y, z, signIds);

        raw.push({
          position: { x, y, z },
          type: block.name,
          sign,
        });
      }
    }
  }

  return deduplicateDoubleChests(raw);
}

module.exports = {
  scanChests,
  EMPTY_SIGN_LABEL,
};
