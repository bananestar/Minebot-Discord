let _bot = null;

// Temps de connexion
let _connectedTime = null;

// Action en cours du bot
let _currentAction = 'idle';

// Arguments de l'action en cours (ex: [x, y, z] pour goto, params pour scan)
let _currentActionArgs = null;

// Action interrompue lors d'une déconnexion — survit à clearBot()
let _pendingResume = null;

// Flags des comportements automatiques en cours
let _isEating = false;
let _isHealing = false;
let _isSleeping = false; // true pendant toute la routine auto-sleep

// Instance auto-sleep (partagée entre mcCommands et botLife)
let _autoSleepInstance = null;

// --- Bot ---
function getBot() {
  return _bot;
}

function hasBot() {
  return !!(_bot && _bot.player);
}

function setBot(botInstance) {
  _bot = botInstance ?? null;
}

function clearBot() {
  _bot = null;
  _currentAction = 'idle';
  _currentActionArgs = null;
  _isEating = false;
  _isHealing = false;
  _isSleeping = false;
  _connectedTime = null;
  _autoSleepInstance = null;
  // NOTE: _pendingResume n'est PAS réinitialisé ici — il survit à la déco
}

// --- Position (lecture directe depuis l'entité du bot) ---
function getPosition() {
  return _bot?.entity?.position ?? null;
}

// --- Temps de connexion ---
function getConnectedTime() {
  return _connectedTime;
}

function setConnectedTime(time) {
  _connectedTime = time ?? null;
}

// --- Action en cours ---
// Valeurs possibles : 'idle' | 'eating' | 'healing' | 'sleeping' | 'navigating' | 'scanning'
function getCurrentAction() {
  return _currentAction;
}

function setCurrentAction(action) {
  _currentAction = action;
}

// --- Arguments de l'action en cours ---
function getCurrentActionArgs() {
  return _currentActionArgs;
}

function setCurrentActionArgs(args) {
  _currentActionArgs = args ?? null;
}

// --- Action en attente de reprise ---
function getPendingResume() {
  return _pendingResume;
}

function setPendingResume(payload) {
  _pendingResume = payload ?? null;
}

function clearPendingResume() {
  _pendingResume = null;
}

// --- Flags comportements ---
function getIsEating() {
  return _isEating;
}

function setIsEating(v) {
  _isEating = Boolean(v);
}

function getIsHealing() {
  return _isHealing;
}

function setIsHealing(v) {
  _isHealing = Boolean(v);
}

function getIsSleeping() {
  return _isSleeping;
}

function setIsSleeping(v) {
  _isSleeping = Boolean(v);
}

// --- Instance auto-sleep ---
function getAutoSleepInstance() {
  return _autoSleepInstance;
}

function setAutoSleepInstance(instance) {
  _autoSleepInstance = instance ?? null;
}

module.exports = Object.freeze({
  // Bot
  getBot,
  hasBot,
  setBot,
  clearBot,
  // Position
  getPosition,
  // Temps de connexion
  getConnectedTime,
  setConnectedTime,
  // Action en cours
  getCurrentAction,
  setCurrentAction,
  // Arguments de l'action en cours
  getCurrentActionArgs,
  setCurrentActionArgs,
  // Action en attente de reprise
  getPendingResume,
  setPendingResume,
  clearPendingResume,
  // Flags comportements
  getIsEating,
  setIsEating,
  getIsHealing,
  setIsHealing,
  getIsSleeping,
  setIsSleeping,
  // Instance auto-sleep
  getAutoSleepInstance,
  setAutoSleepInstance,
});
