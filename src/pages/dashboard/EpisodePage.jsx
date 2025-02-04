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
} from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import {
  getEpisode,
  updateEpisode,
  processAudioFile,
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
        setError("Failed to load episode");
      } finally {
        setIsLoading(false);
      }
    }

    loadEpisode();
  }, [episodeId]);

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
      const response = await fetch("http://localhost:3001/api/compress-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          episodeId: episodeId,
          userId: episode.userId,
          fileName: episode.fileName,
          filePath: `episodes/${episode.userId}/${episode.fileName}`,
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
          const updateData = {
            audioUrl: status.audioUrl || "",
            transcript: status.transcript || "",
            showNotes: status.showNotes || { summary: "", timestamps: [] },
            segments: status.segments || [],
            needsCompression: false,
            status: "ready",
          };

          await updateEpisode(episodeId, updateData);

          const updatedEpisode = await getEpisode(episodeId);
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
      setError(error.message || "Failed to compress and process audio");
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
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
                <h1 className="text-3xl font-bold">{episode.title}</h1>
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
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>

            {episode.audioUrl && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-xl font-semibold mb-4">Audio</h2>
                <AudioPlayer src={episode.audioUrl} />
              </div>
            )}

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
                        <ul className="list-none space-y-2">
                          {episode.showNotes.timestamps.map(
                            (timestamp, index) => (
                              <li key={index} className="flex items-start">
                                <span className="font-mono text-sm text-gray-500 mr-4">
                                  {timestamp.time}
                                </span>
                                <span>{timestamp.description}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {episode.showNotes.guestInfo && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-2">
                          Guest Information
                        </h3>
                        <div className="prose">
                          {episode.showNotes.guestInfo.bio}
                        </div>
                      </div>
                    )}

                    {episode.showNotes.resourceLinks?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-2">
                          Resources & Links
                        </h3>
                        <ul className="list-none space-y-2">
                          {episode.showNotes.resourceLinks.map(
                            (resource, index) => (
                              <li key={index}>
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {resource.title}
                                </a>
                              </li>
                            )
                          )}
                        </ul>
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
              <div className="prose max-w-none whitespace-pre-wrap">
                {episode.transcript || (
                  <p className="text-gray-500 italic">
                    {episode.needsCompression
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
