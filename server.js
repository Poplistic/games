import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY || "CHANGE_ME";

// Stored dome state
let domeState = {
  imageId: "0",
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0
};

// Website updates dome
app.post("/update-dome", (req, res) => {
  if (req.body.apiKey !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  const { imageId, offsetX, offsetY, scale, rotation } = req.body;

  domeState = {
    imageId: String(imageId),
    offsetX: Number(offsetX),
    offsetY: Number(offsetY),
    scale: Number(scale),
    rotation: Number(rotation)
  };

  res.json({ success: true });
});

// Roblox polls dome state
app.get("/dome-state", (req, res) => {
  res.json(domeState);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Dome controller running on port", PORT);
});
