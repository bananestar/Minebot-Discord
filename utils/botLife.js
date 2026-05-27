const Logger = require('./logger');
const { goTo } = require('./pathfinder');
const state = require('../state');
const { randomGreeting, randomSleepMessage, randomDailyMessage } = require('./messages');

const FOOD_THRESHOLD = 18; // mange en dessous de 18/20
const HEAL_THRESHOLD = 14; // soigne en dessous de 7 coeurs (14/20)
const HEAL_ITEMS = ['golden_apple', 'enchanted_golden_apple'];

/**
 * Consomme un item (nourriture ou soin) depuis l'inventaire du bot.
 * Met temporairement en pause le goal du pathfinder le temps de la consommation,
 * puis le restaure ensuite.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @param {object} item - Item à consommer (objet inventaire Mineflayer).
 * @returns {Promise<void>}
 */
async function consumeItem(bot, item) {
	const previousGoal = bot.pathfinder?.goal ?? null;
	bot.pathfinder?.setGoal(null);
	await bot.equip(item, 'hand');
	await bot.consume();
	if (previousGoal) bot.pathfinder.setGoal(previousGoal);
}

/**
 * Met en place l'auto-manger du bot.
 * Écoute l'événement `health` : si la faim passe sous {@link FOOD_THRESHOLD},
 * le bot mange automatiquement le premier aliment trouvé dans son inventaire.
 * Met à jour l'état global via {@link state} pendant la consommation.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @returns {{ enable: function, disable: function, isEnabled: function }} Contrôleurs pour activer/désactiver l'auto-eat.
 */
function setupAutoEat(bot) {
	let enabled = true;

	bot.on('health', async () => {
		if (!enabled) return;
		if (state.getIsEating()) return;
		if (bot.food >= FOOD_THRESHOLD) return;

		const foodItem = bot.inventory.items().find((item) => bot.registry.foodsByName[item.name]);
		if (!foodItem) return;

		state.setIsEating(true);
		state.setCurrentAction('eating');
		try {
			await consumeItem(bot, foodItem);
			Logger.success(`🍗 Auto-eat: ${foodItem.name} mangé (faim: ${Math.round(bot.food)}/20).`);
		} catch (err) {
			if (!err.message?.includes('timed out')) {
				Logger.warn(`Auto-eat erreur: ${err.message}`);
			}
		} finally {
			state.setIsEating(false);
			if (state.getCurrentAction() === 'eating') state.setCurrentAction('idle');
		}
	});

	return {
		enable: () => {
			enabled = true;
			Logger.info('🍗 Auto-eat activé.');
		},
		disable: () => {
			enabled = false;
			Logger.info('🍗 Auto-eat désactivé.');
		},
		isEnabled: () => enabled,
	};
}

/**
 * Met en place l'auto-soin du bot.
 * Écoute l'événement `health` : si les points de vie passent sous {@link HEAL_THRESHOLD},
 * le bot tente d'utiliser un item de soin ({@link HEAL_ITEMS}) en priorité,
 * ou à défaut mange de la nourriture pour déclencher la régénération naturelle.
 * Met à jour l'état global via {@link state} pendant le soin.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @returns {{ enable: function, disable: function, isEnabled: function }} Contrôleurs pour activer/désactiver l'auto-heal.
 */
function setupAutoHeal(bot) {
	let enabled = true;

	bot.on('health', async () => {
		if (!enabled) return;
		if (state.getIsHealing()) return;
		if (bot.health >= HEAL_THRESHOLD) return;

		state.setIsHealing(true);
		state.setCurrentAction('healing');
		try {
			// Cherche un item de soin en priorité
			const healItem = bot.inventory.items().find((item) => HEAL_ITEMS.includes(item.name));

			if (healItem) {
				await consumeItem(bot, healItem);
				Logger.success(
					`💊 Auto-heal: ${healItem.name} utilisé (santé: ${Math.round(bot.health)}/20).`,
				);
				return;
			}

			// Pas d'item de soin → mange pour déclencher la régénération naturelle
			Logger.warn(
				`💊 Auto-heal: pas d'item de soin, mange pour régénérer (santé: ${Math.round(bot.health)}/20).`,
			);
			const foodItem = bot.inventory.items().find((item) => bot.registry.foodsByName[item.name]);
			if (!foodItem) {
				Logger.warn('💊 Auto-heal: aucun item de soin ni nourriture disponible.');
				return;
			}

			await consumeItem(bot, foodItem);
			Logger.info(`🍗 Auto-heal via nourriture: ${foodItem.name} mangé.`);
		} catch (err) {
			Logger.warn(`💊 Auto-heal erreur: ${err.message}`);
		} finally {
			state.setIsHealing(false);
			if (state.getCurrentAction() === 'healing') state.setCurrentAction('idle');
		}
	});

	return {
		enable: () => {
			enabled = true;
			Logger.info('💊 Auto-heal activé.');
		},
		disable: () => {
			enabled = false;
			Logger.info('💊 Auto-heal désactivé.');
		},
		isEnabled: () => enabled,
	};
}

const SLEEP_RETRY_INTERVAL = 30_000; // réessaye toutes les 30s si pas de lit

/**
 * Met en place l'auto-sommeil du bot.
 * Écoute l'événement `time` : la nuit (ticks 12542–23460) ou pendant un orage,
 * si un joueur whitelisté est connecté, le bot cherche un lit libre dans un
 * rayon de 32 blocs, s'y déplace, envoie un message de bonne nuit, dort, puis
 * retourne à sa position initiale au réveil. Un délai de
 * {@link SLEEP_RETRY_INTERVAL} ms est respecté entre chaque tentative échouée.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @param {function(string): boolean} isUserWhitelistedMC - Fonction retournant `true` si le pseudo Minecraft est whitelisté.
 * @returns {{ enable: function, disable: function, isEnabled: function }} Contrôleurs pour activer/désactiver l'auto-sleep.
 */
function setupAutoSleep(bot, isUserWhitelistedMC) {
	let enabled = false;
	let savePosition = null;
	let lastAttempt = 0;

	/**
	 * Vérifie si le bot peut dormir : nuit Minecraft (ticks 12542–23460) ou orage actif.
	 * @returns {boolean}
	 */
	function canSleep() {
		const isNight = bot.time.timeOfDay >= 12542 && bot.time.timeOfDay <= 23460;
		const isThunder = bot.thunderState >= 1 && bot.rainState >= 1;
		Logger.debug(
			`canSleep: time=${bot.time.timeOfDay} isNight=${isNight} thunderState=${bot.thunderState} isRaining=${bot.isRaining} isThunder=${isThunder}`,
		);
		console.log(
			`canSleep: time=${bot.time.timeOfDay} isNight=${isNight} thunderState=${bot.thunderState} isRaining=${bot.isRaining} isThunder=${isThunder}`,
		);
		return isNight || isThunder;
	}

	bot.on('time', async () => {
		if (!enabled) return;
		if (state.getIsSleeping()) return;
		if (bot.isSleeping) return;
		if (!canSleep()) return;

		// Ne dort que si un joueur whitelisté est connecté (peut désactiver si besoin)
		const whitelistedOnline = Object.values(bot.players).some(
			(p) => p.username !== bot.username && isUserWhitelistedMC(p.username),
		);
		if (!whitelistedOnline) return;

		const now = Date.now();
		if (now - lastAttempt < SLEEP_RETRY_INTERVAL) return;
		lastAttempt = now;

		state.setIsSleeping(true);
		savePosition = bot.entity.position.clone();
		state.setCurrentAction('sleeping');
		state.setCurrentActionArgs([
			String(Math.round(savePosition.x)),
			String(Math.round(savePosition.y)),
			String(Math.round(savePosition.z)),
		]);

		try {
			// Cherche un lit libre dans un rayon de 32 blocs
			const bed = bot.findBlock({
				matching: (block) => block.name.endsWith('_bed'),
				maxDistance: 32,
				useExtraInfo: (block) => !block.getProperties().occupied,
			});

			if (!bed) {
				Logger.warn('🛏️ Aucun lit disponible pour dormir.');
				return;
			}

			// Message aux joueurs connectés
			const players = Object.values(bot.players).filter((p) => p.username !== bot.username);

			if (players.length > 0) {
				const playerNames = players.map((p) => p.username).join(', ');
				bot.chat(randomSleepMessage(playerNames));
				await new Promise((res) => setTimeout(res, 1000));
			}

			// Se dirige vers le lit (range 2 = adjacent)
			await goTo(bot, bed.position.x, bed.position.y, bed.position.z, 2);

			const wasRaining = bot.isRaining;
			if (bot.thunderState >= 1) bot.isRaining = true;

			try {
				await bot.sleep(bed);
				await new Promise((resolve) => bot.once('wake', resolve));
			} finally {
				bot.isRaining = wasRaining;
			}

			Logger.info('☀️ Réveil, retour à la position initiale.');

			await goTo(bot, savePosition.x, savePosition.y, savePosition.z);
		} catch (err) {
			Logger.error(`💤 Erreur auto-sleep: ${err.message}`);
		} finally {
			state.setIsSleeping(false);
			if (state.getCurrentAction() === 'sleeping') state.setCurrentAction('idle');
			savePosition = null;
		}
	});

	return {
		enable: () => {
			enabled = true;
			Logger.info('💤 Auto-sleep activé.');
		},
		disable: () => {
			enabled = false;
			Logger.info('💤 Auto-sleep désactivé.');
		},
		isEnabled: () => enabled,
	};
}

/**
 * Met en place les salutations automatiques à la connexion des joueurs.
 * Chaque joueur n'est salué qu'une fois par jour (reset à minuit).
 * Pour les joueurs whitelistés, le message inclut les stats du bot
 * (HP, faim, saturation, position). Pour les autres, un message générique est envoyé.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @param {function(string): boolean} isUserWhitelistedMC - Fonction retournant `true` si le pseudo Minecraft est whitelisté.
 * @returns {void}
 */
function setupGreeting(bot, isUserWhitelistedMC) {
	const greetedToday = new Set();

	/**
	 * Planifie le reset quotidien de l'ensemble des joueurs déjà salués,
	 * à minuit (heure locale). Se re-programme automatiquement après chaque reset.
	 *
	 * @returns {void}
	 */
	function scheduleReset() {
		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 0, 0);
		setTimeout(() => {
			greetedToday.clear();
			Logger.info('🌅 Reset des salutations journalières.');
			scheduleReset();
		}, midnight - now);
	}
	scheduleReset();

	bot.on('playerJoined', async (player) => {
		if (player.username === bot.username) return;
		if (greetedToday.has(player.username)) return;
		greetedToday.add(player.username);

		if (isUserWhitelistedMC(player.username)) {
			const health = Math.round(bot.health ?? 0);
			const food = Math.round(bot.food ?? 0);
			const sat = (bot.foodSaturation ?? 0).toFixed(1);
			const pos = bot.entity?.position;
			const posStr = pos
				? `(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`
				: 'inconnue';

			bot.chat(
				`${randomGreeting(player.username)} [HP:${health}/20 | Food:${food}/20 | Sat:${sat}/5 | Pos:${posStr}]`,
			);
		} else {
			bot.chat(randomGreeting(player.username));
		}
	});
}

// ---------------------------------------------------------------------------
// Message quotidien aléatoire entre 12h00 et 02h00 (nuit suivante)
// ---------------------------------------------------------------------------

const DAILY_MSG_START_H = 12;
const DAILY_MSG_END_H = 2;

let dailyMessageTimer = null;

/**
 * Calcule la prochaine heure de déclenchement du message quotidien,
 * choisie aléatoirement dans la fenêtre 12h00–02h00 (nuit suivante).
 * - Si on est avant 12h : toute la fenêtre du jour est disponible.
 * - Si on est dans la fenêtre (12h–02h) : de maintenant jusqu'à 02h.
 * - Si on est après 02h : la fenêtre du lendemain est utilisée.
 *
 * @returns {Date} Date/heure exacte du prochain envoi.
 */
function computeNextFireTime() {
	const now = new Date();

	const windowStart = new Date(now);
	windowStart.setHours(DAILY_MSG_START_H, 0, 0, 0);

	const windowEnd = new Date(now);
	windowEnd.setDate(windowEnd.getDate() + 1);
	windowEnd.setHours(DAILY_MSG_END_H, 0, 0, 0);

	let start, end;
	if (now < windowStart) {
		// Avant midi : fenêtre complète d'aujourd'hui
		start = windowStart;
		end = windowEnd;
	} else if (now < windowEnd) {
		// Dans la fenêtre : de maintenant jusqu'à 2h
		start = now;
		end = windowEnd;
	} else {
		// Après 2h : fenêtre de demain
		start = new Date(windowStart);
		start.setDate(start.getDate() + 1);
		end = new Date(windowEnd);
		end.setDate(end.getDate() + 1);
	}

	const randomMs = Math.floor(Math.random() * (end - start));
	return new Date(start.getTime() + randomMs);
}

/**
 * Met en place l'envoi automatique d'un message quotidien aléatoire dans le chat Minecraft.
 * Le message est envoyé une fois par jour à une heure choisie aléatoirement
 * entre 12h00 et 02h00 (via {@link computeNextFireTime}).
 * Si un timer existait déjà, il est annulé et remplacé.
 * Le timer se re-programme automatiquement après chaque envoi.
 *
 * @param {import('mineflayer').Bot} bot - Instance du bot Mineflayer.
 * @returns {void}
 */
function setupDailyMessage(bot) {
	if (dailyMessageTimer) {
		clearTimeout(dailyMessageTimer);
		dailyMessageTimer = null;
	}

	/**
	 * Calcule le prochain créneau via {@link computeNextFireTime}, programme
	 * un `setTimeout`, envoie le message puis se re-programme récursivement.
	 *
	 * @returns {void}
	 */
	function schedule() {
		const fireAt = computeNextFireTime();
		const delay = fireAt - Date.now();

		Logger.info(
			`[DailyMessage] Prochain message prevu a ${fireAt.toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' })}`,
		);

		dailyMessageTimer = setTimeout(() => {
			try {
				bot.chat(randomDailyMessage());
				Logger.info('[DailyMessage] Message quotidien envoye.');
			} catch (err) {
				Logger.warn(`[DailyMessage] Impossible d'envoyer le message : ${err.message}`);
			}
			schedule();
		}, delay);
	}

	schedule();
}

module.exports = {
	setupAutoSleep,
	setupAutoEat,
	setupAutoHeal,
	setupGreeting,
	setupDailyMessage,
};
