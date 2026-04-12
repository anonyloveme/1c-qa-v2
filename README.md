# 1C Enterprise QA Chatbot

Ứng dụng chatbot tra cứu tài liệu 1C:Enterprise với giao diện kiểu AI demo chat, backend App Router của Next.js, Claude qua Pollinations.ai, và document retrieval từ Supabase.

## Stack

- Next.js App Router, JavaScript only
- shadcn/ui + Tailwind CSS
- Pollinations.ai Unified API với model `claude-airforce`
- Supabase bảng `chunks`
- Streaming SSE tự triển khai tại `POST /api/chat`

## Environment Variables

Tạo file `.env.local`:

```bash
POLLINATIONS_SK=sk_xxxx
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyxxxx
```

## Cài đặt

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## AI Pipeline

1. Vision step: nếu người dùng upload ảnh, server gửi ảnh base64 lên Pollinations để phân tích screenshot 1C.
2. Document search: server truy vấn Supabase bảng `chunks`, ưu tiên RPC `search_chunks`, fallback sang full-text search hoặc `ilike`.
3. Claude answer: server stream phản hồi từ Pollinations theo chuẩn SSE.

## API

`POST /api/chat`

Request body:

```json
{
	"messages": [{ "role": "user", "content": "câu hỏi" }],
	"image": "base64_string_or_null",
	"useFullDocument": true
}
```

Response stream:

```text
data: {"type":"token","text":"..."}
data: {"type":"complete","text":"done"}
data: {"type":"error","text":"..."}
```

## Deploy Render

- Build command: `npm install ; npm run build`
- Start command: `npm run start`
- Thêm đầy đủ biến môi trường trong Render dashboard

## Lưu ý

- `POLLINATIONS_SK` chỉ được dùng ở server-side.
- App không dùng Vercel AI SDK.
- Nếu RPC `search_chunks` khác tên tham số trong database của bạn, cần chỉnh lại trong `services/document.js`.
