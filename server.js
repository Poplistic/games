import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { SECRET, PORT = 10000 } = process.env;
if (!SECRET) throw new Error("SECRET missing");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let players = [];
let lighting = {
	clockTime: 12,
	brightness: 2,
	fogColor: [5, 9, 20],
	fogDensity: 0.00035,
	haze: 0,
	sunDirection: [0, 1, 0]
};

function verify(req, payload) {
	const { timestamp, signature } = req.body;
	if (!timestamp || !signature) return false;
	if (Math.abs(Date.now() / 1000 - timestamp) > 10) return false;

	const raw = JSON.stringify(payload) + ":" + timestamp + ":" + SECRET;
	const hash = crypto.createHash("sha256").update(raw).digest("hex");
	return hash === signature;
}

app.post("/map", (req, res) => {
	if (!verify(req, { players: req.body.players })) return res.sendStatus(403);
	players = req.body.players || [];
	res.sendStatus(200);
});

app.get("/map", (_, res) => res.json(players));

app.post("/lighting", (req, res) => {
	if (!verify(req, { lighting: req.body.lighting })) return res.sendStatus(403);
	lighting = { ...lighting, ...req.body.lighting };
	res.sendStatus(200);
});

app.get("/lighting", (_, res) => res.json(lighting));

app.listen(PORT, () => {
	console.log("🚀 Secure HG Relay running");
});
