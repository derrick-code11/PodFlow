import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  limit,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { jsPDF } from "jspdf";
import { db, storage, auth } from "./index";
import { transcribeAudio } from "../utils/transcription";
import { getVideoMetadata } from "../utils/video";
import { generateShowNotes } from "../utils/openai";
import { getUserSettings } from "./settings";
import { processVideo } from "../utils/videoProcessing";

const MAX_FILE_SIZE = 100 * 1024 * 1024; 
const CHUNK_SIZE = 10 * 1024 * 1024; 
const WHISPER_MAX_SIZE = 25 * 1024 * 1024;

// Fetch episodes for a user
export async function fetchUserEpisodes(userId) {
  try {
    const episodesRef = collection(db, "episodes");
    const q = query(
      episodesRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching episodes:", error);
    throw error;
  }
}

// Delete an episode
export async function deleteEpisode(episodeId) {
  try {
    await deleteDoc(doc(db, "episodes", episodeId));
  } catch (error) {
    console.error("Error deleting episode:", error);
    throw error;
  }
}

// Export episode data
export async function exportEpisode(episode, format = "markdown") {
  try {
    let content = "";
    let blob;
    let fileExtension = format;

    switch (format) {
      case "pdf":
        const pdf = new jsPDF();
        let yPos = 20;
        const lineHeight = 10;

        // Title
        pdf.setFontSize(20);
        pdf.text(episode.title, 20, yPos);
        yPos += lineHeight * 2;

        // Summary
        if (episode.summary) {
          pdf.setFontSize(12);
          pdf.text("Summary", 20, yPos);
          yPos += lineHeight;
          pdf.setFontSize(10);
          pdf.text(episode.summary, 20, yPos, { maxWidth: 170 });
          yPos += calculateTextHeight(episode.summary, 170) + lineHeight;
        }

        // Metadata
        pdf.setFontSize(12);
        pdf.text("Details", 20, yPos);
        yPos += lineHeight;
        pdf.setFontSize(10);
        pdf.text(`Duration: ${episode.duration}`, 20, yPos);
        yPos += lineHeight;
        pdf.text(`Source: ${episode.sourceType}`, 20, yPos);
        yPos += lineHeight;
        pdf.text(
          `Created: ${new Date(episode.createdAt).toLocaleDateString()}`,
          20,
          yPos
        );
        yPos += lineHeight * 1.5;

        // Timestamps
        if (episode.timestamps && episode.timestamps.length > 0) {
          pdf.setFontSize(12);
          pdf.text("Timestamps", 20, yPos);
          yPos += lineHeight;
          pdf.setFontSize(10);
          episode.timestamps.forEach((ts) => {
            pdf.text(`${ts.time} - ${ts.description}`, 20, yPos);
            yPos += lineHeight;
          });
        }

        blob = pdf.output("blob");
        break;

      case "markdown":
        content = `# ${episode.title}\n\n`;
        content += `## Summary\n${episode.summary || ""}\n\n`;
        content += `## Duration\n${episode.duration}\n\n`;
        content += `## Source\n${episode.sourceType}\n\n`;
        if (episode.timestamps) {
          content += `## Timestamps\n`;
          episode.timestamps.forEach((ts) => {
            content += `${ts.time} - ${ts.description}\n`;
          });
        }
        blob = new Blob([content], { type: "text/markdown" });
        break;

      case "json":
        content = JSON.stringify(episode, null, 2);
        blob = new Blob([content], { type: "application/json" });
        break;

      case "txt":
        content = `Title: ${episode.title}\n`;
        content += `Summary: ${episode.summary || ""}\n`;
        content += `Duration: ${episode.duration}\n`;
        content += `Source: ${episode.sourceType}\n`;
        if (episode.timestamps) {
          content += `\nTimestamps:\n`;
          episode.timestamps.forEach((ts) => {
            content += `${ts.time} - ${ts.description}\n`;
          });
        }
        blob = new Blob([content], { type: "text/plain" });
        break;

      default:
        throw new Error("Unsupported export format");
    }

    // Create and download file
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${episode.title}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting episode:", error);
    throw error;
  }
}

// Helper function to calculate text height
function calculateTextHeight(text, maxWidth) {
  const averageCharWidth = 5;
  const lineHeight = 10; 
  const charsPerLine = Math.floor(maxWidth / averageCharWidth);
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * lineHeight;
}

// Process audio file for an episode
export async function processAudioFile(file, userId) {
  try {
    // Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User must be authenticated to process audio files");
    }
    if (currentUser.uid !== userId) {
      throw new Error("User ID mismatch. Please try logging in again.");
    }

    // Check file size for Firebase upload
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File size must be less than 100MB. Current file size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      );
    }

    // Get user settings for AI preferences - will use defaults if not available
    let settings;
    try {
      settings = await getUserSettings(userId);
    } catch (error) {
      console.warn("Failed to get user settings, using defaults:", error);
      settings = {
        defaultLanguage: "en",
        includeTimestamps: true,
        includeGuestInfo: true,
        includeResourceLinks: true,
        includeCallsToAction: true,
        defaultCallToAction: "Subscribe to our podcast for more episodes!",
      };
    }

    // 1. Upload the audio file to Firebase
    const storageRef = ref(storage, `episodes/${userId}/${file.name}`);
    let downloadURL;

    // use chunked upload for better reliability
    const metadata = {
      contentType: file.type,
      customMetadata: {
        userId: userId,
        originalName: file.name,
        fileSize: file.size.toString(),
      },
    };

    console.log("Starting upload for file:", {
      name: file.name,
      size: file.size,
      type: file.type,
      userId: userId,
      currentUser: currentUser.uid,
    });

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    // Upload to Firebase Storage
    await new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress.toFixed(2)}%`);
        },
        (error) => {
          console.error("Upload error details:", error);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          try {
            downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("Upload to Firebase completed successfully");
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });

    // Check if file needs compression (over 25MB)
    const needsCompression = file.size > WHISPER_MAX_SIZE;
    let transcription = null;
    let showNotes = null;

    if (needsCompression) {
      console.log("File exceeds Whisper limit, skipping transcription");
      transcription = {
        text: "File exceeds OpenAI's 25MB limit. Please compress the audio for transcription.",
        segments: [],
      };
      showNotes = {
        summary:
          "Transcription not available. Please compress the audio (under 25MB) to generate show notes.",
        timestamps: [],
        highlights: [],
      };
    } else {
      // Proceed with transcription for files under 25MB
      transcription = await transcribeAudio(file, {
        language: settings.defaultLanguage,
      });

      // Generate show notes if we have transcription
      showNotes = await generateShowNotes(transcription.text, {
        includeTimestamps: settings.includeTimestamps,
        includeGuestInfo: settings.includeGuestInfo,
        includeResourceLinks: settings.includeResourceLinks,
        includeCallsToAction: settings.includeCallsToAction,
        defaultCallToAction: settings.defaultCallToAction,
      });
    }

    return {
      audioUrl: downloadURL,
      transcript: transcription.text,
      segments: transcription.segments,
      showNotes,
      needsCompression,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    };
  } catch (error) {
    console.error("Error processing audio file:", error);
    if (error.code === "permission-denied") {
      throw new Error(
        "Permission denied. Please check if you are logged in with the correct account."
      );
    }
    throw error;
  }
}

// Process video link for an episode
export async function processVideoLink(url, userId) {
  try {
    // Get user settings for AI preferences
    const settings = await getUserSettings(userId);

    // 1. Get video metadata
    const metadata = await getVideoMetadata(url);

    // 2. Process video and get audio, transcript, and show notes
    const processedData = await processVideo(url, userId);

    return processedData;
  } catch (error) {
    console.error("Error processing video link:", error);
    throw error;
  }
}

// Create a new episode
export async function createEpisode(userId, episodeData) {
  try {
    // Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User must be authenticated to create episodes");
    }
    if (currentUser.uid !== userId) {
      throw new Error("User ID mismatch. Please try logging in again.");
    }

    const episodesRef = collection(db, "episodes");

    // Ensure needsCompression is set based on file size if not already set
    const size = episodeData.size || 0;
    const needsCompression = size > WHISPER_MAX_SIZE;

    // Prepare episode data
    const episode = {
      ...episodeData,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: needsCompression ? "needs_compression" : "processing",
      needsCompression,
      size,
    };

    console.log("Creating episode with data:", {
      userId: currentUser.uid,
      size,
      needsCompression,
      status: episode.status,
    });

    // Create the episode document
    const docRef = await addDoc(episodesRef, episode);

    console.log("Created episode:", {
      id: docRef.id,
      size,
      needsCompression,
      status: episode.status,
    });

    return {
      id: docRef.id,
      ...episode,
    };
  } catch (error) {
    console.error("Error creating episode:", error);
    if (error.code === "permission-denied") {
      throw new Error(
        "Permission denied. Please check if you are logged in with the correct account."
      );
    }
    throw error;
  }
}

// Upload episode media file
export async function uploadEpisodeMedia(userId, episodeId, file) {
  try {
    // Create reference to storage location
    const fileExtension = file.name.split(".").pop();
    const storageRef = ref(
      storage,
      `episodes/${userId}/${episodeId}/media.${fileExtension}`
    );

    // Upload file
    await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    // Update episode document with media URL
    const episodeRef = doc(db, "episodes", episodeId);
    await updateDoc(episodeRef, {
      mediaUrl: downloadURL,
      mediaType: file.type,
      status: "completed", 
      updatedAt: serverTimestamp(),
    });

    return downloadURL;
  } catch (error) {
    // Update episode status to failed if upload fails
    const episodeRef = doc(db, "episodes", episodeId);
    await updateDoc(episodeRef, {
      status: "failed",
      error: error.message,
      updatedAt: serverTimestamp(),
    });

    console.error("Error uploading episode media:", error);
    throw error;
  }
}

// Get a single episode by ID
export async function getEpisode(episodeId) {
  try {
    const episodeRef = doc(db, "episodes", episodeId);
    const episodeSnap = await getDoc(episodeRef);

    if (!episodeSnap.exists()) {
      return null;
    }

    return {
      id: episodeSnap.id,
      ...episodeSnap.data(),
    };
  } catch (error) {
    console.error("Error getting episode:", error);
    throw error;
  }
}

// Update an episode
export async function updateEpisode(episodeId, data) {
  try {
    const episodeRef = doc(db, "episodes", episodeId);

    // Get the current episode data first
    const episodeSnap = await getDoc(episodeRef);
    if (!episodeSnap.exists()) {
      throw new Error("Episode not found");
    }

    // Maintain the userId from the original document
    const currentData = episodeSnap.data();

    await updateDoc(episodeRef, {
      ...data,
      userId: currentData.userId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating episode:", error);
    throw error;
  }
}
