/**
 * Converts Firebase authentication error codes into user-friendly error messages
 */
export function getAuthErrorMessage(error) {
  switch (error.code) {
    // Email/Password Sign up errors
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/invalid-email":
      return "Please enter a valid email address";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled. Please contact support.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters)";

    // Sign in errors
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/user-not-found":
      return "No account found with this email address";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";

    // Password reset errors
    case "auth/expired-action-code":
      return "The password reset link has expired. Please request a new one.";
    case "auth/invalid-action-code":
      return "The password reset link is invalid. Please request a new one.";

    // Google Sign in errors
    case "auth/popup-closed-by-user":
      return "Sign in was cancelled. Please try again.";
    case "auth/cancelled-popup-request":
      return "Only one sign in window can be open at a time.";
    case "auth/popup-blocked":
      return "Sign in popup was blocked by your browser. Please allow popups for this site.";

    // Network errors
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    // Default case
    default:
      return "An error occurred. Please try again.";
  }
}
