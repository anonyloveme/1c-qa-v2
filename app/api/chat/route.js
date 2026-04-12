import { searchDocumentContext } from "@/services/document";
import { streamClaudeCompletion, buildUserMessageWithFile } from "@/services/claude";
import { getBalancerHealth } from "@/services/pollinationsBalancer";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ssePayload(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET() {
  const health = getBalancerHealth();
  return Response.json(health);
}

export async function POST(request) {
  const { allowed, retryAfter } = checkRateLimit(request);
  if (!allowed) {
    return Response.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const {
    messages = [],
    // images: array of base64 strings (new multi-image support)
    images = [],
    // legacy single image support
    image = null,
    // files: array of { text, name } (new multi-file support)
    files = [],
    // legacy single file support
    fileText = null,
    fileName = null,
    useFullDocument = false,
  } = await request.json();

  // Normalize: merge legacy single + new array formats
  const allImages = [...(Array.isArray(images) ? images : []), ...(image ? [image] : [])];
  const allFiles = [...(Array.isArray(files) ? files : []), ...(fileText ? [{ text: fileText, name: fileName || "file" }] : [])];

  const normalizedMessages = Array.isArray(messages) ? messages : [];

  if (normalizedMessages.length === 0) {
    return Response.json({ error: "Thiếu messages trong request." }, { status: 400 });
  }

  const latestUserMessage = [...normalizedMessages]
    .reverse()
    .find((message) => message.role === "user");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) =>
        controller.enqueue(encoder.encode(ssePayload(payload)));

      try {
        const userContent = latestUserMessage?.content || "";
        // Build search query from text + first file excerpt
        const searchQuery = allFiles.length > 0
          ? `${userContent} ${allFiles[0].text?.slice(0, 500) ?? ""}`
          : userContent;

        const documentResult = await searchDocumentContext(searchQuery, { useFullDocument });

        // Build enriched messages: inject files as text + images as image_url blocks
        const enrichedMessages = normalizedMessages.map((msg, idx) => {
          const isLast = idx === normalizedMessages.length - 1 && msg.role === "user";
          if (!isLast) return msg;

          // Build multipart content array for the last user message
          const contentParts = [];

          // Text part (with all document files appended)
          let textContent = msg.content || "";
          for (const f of allFiles) {
            textContent = buildUserMessageWithFile(textContent, f.text, f.name);
          }
          contentParts.push({ type: "text", text: textContent });

          // Image parts — embed directly so model sees images
          for (const imgBase64 of allImages) {
            const imageUrl = imgBase64.startsWith("data:")
              ? imgBase64
              : `data:image/jpeg;base64,${imgBase64}`;
            contentParts.push({
              type: "image_url",
              image_url: { url: imageUrl },
            });
          }

          return { ...msg, content: contentParts };
        });

        await streamClaudeCompletion({
          systemPrompt: "",
          documentContext: documentResult.context,
          imageAnalysis: null, // images now embedded directly in messages
          fileText: null,
          fileName: null,
          messages: enrichedMessages,
          onToken(token) {
            send({ type: "token", text: token });
          },
        });

        send({ type: "complete", text: "done" });
      } catch (error) {
        const isAllExhausted = error instanceof Error && error.message === "TẤT_CẢ_KEY_HẾT_POLLEN";
        send({
          type: "error",
          text: isAllExhausted
            ? "Tất cả API key đã hết Pollen (HTTP 402). Vui lòng nạp thêm tại enter.pollinations.ai hoặc thử lại sau."
            : error instanceof Error
              ? error.message
              : "Không thể xử lý yêu cầu chat.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
