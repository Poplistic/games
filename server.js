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

let botReady = false;

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
   DISCORD CLIENT (FIXED)
====================== */

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
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
		description: "Control storm weather",
		options: [
			{
				name: "state",
				description: "Start or stop the storm",
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

/* ======================
   RECAP ROUTE (FIXED)
====================== */

app.post("/recap", async (req, res) => {
	if (!botReady) {
		console.error("❌ Bot not ready");
		return res.sendStatus(503);
	}

	const { secret, year, results } = req.body;

	if (secret !== SECRET) return res.sendStatus(403);
	if (!Array.isArray(results)) return res.sendStatus(400);

	try {
		console.log("📨 Sending recap to", RECAP_CHANNEL_ID);

		const channel = await client.channels.fetch(RECAP_CHANNEL_ID);

		if (!channel || !channel.isTextBased()) {
			throw new Error("Invalid recap channel");
		}

		const lines = results.map(r =>
			`**${r.PlacementText}** — ${r.Name} (${r.Kills} kills, ${r.Sponsors} sponsors)`
		);

		await channel.send(
			`🏹 **Hunger Games ${year} Results** 🏹\n\n${lines.join("\n")}`
		);

		console.log("✅ Recap sent");
		res.sendStatus(200);
	} catch (err) {
		console.error("❌ Recap error:", err);
		res.sendStatus(500);
	}
});

/* ======================
   INTERACTIONS
====================== */

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	switch (interaction.commandName) {
		case "countdown":
			enqueue("COUNTDOWN");
			await interaction.reply("⏳ Countdown started.");
			break;

		case "day":
			enqueue("DAY");
			await interaction.reply("🌞 Day started.");
			break;

		case "night":
			enqueue("NIGHT");
			await interaction.reply("🌙 Night started.");
			break;

		case "finale":
			enqueue("FINALE");
			await interaction.reply("🔥 Finale started.");
			break;

		case "year": {
			const year = interaction.options.getInteger("number");
			enqueue("YEAR", [year]);
			await interaction.reply(`📅 Year set to ${year}`);
			break;
		}

		case "sponsor":
			enqueue("SPONSOR");
			await interaction.reply("🎁 Sponsor triggered.");
			break;

		case "storm": {
			const state = interaction.options.getString("state");
			enqueue("STORM", [state]);
			await interaction.reply(
				state === "START" ? "🌩️ Storm started." : "☀️ Storm stopped."
			);
			break;
		}
	}
});

/* ======================
   READY
====================== */

client.once(Events.ClientReady, async bot => {
	console.log(`🤖 Logged in as ${bot.user.tag}`);
	botReady = true;
	await registerCommands();
});

/* ======================
   START
====================== */

app.listen(PORT, () => {
	console.log(`🚀 HG Relay running on port ${PORT}`);
});

await client.login(DISCORD_TOKEN);
