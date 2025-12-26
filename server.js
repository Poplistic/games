import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* ================= STATE ================= */

let players = {};   // id -> {id,x,y,z,alive}
let chunks = {};    // "cx,cz" -> blocks[]
let events = [];    // kill feed events

/* ================= PLAYERS ================= */

app.post("/players", (req, res) => {
  for (const p of req.body) {
    players[p.id] = {
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      alive: p.alive !== false
    };
  }
  res.sendStatus(200);
});

app.get("/players", (req, res) => {
  res.json(Object.values(players));
});

/* ================= KILL FEED ================= */

// POST kill event from GDMC exporter
// { killer: "Steve", victim: "Alex" }
app.post("/events", (req, res) => {
  events.push({
    killer: req.body.killer,
    victim: req.body.victim,
    time: Date.now()
  });

  // keep last 20 events
  if (events.length > 20) events.shift();
  res.sendStatus(200);
});

// GET for web
app.get("/events", (req, res) => {
  res.json(events);
});

/* ================= CHUNKS ================= */

app.post("/chunks", (req, res) => {
  const { cx, cz, blocks } = req.body;
  chunks[`${cx},${cz}`] = blocks;
  res.sendStatus(200);
});

app.get("/chunks", (req, res) => {
  const cx = Number(req.query.cx);
  const cz = Number(req.query.cz);
  const r = Number(req.query.r || 2);

  const out = [];
  for (let x = cx - r; x <= cx + r; x++) {
    for (let z = cz - r; z <= cz + r; z++) {
      const key = `${x},${z}`;
      if (chunks[key]) {
        out.push({ cx: x, cz: z, blocks: chunks[key] });
      }
    }
  }
  res.json(out);
});

/* ================= FRONTEND ================= */

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("HG map + kill feed running on", PORT);
});
