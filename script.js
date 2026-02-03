const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config({ path: "/root/hompro/.env" });

const app = express();
const PORT = 6544;

// =====================
// MongoDB setup
// =====================
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "mydatabase";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing");
  process.exit(1);
}

// =====================
// Schema & Model
// =====================
const homeProSchema = new mongoose.Schema({
  series: Array,
  genre: Object,
  updatedAt: { type: Date, default: Date.now }
});

const HomePro = mongoose.model("hompro", homeProSchema);

// =====================
// API Routes
// =====================
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

// =====================
// Helpers
// =====================

// ✅ RANDOM between 1 and (totalPages - 1)
// ❌ NEVER last page
function getRandomPage(totalPages) {
  if (totalPages <= 1) return 1;
  return Math.floor(Math.random() * (totalPages - 1)) + 1;
}

async function fetchRandomPage(url) {
  try {
    const firstRes = await axios.get(url);
    const totalPages = firstRes?.data?.totalPages || 1;

    const page = getRandomPage(totalPages);

    const pagedUrl = url.includes("?")
      ? `${url}&page=${page}`
      : `${url}?page=${page}`;

    console.log(`📄 Fetching page ${page} of ${url}`);

    const { data } = await axios.get(pagedUrl);
    return data?.data?.series?.slice(0, 14) || [];
  } catch (err) {
    console.error(`❌ Fetch error (${url}):`, err.message);
    return [];
  }
}

// =====================
// In-memory cache
// =====================
let latestData = {
  series: [],
  genre: {
    uncensored: [],
    harem: [],
    "school-girls": [],
    "large-breasts": [],
  },
};

// =====================
// Update & Save (UPSERT)
// =====================
async function updateData() {
  if (mongoose.connection.readyState !== 1) {
    console.log("⚠️ MongoDB not ready, skipping update");
    return;
  }

  console.log("⏳ Fetching new data...");

  latestData.series = await fetchRandomPage(routes.series);

  for (const [genreName, url] of Object.entries(routes.genre)) {
    latestData.genre[genreName] = await fetchRandomPage(url);
  }

  try {
    await HomePro.findOneAndUpdate(
      {},
      {
        ...latestData,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log("✅ Data saved (upsert)");
  } catch (err) {
    console.error("❌ MongoDB save error:", err.message);
  }

  console.log("✅ Data updated!");
}

// =====================
// Mongo connect → start jobs
// =====================
mongoose
  .connect(MONGODB_URI, { dbName: DB_NAME })
  .then(() => {
    console.log("✅ MongoDB connected");

    updateData();
    setInterval(updateData, 60 * 60 * 1000); // every hour
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// =====================
// API Endpoint
// =====================
app.get("/", async (req, res) => {
  try {
    const doc = await HomePro.findOne().sort({ updatedAt: -1 }).lean();
    res.json(doc || latestData);
  } catch {
    res.json(latestData);
  }
});

// =====================
// Server
// =====================
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
