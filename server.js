import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET;
const QUEUE_FILE = "./queue.json";

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE));
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue));
}

app.post("/command", (req, res) => {
  if (req.body.secret !== SECRET) return res.sendStatus(403);

  const queue = loadQueue();
  queue.push({
    command: req.body.command,
    args: req.body.args || [],
    time: Date.now()
  });
  saveQueue(queue);

  res.sendStatus(200);
});

app.get("/poll", (req, res) => {
  if (req.query.secret !== SECRET) return res.sendStatus(403);

  const queue = loadQueue();
  saveQueue([]); // clear after read
  res.json(queue);
});

app.listen(process.env.PORT || 3000);
