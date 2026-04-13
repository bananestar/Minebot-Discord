const axios = require('axios');

/**
 * Récupère les infos du serveur Minecraft via l'API mcstatus.io.
 * Retourne null en cas d'échec.
 *
 * @returns {Promise<{online: boolean, players: {online: number, max: number}} | null>}
 */
async function fetchServerInfo() {
  const server = process.env.SERVER_MC;
  const port = process.env.PORT;
  if (!server || !port) return null;
  try {
    const { data } = await axios.get(
      `https://api.mcstatus.io/v2/status/java/${server}:${port}`,
      { timeout: 5000 },
    );
    return {
      online: data.online ?? false,
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 0,
      },
    };
  } catch {
    return null;
  }
}

module.exports = { fetchServerInfo };
