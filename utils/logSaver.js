const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Supprime les codes ANSI (couleurs chalk) pour un fichier lisible
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(str) {
  return str.replace(ANSI_REGEX, '');
}

function getLogFile() {
  const date = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Brussels',
  });
  return path.join(LOGS_DIR, `${date}.log`);
}

function writeChunk(chunk) {
  try {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const clean = stripAnsi(text);
    if (!clean.trim()) return;
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.appendFileSync(getLogFile(), clean, 'utf8');
  } catch {
    // Ne pas bloquer le process si l'écriture échoue
  }
}

const MAX_LOG_AGE_DAYS = 30;

function cleanOldLogs() {
  if (!fs.existsSync(LOGS_DIR)) return;
  const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(LOGS_DIR)) {
    if (!f.endsWith('.log')) continue;
    const fp = path.join(LOGS_DIR, f);
    try {
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    } catch {}
  }
}

/**
 * Intercepte stdout et stderr pour sauvegarder l'historique de la console
 * dans logs/YYYY-MM-DD.log (un fichier par jour, rotation automatique).
 * Doit être appelé une seule fois au démarrage du process.
 */
function setupLogSaver() {
  cleanOldLogs();
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk, encoding, callback) => {
    writeChunk(chunk);
    return originalStdoutWrite(chunk, encoding, callback);
  };

  process.stderr.write = (chunk, encoding, callback) => {
    writeChunk(chunk);
    return originalStderrWrite(chunk, encoding, callback);
  };
}

module.exports = { setupLogSaver, LOGS_DIR };
