"use client";

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";

import { MessageItem } from "@/components/chat/MessageItem";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";

function EmptyState({ disabled, onSuggestion }) {
  const suggestions = [
    { icon: "📚", text: "1C:Enterprise là gì? Tổng quan kiến trúc platform" },
    { icon: "🔧", text: "Hướng dẫn tạo Catalog mới trong Configuration" },
    { icon: "📊", text: "Cách viết Query Language lấy dữ liệu từ Register" },
    { icon: "🐛", text: "Debug lỗi 'Object is not found' trong 1C" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center md:px-6 md:py-16">
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "18px",
          marginBottom: "20px",
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(217,119,6,0.25)",
          animation: "floatBounce 3s ease-in-out infinite",
        }}
      >
        <Bot size={32} color="white" />
      </div>

      <h2 className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
        Xin chào! Tôi là 1C Expert
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500 md:mt-3">
        Chuyên gia 1C:Enterprise với 20 năm kinh nghiệm.
        <br className="hidden md:block" />
        Hỏi tôi về cấu hình, lập trình, debug, hoặc upload ảnh để phân tích.
      </p>

      <div className="mt-6 grid w-full grid-cols-1 gap-2.5 md:mt-8 md:gap-3 sm:grid-cols-2">
        {suggestions.map(({ icon, text }) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSuggestion(text)}
            className="group rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-left text-xs text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md hover:text-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:py-3.5 md:text-sm"
            style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0, marginTop: "1px" }}>{icon}</span>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList({ isStreaming, messages, onSuggestion, onRetry }) {
  const bottomRef = useRef(null);
  const autoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  function handleScroll(e) {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = distanceFromBottom < 80;
  }

  useEffect(() => {
    const isNewUserMessage =
      messages.length > prevMessageCountRef.current &&
      messages[messages.length - 1]?.role === "user";
    prevMessageCountRef.current = messages.length;

    if (autoScrollRef.current || isNewUserMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isStreaming]);

  // ✅ FIX: Xác định assistant cuối đang chờ stream
  const lastMsg = messages[messages.length - 1];
  const isLastAssistantEmpty =
    isStreaming &&
    lastMsg?.role === "assistant" &&
    !lastMsg?.content?.trim();

  // Ẩn assistant rỗng — TypingIndicator thay thế
  const visibleMessages = isLastAssistantEmpty
    ? messages.slice(0, -1)
    : messages;

  return (
    <ScrollArea className="flex-1 min-h-0 bg-white" onScroll={handleScroll}>
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-1 py-6 md:px-2 md:py-8">
        {messages.length === 0 ? (
          <EmptyState disabled={isStreaming} onSuggestion={onSuggestion} />
        ) : null}

        {visibleMessages.map((message) => (
          <MessageItem key={message.id} message={message} onRetry={onRetry} />
        ))}

        {isLastAssistantEmpty ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}