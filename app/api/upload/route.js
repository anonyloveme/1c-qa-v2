import { getAcceptedMimeTypes, parseFile } from "@/services/fileParser";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request) {
  try {
    const { allowed, retryAfter } = checkRateLimit(request);
    if (!allowed) {
      return Response.json(
        { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "Không có file" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "File quá lớn, tối đa 10MB" }, { status: 400 });
    }

    const acceptedTypes = getAcceptedMimeTypes();
    const acceptedExtensions = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "docx", "txt", "csv", "md"];
    const fileName = file.name.toLowerCase();
    const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
    const isAccepted = acceptedTypes.includes(file.type) || Boolean(extension && acceptedExtensions.includes(extension));

    if (!isAccepted) {
      return Response.json({ error: `Định dạng không hỗ trợ: ${file.type || file.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buffer, file.type || "", file.name);

    return Response.json({
      success: true,
      type: parsed.type,
      name: parsed.name,
      ...(parsed.type === "document"
        ? { text: parsed.text, charCount: parsed.text.length }
        : { base64: parsed.base64, mimeType: parsed.mimeType }),
    });
  } catch (err) {
    console.error("[/api/upload]", err instanceof Error ? err.message : err);
    return Response.json({ error: err instanceof Error ? err.message : "Upload thất bại" }, { status: 500 });
  }
}
