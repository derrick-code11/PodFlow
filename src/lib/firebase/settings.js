import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./index";

// Default settings
const DEFAULT_SETTINGS = {
  // API Settings
  openaiApiKey: "",

  // Content Generation Settings
  defaultLanguage: "en",
  autoGenerateShowNotes: true,
  includeTimestamps: true,
  includeGuestInfo: true,
  includeResourceLinks: true,
  includeCallsToAction: true,
  defaultCallToAction: "Subscribe to our podcast for more episodes!",

  // Export Settings
  defaultExportFormat: "markdown",
  includeHeaderSection: true,
  includeFooterSection: true,
  customHeaderText: "",
  customFooterText: "",

  // Storage Settings
  retainOriginalAudio: false,
  retainTranscripts: true,
  autoDeleteAfterDays: 30,
};

/**
 * Initialize user settings in Firestore
 * This should be called when a user first signs up
 */
export async function initializeUserSettings(userId) {
  try {
    const settingsRef = doc(db, "settings", userId);
    const settingsSnap = await getDoc(settingsRef);

    // Only initialize if settings don't exist
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error initializing user settings:", error);
    throw new Error("Failed to initialize user settings");
  }
}

/**
 * Get user settings from Firestore
 * If settings don't exist, they will be initialized with defaults
 */
export async function getUserSettings(userId) {
  try {
    if (!userId) {
      console.error("No userId provided to getUserSettings");
      return DEFAULT_SETTINGS;
    }

    const settingsRef = doc(db, "settings", userId);
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // If settings don't exist, create them with defaults
      console.log("Creating default settings for user:", userId);
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return DEFAULT_SETTINGS;
    }

    const settings = settingsSnap.data();

    // Merge with defaults and ensure all required fields exist
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      autoGenerateShowNotes: Boolean(settings.autoGenerateShowNotes),
      includeTimestamps: Boolean(settings.includeTimestamps),
      includeGuestInfo: Boolean(settings.includeGuestInfo),
      includeResourceLinks: Boolean(settings.includeResourceLinks),
      includeCallsToAction: Boolean(settings.includeCallsToAction),
      includeHeaderSection: Boolean(settings.includeHeaderSection),
      includeFooterSection: Boolean(settings.includeFooterSection),
      retainOriginalAudio: Boolean(settings.retainOriginalAudio),
      retainTranscripts: Boolean(settings.retainTranscripts),
    };
  } catch (error) {
    console.error("Error getting user settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update user settings in Firestore
 * Validates and cleans settings before saving
 */
export async function updateUserSettings(userId, settings) {
  if (!userId) {
    throw new Error("User ID is required to update settings");
  }

  try {
    const settingsRef = doc(db, "settings", userId);

    // Validate and clean settings before saving
    const cleanedSettings = {
      ...settings,
      // Store API key as is (it should be encrypted on the client side if needed)
      openaiApiKey: settings.openaiApiKey || "",
      // Ensure autoDeleteAfterDays is within valid range
      autoDeleteAfterDays: Math.max(
        0,
        Math.min(365, settings.autoDeleteAfterDays || 30)
      ),
      autoGenerateShowNotes: Boolean(settings.autoGenerateShowNotes),
      includeTimestamps: Boolean(settings.includeTimestamps),
      includeGuestInfo: Boolean(settings.includeGuestInfo),
      includeResourceLinks: Boolean(settings.includeResourceLinks),
      includeCallsToAction: Boolean(settings.includeCallsToAction),
      includeHeaderSection: Boolean(settings.includeHeaderSection),
      includeFooterSection: Boolean(settings.includeFooterSection),
      retainOriginalAudio: Boolean(settings.retainOriginalAudio),
      retainTranscripts: Boolean(settings.retainTranscripts),
      // Add timestamps
      updatedAt: serverTimestamp(),
    };

    await setDoc(settingsRef, cleanedSettings, { merge: true });
    return cleanedSettings;
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw new Error("Failed to update user settings");
  }
}
