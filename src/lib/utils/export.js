import { jsPDF } from "jspdf";

/**
 * Convert show notes to markdown format
 */
function convertToMarkdown(episode) {
  let markdown = `# ${episode.title}\n\n`;

  if (episode.showNotes?.summary) {
    markdown += `## Summary\n${episode.showNotes.summary}\n\n`;
  }

  if (episode.showNotes?.timestamps?.length > 0) {
    markdown += `## Timestamps\n`;
    episode.showNotes.timestamps.forEach((timestamp) => {
      markdown += `${timestamp.time} - ${timestamp.description}\n`;
    });
    markdown += "\n";
  }

  if (episode.showNotes?.guestInfo) {
    markdown += `## Guest Information\n${episode.showNotes.guestInfo.bio}\n\n`;
  }

  if (episode.showNotes?.resourceLinks?.length > 0) {
    markdown += `## Resources & Links\n`;
    episode.showNotes.resourceLinks.forEach((resource) => {
      markdown += `- [${resource.title}](${resource.url})\n`;
    });
    markdown += "\n";
  }

  if (episode.showNotes?.callToAction) {
    markdown += `## Call to Action\n${episode.showNotes.callToAction}\n\n`;
  }

  return markdown;
}

/**
 * Convert show notes to PDF format
 */
function convertToPDF(episode) {
  const doc = new jsPDF();
  let yPos = 20;
  const lineHeight = 10;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.text(episode.title, margin, yPos);
  yPos += lineHeight * 2;

  // Helper function to add a section with word wrap
  const addSection = (title, content) => {
    if (!content) return yPos;

    // Check if we need a new page
    if (yPos > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(16);
    doc.text(title, margin, yPos);
    yPos += lineHeight;

    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(content, pageWidth - margin * 2);
    doc.text(splitText, margin, yPos);
    yPos += splitText.length * lineHeight + lineHeight;

    return yPos;
  };

  // Add each section
  if (episode.showNotes?.summary) {
    yPos = addSection("Summary", episode.showNotes.summary);
  }

  if (episode.showNotes?.timestamps?.length > 0) {
    yPos = addSection(
      "Timestamps",
      episode.showNotes.timestamps
        .map((t) => `${t.time} - ${t.description}`)
        .join("\n")
    );
  }

  if (episode.showNotes?.guestInfo) {
    yPos = addSection("Guest Information", episode.showNotes.guestInfo.bio);
  }

  if (episode.showNotes?.resourceLinks?.length > 0) {
    yPos = addSection(
      "Resources & Links",
      episode.showNotes.resourceLinks
        .map((r) => `${r.title}: ${r.url}`)
        .join("\n")
    );
  }

  if (episode.showNotes?.callToAction) {
    yPos = addSection("Call to Action", episode.showNotes.callToAction);
  }

  return doc;
}

/**
 * Export episode show notes to the specified format
 */
export async function exportShowNotes(episode, format = "markdown") {
  if (!episode?.showNotes) {
    throw new Error("No show notes available for export");
  }

  try {
    if (format === "markdown") {
      const markdown = convertToMarkdown(episode);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${episode.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_show_notes.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      const doc = convertToPDF(episode);
      doc.save(
        `${episode.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_show_notes.pdf`
      );
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error("Error exporting show notes:", error);
    throw error;
  }
}
