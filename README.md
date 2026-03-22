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
- Message aléatoire quotidien envoyé dans le chat à une heure aléatoire entre 12h et 2h du matin
- Reconnexion intelligente avec vérification du statut serveur
- Notifications Discord en temps réel
- Filtrage des paquets Minecraft malformés (plugins serveur non-standard)
- Sauvegarde automatique des logs console dans `logs/` (un fichier par jour)
- Sauvegarde du state en cas de crash dans `crashes/`
- Reprise d'action après déconnexion (`!bot resume`)

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

| Commande | Description |
| --- | --- |
| `/bot start` | Lance le bot Minecraft |
| `/bot stop` | Déconnecte proprement le bot |
| `/bot status` | Affiche un embed complet : HP, faim, position, uptime, action en cours, systèmes auto |
| `/bot tpa` | Envoie `/tpa <pseudo>` au pseudo MC lié à votre compte Discord |
| `/bot logs` | Liste les fichiers de log disponibles via un menu déroulant et envoie celui sélectionné |
| `/bot crashes` | Liste les crash states JSON disponibles et envoie celui sélectionné |

---

## Commandes in-game (`!bot`)

> Tapées dans le chat Minecraft. Réservées aux joueurs présents dans la `whitelist.json`.

| Commande | Description |
| --- | --- |
| `!bot help` | Affiche toutes les commandes disponibles |
| `!bot status` | Affiche HP, faim, saturation, position et état de l'auto-sleep |
| `!bot ping` | Répond "Pong !" |
| `!bot inv` | Affiche l'inventaire du bot (groupé par item) |
| `!bot drop` | Drope tout l'inventaire |
| `!bot goto <x> <y> <z>` | Déplace le bot vers les coordonnées données |
| `!bot scan <rayon>` | Scanne les coffres autour du bot dans un rayon donné |
| `!bot scan <x1> <y1> <z1> <x2> <y2> <z2>` | Scanne les coffres dans une zone précise |
| `!bot signdbg <x> <y> <z>` | Affiche les données NBT brutes d'un panneau (debug) |
| `!bot sleep on` | Active le sommeil automatique la nuit |
| `!bot sleep off` | Désactive le sommeil automatique |
| `!bot resume` | Reprend l'action interrompue lors de la dernière déconnexion |

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

## Reprise d'action (`!bot resume`)

Si le bot se déconnecte pendant une action (`goto`, `scan`, `sleeping`) :

1. L'action et ses paramètres sont sauvegardés avant la déconnexion
2. À la reconnexion, le bot envoie un message dans le chat MC pour signaler l'interruption
3. `!bot resume` relance exactement l'action là où elle en était

Cas particulier du sommeil : le bot retourne à sa position **pré-sommeil** sans rechercher de lit. L'auto-sleep est mis en pause pendant le trajet pour éviter toute interférence.

---

## Logs & Crashes

### Logs (`logs/`)

Tout l'historique de la console est sauvegardé automatiquement dans `logs/YYYY-MM-DD.log`. Un nouveau fichier est créé chaque jour. Les codes couleur ANSI (chalk) sont retirés pour un fichier lisible.

### Crash states (`crashes/`)

En cas de crash ou de déconnexion inattendue, un snapshot JSON de l'état complet du bot est écrit dans `crashes/<timestamp>_<event>.json` :

- HP, faim, saturation
- Position XYZ
- Action en cours, flags automatiques
- Inventaire complet
- Uptime

---

## Structure du projet

```text
AtomBot/
├── index.js              # Point d'entrée, bot Discord
├── bot.js                # Cycle de vie du bot Minecraft
├── commands.js           # Déploiement des slash commands Discord
├── state.js              # État partagé (bot, position, actions, reprise)
├── config.js             # Règles TPA et configuration
├── whitelist.json        # Utilisateurs autorisés
├── features/
│   ├── mcCommands.js     # Commandes !bot in-game (dont !bot resume)
│   └── tpa.js            # Gestion du TPA automatique
├── utils/
│   ├── pathfinder.js      # Déplacement (mineflayer-pathfinder)
│   ├── scanner.js         # Scan de coffres et lecture de panneaux
│   ├── botLife.js         # Auto-eat, auto-heal, auto-sleep, salutation
│   ├── logger.js          # Logger coloré console
│   ├── logSaver.js        # Sauvegarde de l'historique console dans logs/
│   ├── stateDumper.js     # Dump JSON de l'état en cas de crash
│   ├── discordNotifier.js # Envoi de messages Discord depuis le code
│   └── packetSanitizer.js # Filtrage des erreurs de paquets Minecraft
├── logs/                  # Historique console (YYYY-MM-DD.log)
└── crashes/               # Crash states JSON
```

---

## Licence

ISC — Copyright (c) 2026 bananestar
