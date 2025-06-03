require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// === Définition des commandes Slash ===

/**
 * Liste des commandes slash pour contrôler le bot Minecraft.
 * Chaque commande est construite avec SlashCommandBuilder.
 */
const commands = [
  new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Contrôler le bot Minecraft')
    .addSubcommand((cmd) =>
      cmd.setName('start').setDescription('Lancer le bot Minecraft')
    )
    .addSubcommand((cmd) =>
      cmd
        .setName('stop')
        .setDescription('Déconnecter proprement le bot Minecraft')
    )
    .addSubcommand((cmd) =>
      cmd.setName('status').setDescription('Afficher le statut actuel du bot')
    )
    .addSubcommand((cmd) =>
      cmd
        .setName('logs')
        .setDescription('Recevoir les fichiers logs en message privé')
    )
    .addSubcommand((cmd) =>
      cmd
        .setName('tpa')
        .setDescription(
          'Envoyer une demande de TPA vers votre compte Minecraft associé'
        )
    ),
].map((cmd) => cmd.toJSON());

// === Fonction de déploiement des commandes Slash ===
async function deploy() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🚀 Déploiement des commandes slash...');
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log('✅ Commandes slash enregistrées avec succès.');
  } catch (err) {
    console.error('❌ Erreur lors du déploiement des commandes :', err);
  }
}

module.exports = { deploy };
