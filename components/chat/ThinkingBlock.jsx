"use client";

import { useState } from "react";

export function parseThinkingFromText(rawText) {
  if (!rawText) return { thinking: null, main: "" };

  const fullMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (fullMatch) {
    const mainText = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/, "").trim();
    return { thinking: fullMatch[1].trim(), main: mainText };
  }

  const openOnly = rawText.match(/<thinking>([\s\S]*)/);
  if (openOnly) {
    return { thinking: openOnly[1].trim() + " ▌", main: "" };
  }

  return { thinking: null, main: rawText };
}

export default function ThinkingBlock({ thinkingText }) {
  const [isOpen, setIsOpen] = useState(false);
  const isStreaming = thinkingText?.endsWith("▌");

  if (!thinkingText) return null;

  return (
    <div
      style={{
        marginBottom: "14px",
        borderRadius: "10px",
        border: "1px solid #e0e7ff",
        backgroundColor: "#f5f7ff",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "9px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "15px" }}>{isStreaming ? "🔄" : "💭"}</span>

        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#4338ca",
            flex: 1,
            textAlign: "left",
          }}
        >
          {isStreaming ? "Đang suy nghĩ..." : "Quá trình suy luận"}
        </span>

        {!isStreaming && (
          <span
            style={{
              fontSize: "11px",
              color: "#818cf8",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              display: "inline-block",
            }}
          >
            ▾
          </span>
        )}
      </button>

      {(isOpen || isStreaming) && (
        <div
          style={{
            padding: "10px 16px 14px",
            borderTop: "1px solid #e0e7ff",
            fontSize: "13.5px",
            lineHeight: "1.7",
            color: "#4338ca",
            whiteSpace: "pre-wrap",
            fontStyle: "italic",
            animation: "fadeSlideIn 0.15s ease-out",
          }}
        >
          {thinkingText}
        </div>
      )}
    </div>
  );
}
