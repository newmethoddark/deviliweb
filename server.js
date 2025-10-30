// server.js — Instagram Reels Downloader Backend for Render.com
import express from "express";
import axios from "axios";
import cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ES Module path setup (Render.com + Node 18+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Extract hashtags from text
function extractHashtags(text) {
  if (!text) return [];
  const tags = text.match(/#(\w+)/g);
  return tags ? tags.map((t) => t.replace("#", "")) : [];
}

// 🎯 API Route — extract reel info
app.post("/api/extract", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Please provide an Instagram Reel URL." });

    // Fetch the Instagram page
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Try extracting from meta tags
    let videoUrl =
      $('meta[property="og:video"]').attr("content") ||
      $('meta[name="og:video"]').attr("content");

    let caption =
      $('meta[property="og:description"]').attr("content") ||
      $("meta[name='description']").attr("content") ||
      "";

    let username =
      $('meta[property="og:title"]').attr("content")?.split("•")[0]?.trim() ||
      "";

    // Try parsing from JSON data in scripts (fallback)
    if (!videoUrl) {
      const scripts = $("script").map((i, el) => $(el).html()).get();
      for (const script of scripts) {
        if (script.includes("shortcode_media")) {
          try {
            const json = JSON.parse(script.substring(script.indexOf("{")));
            videoUrl =
              json?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.video_url || null;
            caption =
              json?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.edge_media_to_caption
                ?.edges?.[0]?.node?.text || caption;
            username =
              json?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.owner?.username ||
              username;
            break;
          } catch (e) {}
        }
      }
    }

    const hashtags = extractHashtags(caption);

    if (!videoUrl) {
      return res.json({
        error: "❌ Unable to fetch video. Reels may be private or Instagram changed their format.",
      });
    }

    res.json({ videoUrl, caption, hashtags, username });
  } catch (err) {
    console.error("Error fetching reel:", err.message);
    res.status(500).json({ error: "Server error. Try another reel link." });
  }
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
