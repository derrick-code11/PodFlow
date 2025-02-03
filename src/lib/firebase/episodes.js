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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";
import { db, storage } from "../firebase";

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
  const averageCharWidth = 5; // Approximate width of a character in points
  const lineHeight = 10; // Height of a line in points
  const charsPerLine = Math.floor(maxWidth / averageCharWidth);
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * lineHeight;
}

// Create a new episode
export async function createEpisode(userId, episodeData) {
  try {
    const episodesRef = collection(db, "episodes");

    // Prepare episode data
    const episode = {
      ...episodeData,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "processing", // Initial status
    };

    // Create the episode document
    const docRef = await addDoc(episodesRef, episode);

    return {
      id: docRef.id,
      ...episode,
    };
  } catch (error) {
    console.error("Error creating episode:", error);
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
      status: "completed", // Update status after successful upload
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
    await updateDoc(episodeRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating episode:", error);
    throw error;
  }
}
