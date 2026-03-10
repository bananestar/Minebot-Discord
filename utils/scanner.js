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
 * Depile les objets NBT du style { type, value } jusqu'a la valeur brute.
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
 * Lit une cle dans une structure NBT.
 *
 * @param {any} obj
 * @param {string} key
 * @returns {any}
 */
function getNbt(obj, key) {
  return unwrapAll(unwrap(obj)?.[key]);
}

/**
 * Parse un texte JSON Minecraft.
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
 * Retourne les proprietes d'un bloc Mineflayer.
 *
 * @param {any} block
 * @returns {object | null}
 */
function getBlockProps(block) {
  if (!block) return null;

  if (typeof block.getProperties === 'function') {
    return block.getProperties();
  }

  return block._properties ?? block.properties ?? null;
}

/**
 * Retourne l'etat utile d'un coffre.
 *
 * @param {any} block
 * @returns {{ facing: string | null, type: string }}
 */
function getChestState(block) {
  const props = getBlockProps(block);

  if (!props) {
    return {
      facing: null,
      type: 'unknown',
    };
  }

  return {
    facing: props.facing ?? null,
    type: props.type ?? 'unknown',
  };
}

/**
 * Verifie si deux positions sont adjacentes sur X/Z au meme Y.
 *
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @returns {boolean}
 */
function isAdjacentPos(a, b) {
  if (!a || !b) return false;
  if (a.y !== b.y) return false;

  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);

  return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
}

/**
 * Retourne l'offset du coffre partenaire selon facing + type(left/right).
 *
 * @param {string | null} facing
 * @param {string} chestType
 * @returns {{x:number,y:number,z:number} | null}
 */
function getPartnerOffsetFromFacing(facing, chestType) {
  const map = {
    north: {
      left: { x: 1, y: 0, z: 0 },
      right: { x: -1, y: 0, z: 0 },
    },
    south: {
      left: { x: -1, y: 0, z: 0 },
      right: { x: 1, y: 0, z: 0 },
    },
    east: {
      left: { x: 0, y: 0, z: 1 },
      right: { x: 0, y: 0, z: -1 },
    },
    west: {
      left: { x: 0, y: 0, z: -1 },
      right: { x: 0, y: 0, z: 1 },
    },
  };

  return map[facing]?.[chestType] ?? null;
}

/**
 * Retourne la position attendue du partenaire d'un double coffre
 * d'apres les block states.
 *
 * @param {any} block
 * @returns {Vec3 | null}
 */
function getExpectedPartnerPos(block) {
  const state = getChestState(block);

  if (state.type !== 'left' && state.type !== 'right') return null;
  if (!state.facing) return null;

  const offset = getPartnerOffsetFromFacing(state.facing, state.type);
  if (!offset) return null;

  return new Vec3(
    block.position.x + offset.x,
    block.position.y + offset.y,
    block.position.z + offset.z,
  );
}

/**
 * Lit le texte d'un panneau.
 *
 * Retourne :
 * - null si pas de panneau exploitable
 * - EMPTY_SIGN_LABEL si panneau vide
 * - le texte sinon
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
    if (!entity) return EMPTY_SIGN_LABEL;

    const lines = [];

    // Format 1.20+
    const frontText = getNbt(entity, 'front_text');
    const messages = getNbt(frontText, 'messages');

    if (Array.isArray(messages)) {
      for (let raw of messages) {
        raw = unwrap(raw);
        const text = parseMinecraftText(raw);
        if (text) lines.push(text);
      }
    }

    // Ancien format
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
 * Cherche un panneau strictement au-dessus d'un coffre.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Set<number>} signIds
 * @returns {string | null}
 */
function findSignAbove(bot, x, y, z, signIds) {
  for (let dy = 1; dy <= 3; dy++) {
    const pos = new Vec3(x, y + dy, z);
    const block = bot.blockAt(pos);

    if (!block) continue;
    if (!signIds.has(block.type)) continue;

    return readSignText(bot, pos);
  }

  return null;
}

/**
 * Cherche un panneau pour un double coffre en testant les deux moities.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {any} blockA
 * @param {any} blockB
 * @param {Set<number>} signIds
 * @returns {string | null}
 */
function findSignForDoubleChest(bot, blockA, blockB, signIds) {
  const signA = findSignAbove(
    bot,
    blockA.position.x,
    blockA.position.y,
    blockA.position.z,
    signIds,
  );

  const signB = findSignAbove(
    bot,
    blockB.position.x,
    blockB.position.y,
    blockB.position.z,
    signIds,
  );

  if (signA === null && signB === null) return null;

  if (signA !== null && signB === null) return signA;
  if (signA === null && signB !== null) return signB;

  if (signA === signB) return signA;

  if (signA !== EMPTY_SIGN_LABEL && signB === EMPTY_SIGN_LABEL) return signA;
  if (signA === EMPTY_SIGN_LABEL && signB !== EMPTY_SIGN_LABEL) return signB;

  return `${signA} || ${signB}`;
}

/**
 * Detecte de maniere robuste si un coffre fait partie d'un double coffre.
 * Utilise :
 * 1. facing + type
 * 2. fallback adjacency
 *
 * @param {import('mineflayer').Bot} bot
 * @param {any} block
 * @param {Set<number>} chestIds
 * @returns {{ isDouble: boolean, partner: any | null, method: string }}
 */
function resolveChestPair(bot, block, chestIds) {
  if (!block || !chestIds.has(block.type)) {
    return {
      isDouble: false,
      partner: null,
      method: 'invalid',
    };
  }

  const expectedPartnerPos = getExpectedPartnerPos(block);

  // Methode 1 : block states
  if (expectedPartnerPos) {
    const partner = bot.blockAt(expectedPartnerPos);

    if (
      partner &&
      partner.type === block.type &&
      isAdjacentPos(block.position, partner.position)
    ) {
      return {
        isDouble: true,
        partner,
        method: 'state',
      };
    }
  }

  // Methode 2 : adjacency fallback
  const neighborPositions = [
    new Vec3(block.position.x + 1, block.position.y, block.position.z),
    new Vec3(block.position.x - 1, block.position.y, block.position.z),
    new Vec3(block.position.x, block.position.y, block.position.z + 1),
    new Vec3(block.position.x, block.position.y, block.position.z - 1),
  ];

  for (const pos of neighborPositions) {
    const neighbor = bot.blockAt(pos);
    if (!neighbor) continue;
    if (neighbor.type !== block.type) continue;

    return {
      isDouble: true,
      partner: neighbor,
      method: 'adjacency',
    };
  }

  return {
    isDouble: false,
    partner: null,
    method: 'single',
  };
}

/**
 * Retourne la position canonique d'un double coffre
 * pour eviter les doublons.
 *
 * @param {any} a
 * @param {any} b
 * @returns {{x:number,y:number,z:number}}
 */
function getCanonicalDoubleChestPosition(a, b) {
  const first =
    a.position.x < b.position.x ||
    (a.position.x === b.position.x && a.position.z <= b.position.z)
      ? a
      : b;

  return {
    x: first.position.x,
    y: first.position.y,
    z: first.position.z,
  };
}

/**
 * Scanne une zone rectangulaire et retourne tous les coffres/barils trouves
 * avec l'etat du panneau au-dessus.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {{ x: number, y: number, z: number }} pos1
 * @param {{ x: number, y: number, z: number }} pos2
 * @returns {{ position: {x:number,y:number,z:number}, type: string, sign: string | null, meta?: object }[]}
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

  const visited = new Set();
  const results = [];

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${y},${z}`;
        if (visited.has(key)) continue;

        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block) continue;
        if (!chestIds.has(block.type)) continue;

        // Cas barrel : jamais double
        if (block.name === 'barrel') {
          visited.add(key);

          const sign = findSignAbove(bot, x, y, z, signIds);

          results.push({
            position: { x, y, z },
            type: 'barrel',
            sign,
            meta: {
              isDouble: false,
              scanMethod: 'single',
              facing: null,
              chestType: 'single',
            },
          });

          continue;
        }

        const chestState = getChestState(block);
        const pair = resolveChestPair(bot, block, chestIds);

        if (pair.isDouble && pair.partner) {
          const partnerKey = `${pair.partner.position.x},${pair.partner.position.y},${pair.partner.position.z}`;

          visited.add(key);
          visited.add(partnerKey);

          const position = getCanonicalDoubleChestPosition(block, pair.partner);
          const sign = findSignForDoubleChest(
            bot,
            block,
            pair.partner,
            signIds,
          );

          results.push({
            position,
            type:
              block.name === 'trapped_chest'
                ? 'large_trapped_chest'
                : 'large_chest',
            sign,
            meta: {
              isDouble: true,
              scanMethod: pair.method,
              facing: chestState.facing,
              chestType: chestState.type,
              partner: {
                x: pair.partner.position.x,
                y: pair.partner.position.y,
                z: pair.partner.position.z,
              },
            },
          });

          continue;
        }

        visited.add(key);

        const sign = findSignAbove(bot, x, y, z, signIds);

        results.push({
          position: { x, y, z },
          type: block.name,
          sign,
          meta: {
            isDouble: false,
            scanMethod: pair.method,
            facing: chestState.facing,
            chestType: chestState.type,
          },
        });
      }
    }
  }

  return results;
}

module.exports = {
  scanChests,
  EMPTY_SIGN_LABEL,
};
