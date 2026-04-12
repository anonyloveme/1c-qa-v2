"use client";

import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-3 py-1.5 md:px-8 md:py-2" style={{ animation: "fadeSlideIn 0.2s ease-out" }}>
      <Avatar className="mt-0.5 shrink-0 size-7 bg-gray-100 text-gray-600 border border-gray-200 md:size-8">
        <AvatarFallback className="bg-gray-100">
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          borderRadius: "14px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span className="size-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.32s]" />
          <span className="size-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.16s]" />
          <span className="size-2 animate-bounce rounded-full bg-blue-400" />
        </div>
        <span style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500 }}>
          Đang trả lời...
        </span>
      </div>
    </div>
  );
}
