let _bot = null;

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
}

module.exports = Object.freeze({
  getBot,
  hasBot,
  setBot,
  clearBot,
});
