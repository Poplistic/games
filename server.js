// =========================================
// hg-relay index.js
// =========================================

import express from "express";
import fs from "fs";
import {
	Client,
	GatewayIntentBits,
	Events
} from "discord.js";

const app = express();
app.use(express.json());

const {
	SECRET,
	DISCORD_TOKEN,
	PORT = 10000,
	RECAP_CHANNEL_ID
} = process.env;

const STATE_FILE = "./liveState.json";

const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

app.post("/state", (req, res) => {
	if (req.body.secret !== SECRET) return res.sendStatus(403);
	fs.writeFileSync(STATE_FILE, JSON.stringify(req.body.state, null, 2));
	res.sendStatus(200);
});

function arrow(deg = 0) {
	const d = ((deg % 360) + 360) % 360;
	if (d < 45) return "⬆️";
	if (d < 90) return "↗️";
	if (d < 135) return "➡️";
	if (d < 180) return "↘️";
	if (d < 225) return "⬇️";
	if (d < 270) return "↙️";
	if (d < 315) return "⬅️";
	return "↖️";
}

function renderMap(tributes) {
	const size = 10;
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

async function updateEmbed() {
	if (!fs.existsSync(STATE_FILE)) return;

	const state = JSON.parse(fs.readFileSync(STATE_FILE));
	const channel = await client.channels.fetch(RECAP_CHANNEL_ID);

	const leaderboard = state.leaderboard
		.map((l, i) => `**${i + 1}.** ${l.name} — ${l.votes}💎`)
		.join("\n");

	const embed = {
		title: `🏹 Hunger Games — ${state.gameState}`,
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

setInterval(updateEmbed, 10_000);

client.once(Events.ClientReady, bot => {
	console.log(`🤖 Logged in as ${bot.user.tag}`);
});

app.listen(PORT, () => console.log("🚀 Relay running"));
await client.login(DISCORD_TOKEN);
