# Minebot-Discord

Minebot-Discord is a Discord bot developed in **Node.js** that allows interaction with a **Minecraft** server through **Discord slash commands**.
The bot is designed to securely control a Minecraft bot, execute in-game actions, and retrieve logs, using a Discord ↔ Minecraft whitelist system.

## Features

* Minecraft bot connection to a server
* Discord slash commands
* Discord ↔ Minecraft user association via whitelist
* Start and stop the Minecraft bot cleanly
* Send in-game actions (TPA)
* Retrieve bot logs via private messages
* Configuration using environment variables

## Requirements

* Node.js (recommended version: 18 or higher)
* A Discord bot created via the Discord Developer Portal
* An accessible Minecraft server
* Required permissions for Discord slash commands

## Installation

1. Clone the repository:

```
git clone https://github.com/bananestar/Minebot-Discord.git
```

2. Move into the project directory:

```
cd Minebot-Discord
```

3. Install dependencies:

```
npm install
```

## Configuration

### `.env` file

Create a `.env` file at the root of the project based on `.env.exemple`.

Content of `.env.exemple`:

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
SERVER_MC=
PORT=
USERNAME=
VERSION=
```

### Environment variables description

* `DISCORD_TOKEN` : Discord bot token
* `CLIENT_ID` : Discord application ID
* `GUILD_ID` : Authorized Discord server ID
* `SERVER_MC` : Minecraft server address
* `PORT` : Minecraft server port
* `USERNAME` : Minecraft account used by the bot
* `VERSION` : Target Minecraft version

## Whitelist (required)

The file `whitelist.exemple.json` was not initially provided and must be created manually.

### File creation

Create a file named:

```
whitelist.json
```

### Expected format

The file must contain a JSON array of objects:

```json
[
  {
    "id": "DISCORD_ID",
    "mcUsername": "MINECRAFT_USERNAME"
  }
]
```

### Fields description

* `id` : Authorized Discord user ID
* `mcUsername` : Associated Minecraft username

Only users present in this file are allowed to use Minecraft-related commands.

## Discord Commands

Minebot-Discord uses **Discord slash commands**.

### Usage conditions

* Commands are only available on the Discord server defined by `GUILD_ID`
* Minecraft commands require the user to be present in `whitelist.json`
* Each Minecraft action is linked to the corresponding Discord user

### Available commands

#### `/bot start`

Starts the Minecraft bot.

* Connects the Minecraft bot to the configured server
* Initializes the game session

---

#### `/bot tpa`

Sends a teleport request to your associated Minecraft account.

* Minecraft username is retrieved from the whitelist
* Command is executed in-game via the bot

---

#### `/bot stop`

Stops the Minecraft bot cleanly.

* Properly disconnects from the server
* Closes the active session

---

#### `/bot status`

Displays the current bot status.

* Indicates whether the Minecraft bot is connected or not

---

#### `/bot logs`

Retrieves the bot log files.

* Logs are sent via Discord private message
* Accessible only to the user who executed the command

## Running the bot

To start the bot:

```
node index.js
```

Or using npm if a script is defined:

```
npm start
```

## Project structure

* `index.js` : Main entry point
* `bot.js` : Discord client handling
* `commands/` : Discord slash commands
* `config/` : Bot configuration
* `utils/` : Utility functions
* `whitelist.json` : Authorized users

## Security

* Access controlled via Discord ↔ Minecraft whitelist
* Sensitive commands are restricted
* Logs are only sent via private messages

## Contribution

Contributions are welcome:

1. Fork the repository
2. Create a dedicated branch
3. Commit your changes
4. Open a Pull Request

## License

Copyright (c) 2026 bananestar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
