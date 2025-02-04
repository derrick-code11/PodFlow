import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import NewEpisodePage from "./pages/dashboard/NewEpisodePage";
import EpisodesPage from "./pages/dashboard/EpisodesPage";
import EpisodePage from "./pages/dashboard/EpisodePage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useSessionTimeout } from "./hooks/useSessionTimeout";

function App() {
  // Initialize session timeout monitoring
  useSessionTimeout();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/episodes"
          element={
            <ProtectedRoute>
              <EpisodesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/episodes/new"
          element={
            <ProtectedRoute>
              <NewEpisodePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/episodes/:episodeId"
          element={
            <ProtectedRoute>
              <EpisodePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
