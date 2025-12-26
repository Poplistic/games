import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let state = {
  images: [],        // spatial image objects
  announcement: {
    text: "",
    panels: [],
    color: [255,215,0]
  }
};

app.get("/dome", (req, res) => {
  res.json(state);
});

app.post("/image", (req, res) => {
  const image = req.body;
  state.images = state.images.filter(i => i.id !== image.id);
  state.images.push(image);
  res.json({ success: true });
});

app.post("/clear-images", (req, res) => {
  state.images = [];
  res.json({ success: true });
});

app.post("/announcement", (req, res) => {
  state.announcement = req.body;
  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Capitol Dome API running")
);
