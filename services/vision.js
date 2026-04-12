import { extractAssistantText } from "@/services/claude";
import { callWithBalancer } from "@/services/pollinationsBalancer";

// openai = GPT-5.4 (free, vision OK, 400k context)
// gemini = Gemini Flash (free, vision OK, 1M context)
// claude-fast = Claude (free, vision OK, 200k context)
const VISION_MODELS = ["openai", "gemini", "claude-fast"];

function normalizeImageInput(image) {
  if (!image) return null;
  // Nếu đã là data URL → giữ nguyên
  if (image.startsWith("data:")) return image;
  // Nếu là URL http → dùng trực tiếp
  if (image.startsWith("http")) return image;
  // Còn lại → coi là raw base64
  return `data:image/jpeg;base64,${image}`;
}

export async function analyzeImage(image) {
  const imageUrl = normalizeImageInput(image);
  if (!imageUrl) return "";

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Bạn là chuyên gia 1C:Enterprise. Phân tích ảnh screenshot 1C này:
1. Mô tả ngắn gọn nội dung màn hình (form, report, error dialog...)
2. Liệt kê các trường/field quan trọng và giá trị nếu thấy
3. Nếu có lỗi: đọc chính xác thông báo lỗi
4. Suy đoán user đang cố làm gì
Trả lời bằng tiếng Việt, tối đa 300 từ.`,
        },
        {
          type: "image_url",
          image_url: { url: imageUrl },
        },
      ],
    },
  ];

  for (const model of VISION_MODELS) {
    try {
      console.log(`[Vision] 🖼️ Thử model: ${model}`);

      const response = await callWithBalancer(messages, "", {
        stream: false,
        maxTokens: 600,
        temperature: 0.15,
        model,
        timeoutMs: 55000, // Vision cần thời gian dài hơn text thông thường
        skipEmptyCheck: true,
      });

      const json = await response.json();
      const result = extractAssistantText(json);

      if (result && result.trim().length > 10) {
        console.log(`[Vision] ✅ Thành công: ${model} (${result.length} chars)`);
        return result;
      }

      console.warn(`[Vision] ⚠️ Model ${model} trả về rỗng/quá ngắn`);
    } catch (err) {
      console.warn(`[Vision] ❌ Model ${model}: ${err.message}`);
      continue;
    }
  }

  return "Không thể phân tích ảnh lúc này. Vui lòng mô tả nội dung ảnh bằng text để tôi hỗ trợ.";
}
