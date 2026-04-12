import mammoth from "mammoth";

const MAX_TEXT_LENGTH = 50000;

export async function parseFile(buffer, mimeType, filename) {
  const name = filename.toLowerCase();

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      type: "document",
      text: result.value.slice(0, MAX_TEXT_LENGTH),
      name: filename,
    };
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return {
      type: "document",
      text: result.text.slice(0, MAX_TEXT_LENGTH),
      name: filename,
    };
  }

  if (
    mimeType.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md")
  ) {
    return {
      type: "document",
      text: buffer.toString("utf-8").slice(0, MAX_TEXT_LENGTH),
      name: filename,
    };
  }

  if (mimeType.startsWith("image/")) {
    return {
      type: "image",
      base64: buffer.toString("base64"),
      mimeType,
      name: filename,
    };
  }

  throw new Error(`Định dạng không hỗ trợ: ${filename}`);
}

export function getAcceptedMimeTypes() {
  return [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "text/markdown",
  ];
}
