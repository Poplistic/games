import express from "express";
import fs from "fs";
import {
	Client,
	GatewayIntentBits,
	Events,
	REST,
	Routes
} from "discord.js";

/* ======================
   BASIC SETUP
====================== */

const app = express();
app.use(express.json());

const {
	SECRET,
	DISCORD_TOKEN,
	CLIENT_ID,
	GUILD_ID,
	PORT = 10000,
	RECAP_CHANNEL_ID
} = process.env;

const QUEUE_FILE = "./queue.json";
const STATE_FILE = "./liveState.json";

/* ======================
   QUEUE HELPERS
====================== */

function loadQueue() {
	if (!fs.existsSync(QUEUE_FILE)) return [];
	return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
}

function saveQueue(queue) {
	fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function enqueue(command, args = []) {
	const queue = loadQueue();
	queue.push({ command, args });
	saveQueue(queue);
}

/* ======================
   DISCORD CLIENT
====================== */

const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

/* ======================
   SLASH COMMANDS
====================== */

const commands = [
	{ name: "countdown", description: "Start the Hunger Games countdown" },
	{ name: "day", description: "Start daytime" },
	{ name: "night", description: "Start nighttime" },
	{ name: "finale", description: "Start finale" },
	{
		name: "year",
		description: "Set Hunger Games year",
		options: [
			{
				name: "number",
				description: "Year 1–100",
				type: 4,
				required: true
			}
		]
	},
	{ name: "sponsor", description: "Trigger sponsor event" },
	{
		name: "storm",
		description: "Control storm",
		options: [
			{
				name: "state",
				type: 3,
				required: true,
				choices: [
					{ name: "start", value: "START" },
					{ name: "stop", value: "STOP" }
				]
			}
		]
	}
];

async function registerCommands() {
	const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

	if (GUILD_ID) {
		await rest.put(
			Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
			{ body: commands }
		);
	} else {
		await rest.put(
			Routes.applicationCommands(CLIENT_ID),
			{ body: commands }
		);
	}
}

/* ======================
   ROBLOX ROUTES
====================== */

app.get("/poll", (req, res) => {
	if (req.query.secret !== SECRET) return res.sendStatus(403);

	const queue = loadQueue();
	saveQueue([]);
	res.json(queue);
});

app.post("/state", (req, res) => {
	if (req.body.secret !== SECRET) return res.sendStatus(403);

	fs.writeFileSync(
		STATE_FILE,
		JSON.stringify(req.body.state, null, 2)
	);

	res.sendStatus(200);
});

/* ======================
   MAP HELPERS
====================== */

function arrow(deg = 0) {
	const d = ((deg % 360) + 360) % 360;
	if (d < 22.5) return "⬆️";
	if (d < 67.5) return "↗️";
	if (d < 112.5) return "➡️";
	if (d < 157.5) return "↘️";
	if (d < 202.5) return "⬇️";
	if (d < 247.5) return "↙️";
	if (d < 292.5) return "⬅️";
	return "↖️";
}

function renderMap(tributes, size = 10) {
	const grid = Array.from({ length: size }, () =>
		Array(size).fill("⬛")
	);

	for (const t of tributes) {
		if (!t.alive || !t.position) continue;
		const x = Math.floor(t.position.x * (size - 1));
		const z = Math.floor(t.position.z * (size - 1));
		grid[z][x] = arrow(t.rotation);
	}

	return grid.map(r => r.join("")).join("\n");
}

/* ======================
   LIVE EMBED
====================== */

async function updateLiveEmbed() {
	if (!fs.existsSync(STATE_FILE)) return;

	const state = JSON.parse(fs.readFileSync(STATE_FILE));
	const channel = await client.channels.fetch(RECAP_CHANNEL_ID);

	const leaderboard = (state.leaderboard || [])
		.map((l, i) => `**${i + 1}.** ${l.name} — ${l.votes}💎`)
		.join("\n");

	const tributes = state.tributes.map(t =>
		`${t.alive ? "🟢" : "🔴"} **D${t.district}** ${t.displayName} (${t.kills}⚔️)`
	);

	const embed = {
		title: `🏹 Hunger Games — ${state.gameState}`,
		description: tributes.join("\n").slice(0, 4000),
		fields: [
			{
				name: "Top Sponsors",
				value: leaderboard || "None"
			},
			{
				name: "Arena Map",
				value: "```\n" + renderMap(state.tributes) + "\n```"
			}
		],
		timestamp: new Date().toISOString()
	};

	const msgs = await channel.messages.fetch({ limit: 1 });
	const msg = msgs.first();

	if (msg && msg.author.id === client.user.id) {
		await msg.edit({ embeds: [embed] });
	} else {
		await channel.send({ embeds: [embed] });
	}
}

setInterval(updateLiveEmbed, 10_000);

/* ======================
   INTERACTIONS
====================== */

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	switch (interaction.commandName) {
		case "countdown":
			enqueue("COUNTDOWN");
			return interaction.reply("⏳ Countdown started.");

		case "day":
			enqueue("DAY");
			return interaction.reply("🌞 Day started.");

		case "night":
			enqueue("NIGHT");
			return interaction.reply("🌙 Night started.");

		case "finale":
			enqueue("FINALE");
			return interaction.reply("🔥 Finale started.");

		case "year":
			enqueue("YEAR", [interaction.options.getInteger("number")]);
			return interaction.reply("📅 Year set.");

		case "sponsor":
			enqueue("SPONSOR");
			return interaction.reply("🎁 Sponsor triggered.");

		case "storm":
			enqueue("STORM", [interaction.options.getString("state")]);
			return interaction.reply("🌩️ Storm updated.");
	}
});

/* ======================
   READY
====================== */

client.once(Events.ClientReady, async bot => {
	console.log(`🤖 Logged in as ${bot.user.tag}`);
	await registerCommands();
});

/* ======================
   START
====================== */

app.listen(PORT, () =>
	console.log(`🚀 HG Relay running on port ${PORT}`)
);

await client.login(DISCORD_TOKEN);
