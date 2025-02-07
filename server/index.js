require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getStorage } = require("firebase-admin/storage");
const { initializeApp, cert } = require("firebase-admin/app");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const OpenAI = require("openai");
const { getFirestore } = require("firebase-admin/firestore");

// First check OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Firebase first
const serviceAccount = require("./serviceAccountKey.json");
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "podflow-e865b.firebasestorage.app",
});

// Then initialize Firebase services
const bucket = getStorage().bucket();
const db = getFirestore();

// Initialize Express app
const app = express();
const port = 3001;

// Then require routes that use Firebase services
const compression = require("./routes/compression");

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

const compressionStatus = new Map();

async function getUserSettings(userId) {
  try {
    const settingsDoc = await db.collection("settings").doc(userId).get();
    if (!settingsDoc.exists) {
      return null;
    }
    return settingsDoc.data();
  } catch (error) {
    return null;
  }
}

async function transcribeAudio(filePath, userId) {
  try {
    const userSettings = await getUserSettings(userId);
    const apiKey = userSettings?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("No OpenAI API key available");
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
    });

    return transcription;
  } catch (error) {
    throw error;
  }
}

app.post("/api/compress-audio", async (req, res) => {
  const { episodeId, userId, fileName, filePath } = req.body;

  try {
    compressionStatus.set(episodeId, {
      status: "processing",
      progress: 0,
    });

    processAudio(episodeId, userId, fileName, filePath);
    res.json({ message: "Compression started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/compression-status/:episodeId", (req, res) => {
  const status = compressionStatus.get(req.params.episodeId) || {
    status: "not_found",
  };
  res.json(status);
});

async function processAudio(episodeId, userId, fileName, filePath) {
  try {
    const tempInputPath = path.join(os.tmpdir(), fileName);
    const tempOutputPath = path.join(os.tmpdir(), `compressed_${fileName}`);

    await bucket.file(filePath).download({ destination: tempInputPath });

    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .toFormat("mp3")
        .audioBitrate("64k")
        .on("progress", (progress) => {
          compressionStatus.set(episodeId, {
            status: "processing",
            progress: Math.round(progress.percent / 2),
          });
        })
        .on("end", resolve)
        .on("error", reject)
        .save(tempOutputPath);
    });

    const compressedFilePath = `episodes/${userId}/compressed_${fileName}`;

    await bucket.upload(tempOutputPath, {
      destination: compressedFilePath,
      metadata: {
        contentType: "audio/mpeg",
      },
    });

    const [url] = await bucket.file(compressedFilePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    compressionStatus.set(episodeId, {
      status: "processing",
      progress: 50,
      message: "Starting transcription...",
    });

    const transcriptionResult = await transcribeAudio(tempOutputPath, userId);

    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);

    const transcript = transcriptionResult.segments
      .map((segment) => segment.text)
      .join(" ");

    compressionStatus.set(episodeId, {
      status: "completed",
      progress: 100,
      compressedFilePath,
      audioUrl: url,
      transcript: transcript,
      segments: transcriptionResult.segments,
      showNotes: {
        summary: "",
        timestamps: [], // Empty array for timestamps
      },
      needsCompression: false,
    });
  } catch (error) {
    compressionStatus.set(episodeId, {
      status: "failed",
      error: error.message,
      transcript: "",
      showNotes: {
        summary: "",
        timestamps: [],
      },
      segments: [],
      needsCompression: true,
    });
  }
}

function formatTimestamp(seconds) {
  const pad = (num) => String(Math.floor(num)).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

// Routes
app.use("/api", compression);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Something went wrong!" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
