import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Upload,
  Link as LinkIcon,
  Loader2,
  X,
  Youtube,
  Video,
  Podcast,
  Music,
} from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { uploadEpisode, saveVideoLink } from "../../lib/firebase/storage";
import {
  processAudioFile,
  createEpisode,
  processVideoLink,
} from "../../lib/firebase/episodes";
import { getVideoMetadata } from "../../lib/utils/video";

// Platform regex and utilities
const PLATFORMS = {
  YOUTUBE: {
    name: "YouTube",
    regex: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
    icon: Youtube,
    color: "text-red-500",
    getVideoId: (url) => {
      const match = url.match(
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?.*v=)([^#&?]*).*/
      );
      return match && match[2].length === 11 ? match[2] : null;
    },
    getThumbnail: (id) => ({
      high: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      default: `https://img.youtube.com/vi/${id}/0.jpg`,
    }),
  },
  VIMEO: {
    name: "Vimeo",
    regex: /^(https?:\/\/)?(www\.)?(vimeo\.com)\/.+$/,
    icon: Video,
    color: "text-blue-500",
    getVideoId: (url) => {
      const match = url.match(/vimeo\.com\/([0-9]+)/);
      return match ? match[1] : null;
    },
    getThumbnail: async (id) => {
      try {
        const response = await fetch(
          `https://vimeo.com/api/v2/video/${id}.json`
        );
        const data = await response.json();
        return {
          high: data[0].thumbnail_large,
          default: data[0].thumbnail_medium,
        };
      } catch (error) {
        console.error("Error fetching Vimeo thumbnail:", error);
        return null;
      }
    },
  },
  SPOTIFY: {
    name: "Spotify",
    regex: /^(https?:\/\/)?(open\.spotify\.com)\/(episode|show)\/.+$/,
    icon: Music,
    color: "text-green-500",
  },
  APPLE_PODCASTS: {
    name: "Apple Podcasts",
    regex: /^(https?:\/\/)?(podcasts\.apple\.com)\/.+$/,
    icon: Podcast,
    color: "text-purple-500",
  },
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

export default function NewEpisodePage() {
  const [user, loading, error] = useAuthState(auth);
  const [isUploading, setIsUploading] = useState(false);
  const [episodeLink, setEpisodeLink] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [linkPreview, setLinkPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Detect platform and get preview
  const handleLinkChange = async (e) => {
    const link = e.target.value;
    setEpisodeLink(link);
    setUploadError("");
    setLinkPreview(null);

    // Find matching platform
    for (const [platform, config] of Object.entries(PLATFORMS)) {
      if (config.regex.test(link)) {
        if (platform === "YOUTUBE") {
          const videoId = config.getVideoId(link);
          if (videoId) {
            const thumbnails = config.getThumbnail(videoId);
            setLinkPreview({
              type: platform.toLowerCase(),
              videoId,
              thumbnail: thumbnails.high,
              fallbackThumbnail: thumbnails.default,
              name: config.name,
              icon: config.icon,
              color: config.color,
            });
          }
        } else if (platform === "VIMEO") {
          const videoId = config.getVideoId(link);
          if (videoId) {
            setIsLoadingPreview(true);
            try {
              const thumbnails = await config.getThumbnail(videoId);
              if (thumbnails) {
                setLinkPreview({
                  type: platform.toLowerCase(),
                  videoId,
                  thumbnail: thumbnails.high,
                  fallbackThumbnail: thumbnails.default,
                  name: config.name,
                  icon: config.icon,
                  color: config.color,
                });
              }
            } catch (error) {
              console.error("Error loading Vimeo preview:", error);
            } finally {
              setIsLoadingPreview(false);
            }
          }
        } else {
          // For other platforms without thumbnails
          setLinkPreview({
            type: platform.toLowerCase(),
            name: config.name,
            icon: config.icon,
            color: config.color,
          });
        }
        return;
      }
    }
  };

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    setUploadError("");

    if (!episodeLink) {
      setUploadError("Please enter a valid episode link");
      return;
    }

    if (linkPreview && linkPreview.type === "youtube") {
      const videoId = PLATFORMS.YOUTUBE.getVideoId(episodeLink);
      if (!videoId) {
        setUploadError("Invalid YouTube link");
        return;
      }
    }

    // TODO: Handle link processing
    console.log("Processing link:", episodeLink);
  };

  const onDrop = useCallback((acceptedFiles) => {
    setUploadError("");
    const file = acceptedFiles[0];

    // Validate file type
    if (!file.type.startsWith("audio/")) {
      setUploadError("Please upload an audio file");
      return;
    }

    // Validate file size (100MB limit)
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setUploadError(
        `File size (${fileSizeMB}MB) must be less than 100MB. Please compress your audio file first.`
      );
      return;
    }

    setUploadedFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".m4a", ".wav", ".aac"],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    onDropRejected: (rejectedFiles) => {
      const file = rejectedFiles[0];
      if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setUploadError(
          `File size (${fileSizeMB}MB) must be less than 100MB. Please compress your audio file first.`
        );
      } else {
        setUploadError("Invalid file. Please upload a supported audio file.");
      }
    },
  });

  const handleUpload = async () => {
    if (!user) {
      setUploadError("Please login to upload episodes");
      return;
    }

    if (!uploadedFile && !episodeLink) {
      setUploadError("Please upload a file or provide a link");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadProgress(0);

    try {
      if (uploadedFile) {
        // Process audio file
        const processedData = await processAudioFile(uploadedFile, user.uid);

        // Create episode with processed data
        const episode = await createEpisode(user.uid, {
          title: uploadedFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
          sourceType: "upload",
          fileName: uploadedFile.name,
          fileType: uploadedFile.type,
          size: uploadedFile.size,
          audioUrl: processedData.audioUrl,
          transcript: processedData.transcript,
          segments: processedData.segments,
          showNotes: processedData.showNotes,
          status: "ready",
        });

        navigate(`/dashboard/episodes/${episode.id}`);
      } else if (episodeLink) {
        try {
          // Get video metadata first
          const metadata = await getVideoMetadata(episodeLink);

          // Create episode with video metadata
          const episode = await createEpisode(user.uid, {
            title: metadata.title,
            sourceType: linkPreview.type,
            sourceUrl: episodeLink,
            sourceId: linkPreview.videoId,
            thumbnail: metadata.thumbnail,
            author: metadata.author,
            duration: metadata.duration,
            status: "pending", // Changed to pending since we can't process in browser
            message: "Please upload the audio file separately for processing",
          });

          navigate(`/dashboard/episodes/${episode.id}`);
        } catch (error) {
          if (error.message.includes("not available in the browser version")) {
            setUploadError(
              "Direct video processing is not available. Please download the audio and upload it as a file."
            );
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error.message || "Error uploading file. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setUploadError("");
  };

  const clearLink = () => {
    setEpisodeLink("");
    setLinkPreview(null);
    setUploadError("");
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Upload New Episode</h1>
          <p className="text-muted-foreground">
            Upload your podcast episode audio file or paste a link
          </p>
        </div>

        <div className="space-y-8">
          {/* File Upload Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Upload Audio File</h2>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input {...getInputProps()} />
              {uploadedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="flex-1 truncate">
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearUploadedFile();
                    }}
                    className="p-2 hover:bg-muted rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-medium">
                      Drag & drop your audio file here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports MP3, M4A, WAV, AAC (max 100MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Link Input Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Or Paste Episode Link
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="url"
                    value={episodeLink}
                    onChange={handleLinkChange}
                    placeholder="Paste a YouTube or Vimeo link..."
                    className="w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                  />
                </div>
                <button
                  onClick={handleLinkSubmit}
                  disabled={!episodeLink || isUploading}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Platform Support Note */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1.5 items-center">
                  <Youtube className="w-4 h-4" /> YouTube
                </div>
                <span>•</span>
                <div className="flex gap-1.5 items-center">
                  <Video className="w-4 h-4" /> Vimeo
                </div>
                <span>•</span>
                <div className="flex gap-1.5 items-center opacity-50">
                  <Music className="w-4 h-4" /> Spotify (Coming Soon)
                </div>
                <span>•</span>
                <div className="flex gap-1.5 items-center opacity-50">
                  <Podcast className="w-4 h-4" /> Apple Podcasts (Coming Soon)
                </div>
              </div>

              {/* Link Preview */}
              {linkPreview && (
                <div className="rounded-lg border border-border overflow-hidden bg-card">
                  {/* Show thumbnail for video platforms */}
                  {(linkPreview.type === "youtube" ||
                    linkPreview.type === "vimeo") && (
                    <div className="relative aspect-video">
                      <img
                        src={linkPreview.thumbnail}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = linkPreview.fallbackThumbnail;
                        }}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <linkPreview.icon className="w-12 h-12 text-white opacity-80" />
                      </div>
                    </div>
                  )}

                  {/* Preview card footer */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <linkPreview.icon
                        className={`w-5 h-5 ${linkPreview.color}`}
                      />
                      <span className="text-sm font-medium">
                        {linkPreview.name}
                      </span>
                    </div>
                    <button
                      onClick={clearLink}
                      className="p-2 hover:bg-muted rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Loading state for previews */}
              {isLoadingPreview && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="text-muted-foreground">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {uploadError}
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={(!uploadedFile && !episodeLink) || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploadProgress > 0 ? "Uploading..." : "Processing..."}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Episode
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
