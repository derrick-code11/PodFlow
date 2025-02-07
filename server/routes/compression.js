const express = require("express");
const router = express.Router();
const { getStorage } = require("firebase-admin/storage");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const OpenAI = require("openai");

// Store compression status
const compressionStatus = new Map();

// Words per page for transcript pagination
const WORDS_PER_PAGE = 500;

function paginateTranscript(transcript) {
  if (!transcript) return [];

  // Split by sentences to avoid cutting in the middle of one
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
  const pages = [];
  let currentPage = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;

    if (wordCount + sentenceWords > WORDS_PER_PAGE && currentPage.length > 0) {
      // Start a new page
      pages.push(currentPage.join(" ").trim());
      currentPage = [sentence];
      wordCount = sentenceWords;
    } else {
      // Add to current page
      currentPage.push(sentence);
      wordCount += sentenceWords;
    }
  }

  // Add the last page if there's content
  if (currentPage.length > 0) {
    pages.push(currentPage.join(" ").trim());
  }

  return pages;
}

async function transcribeAudio(filePath, userId) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
    });

    return transcription;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

router.post("/compress-audio", async (req, res) => {
  const bucket = getStorage().bucket();
  const { episodeId, userId, fileName, filePath, audioUrl } = req.body;

  if (!episodeId || !userId || !fileName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Create temp directory for processing
    const tempDir = path.join(os.tmpdir(), "podcast-compression");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempInputPath = path.join(
      tempDir,
      `input-${episodeId}${path.extname(fileName)}`
    );
    const tempOutputPath = path.join(tempDir, `output-${episodeId}.mp3`);

    // Initialize status
    compressionStatus.set(episodeId, {
      status: "downloading",
      progress: 0,
      error: null,
    });

    console.log("Starting file download:", { filePath, audioUrl });

    // Try downloading using the direct URL first
    if (audioUrl) {
      try {
        const response = await fetch(audioUrl);
        if (response.ok) {
          const fileStream = fs.createWriteStream(tempInputPath);
          await new Promise((resolve, reject) => {
            response.body
              .pipe(fileStream)
              .on("finish", resolve)
              .on("error", reject);
          });
        } else {
          throw new Error("Failed to download using direct URL");
        }
      } catch (error) {
        console.log(
          "Failed to download using direct URL, falling back to Storage:",
          error
        );
        // Fall back to Storage download
        await bucket.file(filePath).download({ destination: tempInputPath });
      }
    } else {
      // Use Storage download directly
      await bucket.file(filePath).download({ destination: tempInputPath });
    }

    console.log("File downloaded successfully");

    // Update status to compressing
    compressionStatus.set(episodeId, {
      status: "compressing",
      progress: 10,
      error: null,
    });

    // Compress audio using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .toFormat("mp3")
        .audioBitrate("128k")
        .on("progress", (progress) => {
          const status = compressionStatus.get(episodeId);
          compressionStatus.set(episodeId, {
            ...status,
            progress: Math.min(40, 10 + Math.round(progress.percent)),
          });
        })
        .on("end", resolve)
        .on("error", reject)
        .save(tempOutputPath);
    });

    // Update status to transcribing
    compressionStatus.set(episodeId, {
      status: "transcribing",
      progress: 50,
      error: null,
    });

    // Transcribe the compressed audio
    console.log("Starting transcription...");
    const transcriptionResult = await transcribeAudio(tempOutputPath, userId);

    // Process transcript
    const transcript = transcriptionResult.segments
      .map((segment) => segment.text)
      .join(" ");

    // Paginate transcript
    const transcriptPages = paginateTranscript(transcript);

    console.log("Transcription completed, uploading compressed file...");

    // Upload compressed file
    const uploadPath = `episodes/${userId}/compressed_${fileName}`;
    await bucket.upload(tempOutputPath, {
      destination: uploadPath,
      metadata: {
        contentType: "audio/mpeg",
      },
    });

    // Get the public URL
    const [url] = await bucket.file(uploadPath).getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    // Clean up temp files
    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);

    // Update status to complete with all the data
    compressionStatus.set(episodeId, {
      status: "completed",
      progress: 100,
      audioUrl: url,
      transcript: transcript,
      transcriptPages: transcriptPages,
      totalPages: transcriptPages.length,
      segments: transcriptionResult.segments,
      error: null,
    });

    res.json({ status: "started", message: "Compression process started" });
  } catch (error) {
    console.error("Compression error:", error);
    compressionStatus.set(episodeId, {
      status: "failed",
      progress: 0,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

router.get("/compression-status/:episodeId", (req, res) => {
  const { episodeId } = req.params;
  const status = compressionStatus.get(episodeId) || {
    status: "not_found",
    progress: 0,
    error: "Compression status not found",
  };
  res.json(status);
});

module.exports = router;
