import axios from "axios";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { transcribeAudio } from "./transcription";
import { generateShowNotes } from "./openai";
import { getUserSettings } from "../firebase/settings";

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

/**
 * Get available captions for a video
 */
async function getVideoCaptions(videoId, apiKey) {
  try {
    // First get the caption tracks available
    const captionResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/captions`,
      {
        params: {
          part: "snippet",
          videoId: videoId,
          key: apiKey,
        },
      }
    );

    if (
      !captionResponse.data.items ||
      captionResponse.data.items.length === 0
    ) {
      return null;
    }

    // Prefer English captions, fallback to any available
    const captionTrack =
      captionResponse.data.items.find(
        (track) => track.snippet.language === "en"
      ) || captionResponse.data.items[0];

    // Get the actual caption content
    const captionContent = await axios.get(
      `https://www.googleapis.com/youtube/v3/captions/${captionTrack.id}`,
      {
        params: {
          key: apiKey,
          tfmt: "srt", // Get in SRT format which is easier to parse
        },
      }
    );

    return captionContent.data;
  } catch (error) {
    console.error("Error fetching captions:", error);
    return null;
  }
}

/**
 * Process video URL to extract captions/audio and generate transcript/show notes
 */
export async function processVideo(videoUrl, userId) {
  try {
    // Get user settings for AI preferences
    const settings = await getUserSettings(userId);

    // Extract video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Create unique filename based on timestamp and user ID
    const timestamp = Date.now();
    const audioFileName = `${userId}_${timestamp}.mp3`;

    // Get video metadata from YouTube Data API
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos`,
      {
        params: {
          part: "snippet,contentDetails",
          id: videoId,
          key: apiKey,
        },
      }
    );

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error("Video not found");
    }

    const videoData = videoResponse.data.items[0];
    const { snippet, contentDetails } = videoData;
    const duration = parseDuration(contentDetails.duration);

    // Try to get captions
    const captions = await getVideoCaptions(videoId, apiKey);

    if (captions) {
      // Generate show notes from captions
      const showNotes = await generateShowNotes(captions, {
        includeTimestamps: settings.includeTimestamps,
        includeGuestInfo: settings.includeGuestInfo,
        includeResourceLinks: settings.includeResourceLinks,
        includeCallsToAction: settings.includeCallsToAction,
        defaultCallToAction: settings.defaultCallToAction,
      });

      return {
        title: snippet.title,
        author: snippet.channelTitle,
        thumbnail:
          snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
        duration,
        sourceUrl: videoUrl,
        sourceType: "youtube",
        transcript: captions,
        showNotes,
        status: "ready",
      };
    } else {
      // No captions available, return metadata and prompt for audio upload
      return {
        title: snippet.title,
        author: snippet.channelTitle,
        thumbnail:
          snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
        duration,
        sourceUrl: videoUrl,
        sourceType: "youtube",
        status: "pending",
        message:
          "No captions found. Please upload the audio file for transcription.",
      };
    }
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
}

// Helper function to parse ISO 8601 duration to seconds
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}
