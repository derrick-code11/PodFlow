import { doc, setDoc, collection, getDoc } from "firebase/firestore";
import { db } from "../firebase/index";
import { getUserSettings } from "../firebase/settings";
import { callOpenAI } from "../utils/openai";
import { updateTranscript } from "../firebase/episodes";

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
    console.log("User settings loaded:", {
      hasApiKey: !!settings.openaiApiKey,
      includeTimestamps: settings.includeTimestamps,
      includeGuestInfo: settings.includeGuestInfo,
      includeResourceLinks: settings.includeResourceLinks,
      includeCallsToAction: settings.includeCallsToAction,
    });

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

    // Update transcript with pagination
    await updateTranscript(episodeId, episode.transcript);

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
For each guest, provide:
- Full name and current role/company
- Brief professional background
- Notable achievements or expertise areas

# Resources & Links
[Intelligently categorize and provide links for mentioned resources]

Tools & Software:
- Link to any software, tools, or platforms discussed
- Include official documentation when relevant
- Add GitHub repositories if open source tools are mentioned
Format: [Tool Name](official_url) - Brief description of how it was discussed

Books & Publications:
- Amazon links to books mentioned (use exact book title)
- Links to research papers or articles discussed
- Links to relevant documentation
Format: [Book Title](amazon_url) - Brief context from the discussion

People & Companies:
- LinkedIn: [Full Name](linkedin_url) - Current role at Company
- Twitter: [@handle](twitter_url) - Brief bio or recent focus
- Company: [Company Name](company_url) - Brief description
- Wikipedia: [Name/Company](wiki_url) - If notable entity
Format: Include both personal and company links when available

Additional Resources:
- Blog posts: [Title](url) - Key takeaway discussed
- YouTube: [Channel/Video](url) - Relevant timestamp/topic
- Podcasts: [Show Name](url) - Related episode if mentioned
- Courses: [Course Name](url) - Specific module/topic referenced
- Forums: [Community](url) - Relevant thread/topic

[For each link, provide specific context from the discussion]

# Calls to Action (CTA)
[Clear next steps for listeners]

# Social Media & Contact Info
[Any mentioned social media handles or contact information]

Focus on:
- Verify all social media profiles and links before including
- Provide multiple link variations for better accuracy
- Include context for why each resource is relevant
- Ensure all links are properly formatted and accessible

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
    const sections = await processShowNotes(showNotesContent);
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
async function processShowNotes(content) {
  const sections = {
    summary: "",
    timestamps: [],
    guestInfo: null,
    resourceLinks: [],
    callToAction: "",
  };

  // Split content into sections based on markdown headers
  const parts = content.split(/^#\s+/m);

  let currentCategory = null;

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
      sections.summary += "\n\nKey Takeaways:\n" + cleanContent;
    } else if (sectionTitle.toLowerCase().includes("timestamp")) {
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
      // Extract guest information without social profiles
      sections.guestInfo = {
        bio: cleanContent,
      };
    } else if (
      sectionTitle.toLowerCase().includes("resource") ||
      sectionTitle.toLowerCase().includes("link")
    ) {
      // Process resource links by category
      const lines = cleanContent.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Check for category headers
        if (trimmedLine.toLowerCase().includes("tools & software:")) {
          currentCategory = "tools";
          continue;
        } else if (
          trimmedLine.toLowerCase().includes("books & publications:")
        ) {
          currentCategory = "books";
          continue;
        } else if (trimmedLine.toLowerCase().includes("people & companies:")) {
          currentCategory = "people";
          continue;
        } else if (
          trimmedLine.toLowerCase().includes("additional resources:")
        ) {
          currentCategory = "additional";
          continue;
        }

        // Extract links and descriptions
        if (trimmedLine.startsWith("-")) {
          // Try to extract markdown link
          const markdownLinkMatch = trimmedLine.match(
            /\[([^\]]+)\]\(([^)]+)\)/
          );
          if (markdownLinkMatch) {
            const title = markdownLinkMatch[1];
            const url = markdownLinkMatch[2];
            // Look for description after the link
            const descriptionMatch = trimmedLine.match(/\)\s*-?\s*(.+)$/);
            const description = descriptionMatch
              ? descriptionMatch[1].trim()
              : "";

            // For people category, construct social media URLs
            if (currentCategory === "people") {
              if (url.includes("linkedin.com")) {
                const constructedUrl = constructLinkedInUrl(title);
                sections.resourceLinks.push({
                  title,
                  url: constructedUrl || url, // Fallback to original URL if construction fails
                  description,
                  category: currentCategory,
                  platform: "linkedin",
                });
              } else if (url.includes("twitter.com")) {
                const handle = url.split("/").pop();
                const constructedUrl = constructTwitterUrl(handle);
                sections.resourceLinks.push({
                  title,
                  url: constructedUrl || url, // Fallback to original URL if construction fails
                  description,
                  category: currentCategory,
                  platform: "twitter",
                });
              } else {
                sections.resourceLinks.push({
                  title,
                  url,
                  description,
                  category: currentCategory,
                });
              }
            } else {
              sections.resourceLinks.push({
                title,
                url,
                description,
                category: currentCategory,
              });
            }
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

// Update the LinkedIn URL construction function
function constructLinkedInUrl(name, company = "") {
  try {
    // Format the name for LinkedIn URL
    const formattedName = name
      .toLowerCase()
      // Replace accented characters
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Keep only letters, numbers, and hyphens
      .replace(/[^a-z0-9-\s]/g, "")
      // Replace spaces with hyphens and remove consecutive hyphens
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "");

    // For people with short names, don't add company
    if (formattedName.length >= 3) {
      return `https://www.linkedin.com/in/${formattedName}`;
    }

    // If name is too short and company is provided, include it
    if (company) {
      const formattedCompany = company
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

      return `https://www.linkedin.com/in/${formattedName}-${formattedCompany}`;
    }

    return `https://www.linkedin.com/in/${formattedName}`;
  } catch (error) {
    console.error("Error constructing LinkedIn URL:", error);
    return null;
  }
}

function constructTwitterUrl(handle) {
  try {
    // Clean up the handle
    const cleanHandle = handle.replace(/[@\s]/g, "").trim();
    return `https://twitter.com/${cleanHandle}`;
  } catch (error) {
    console.error("Error constructing Twitter URL:", error);
    return null;
  }
}
