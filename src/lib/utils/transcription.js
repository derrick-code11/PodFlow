import { getUserSettings } from "../firebase/settings";
import { auth } from "../firebase";
import { OPENAI_API_KEY as ENV_OPENAI_API_KEY } from "../config";

const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const WHISPER_MAX_SIZE = 25 * 1024 * 1024; // 25MB OpenAI limit

/**
 * Transcribes audio using OpenAI's Whisper API
 */
export async function transcribeAudio(file, options = {}) {
  try {
    // Check authentication
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to use transcription");
    }

    // Get API key from user settings or environment
    const settings = await getUserSettings(user.uid);
    const apiKey = settings?.openaiApiKey || ENV_OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OpenAI API key not found. Please add it in your settings or environment variables."
      );
    }

    if (file.size > WHISPER_MAX_SIZE) {
      throw new Error(
        `OpenAI's Whisper API has a 25MB file size limit. Please compress your audio file or use a different transcription service. Current file size: ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)}MB`
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    if (options.language) {
      formData.append("language", options.language);
    }

    const response = await fetch(OPENAI_WHISPER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Transcription failed");
    }

    const data = await response.json();
    return {
      text: data.text,
      segments: data.segments || [],
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

/**
 * Downloads audio from a video URL
 */
export async function downloadAudioFromVideo(videoUrl) {
  // This would typically be handled by a backend service
  // For now, we'll throw an error suggesting backend processing
  throw new Error("Video processing requires backend implementation");
}
