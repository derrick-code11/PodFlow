import { getUserSettings } from "../firebase/settings";
import { auth } from "../firebase";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Makes a call to OpenAI's API
 */
export async function callOpenAI(messages, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to use AI features");
  }

  // Get user settings to retrieve API key
  const settings = await getUserSettings(user.uid);
  const apiKey = settings.openaiApiKey;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found. Please add it in your settings."
    );
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-4-turbo-preview",
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        presence_penalty: options.presencePenalty || 0,
        frequency_penalty: options.frequencyPenalty || 0,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to call OpenAI API");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

/**
 * Generates show notes from a transcript
 */
export async function generateShowNotes(transcript, options = {}) {
  const messages = [
    {
      role: "system",
      content: `You are a professional podcast show notes writer. Your task is to create comprehensive, well-structured show notes from the provided transcript. 
      Focus on:
      - Key discussion points and insights
      - Important quotes (with timestamps if available)
      - Main takeaways
      - Resources mentioned
      - Action items for listeners
      
      Format the notes in markdown with clear sections and bullet points.`,
    },
    {
      role: "user",
      content: `Please create show notes for the following podcast transcript. ${
        options.includeTimestamps ? "Include timestamps where relevant." : ""
      }
      ${options.includeGuestInfo ? "Include guest information if mentioned." : ""}
      ${
        options.includeResourceLinks
          ? "Include links to resources mentioned."
          : ""
      }
      ${
        options.includeCallsToAction
          ? `Include this call to action: "${options.defaultCallToAction}"`
          : ""
      }

      Transcript:
      ${transcript}`,
    },
  ];

  return await callOpenAI(messages, {
    temperature: 0.7,
    maxTokens: 2000,
  });
}

/**
 * Enhances show notes with additional content
 */
export async function enhanceShowNotes(showNotes, options = {}) {
  const messages = [
    {
      role: "system",
      content: `You are a professional content enhancer. Your task is to improve the provided show notes by:
      - Adding relevant subheadings
      - Expanding on key points
      - Adding formatting for better readability
      - Suggesting related resources
      - Adding social sharing snippets
      
      Keep the original content intact while enhancing it.`,
    },
    {
      role: "user",
      content: `Please enhance these show notes:

      ${showNotes}`,
    },
  ];

  return await callOpenAI(messages, {
    temperature: 0.7,
    maxTokens: 2000,
  });
}

/**
 * Generates SEO-optimized title suggestions
 */
export async function generateTitleSuggestions(showNotes, currentTitle = "") {
  const messages = [
    {
      role: "system",
      content: `You are a podcast title optimization expert. Generate 5 engaging, SEO-friendly title suggestions based on the show notes. 
      The titles should be:
      - Attention-grabbing but not clickbait
      - Include relevant keywords
      - Under 60 characters
      - Reflect the main value proposition for listeners`,
    },
    {
      role: "user",
      content: `Current title: "${currentTitle}"

      Show notes:
      ${showNotes}

      Please suggest 5 alternative titles.`,
    },
  ];

  return await callOpenAI(messages, {
    temperature: 0.8,
    maxTokens: 500,
  });
}
