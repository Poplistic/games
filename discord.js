import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let messageId = null;

client.once("ready", async () => {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  setInterval(async () => {
    const alive = latestState.filter(t => t.alive);
    const dead = latestState.filter(t => !t.alive);

    const embed = new EmbedBuilder()
      .setTitle("🏹 Hunger Games Live")
      .setDescription(`Alive: ${alive.length}`)
      .addFields(
        alive.map(t => ({
          name: t.name,
          value: `Kills: ${t.kills} | Votes: ${t.votes}`,
          inline: true
        }))
      );

    if (!messageId) {
      const msg = await channel.send({ embeds: [embed] });
      messageId = msg.id;
    } else {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
    }
  }, 10000);
});

client.login(process.env.DISCORD_TOKEN);
