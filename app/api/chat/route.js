import { searchDocumentContext } from "@/services/document";
import { streamClaudeCompletion, buildUserMessageWithFile } from "@/services/claude";
import { analyzeImage } from "@/services/vision";
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
    image = null,
    fileText = null,
    fileName = null,
    useFullDocument = false,
  } = await request.json();

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
        // Tạo search query: ưu tiên nội dung file nếu có
        const userContent = latestUserMessage?.content || "";
        const searchQuery = fileText
          ? `${userContent} ${fileText.slice(0, 500)}`
          : userContent;

        // ✅ FIX: Truyền useFullDocument từ client đúng cách
        const [imageAnalysis, documentResult] = await Promise.all([
          image
            ? analyzeImage(image).catch((err) => {
                console.error("[Chat] Vision failed:", err.message);
                return "Không thể phân tích ảnh. Bạn đã upload một ảnh screenshot 1C nhưng hệ thống không đọc được. Vui lòng mô tả nội dung ảnh.";
              })
            : Promise.resolve(""),
          searchDocumentContext(searchQuery, { useFullDocument }),
        ]);

        // Inject file vào tin nhắn user
        const enrichedMessages = normalizedMessages.map((msg, idx) => {
          const isLast = idx === normalizedMessages.length - 1 && msg.role === "user";
          if (isLast && fileText) {
            return { ...msg, content: buildUserMessageWithFile(msg.content, fileText, fileName) };
          }
          return msg;
        });

        await streamClaudeCompletion({
          systemPrompt: "",
          documentContext: documentResult.context,
          imageAnalysis,
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
