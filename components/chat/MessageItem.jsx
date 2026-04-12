"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Check, Copy, FileText, ImageIcon, RotateCcw } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ThinkingBlock, { parseThinkingFromText } from "./ThinkingBlock";

const LANGUAGE_LABELS = {
  "1c": "1C:Enterprise",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  sql: "SQL",
  json: "JSON",
  bash: "Bash",
  shell: "Shell",
  css: "CSS",
  html: "HTML",
  text: "Text",
  plaintext: "Text",
};

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const rawLang = className?.replace("language-", "") || "text";
  const label = LANGUAGE_LABELS[rawLang.toLowerCase()] || rawLang.toUpperCase();

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      style={{
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        margin: "12px 0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 14px",
          backgroundColor: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}
        >
          {label}
        </span>

        <button
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "12px",
            color: copied ? "#16a34a" : "#6b7280",
            background: copied ? "#f0fdf4" : "none",
            border: copied ? "1px solid #bbf7d0" : "1px solid transparent",
            cursor: "pointer",
            padding: "3px 10px",
            borderRadius: "6px",
            transition: "all 0.2s ease",
            fontWeight: 500,
          }}
          onMouseEnter={(e) => { if (!copied) e.currentTarget.style.backgroundColor = "#f3f4f6"; }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {copied ? (
            <>
              <Check size={13} /> Copied!
            </>
          ) : (
            <>
              <Copy size={13} /> Copy
            </>
          )}
        </button>
      </div>

      <SyntaxHighlighter
        language={rawLang === "1c" ? "javascript" : rawLang}
        style={oneLight}
        className="code-block-content"
        customStyle={{
          margin: 0,
          background: "#fafafa",
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ children, className, node, ...props }) {
          const isInline = !className && !String(children).includes("\n");
          if (isInline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        // ✅ FIX: Wrap table trong scrollable container để giữ border-radius
        table({ children, ...props }) {
          return (
            <div className="table-wrapper">
              <table {...props}>{children}</table>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MessageItem({ message, onRetry }) {
  const isUser = message.role === "user";

  // Multi-file: resolve images and attachedFiles arrays (support old single-field too)
  const images = message.images?.length
    ? message.images
    : message.image
      ? [message.image]
      : [];

  const attachedFiles = message.attachedFiles?.length
    ? message.attachedFiles
    : message.attachedFile
      ? [message.attachedFile]
      : [];

  const hadImagesStripped = message._hadImages || message._hadImage ||
    images.some((img) => img === "[image]");
  const realImages = images.filter((img) => img !== "[image]" && img.startsWith("data:"));

  return (
    <div
      className={cn("px-3 py-1.5 md:px-8 md:py-2")}
      style={{
        animation: "fadeSlideIn 0.2s ease-out",
      }}
    >

      <div
        className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "flex-row")}
        style={{ maxWidth: isUser ? "min(88%, 560px)" : "100%", marginLeft: isUser ? "auto" : 0 }}
      >
        <Avatar
          className={cn(
            "mt-0.5 shrink-0 size-7 md:size-8",
            isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
          )}
        >
          <AvatarFallback className={isUser ? "bg-blue-600 text-white text-xs font-semibold" : "bg-gray-100"}>
            {isUser ? "B" : <Bot className="size-4" />}
          </AvatarFallback>
        </Avatar>

        <div
          style={
            isUser
              ? {
                  backgroundColor: "#2563eb",
                  color: "white",
                  borderRadius: "18px 4px 18px 18px",
                  padding: "10px 16px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  maxWidth: "100%",
                  wordBreak: "break-word",
                  boxShadow: "0 1px 3px rgba(37,99,235,0.15)",
                }
              : {
                  flex: 1,
                  minWidth: 0,
                  padding: "12px 16px 12px 0",
                }
          }
        >
          {/* Show real images */}
          {realImages.map((src, i) => (
            <img
              key={i}
              alt={`Uploaded image ${i + 1}`}
              src={src}
              style={{
                display: "block",
                maxHeight: "220px",
                borderRadius: "10px",
                marginBottom: "8px",
                objectFit: "cover",
                border: isUser ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e5e7eb",
              }}
            />
          ))}

          {/* Placeholder for stripped images */}
          {realImages.length === 0 && hadImagesStripped ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                marginBottom: "6px",
                backgroundColor: isUser ? "rgba(255,255,255,0.15)" : "#f3f4f6",
                borderRadius: "8px",
                border: isUser ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e5e7eb",
                fontSize: "12px",
                color: isUser ? "rgba(255,255,255,0.8)" : "#6b7280",
              }}
            >
              <ImageIcon size={14} />
              Ảnh đã gửi (không lưu trong lịch sử)
            </div>
          ) : null}

          {isUser ? (
            <>
              {/* Attached document files */}
              {attachedFiles.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    marginBottom: "6px",
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    maxWidth: "100%",
                    overflow: "hidden",
                  }}
                >
                  <FileText size={16} style={{ flexShrink: 0, opacity: 0.9 }} />
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", opacity: 0.75 }}>
                      {((file.charCount || 0) / 1000).toFixed(1)}k ký tự
                    </p>
                  </div>
                </div>
              ))}
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content || ""}</p>
            </>
          ) : (
            <div className="chat-markdown">
              {message.isError ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      margin: 0,
                      padding: "12px 16px",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "12px",
                      color: "#dc2626",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>⚠️</span>
                    <span>{message.content}</span>
                  </div>
                  {onRetry ? (
                    <button
                      onClick={() => onRetry(message.id)}
                      style={{
                        marginTop: "10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#2563eb",
                        backgroundColor: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "10px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 1px 3px rgba(37,99,235,0.1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#dbeafe";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(37,99,235,0.15)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#eff6ff";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.1)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <RotateCcw size={14} />
                      Thử lại
                    </button>
                  ) : null}
                </div>
              ) : (
                (() => {
                  const { thinking, main } = parseThinkingFromText(message.content || "");
                  return (
                    <>
                      {thinking ? <ThinkingBlock thinkingText={thinking} /> : null}
                      <MarkdownMessage content={main} />
                    </>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
