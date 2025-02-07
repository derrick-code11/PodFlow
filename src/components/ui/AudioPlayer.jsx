import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "../../lib/utils";
import "../../styles/audioPlayer.css";

export default function AudioPlayer({ src, onTimeUpdate, timestamps = [] }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        const currentTime = audio.currentTime;
        setCurrentTime(currentTime);

        // Find current segment based on timestamp
        const segment = timestamps.find(
          (ts) => currentTime >= ts.start && currentTime <= ts.end
        );
        setCurrentSegment(segment);

        if (onTimeUpdate) {
          onTimeUpdate(currentTime, segment);
        }
      }
    };

    audio.addEventListener("timeupload", handleTimeUpdate);
    return () => audio.removeEventListener("timeupload", handleTimeUpdate);
  }, [onTimeUpdate, isDragging, timestamps]);

  const togglePlay = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const time = (e.target.value / 100) * duration;
    setCurrentTime(time);
    if (!isDragging) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekEnd = (e) => {
    setIsDragging(false);
    const time = (e.target.value / 100) * duration;
    audioRef.current.currentTime = time;
  };

  const handleVolumeChange = (e) => {
    const value = e.target.value / 100;
    setVolume(value);
    audioRef.current.volume = value;
    if (value === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const skipForward = () => {
    audioRef.current.currentTime += 15;
  };

  const skipBackward = () => {
    audioRef.current.currentTime -= 15;
  };

  const jumpToTime = (timestamp) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timestamp;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="w-full bg-white rounded-lg p-4 shadow-sm">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="w-full mb-4">
        <input
          type="range"
          value={(currentTime / duration) * 100 || 0}
          onChange={handleSeek}
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
          className="audio-player-range w-full"
          style={{
            background: `linear-gradient(to right, #2563eb ${
              (currentTime / duration) * 100
            }%, #e5e7eb ${(currentTime / duration) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={skipBackward}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Skip backward 15 seconds"
            >
              <SkipBack className="w-5 h-5 text-gray-700" />
            </button>

            <button
              onClick={togglePlay}
              className={cn(
                "p-3 rounded-full transition-all transform hover:scale-105",
                "bg-primary hover:bg-primary/90",
                "flex items-center justify-center"
              )}
              disabled={isLoading}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white translate-x-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Skip forward 15 seconds"
            >
              <SkipForward className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-gray-700" />
            ) : (
              <Volume2 className="w-5 h-5 text-gray-700" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume * 100}
            onChange={handleVolumeChange}
            className="audio-player-range volume-slider"
            style={{
              background: `linear-gradient(to right, #2563eb ${
                isMuted ? 0 : volume * 100
              }%, #e5e7eb ${isMuted ? 0 : volume * 100}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
