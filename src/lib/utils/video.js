/**
 * Extracts video ID from various platform URLs
 */
export function extractVideoId(url) {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  if (youtubeMatch) return { platform: "youtube", id: youtubeMatch[1] };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/([0-9]+)/);
  if (vimeoMatch) return { platform: "vimeo", id: vimeoMatch[1] };

  return null;
}

/**
 * Fetches video metadata from YouTube
 */
export async function getYouTubeMetadata(videoId) {
  try {
    // Using oEmbed API (no API key required)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch YouTube metadata");
    }

    const data = await response.json();
    return {
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      duration: null, // Note: oEmbed doesn't provide duration
    };
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error);
    throw error;
  }
}

/**
 * Fetches video metadata from Vimeo
 */
export async function getVimeoMetadata(videoId) {
  try {
    // Using oEmbed API (no API key required)
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Vimeo metadata");
    }

    const data = await response.json();
    return {
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      duration: data.duration,
    };
  } catch (error) {
    console.error("Error fetching Vimeo metadata:", error);
    throw error;
  }
}

/**
 * Fetches video metadata from any supported platform
 */
export async function getVideoMetadata(url) {
  const videoInfo = extractVideoId(url);
  if (!videoInfo) {
    throw new Error("Unsupported video URL");
  }

  switch (videoInfo.platform) {
    case "youtube":
      return getYouTubeMetadata(videoInfo.id);
    case "vimeo":
      return getVimeoMetadata(videoInfo.id);
    default:
      throw new Error("Unsupported video platform");
  }
}
