import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getEpisode, updateEpisode } from "../../lib/firebase/episodes";

const STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export default function EpisodePage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [showNotes, setShowNotes] = useState("");

  useEffect(() => {
    async function loadEpisode() {
      try {
        const data = await getEpisode(episodeId);
        if (!data) {
          throw new Error("Episode not found");
        }
        setEpisode(data);
        setTitle(data.title || "");
        setStatus(data.status || "processing");
        setShowNotes(data.showNotes || "");
      } catch (error) {
        console.error("Error loading episode:", error);
        setError("Failed to load episode");
      } finally {
        setIsLoading(false);
      }
    }

    loadEpisode();
  }, [episodeId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError("");

    try {
      await updateEpisode(episodeId, {
        title,
        status,
        showNotes,
        updatedAt: new Date(),
      });
      // Navigate back to episodes list
      navigate("/dashboard/episodes");
    } catch (error) {
      console.error("Error saving episode:", error);
      setError("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            {error}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Episode</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>

        <div className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter episode title"
              className="w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
            />
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Show Notes Section */}
          <div className="space-y-2">
            <label htmlFor="showNotes" className="text-sm font-medium">
              Show Notes
            </label>
            <div className="border border-border rounded-md overflow-hidden">
              <textarea
                id="showNotes"
                value={showNotes}
                onChange={(e) => setShowNotes(e.target.value)}
                placeholder="Episode show notes will appear here..."
                rows={12}
                className="w-full px-3 py-2 focus:outline-none focus:ring-0 bg-muted/50 resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
