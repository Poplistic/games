import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import fetch from "node-fetch"; // npm install node-fetch

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { SESSION_TOKEN, PORT = 10000 } = process.env;
if (!SESSION_TOKEN) {
    console.error("❌ SESSION_TOKEN missing");
    process.exit(1);
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

/* ====================== SECURITY ====================== */
let lastNonce = 0;
let times = [];
function verify(req) {
    const { token, nonce, timestamp } = req.body ?? {};
    if (token !== SESSION_TOKEN) return false;
    if (typeof nonce !== "number" || nonce <= lastNonce) return false;
    if (Math.abs(Date.now()/1000 - timestamp) > 10) return false;
    lastNonce = nonce;
    times.push(Date.now());
    times = times.filter(t => Date.now() - t < 1000);
    return times.length < 40;
}

/* ====================== LIVE STATE ====================== */
let players = [];
let killFeed = [];
let dead = [];
const MAX_KILLS = 20;

/* ====================== WEAPONS ====================== */
const meleeWeapons = ["Sword","Dagger","Axe","Mace","Club","Knife","Spear"];
const rangedWeapons = ["Bow","Sling","Throwing Knife","Trident","Net"];
const traps = ["Fire","Poison","Explosive","Falling Rocks","Electric Trap"];

function generateDeathMessage(victim, killer) {
    if (!killer) return `${victim} died.`;
    const weaponType = Math.random();
    let weapon = "", action = "";

    if (weaponType < 0.5) {
        weapon = meleeWeapons[Math.floor(Math.random()*meleeWeapons.length)];
        action = `was slain by ${killer} using ${weapon}`;
    } else if (weaponType < 0.85) {
        weapon = rangedWeapons[Math.floor(Math.random()*rangedWeapons.length)];
        action = `was killed by ${killer}'s ${weapon}`;
    } else {
        weapon = traps[Math.floor(Math.random()*traps.length)];
        action = `was caught in ${killer}'s ${weapon}`;
    }
    return `${victim} ${action}`;
}

/* ====================== MAP ENDPOINTS ====================== */
app.post("/map", (req,res) => {
    if (!verify(req)) return res.sendStatus(403);
    if (!Array.isArray(req.body.players)) return res.sendStatus(400);
    players = req.body.players;
    res.sendStatus(200);
});

app.get("/map", (_, res) => res.json(players));

/* ====================== KILL FEED ====================== */
app.post("/kill", (req,res) => {
    if (!verify(req)) return res.sendStatus(403);
    const { victim, killer } = req.body;
    if (!victim) return res.sendStatus(400);

    const text = generateDeathMessage(victim, killer);
    killFeed.unshift({ text, time: Date.now() });
    killFeed = killFeed.slice(0, MAX_KILLS);
    io.emit("kill:feed", killFeed);
    res.sendStatus(200);
});

app.get("/kills", (_,res) => res.json(killFeed));

/* ====================== DEAD PLAYERS ====================== */
app.post("/death", (req,res) => {
    if (!verify(req)) return res.sendStatus(403);
    const { id, name, killer } = req.body;
    if (!id || !name) return res.sendStatus(400);

    dead.push({ id, name });
    const text = generateDeathMessage(name, killer);
    killFeed.unshift({ text, time: Date.now() });
    killFeed = killFeed.slice(0, MAX_KILLS);
    io.emit("kill:feed", killFeed);

    res.sendStatus(200);
});

app.get("/dead", (_,res) => res.json(dead));
app.post("/reset-dead", (req,res) => {
    if (!verify(req)) return res.sendStatus(403);
    dead = [];
    killFeed = [];
    io.emit("kill:feed", killFeed);
    res.sendStatus(200);
});

/* ====================== BUST ENDPOINT ====================== */
const bustCache = new Map();
app.get("/bust/:id", async (req,res) => {
    const userId = req.params.id;
    console.log("[BUST] Request for:", userId);

    if (!/^\d+$/.test(userId)) return res.status(400).send("Invalid UserId");
    if (bustCache.has(userId)) {
        res.setHeader("Content-Type", "image/png");
        return res.send(bustCache.get(userId));
    }

    const robloxUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
    try {
        const r = await fetch(robloxUrl);
        if (!r.ok) return res.status(404).send("Roblox bust not found");

        const buffer = Buffer.from(await r.arrayBuffer());
        bustCache.set(userId, buffer);
        res.setHeader("Content-Type", "image/png");
        res.send(buffer);
    } catch(err) {
        console.error("[BUST] Error fetching bust:", userId, err);
        res.status(500).send("Internal Server Error");
    }
});

/* ====================== SOCKET.IO ====================== */
io.on("connection", socket => {
    socket.on("chat:send", msg => {
        if (typeof msg !== "string" || msg.length > 120) return;
        io.emit("chat:msg", { from: "Spectator", msg, time: Date.now() });
    });
});

/* ====================== START SERVER ====================== */
httpServer.listen(PORT, () => {
    console.log(`🚀 HG Relay running on http://localhost:${PORT}`);
});
