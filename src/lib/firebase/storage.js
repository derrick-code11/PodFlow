import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { storage, db, auth } from "../firebase";

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

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload progress:", progress);
          if (onProgress) onProgress(progress);
        },
        (error) => {
          // Handle unsuccessful uploads
          console.error("Upload error:", error);
          // Update status to error state
          setDoc(
            episodeRef,
            {
              status: "error",
              error: error.message,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(console.error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("Upload completed. Download URL:", downloadURL);

            // Update episode document with download URL but keep status as processing
            await setDoc(
              episodeRef,
              {
                downloadURL,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            resolve({
              id: episodeRef.id,
              downloadURL,
            });
          } catch (error) {
            console.error("Error getting download URL:", error);
            // Update status to error state
            await setDoc(
              episodeRef,
              {
                status: "error",
                error: error.message,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            reject(error);
          }
        }
      );
    });
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

    // Start processing the video link (you can add actual processing logic here)
    // For now, we'll just set it to ready state after a short delay
    setTimeout(async () => {
      try {
        await setDoc(
          episodeRef,
          {
            status: "ready",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Error updating video link status:", error);
        await setDoc(
          episodeRef,
          {
            status: "error",
            error: error.message,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }, 2000);

    return {
      id: episodeRef.id,
    };
  } catch (error) {
    console.error("Error in saveVideoLink:", error);
    throw error;
  }
}
