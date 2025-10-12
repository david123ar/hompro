const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config(); // Make sure you have .env file

const app = express();
const PORT = 6544;

// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "mydatabase";

mongoose.connect(MONGODB_URI, {
  dbName: DB_NAME,
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

// Define a schema and model
const homeProSchema = new mongoose.Schema({
  series: Array,
  genre: Object,
  createdAt: { type: Date, default: Date.now }
});

const HomePro = mongoose.model("hompro", homeProSchema);

const BASE_URL = "https://api.henpro.fun/api";

const routes = {
  series: `${BASE_URL}/series`,
  genre: {
    uncensored: `${BASE_URL}/genre?genre=uncensored`,
    harem: `${BASE_URL}/genre?genre=harem`,
    "school-girls": `${BASE_URL}/genre?genre=school-girls`,
    "large-breasts": `${BASE_URL}/genre?genre=large-breasts`,
  },
};

// 🌀 Helper to get random page
function getRandomPage(totalPages) {
  return Math.floor(Math.random() * totalPages) + 1;
}

// Fetch random page dynamically
async function fetchRandomPage(url) {
  try {
    const firstRes = await axios.get(url);
    const totalPages = firstRes?.data?.totalPages || 1;
    const randomPage = getRandomPage(totalPages);
    const pagedUrl = url.includes("?") ? `${url}&page=${randomPage}` : `${url}?page=${randomPage}`;
    console.log(`📄 Fetching random page ${randomPage} of ${url}`);

    const { data } = await axios.get(pagedUrl);
    return data?.data?.series?.slice(0, 14) || [];
  } catch (err) {
    console.error(`❌ Error fetching from ${url}:`, err.message);
    return [];
  }
}

// Global variable to store latest data
let latestData = {
  series: [],
  genre: {
    uncensored: [],
    harem: [],
    "school-girls": [],
    "large-breasts": [],
  },
};

// Fetch and update latest data, then save to MongoDB
async function updateData() {
  console.log("⏳ Fetching new data...");
  latestData.series = await fetchRandomPage(routes.series);

  for (const [genreName, url] of Object.entries(routes.genre)) {
    latestData.genre[genreName] = await fetchRandomPage(url);
  }

  // Save to MongoDB
  try {
    const doc = new HomePro(latestData);
    await doc.save();
    console.log("✅ Data saved to MongoDB collection 'hompro'");
  } catch (err) {
    console.error("❌ MongoDB save error:", err.message);
  }

  console.log("✅ Data updated!");
}

// Initial fetch on server start
updateData();

// Fetch every hour
setInterval(updateData, 60 * 60 * 1000);

// Express endpoint serves latest in-memory data
app.get("/", (req, res) => {
  res.json(latestData);
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
