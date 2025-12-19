import express from "express";
import fs from "fs";
import {
	Client,
	GatewayIntentBits,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} from "discord.js";

/* ======================
   BASIC SETUP
====================== */

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET;
const PORT = process.env.PORT || 3000;
const QUEUE_FILE = "./queue.json";

/* ======================
   DISCORD CLIENT
====================== */

const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

await client.login(process.env.DISCORD_TOKEN);

client.once("ready", () => {
	console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ======================
   COMMAND QUEUE
====================== */

function loadQueue() {
	if (!fs.existsSync(QUEUE_FILE)) return [];
	return JSON.parse(fs.readFileSync(QUEUE_FILE));
}

function saveQueue(queue) {
	fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/* ======================
   LIVE STATE + VOTES
====================== */

let latestState = [];
let sponsorVotes = {}; // name -> votes
let oddsMessageId = null;
let voteMessageId = null;

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

	latestState = req.body.state || [];

	// sync sponsor votes
	for (const t of latestState) {
		if (!sponsorVotes[t.name]) sponsorVotes[t.name] = t.votes || 0;
	}

	res.sendStatus(200);
});

/* ======================
   DISCORD BUTTON VOTING
====================== */

client.on("interactionCreate", async interaction => {
	if (!interaction.isButton()) return;

	const name = interaction.customId.replace("vote_", "");
	sponsorVotes[name] = (sponsorVotes[name] || 0) + 1;

	await interaction.reply({
		content: `🎁 You sponsored **${name}**!`,
		ephemeral: true
	});
});

/* ======================
   LIVE ODDS + VOTING EMBEDS
====================== */

client.once("ready", async () => {
	const channel = await client.channels.fetch(process.env.CHANNEL_ID);

	setInterval(async () => {
		if (!latestState.length) return;

		/* ---- CALCULATE ODDS ---- */
		const scored = latestState.map(t => {
			const votes = sponsorVotes[t.name] || 0;
			const score = (t.kills * 2) + votes;
			return { ...t, votes, score };
		});

		const maxScore = Math.max(...scored.map(t => t.score), 1);

		scored.forEach(t => {
			t.odds = Math.round((t.score / maxScore) * 100);
		});

		/* ---- ODDS EMBED ---- */
		const oddsEmbed = new EmbedBuilder()
			.setTitle("🎲 Live Victory Odds")
			.setColor(0x9B59B6)
			.setDescription(
				scored
					.sort((a, b) => b.odds - a.odds)
					.map(t =>
						`**${t.name}** — ${t.odds}% 🗡️ ${t.kills} 🎁 ${t.votes}`
					)
					.join("\n")
			)
			.setTimestamp();

		if (!oddsMessageId) {
			const msg = await channel.send({ embeds: [oddsEmbed] });
			oddsMessageId = msg.id;
		} else {
			const msg = await channel.messages.fetch(oddsMessageId);
			await msg.edit({ embeds: [oddsEmbed] });
		}

		/* ---- VOTING EMBED ---- */
		const buttons = scored
			.filter(t => t.alive)
			.slice(0, 5)
			.map(t =>
				new ButtonBuilder()
					.setCustomId(`vote_${t.name}`)
					.setLabel(t.name)
					.setStyle(ButtonStyle.Primary)
			);

		const row = new ActionRowBuilder().addComponents(buttons);

		const voteEmbed = new EmbedBuilder()
			.setTitle("🎁 Sponsor a Tribute")
			.setDescription("Click a button to send sponsor support!")
			.setColor(0xF1C40F);

		if (!voteMessageId) {
			const msg = await channel.send({
				embeds: [voteEmbed],
				components: [row]
			});
			voteMessageId = msg.id;
		} else {
			const msg = await channel.messages.fetch(voteMessageId);
			await msg.edit({
				embeds: [voteEmbed],
				components: [row]
			});
		}

	}, 10000);
});

/* ======================
   START SERVER
====================== */

app.listen(PORT, () => {
	console.log(`🚀 HG Relay running on port ${PORT}`);
});
