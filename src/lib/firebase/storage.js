import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { storage, db, auth } from "./index";
import { generateShowNotes } from "../ai/showNotes";
import { getUserSettings } from "./settings";

/**
 * Upload a file to Firebase Storage and save metadata to Firestore
 */
export async function uploadEpisode(file, onProgress) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in to upload");

  try {
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `episodes/${user.uid}/${fileName}`;

    // Create storage reference
    const storageRef = ref(storage, filePath);

    // Create episode document in Firestore
    const episodeRef = doc(collection(db, "episodes"));

    // Get user settings
    const settings = await getUserSettings(user.uid);

    // Save initial metadata
    await setDoc(episodeRef, {
      id: episodeRef.id,
      userId: user.uid,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      fileName,
      filePath, // Store the full path
      sourceType: "upload",
      fileType: file.type,
      size: file.size,
      status: "processing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Upload file with progress monitoring
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        throw error;
      }
    );

    // Wait for upload to complete
    await uploadTask;

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    // If auto-generate is enabled, start show notes generation
    if (settings.autoGenerateShowNotes) {
      generateShowNotes(user.uid, episodeRef.id, downloadURL).catch((error) => {
        console.error("Error generating show notes:", error);
      });
    } else {
      // If auto-generate is disabled, set status to ready
      await setDoc(
        episodeRef,
        {
          status: "ready",
          downloadURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      id: episodeRef.id,
      downloadURL,
    };
  } catch (error) {
    console.error("Error in uploadEpisode:", error);
    throw error;
  }
}

/**
 * Save video link metadata to Firestore
 */
export async function saveVideoLink(linkData) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in to save video link");

  try {
    const episodeRef = doc(collection(db, "episodes"));

    // Get user settings
    const settings = await getUserSettings(user.uid);

    await setDoc(episodeRef, {
      id: episodeRef.id,
      userId: user.uid,
      title: linkData.title || "Untitled Episode",
      sourceType: linkData.type, // "youtube" or "vimeo"
      sourceId: linkData.videoId,
      thumbnail: linkData.thumbnail,
      status: "processing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // If auto-generate is enabled, start show notes generation
    if (settings.autoGenerateShowNotes) {
      generateShowNotes(user.uid, episodeRef.id, linkData.url).catch(
        (error) => {
          console.error("Error generating show notes:", error);
        }
      );
    } else {
      // If auto-generate is disabled, set status to ready
      await setDoc(
        episodeRef,
        {
          status: "ready",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      id: episodeRef.id,
    };
  } catch (error) {
    console.error("Error in saveVideoLink:", error);
    throw error;
  }
}
