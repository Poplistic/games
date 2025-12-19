import express from "express";
import fs from "fs";
import {
	Client,
	GatewayIntentBits,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
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
	CHANNEL_ID,
	PORT = 10000
} = process.env;

const QUEUE_FILE = "./queue.json";

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
	{ name: "sponsor", description: "Trigger sponsor event" }
];

async function registerCommands() {
	const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

	try {
		if (GUILD_ID) {
			await rest.put(
				Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
				{ body: commands }
			);
			console.log("📌 Guild commands registered");
		} else {
			await rest.put(
				Routes.applicationCommands(CLIENT_ID),
				{ body: commands }
			);
			console.log("🌍 Global commands registered");
		}
	} catch (err) {
		console.error("❌ Command registration failed:", err);
	}
}

/* ======================
   LIVE STATE + VOTES
====================== */

let latestState = [];
let sponsorVotes = {};
let oddsMessageId = null;
let voteMessageId = null;

/* ======================
   ROBLOX ROUTES
====================== */

app.get("/poll", (req, res) => {
	if (req.query.secret !== SECRET) return res.sendStatus(403);

	const queue = loadQueue();
	saveQueue([]); // one-time commands

	res.json(queue);
});

app.post("/state", (req, res) => {
	if (req.body.secret !== SECRET) return res.sendStatus(403);

	latestState = req.body.state || [];

	for (const t of latestState) {
		if (!sponsorVotes[t.name]) {
			sponsorVotes[t.name] = t.votes || 0;
		}
	}

	res.sendStatus(200);
});

/* ======================
   INTERACTIONS
====================== */

client.on(Events.InteractionCreate, async interaction => {
	/* ---- SLASH COMMANDS ---- */

	if (interaction.isChatInputCommand()) {
		try {
			switch (interaction.commandName) {
				case "day":
					enqueue("DAY");
					await interaction.reply("🌞 Day started in-game.");
					break;

				case "night":
					enqueue("NIGHT");
					await interaction.reply("🌙 Night started in-game.");
					break;

				case "finale":
					enqueue("FINALE");
					await interaction.reply("🔥 Finale started in-game.");
					break;

				case "year": {
					const year = interaction.options.getInteger("number");
					enqueue("YEAR", [year]);
					await interaction.reply(`📅 Year set to **${year}**`);
					break;
				}

				case "sponsor":
					enqueue("SPONSOR");
					await interaction.reply("🎁 Sponsor event triggered.");
					break;
			}
		} catch (err) {
			console.error(err);
			if (!interaction.replied) {
				await interaction.reply({
					content: "❌ Command failed.",
					ephemeral: true
				});
			}
		}
		return;
	}

	/* ---- BUTTONS ---- */

	if (interaction.isButton()) {
		const name = interaction.customId.replace("vote_", "");
		sponsorVotes[name] = (sponsorVotes[name] || 0) + 1;

		await interaction.reply({
			content: `🎁 You sponsored **${name}**!`,
			ephemeral: true
		});
	}
});

/* ======================
   READY + EMBEDS
====================== */

client.once(Events.ClientReady, async bot => {
	console.log(`🤖 Logged in as ${bot.user.tag}`);
	await registerCommands();

	const channel = await bot.channels.fetch(CHANNEL_ID);

	setInterval(async () => {
		if (!latestState.length) return;

		const scored = latestState.map(t => {
			const votes = sponsorVotes[t.name] || 0;
			const score = t.kills * 2 + votes;
			return { ...t, votes, score };
		});

		const max = Math.max(...scored.map(t => t.score), 1);
		scored.forEach(t => (t.odds = Math.round((t.score / max) * 100)));

		const oddsEmbed = new EmbedBuilder()
			.setTitle("🎲 Live Victory Odds")
			.setColor(0x9b59b6)
			.setDescription(
				scored
					.sort((a, b) => b.odds - a.odds)
					.map(
						t =>
							`**${t.name}** — ${t.odds}% 🗡️ ${t.kills} 🎁 ${t.votes}`
					)
					.join("\n")
			);

		if (!oddsMessageId) {
			oddsMessageId = (await channel.send({ embeds: [oddsEmbed] })).id;
		} else {
			const msg = await channel.messages.fetch(oddsMessageId);
			await msg.edit({ embeds: [oddsEmbed] });
		}

		const buttons = scored
			.filter(t => t.alive)
			.slice(0, 5)
			.map(t =>
				new ButtonBuilder()
					.setCustomId(`vote_${t.name}`)
					.setLabel(t.name)
					.setStyle(ButtonStyle.Primary)
			);

		const voteEmbed = new EmbedBuilder()
			.setTitle("🎁 Sponsor a Tribute")
			.setColor(0xf1c40f);

		const row = new ActionRowBuilder().addComponents(buttons);

		if (!voteMessageId) {
			voteMessageId = (
				await channel.send({ embeds: [voteEmbed], components: [row] })
			).id;
		} else {
			const msg = await channel.messages.fetch(voteMessageId);
			await msg.edit({ embeds: [voteEmbed], components: [row] });
		}
	}, 10000);
});

/* ======================
   START
====================== */

app.listen(PORT, () => {
	console.log(`🚀 HG Relay running on port ${PORT}`);
});

await client.login(DISCORD_TOKEN);
