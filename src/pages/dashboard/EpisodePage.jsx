import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  Save,
  Wand2,
  Sparkles,
  RefreshCcw,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import {
  getEpisode,
  updateEpisode,
  processAudioFile,
  getTranscriptPage,
} from "../../lib/firebase/episodes";
import {
  enhanceShowNotes,
  generateTitleSuggestions,
} from "../../lib/utils/openai";
import { generateShowNotes } from "../../lib/ai/showNotes";
import { getUserSettings } from "../../lib/firebase/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import AudioPlayer from "../../components/ui/AudioPlayer";
import { compressAudio } from "../../lib/utils/audioCompression";
import { getStorage, ref, getBytes } from "firebase/storage";
import { exportShowNotes } from "../../lib/utils/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/index";

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
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isEnhancingNotes, setIsEnhancingNotes] = useState(false);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [transcriptPage, setTranscriptPage] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadEpisode() {
      try {
        const data = await getEpisode(episodeId);
        if (!data) {
          throw new Error("Episode not found");
        }

        console.log("Loading episode data:", {
          hasTranscript: !!data.transcript,
          hasPages: !!data.transcriptPages,
          totalPages: data.totalPages,
        });

        setEpisode(data);
        setTitle(data.title || "");
        setStatus(data.status || "processing");
        setShowNotes(data.showNotes || "");

        // Initialize transcript data if available
        if (data.transcript) {
          if (data.transcriptPages?.length > 0) {
            // Use existing pages
            setTranscriptPage(data.transcriptPages[0]);
            setTotalPages(data.totalPages || data.transcriptPages.length);
            setCurrentPage(1);
          } else {
            // If we have transcript but no pages, create pages
            const { page, totalPages } = await getTranscriptPage(episodeId, 1);
            setTranscriptPage(page);
            setTotalPages(totalPages);
            setCurrentPage(1);
          }
        }
      } catch (error) {
        console.error("Error loading episode:", error);
        setError("Failed to load episode");
      } finally {
        setIsLoading(false);
      }
    }

    loadEpisode();
  }, [episodeId]);

  useEffect(() => {
    if (episode?.title) {
      setEditedTitle(episode.title);
    }
  }, [episode?.title]);

  useEffect(() => {
    async function loadTranscriptPage() {
      if (!episodeId || !episode?.transcript) return;

      // Skip if we're on page 1 and already have the content
      if (currentPage === 1 && transcriptPage && episode.transcriptPages)
        return;

      setIsLoadingPage(true);
      try {
        console.log("Loading transcript page:", currentPage);
        const { page, totalPages: newTotalPages } = await getTranscriptPage(
          episodeId,
          currentPage
        );
        setTranscriptPage(page);
        if (newTotalPages !== totalPages) {
          setTotalPages(newTotalPages);
        }
      } catch (error) {
        console.error("Error loading transcript page:", error);
        setError("Failed to load transcript page");
      } finally {
        setIsLoadingPage(false);
      }
    }

    loadTranscriptPage();
  }, [episodeId, currentPage, episode?.transcript]);

  const requiresConfirmation = (newStatus) => {
    const importantStatuses = ["published", "archived"];
    return (
      importantStatuses.includes(newStatus) && episode.status !== newStatus
    );
  };

  const performSave = async (data) => {
    setIsSaving(true);
    setError("");

    try {
      await updateEpisode(episodeId, {
        ...data,
        updatedAt: new Date(),
      });
      navigate("/dashboard/episodes");
    } catch (error) {
      if (error.code === "permission-denied") {
        setError("You don't have permission to edit this episode");
      } else if (error.code === "not-found") {
        setError("This episode no longer exists");
        navigate("/dashboard/episodes");
      } else {
        setError("Failed to save changes. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Episode title is required");
      return;
    }

    const updateData = {
      title: title.trim(),
      status,
      showNotes,
    };

    if (requiresConfirmation(status)) {
      setPendingSave(updateData);
      setShowConfirmDialog(true);
    } else {
      await performSave(updateData);
    }
  };

  const handleGenerateNotes = async () => {
    if (!episode.transcript) {
      setError("No transcript available. Please upload an audio file first.");
      return;
    }

    setIsGeneratingNotes(true);
    setError("");

    try {
      await generateShowNotes(episode.userId, episode.id, episode.audioUrl);
      const updatedEpisode = await getEpisode(episode.id);
      setEpisode(updatedEpisode);
      setShowNotes(
        updatedEpisode.showNotes || {
          summary: "",
          timestamps: [],
          guestInfo: null,
          resourceLinks: [],
          callToAction: "",
        }
      );
    } catch (error) {
      if (error.message.includes("API key not found")) {
        setError(
          "Please add your OpenAI API key in Settings to generate show notes."
        );
      } else if (error.message.includes("No transcript available")) {
        setError(
          "No transcript found. Please ensure the audio has been transcribed first."
        );
      } else {
        setError(
          error.message || "Failed to generate show notes. Please try again."
        );
      }
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleEnhanceNotes = async () => {
    if (!episode.showNotes?.summary) {
      setError("No show notes to enhance. Generate or write some notes first.");
      return;
    }

    setIsEnhancingNotes(true);
    setError("");

    try {
      const enhancedNotes = await enhanceShowNotes(episode.showNotes.summary);
      setShowNotes({
        ...episode.showNotes,
        summary: enhancedNotes,
      });
    } catch (error) {
      setError(error.message || "Failed to enhance show notes");
    } finally {
      setIsEnhancingNotes(false);
    }
  };

  const handleGenerateTitles = async () => {
    if (!episode.showNotes?.summary) {
      setError(
        "No show notes summary available. Generate or write some notes first."
      );
      return;
    }

    setIsGeneratingTitles(true);
    setError("");

    try {
      const suggestions = await generateTitleSuggestions(
        episode.showNotes.summary,
        title
      );
      setTitleSuggestions(suggestions.split("\n").filter(Boolean));
      setShowTitleDialog(true);
    } catch (error) {
      setError(error.message || "Failed to generate title suggestions");
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const handleCompressAndProcess = async () => {
    if (!episode?.userId || !episode?.fileName) {
      setError("Missing episode information (userId or fileName)");
      return;
    }

    setIsCompressing(true);
    setError("");
    setCompressionProgress(0);

    try {
      // Construct the correct storage path
      const storagePath = `episodes/${episode.userId}/${episode.fileName}`;
      console.log("Compression request for:", { storagePath, episode });

      // Show initial toast
      toast({
        title: "Processing Started",
        description:
          "Compressing audio and generating transcript. This may take a few minutes.",
        duration: 10000,
      });

      const response = await fetch("http://localhost:3001/api/compress-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          episodeId: episodeId,
          userId: episode.userId,
          fileName: episode.fileName,
          filePath: storagePath,
          audioUrl: episode.audioUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to start compression");
      }

      const pollStatus = async () => {
        const statusResponse = await fetch(
          `http://localhost:3001/api/compression-status/${episodeId}`
        );
        const status = await statusResponse.json();

        if (status.error) {
          throw new Error(status.error);
        }

        setCompressionProgress(status.progress || 0);

        if (status.status === "completed") {
          console.log(
            "Compression completed, updating episode with transcript:",
            {
              hasTranscript: !!status.transcript,
              totalPages: status.totalPages,
              firstPageLength: status.transcriptPages?.[0]?.length,
            }
          );

          // First update the local state immediately
          setTranscriptPage(status.transcriptPages?.[0] || "");
          setTotalPages(status.totalPages || 1);
          setCurrentPage(1);

          // Update episode state immediately with the new data
          setEpisode((prev) => ({
            ...prev,
            audioUrl: status.audioUrl || "",
            transcript: status.transcript || "",
            transcriptPages: status.transcriptPages || [],
            totalPages: status.totalPages || 1,
            segments: status.segments || [],
            needsCompression: false,
            status: "ready",
          }));

          // Show toast notification
          toast({
            title: "Transcript Generated",
            description:
              "If you don't see the transcript, please refresh the page.",
            duration: 5000,
          });

          // Then update in the database
          const updateData = {
            audioUrl: status.audioUrl || "",
            transcript: status.transcript || "",
            transcriptPages: status.transcriptPages || [],
            totalPages: status.totalPages || 1,
            segments: status.segments || [],
            needsCompression: false,
            status: "ready",
          };

          await updateEpisode(episodeId, updateData);

          // Initialize empty show notes structure
          setShowNotes({
            summary: "",
            timestamps: [],
            guestInfo: null,
            resourceLinks: [],
            callToAction: "",
          });

          return true;
        } else if (status.status === "failed") {
          throw new Error(status.error || "Compression failed");
        }

        return false;
      };

      while (true) {
        const isComplete = await pollStatus();
        if (isComplete) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setCompressionProgress(100);
    } catch (error) {
      console.error("Compression error:", error);
      setError(error.message || "Failed to compress and process audio");
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
    }
  };

  const handleTitleEdit = () => {
    setIsEditing(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle !== episode.title) {
      await performSave({ ...episode, title: editedTitle });
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditedTitle(episode.title);
    }
  };

  const goToPage = (pageNum) => {
    setCurrentPage(Math.max(1, Math.min(pageNum, totalPages)));
  };

  const goToPreviousPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  const handleCompressionComplete = async (status) => {
    console.log("Compression complete with status:", status);

    // Update local state immediately
    setTranscriptPage(status.transcriptPages?.[0] || "");
    setTotalPages(status.totalPages || 1);
    setCurrentPage(1);

    // Update episode state
    setEpisode((prev) => ({
      ...prev,
      audioUrl: status.audioUrl || "",
      transcript: status.transcript || "",
      transcriptPages: status.transcriptPages || [],
      totalPages: status.totalPages || 1,
      segments: status.segments || [],
      needsCompression: false,
      status: "ready",
    }));

    // Show toast notification
    toast({
      title: "Transcript Generated",
      description: "If you don't see the transcript, please refresh the page.",
      duration: 5000,
    });

    // Update in database
    try {
      const episodeRef = doc(db, "episodes", episode.id);
      await updateDoc(episodeRef, {
        audioUrl: status.audioUrl || "",
        transcript: status.transcript || "",
        transcriptPages: status.transcriptPages || [],
        totalPages: status.totalPages || 1,
        segments: status.segments || [],
        needsCompression: false,
        status: "ready",
      });
    } catch (error) {
      console.error("Error updating episode:", error);
      toast({
        title: "Error",
        description: "Failed to save transcript. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
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
      <div className="container mx-auto px-4 py-8">
        {episode ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className="text-3xl font-bold tracking-tight w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                ) : (
                  <h1
                    className="text-3xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
                    onClick={handleTitleEdit}
                    title="Click to edit title"
                  >
                    {episode?.title || "Loading..."}
                  </h1>
                )}
                {episode.needsCompression && (
                  <p className="text-sm text-yellow-600 mt-2">
                    ⚠️ This file needs compression for transcription
                  </p>
                )}
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center px-6 py-2.5 min-w-[140px] border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <AudioPlayer src={episode.audioUrl} />
            </div>

            {episode.needsCompression && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Upload className="w-5 h-5 text-yellow-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Audio Compression Required
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Your audio file is{" "}
                      {(episode.size / (1024 * 1024)).toFixed(2)}MB, which
                      exceeds the 25MB limit for transcription. Click below to
                      compress the file and generate the transcript
                      automatically.
                    </p>
                    <button
                      onClick={handleCompressAndProcess}
                      disabled={isCompressing}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCompressing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          {compressionProgress > 0
                            ? `Compressing... ${compressionProgress}%`
                            : "Starting compression..."}
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mr-3" />
                          Compress Audio & Generate Transcript
                        </>
                      )}
                    </button>
                    {error && (
                      <p className="mt-2 text-sm text-red-600">{error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Show Notes</h2>
                {!episode.needsCompression && (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleGenerateNotes}
                      disabled={isGeneratingNotes || !episode?.transcript}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingNotes ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate
                        </>
                      )}
                    </button>

                    {episode.showNotes?.summary && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => exportShowNotes(episode, "markdown")}
                          >
                            Export as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => exportShowNotes(episode, "pdf")}
                          >
                            Export as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
              <div className="prose max-w-none">
                {episode.showNotes?.summary ? (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-2">Summary</h3>
                      <p>{episode.showNotes.summary}</p>
                    </div>

                    {episode.showNotes.timestamps?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-2">Timestamps</h3>
                        <div className="whitespace-pre-line font-mono text-sm">
                          {episode.showNotes.timestamps
                            .map(
                              (timestamp, index) =>
                                `${timestamp.time} - ${timestamp.description}\n`
                            )
                            .join("")}
                        </div>
                      </div>
                    )}

                    {episode.showNotes.guestInfo && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-2">
                          Guest Information
                        </h3>
                        <div className="prose">
                          <div className="mb-4">
                            {episode.showNotes.guestInfo.bio}
                          </div>
                          {episode.showNotes.guestInfo.socialProfiles?.length >
                            0 && (
                            <div className="flex flex-wrap gap-3">
                              {episode.showNotes.guestInfo.socialProfiles.map(
                                (profile, index) => (
                                  <a
                                    key={index}
                                    href={profile.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 hover:bg-gray-200 transition-colors"
                                  >
                                    {profile.platform === "linkedin" && (
                                      <>
                                        <svg
                                          className="w-4 h-4 mr-2"
                                          viewBox="0 0 24 24"
                                          fill="currentColor"
                                        >
                                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                                        </svg>
                                        {profile.name}
                                      </>
                                    )}
                                    {profile.platform === "twitter" && (
                                      <>
                                        <svg
                                          className="w-4 h-4 mr-2"
                                          viewBox="0 0 24 24"
                                          fill="currentColor"
                                        >
                                          <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                                        </svg>
                                        {profile.handle}
                                      </>
                                    )}
                                  </a>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {episode.showNotes.resourceLinks?.filter(
                      (r) => r.category === "people"
                    ).length > 0 && (
                      <div>
                        <h4 className="text-md font-medium text-gray-700 mb-2">
                          People & Companies
                        </h4>
                        <ul className="list-none space-y-2">
                          {episode.showNotes.resourceLinks
                            .filter((r) => r.category === "people")
                            .map((resource, index) => (
                              <li key={index} className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  {resource.platform === "linkedin" && (
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                                    </svg>
                                  )}
                                  {resource.platform === "twitter" && (
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                                    </svg>
                                  )}
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    {resource.title}
                                  </a>
                                </div>
                                {resource.description && (
                                  <span className="text-sm text-gray-600 mt-0.5 ml-6">
                                    {resource.description}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {episode.showNotes.resourceLinks?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-4">
                          Resources & Links
                        </h3>
                        <div className="space-y-6">
                          {/* Tools & Software */}
                          {episode.showNotes.resourceLinks.filter(
                            (r) => r.category === "tools"
                          ).length > 0 && (
                            <div>
                              <h4 className="text-md font-medium text-gray-700 mb-2">
                                Tools & Software
                              </h4>
                              <ul className="list-none space-y-2">
                                {episode.showNotes.resourceLinks
                                  .filter((r) => r.category === "tools")
                                  .map((resource, index) => (
                                    <li key={index} className="flex flex-col">
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        {resource.title}
                                      </a>
                                      {resource.description && (
                                        <span className="text-sm text-gray-600 mt-0.5">
                                          {resource.description}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}

                          {/* Books & Publications */}
                          {episode.showNotes.resourceLinks.filter(
                            (r) => r.category === "books"
                          ).length > 0 && (
                            <div>
                              <h4 className="text-md font-medium text-gray-700 mb-2">
                                Books & Publications
                              </h4>
                              <ul className="list-none space-y-2">
                                {episode.showNotes.resourceLinks
                                  .filter((r) => r.category === "books")
                                  .map((resource, index) => (
                                    <li key={index} className="flex flex-col">
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        {resource.title}
                                      </a>
                                      {resource.description && (
                                        <span className="text-sm text-gray-600 mt-0.5">
                                          {resource.description}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}

                          {/* Additional Resources */}
                          {episode.showNotes.resourceLinks.filter(
                            (r) => r.category === "additional"
                          ).length > 0 && (
                            <div>
                              <h4 className="text-md font-medium text-gray-700 mb-2">
                                Additional Resources
                              </h4>
                              <ul className="list-none space-y-2">
                                {episode.showNotes.resourceLinks
                                  .filter((r) => r.category === "additional")
                                  .map((resource, index) => (
                                    <li key={index} className="flex flex-col">
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        {resource.title}
                                      </a>
                                      {resource.description && (
                                        <span className="text-sm text-gray-600 mt-0.5">
                                          {resource.description}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}

                          {/* Uncategorized Links */}
                          {episode.showNotes.resourceLinks.filter(
                            (r) => !r.category
                          ).length > 0 && (
                            <div>
                              <h4 className="text-md font-medium text-gray-700 mb-2">
                                Other Links
                              </h4>
                              <ul className="list-none space-y-2">
                                {episode.showNotes.resourceLinks
                                  .filter((r) => !r.category)
                                  .map((resource, index) => (
                                    <li key={index} className="flex flex-col">
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        {resource.title}
                                      </a>
                                      {resource.description && (
                                        <span className="text-sm text-gray-600 mt-0.5">
                                          {resource.description}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {episode.showNotes.callToAction && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-2">
                          Call to Action
                        </h3>
                        <p>{episode.showNotes.callToAction}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    {episode.needsCompression
                      ? "Show notes will be generated after compressing and transcribing the audio."
                      : "No show notes available. Click 'Generate' to create show notes from the transcript."}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Transcript</h2>
              <div className="prose max-w-none">
                {episode?.transcript ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-500">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={goToPreviousPage}
                          disabled={currentPage === 1 || isLoadingPage}
                          className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) =>
                              goToPage(parseInt(e.target.value) || 1)
                            }
                            className="w-16 px-2 py-1 border rounded-md text-center"
                          />
                          <span className="text-gray-500">/ {totalPages}</span>
                        </div>
                        <button
                          onClick={goToNextPage}
                          disabled={currentPage === totalPages || isLoadingPage}
                          className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-[400px] whitespace-pre-wrap relative bg-gray-50 rounded-lg p-4">
                      {isLoadingPage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      ) : transcriptPage ? (
                        <div className="text-gray-700 leading-relaxed">
                          {transcriptPage}
                        </div>
                      ) : (
                        <div className="text-gray-500 italic text-center">
                          No content available for this page
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    {episode?.needsCompression
                      ? "Transcript will be generated after compressing the audio."
                      : "No transcript available."}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              {status === "published"
                ? "Publishing this episode will make it visible to your audience. Are you sure you want to proceed?"
                : status === "archived"
                  ? "Archiving this episode will hide it from your audience. Are you sure you want to proceed?"
                  : "Are you sure you want to change the status of this episode?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSave(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingSave) {
                  await performSave(pendingSave);
                  setPendingSave(null);
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Title Suggestions</AlertDialogTitle>
            <AlertDialogDescription>
              Select a title suggestion or use it as inspiration for your own.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {titleSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setTitle(suggestion.replace(/^\d+\.\s*/, ""));
                    setShowTitleDialog(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-muted rounded-md transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
