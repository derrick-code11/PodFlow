import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../lib/firebase";
import { resetSessionTimeout, clearSessionTimeout } from "../lib/firebase/auth";

export function useSessionTimeout() {
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!user) {
      clearSessionTimeout();
      return;
    }

    // List of events to monitor for user activity
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    // Reset timeout on user activity
    const handleActivity = () => {
      resetSessionTimeout();
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearSessionTimeout();
    };
  }, [user]);
}
