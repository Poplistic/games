import express from "express";

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET;
let queue = [];

// Discord → Server
app.post("/command", (req, res) => {
	if (req.body.secret !== SECRET) {
		return res.sendStatus(403);
	}

	queue.push({
		command: req.body.command,
		args: req.body.args || [],
		time: Date.now()
	});

	res.sendStatus(200);
});

// Roblox → Server
app.get("/poll", (req, res) => {
	if (req.query.secret !== SECRET) {
		return res.sendStatus(403);
	}

	const data = [...queue];
	queue = [];
	res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log("HG Relay running on port", PORT);
});
