import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
	SESSION_TOKEN,
	PORT = 10000
} = process.env;

if (!SESSION_TOKEN) throw new Error("SESSION_TOKEN missing");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let lastNonce = 0;

function verify(req) {
	const { token, nonce, timestamp } = req.body;
	if (token !== SESSION_TOKEN) return false;
	if (typeof nonce !== "number" || nonce <= lastNonce) return false;
	if (Math.abs(Date.now() / 1000 - timestamp) > 10) return false;

	lastNonce = nonce;
	return true;
}

let players = [];
let lighting = {};

app.post("/map", (req, res) => {
	if (!verify(req)) return res.sendStatus(403);
	players = req.body.players || [];
	res.sendStatus(200);
});

app.post("/lighting", (req, res) => {
	if (!verify(req)) return res.sendStatus(403);
	lighting = { ...lighting, ...req.body.lighting };
	res.sendStatus(200);
});

app.get("/map", (_, res) => res.json(players));
app.get("/lighting", (_, res) => res.json(lighting));

app.listen(PORT, () => {
	console.log("🚀 HG Relay secure (Roblox-safe)");
});
