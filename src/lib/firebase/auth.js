import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

// Session timeout duration in milliseconds (default: 24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

/**
 * Set auth persistence based on "Remember me" preference
 */
export async function setAuthPersistence(rememberMe) {
  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
  } catch (error) {
    console.error("Error setting auth persistence:", error);
    throw error;
  }
}

/**
 * Start session timeout
 */
export function startSessionTimeout(timeout = SESSION_TIMEOUT) {
  // Clear any existing timeout
  clearSessionTimeout();

  // Set new timeout
  const timeoutId = setTimeout(() => {
    signOut(auth).then(() => {
      console.log("Session expired. Signed out.");
    });
  }, timeout);

  // Store timeout ID in localStorage
  localStorage.setItem("sessionTimeoutId", timeoutId.toString());
}

/**
 * Clear session timeout
 */
export function clearSessionTimeout() {
  const timeoutId = localStorage.getItem("sessionTimeoutId");
  if (timeoutId) {
    clearTimeout(parseInt(timeoutId));
    localStorage.removeItem("sessionTimeoutId");
  }
}

/**
 * Reset session timeout
 */
export function resetSessionTimeout(timeout = SESSION_TIMEOUT) {
  clearSessionTimeout();
  startSessionTimeout(timeout);
}
