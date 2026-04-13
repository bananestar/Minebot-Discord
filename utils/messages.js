/**
 * messages.js
 *
 * Centralise tous les messages texte du bot.
 * Utilise pickRandom(array) pour tirer un message au hasard.
 */

/**
 * Retourne un element aléatoire d'un tableau.
 * @template T
 * @param {T[]} array
 * @returns {T}
 */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ---------------------------------------------------------------------------
// Salutations (playerJoined)
// ${username} = pseudo du joueur
// ---------------------------------------------------------------------------

const GREETINGS = [
  (username) => `Bonjour ${username} ! o/`,
  (username) => `Salut ${username} !`,
  (username) => `Hey ${username}, te voila !`,
  (username) => `${username} est dans la place !`,
  (username) => `Yo ${username} !`,
  (username) => `Bienvenue ${username} !`,
  (username) => `Ah, ${username} ! Content de te voir.`,
  (username) => `${username} a rejoint le serveur. Bonjour !`,
  (username) => `Salutations, ${username}.`,
  (username) => `Tiens, ${username} ! Ca faisait longtemps.`,
];

/**
 * @param {string} username
 * @returns {string}
 */
function randomGreeting(username) {
  return pickRandom(GREETINGS)(username);
}

// ---------------------------------------------------------------------------
// Auto-sleep (avant de dormir)
// ${playerNames} = liste des joueurs connectes (string)
// ---------------------------------------------------------------------------

const SLEEP_MESSAGES = [
  (playerNames) => `Je vais dormir, ${playerNames} ! Bonne nuit.`,
  (playerNames) => `Nuit ${playerNames}, je vais me reposer.`,
  (playerNames) => `ZZZ... Je vais au lit. Bonne nuit ${playerNames} !`,
  (playerNames) => `Je vais pioncer, ${playerNames}. A demain !`,
  (playerNames) => `Il fait nuit, je dors. Bonne nuit ${playerNames}.`,
  (playerNames) => `${playerNames}, je vais dormir. Faites pas de bêtises.`,
  (playerNames) => `Bonne nuit ${playerNames} ! Je reviens au lever du soleil.`,
  (playerNames) => `Je vais passer la nuit. A tout de suite ${playerNames} !`,
  (playerNames) => `Nuit nuit ${playerNames} ~`,
  (playerNames) =>
    `${playerNames}, je fais une sieste. Reveille-moi si ca brûle.`,
];

/**
 * @param {string} playerNames
 * @returns {string}
 */
function randomSleepMessage(playerNames) {
  return pickRandom(SLEEP_MESSAGES)(playerNames);
}

// ---------------------------------------------------------------------------
// Messages quotidiens (heure aléatoire entre midi et 2h du matin)
// ---------------------------------------------------------------------------

const DAILY_MESSAGES = [
  'Je me demande si les creepers ont des sentiments.',
  "Rappel : les endermen n'aiment pas le regard direct. Soyez respectueux. Et oui c'est a toi que je parle Kevin.",
  'Il parait que les cochons courent plus vite que les joueurs. Info ou intox ?',
  'Je veille sur la base. Enfin... je fais semblant.',
  "Moi j'aime bien la nuit. C'est calme. Les squelettes aussi aiment la nuit.",
  "La lave c'est juste de l'eau pour les gens courageux.",
  'Pensee du jour : Perdu',
  "Je surveille. Je veille. J'attends en fait.",
  "Si vous voyez un creeper, courez. Si vous ne le voyez pas, c'est pire.",
  "Bonne nouvelle : la base n'a pas brûlé pendant mon quart de nuit.",
  "J'ai compte les moutons cette nuit. 1... 2... 3... zzz.",
  'Le netherrack ca brûle pour toujours. Relatable.',
  'Fun fact : les chauves-souris ne servent a rien. Comme moi parfois.',
  "Je suis un bot. Mais j'ai des rêves. Des rêves de minerai de fer.",
  "Il fait beau aujourd'hui. Enfin je crois, je suis dans une cave.",
  'Les villageois me regardent bizarrement depuis ce matin.',
];

/**
 * @returns {string}
 */
function randomDailyMessage() {
  return pickRandom(DAILY_MESSAGES);
}

// ---------------------------------------------------------------------------

module.exports = {
  randomGreeting,
  randomSleepMessage,
  randomDailyMessage,
};
