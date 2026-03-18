# AtomBot

Bot Minecraft piloté via Discord, développé en **Node.js**. Il connecte un compte Minecraft à un serveur et expose des commandes Discord slash ainsi que des commandes in-game, avec un système de whitelist Discord ↔ Minecraft.

---

## Fonctionnalités

- Connexion du bot Minecraft avec authentification Microsoft
- Contrôle via slash commands Discord (`/bot`)
- Commandes in-game via le chat Minecraft (`!bot`)
- TPA automatique (accepte/refuse selon la whitelist)
- Scan de coffres/barils avec lecture des panneaux
- Déplacement par pathfinding
- Auto-eat (mange automatiquement quand la faim descend sous 18/20)
- Auto-heal (utilise golden apple ou mange pour régénérer si santé < 7 cœurs)
- Auto-sleep (dort la nuit si un joueur whitelisté est connecté, activable via `!bot sleep on/off`)
- Salutation automatique à chaque joueur se connectant (une fois par jour), avec rapport de statut pour les joueurs whitelistés
- Reconnexion intelligente avec vérification du statut serveur
- Notifications Discord en temps réel
- Filtrage des paquets Minecraft malformés (plugins serveur non-standard)

---

## Prérequis

- Node.js 18 ou supérieur
- Un bot Discord créé sur le [Discord Developer Portal](https://discord.com/developers/applications)
- Un serveur Minecraft accessible
- Un compte Minecraft (authentification Microsoft)

---

## Installation

```bash
git clone https://github.com/bananestar/Minebot-Discord.git
cd Minebot-Discord
npm install
```

---

## Configuration

### Fichier `.env`

Créer un fichier `.env` à la racine du projet :

```env
DISCORD_TOKEN=        # Token du bot Discord
CLIENT_ID=            # ID de l'application Discord
GUILD_ID=             # ID du serveur Discord
DISCORD_CHANNEL_ID=   # ID du salon pour les notifications
DISCORD_ROLE=         # Nom du rôle requis pour utiliser les commandes
SERVER_MC=            # Adresse du serveur Minecraft
PORT=                 # Port du serveur Minecraft
USERNAME=             # Pseudo Minecraft du bot
VERSION=              # Version Minecraft cible (ex: 1.20.1)
```

### Fichier `whitelist.json`

Associe les comptes Discord aux pseudos Minecraft. Seuls les utilisateurs listés peuvent utiliser les commandes.

```json
[
  {
    "id": "DISCORD_USER_ID",
    "mcUsername": "PseudoMinecraft"
  }
]
```

---

## Lancement

```bash
node index.js
```

---

## Commandes Discord (`/bot`)

> Requièrent le rôle configuré dans `DISCORD_ROLE` **et** d'être dans la `whitelist.json`.

| Commande      | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `/bot start`  | Lance le bot Minecraft                                         |
| `/bot stop`   | Déconnecte proprement le bot                                   |
| `/bot status` | Affiche le statut et l'uptime du bot                           |
| `/bot tpa`    | Envoie `/tpa <pseudo>` au pseudo MC lié à votre compte Discord |
| `/bot logs`   | Non implémenté                                                 |

---

## Commandes in-game (`!bot`)

> Tapées dans le chat Minecraft. Réservées aux joueurs présents dans la `whitelist.json`.

| Commande                                    | Description                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| `!bot help`                                 | Affiche toutes les commandes disponibles             |
| `!bot status`                               | Affiche HP, faim, saturation et état de l'auto-sleep |
| `!bot ping`                                 | Répond "Pong !"                                      |
| `!bot inv`                                  | Affiche l'inventaire du bot (groupé par item)        |
| `!bot drop`                                 | Drope tout l'inventaire                              |
| `!bot goto <x> <y> <z>`                     | Déplace le bot vers les coordonnées données          |
| `!bot scan <rayon>`                         | Scanne les coffres autour du bot dans un rayon donné |
| `!bot scan <x1> <y1> <z1> <x2> <y2> <z2>`   | Scanne les coffres dans une zone précise             |
| `!bot signdbg <x> <y> <z>`                  | Affiche les données NBT brutes d'un panneau (debug)  |
| `!bot sleep on`                             | Active le sommeil automatique la nuit                |
| `!bot sleep off`                            | Désactive le sommeil automatique                     |

### Détail du scan (`!bot scan`)

Le scan détecte les coffres (`chest`, `trapped_chest`) et les barils (`barrel`) dans la zone. Pour chaque conteneur il retourne :

- Position
- Type (`chest`, `large_chest`, `barrel`, etc.)
- Texte du panneau posé au-dessus (s'il existe)

Les doubles coffres sont automatiquement fusionnés et dédupliqués.

---

## TPA automatique

Le bot surveille le chat Minecraft. Quand une demande de TPA est détectée :

- Le joueur est **whitelisté** → `/tpaccept <joueur>`
- Le joueur n'est **pas whitelisté** → `/tpdeny <joueur>` + message privé d'explication

---

## Reconnexion intelligente

En cas de déconnexion du serveur Minecraft :

1. Le bot interroge l'API `mcstatus.io` toutes les 15 secondes
2. Dès que le serveur est détecté en ligne, il attend 8 secondes puis se reconnecte
3. Le canal Discord configuré est notifié du changement d'état
4. En mode dev (`localhost`), la reconnexion est directe sans appel API

---

## Structure du projet

```text
AtomBot/
├── index.js              # Point d'entrée, bot Discord
├── bot.js                # Cycle de vie du bot Minecraft
├── commands.js           # Déploiement des slash commands Discord
├── state.js              # Singleton de l'instance bot
├── config.js             # Règles TPA et configuration
├── whitelist.json        # Utilisateurs autorisés
├── features/
│   ├── mcCommands.js     # Commandes !bot in-game
│   └── tpa.js            # Gestion du TPA automatique
└── utils/
    ├── pathfinder.js      # Déplacement (mineflayer-pathfinder)
    ├── scanner.js         # Scan de coffres et lecture de panneaux
    ├── botLife.js         # Auto-eat, auto-heal, auto-sleep, salutation
    ├── logger.js          # Logger coloré
    ├── discordNotifier.js # Envoi de messages Discord depuis le code
    └── packetSanitizer.js # Filtrage des erreurs de paquets Minecraft
```

---

## Licence

ISC — Copyright (c) 2026 bananestar
