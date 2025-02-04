import { doc, setDoc, collection, getDoc } from "firebase/firestore";
import { db } from "../firebase/index";
import { getUserSettings } from "../firebase/settings";
import { callOpenAI } from "../utils/openai";

/**
 * Generate show notes for an episode using AI
 */
export async function generateShowNotes(userId, episodeId, audioUrl) {
  console.log("Starting show notes generation:", {
    userId,
    episodeId,
    audioUrl,
  });

  try {
    // Get user settings
    const settings = await getUserSettings(userId);
    console.log("Got user settings:", settings);

    if (!settings.openaiApiKey) {
      throw new Error(
        "OpenAI API key not found. Please add it in your settings."
      );
    }

    // Update episode status to show processing has started
    const episodeRef = doc(db, "episodes", episodeId);
    await setDoc(
      episodeRef,
      {
        status: "processing",
        processingStartedAt: new Date(),
      },
      { merge: true }
    );
    console.log("Updated episode status to processing");

    // Get the episode data to access the transcript
    const episodeSnap = await getDoc(episodeRef);
    const episode = episodeSnap.data();
    console.log("Got episode data:", {
      hasTranscript: !!episode?.transcript,
      transcriptLength: episode?.transcript?.length,
    });

    if (!episode?.transcript) {
      throw new Error("No transcript available for show notes generation");
    }

    // Generate show notes using GPT
    console.log("Calling OpenAI...");
    const messages = [
      {
        role: "system",
        content: `You are an expert podcast summarizer with a deep understanding of effective show note structures, audience engagement strategies, and content organization. You excel at extracting important details from transcripts or audio content to produce concise, structured, and listener-friendly show notes.

Your task is to analyze the provided transcript and create comprehensive show notes following this structure:

# Episode Title & Description
[A compelling title and brief overview of the episode]

# Key Takeaways
- Main point 1
- Main point 2
- Main point 3

# Timestamps
[Time markers for key moments in the discussion]
00:00 - Introduction
05:00 - Topic 1

# Guest Information
[If applicable: Name, credentials, and relevant background]

# Links & Resources
[Any tools, books, websites, or resources mentioned]
[Resource Title](URL)

# Calls to Action (CTA)
[Clear next steps for listeners]

# Social Media & Contact Info
[Any mentioned social media handles or contact information]

Focus on:
- Clarity and conciseness
- Actionable insights
- Engaging structure
- Key discussion points
- Memorable quotes
- Resource links
- Clear calls to action

Format everything in clean markdown with proper headings and bullet points.`,
      },
      {
        role: "user",
        content: `Please create show notes for the following podcast transcript. ${
          settings.includeTimestamps ? "Include timestamps where relevant." : ""
        }
        ${settings.includeGuestInfo ? "Include guest information if mentioned." : ""}
        ${
          settings.includeResourceLinks
            ? "Include links to resources mentioned."
            : ""
        }
        ${
          settings.includeCallsToAction
            ? `Include this call to action: "${settings.defaultCallToAction}"`
            : ""
        }

        Transcript:
        ${episode.transcript}`,
      },
    ];

    const showNotesContent = await callOpenAI(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });


    // Process the show notes to extract different sections
    const sections = processShowNotes(showNotesContent);
    console.log("Processed show notes sections:", Object.keys(sections));

    // Update episode with generated content
    await setDoc(
      episodeRef,
      {
        status: "ready",
        showNotes: {
          summary: sections.summary || "",
          timestamps: sections.timestamps || [],
          guestInfo: settings.includeGuestInfo ? sections.guestInfo : null,
          resourceLinks: settings.includeResourceLinks
            ? sections.resourceLinks
            : [],
          callToAction: settings.includeCallsToAction
            ? settings.defaultCallToAction
            : "",
        },
        processingCompletedAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error("Error in generateShowNotes:", error);

    // Update episode status to show error
    const episodeRef = doc(db, "episodes", episodeId);
    await setDoc(
      episodeRef,
      {
        status: "error",
        error: error.message,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    throw error;
  }
}

/**
 * Process the raw show notes content to extract different sections
 */
function processShowNotes(content) {
  const sections = {
    summary: "",
    timestamps: [],
    guestInfo: null,
    resourceLinks: [],
    callToAction: "",
  };

  // Split content into sections based on markdown headers
  const parts = content.split(/^#\s+/m);

  for (const part of parts) {
    if (!part.trim()) continue;

    const [sectionTitle, ...sectionContent] = part.split("\n");
    const cleanContent = sectionContent.join("\n").trim();

    if (
      sectionTitle.toLowerCase().includes("title") ||
      sectionTitle.toLowerCase().includes("description")
    ) {
      sections.summary = cleanContent;
    } else if (sectionTitle.toLowerCase().includes("key takeaway")) {
      // Append key takeaways to summary
      sections.summary += "\n\nKey Takeaways:\n" + cleanContent;
    } else if (sectionTitle.toLowerCase().includes("timestamp")) {
      // Extract timestamps in format "00:00 - Description"
      const timestampMatches = cleanContent.matchAll(
        /(\d{1,2}:\d{2})\s*-\s*(.+)/g
      );
      for (const match of timestampMatches) {
        sections.timestamps.push({
          time: match[1],
          description: match[2].trim(),
        });
      }
    } else if (sectionTitle.toLowerCase().includes("guest")) {
      sections.guestInfo = {
        bio: cleanContent,
      };
    } else if (
      sectionTitle.toLowerCase().includes("link") ||
      sectionTitle.toLowerCase().includes("resource")
    ) {
      // Extract links in markdown format [title](url)
      const linkMatches = cleanContent.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of linkMatches) {
        sections.resourceLinks.push({
          title: match[1],
          url: match[2],
        });
      }

      // Also extract plain text links if no markdown links found
      if (sections.resourceLinks.length === 0) {
        const lines = cleanContent.split("\n");
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith("-")) {
            sections.resourceLinks.push({
              title: trimmedLine,
              url: trimmedLine,
            });
          }
        }
      }
    } else if (
      sectionTitle.toLowerCase().includes("call to action") ||
      sectionTitle.toLowerCase().includes("cta")
    ) {
      sections.callToAction = cleanContent;
    }
  }

  if (sections.summary) {
    sections.summary = sections.summary.trim();
  }
  return sections;
}
