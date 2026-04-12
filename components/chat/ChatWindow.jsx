"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { Bot, Menu, PanelLeftClose, PanelLeftOpen, Upload } from "lucide-react";

import { InputBar } from "@/components/chat/InputBar";
import { MessageList } from "@/components/chat/MessageList";
import { Sidebar } from "@/components/chat/Sidebar";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "onec-qa-chat-conversations-v2"; // ✅ Đổi key version vì cấu trúc thay đổi
const MAX_AUTO_RETRY = 2;
const RETRY_DELAYS = [0, 2000, 3000];

function createConversation(title = "New Chat") {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function buildConversationTitle(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "New Chat";
  return normalized.length > 34 ? `${normalized.slice(0, 34)}...` : normalized;
}

// ✅ FIX BUG #1 + #3: Lọc sạch messages trước khi gửi API
function toApiMessages(messages) {
  const cleaned = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      if (!msg.content || !msg.content.trim() || msg.isError) continue;
    }
    cleaned.push({ role: msg.role, content: msg.content || "" });
  }
  // Đảm bảo không có 2 role giống nhau liền kề (API requirement cho một số model)
  const result = [];
  for (const msg of cleaned) {
    const prev = result[result.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content = prev.content + "\n" + msg.content;
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}

function updateConversationList(conversations, conversationId, updater) {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    const nextConversation = updater(conversation);
    return { ...nextConversation, updatedAt: Date.now() };
  });
}

// ✅ FIX BUG #11: Loại bỏ base64 image khỏi messages trước khi lưu localStorage
function sanitizeForStorage(conversations) {
  return conversations.map((conv) => ({
    ...conv,
    messages: conv.messages.map((msg) => {
      if (msg.image) {
        // Chỉ giữ flag "có ảnh", không lưu data base64
        return { ...msg, image: "[image]", _hadImage: true };
      }
      return msg;
    }),
  }));
}

export function ChatWindow() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const abortRef = useRef(null);
  const globalDragCounterRef = useRef(0);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveConversationId(parsed[0].id);
          setIsHydrated(true);
          return;
        }
      } catch { /* ignore corrupted storage */ }
    }
    const initialConversation = createConversation();
    setConversations([initialConversation]);
    setActiveConversationId(initialConversation.id);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || conversations.length === 0) return;
    try {
      const sanitized = sanitizeForStorage(conversations);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      // ✅ FIX BUG #11: Nếu localStorage đầy, xóa bớt conversations cũ
      console.warn("[Storage] Lưu thất bại, xóa bớt lịch sử cũ:", e.message);
      try {
        const trimmed = sanitizeForStorage(conversations.slice(0, 10));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [conversations, isHydrated]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null,
    [activeConversationId, conversations]
  );

  function handleNewChat() {
    if (isStreaming) return;
    const nextConversation = createConversation();
    setConversations((current) => [nextConversation, ...current]);
    setActiveConversationId(nextConversation.id);
    setMobileSidebarOpen(false);
  }

  function handleSelectConversation(conversationId) {
    setActiveConversationId(conversationId);
    setMobileSidebarOpen(false);
  }

  function handleDeleteConversation(conversationId) {
    if (isStreaming) return;
    const remaining = conversations.filter((c) => c.id !== conversationId);
    if (remaining.length === 0) {
      const newConv = createConversation();
      setConversations([newConv]);
      setActiveConversationId(newConv.id);
    } else {
      setConversations(remaining);
      if (activeConversationId === conversationId) {
        setActiveConversationId(remaining[0].id);
      }
    }
    setMobileSidebarOpen(false);
  }

  function handleSuggestedQuestion(question) {
    if (isStreaming || !activeConversation) return;
    void handleSend({ text: question, uploadedFile: null });
  }

  // ═══════════════════════════════════════════════════════════
  // GLOBAL DRAG & DROP — toàn trang
  // ═══════════════════════════════════════════════════════════
  const handleGlobalDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Chỉ hiện overlay nếu đang kéo file (không phải text selection)
    if (e.dataTransfer?.types?.includes("Files")) {
      globalDragCounterRef.current++;
      if (globalDragCounterRef.current === 1) {
        setGlobalDragOver(true);
      }
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    globalDragCounterRef.current--;
    if (globalDragCounterRef.current === 0) {
      setGlobalDragOver(false);
    }
  }, []);

  const handleGlobalDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleGlobalDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    globalDragCounterRef.current = 0;
    setGlobalDragOver(false);

    if (isStreaming) return;

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      // Truyền file xuống InputBar qua state
      setDroppedFile(file);
    }
  }, [isStreaming]);

  // Callback để InputBar gọi sau khi đã nhận file
  const handleDroppedFileConsumed = useCallback(() => {
    setDroppedFile(null);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // STREAM API CALL
  // ═══════════════════════════════════════════════════════════
  async function callStreamAPI({ requestMessages, image, fileText, fileName, assistantMessageId, conversationId, signal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: toApiMessages(requestMessages),
        image: image || null,
        fileText: fileText || null,
        fileName: fileName || null,
        useFullDocument: true,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const t = await response.text().catch(() => "");
      throw new Error(t || "SERVER_ERROR");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedTokens = false;

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const line = event.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let payload;
        try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }

        if (payload.type === "token") {
          receivedTokens = true;
          setConversations((cur) =>
            updateConversationList(cur, conversationId, (conv) => ({
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: (m.content || "") + payload.text }
                  : m
              ),
            }))
          );
        }

        if (payload.type === "error") {
          throw new Error(payload.text || "STREAM_ERROR");
        }
      }

      if (done) break;
    }

    return receivedTokens;
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ FIX BUG #4: RETRY HELPER dùng chung
  // ═══════════════════════════════════════════════════════════
  async function executeWithRetry({ baseParams, assistantMessageId, conversationId }) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_AUTO_RETRY; attempt++) {
      if (RETRY_DELAYS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }

      if (attempt > 0) {
        setConversations((cur) =>
          updateConversationList(cur, conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: "", isError: false } : m
            ),
          }))
        );
        abortRef.current?.abort();
        abortRef.current = new AbortController();
      }

      try {
        const ok = await callStreamAPI({
          ...baseParams,
          signal: abortRef.current.signal,
        });
        if (ok) return { success: true };
        lastError = new Error("EMPTY_RESPONSE");
      } catch (err) {
        if (err.name === "AbortError") {
          return { success: false, aborted: true };
        }
        lastError = err;
      }
    }

    return { success: false, aborted: false, error: lastError };
  }

  function finishStream(conversationId, assistantMessageId, result) {
    if (result.success) {
      setIsStreaming(false);
      abortRef.current = null;
      return;
    }

    const errorContent = result.aborted
      ? "Đã hủy."
      : null; // null = dùng logic kiểm tra content có sẵn

    setConversations((cur) =>
      updateConversationList(cur, conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== assistantMessageId) return m;
          if (result.aborted) {
            return { ...m, content: "Đã hủy.", isError: true };
          }
          const hasContent = m.content && m.content.trim();
          return {
            ...m,
            content: hasContent ? m.content : "Không thể kết nối AI lúc này. Bấm \"Thử lại\" bên dưới.",
            isError: !hasContent,
          };
        }),
      }))
    );
    setIsStreaming(false);
    abortRef.current = null;
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ THIẾT KẾ HOÀN CẢO: "Thử lại" = Xóa messages lỗi + Gửi lại qua handleSend
  // ═══════════════════════════════════════════════════════════
  // Nguyên tắc: "Thử lại" hoạt động GIỐNG HỆT khi user gõ lại câu hỏi
  // → Xóa cặp [user message lỗi + assistant message lỗi]
  // → Tái tạo uploadedFile từ dữ liệu user message
  // → Gọi handleSend() — dùng chung retry logic, fallback model, key rotation
  async function handleRetry(errorAssistantMessageId) {
    if (isStreaming || !activeConversation) return;

    const conv = activeConversation;
    const errorMsgIndex = conv.messages.findIndex(
      (m) => m.id === errorAssistantMessageId
    );
    if (errorMsgIndex < 0) return;

    // Tìm user message ngay trước assistant lỗi
    let userMsgIndex = -1;
    for (let i = errorMsgIndex - 1; i >= 0; i--) {
      if (conv.messages[i].role === "user") {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex < 0) return;

    const userMsg = conv.messages[userMsgIndex];

    // BƯỚC 1: Xóa cặp [user message + assistant lỗi] khỏi conversation
    // dùng flushSync để đảm bảo state đã flush trước khi handleSend đọc activeConversation
    flushSync(() => {
      setConversations((cur) =>
        updateConversationList(cur, conv.id, (c) => ({
          ...c,
          messages: c.messages.filter(
            (m) => m.id !== userMsg.id && m.id !== errorAssistantMessageId
          ),
        }))
      );
    });

    // BƯỚC 2: Tái tạo uploadedFile object từ dữ liệu user message
    let uploadedFile = null;

    if (
      userMsg.image &&
      userMsg.image !== "[image]" &&
      userMsg.image.startsWith("data:")
    ) {
      const match = userMsg.image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        uploadedFile = {
          type: "image",
          mimeType: match[1],
          base64: match[2],
        };
      }
    }

    if (!uploadedFile && userMsg.attachedFile) {
      uploadedFile = {
        type: "document",
        name: userMsg.attachedFile.name,
        charCount: userMsg.attachedFile.charCount || 0,
        text: userMsg.attachedFile.text || null,
      };
    }

    // BƯỚC 3: Gọi handleSend — state đã flush xong nhờ flushSync ở trên
    await handleSend({ text: userMsg.content || "", uploadedFile });
  }

  // ═══════════════════════════════════════════════════════════
  // GỬI TIN NHẮN MỚI
  // ═══════════════════════════════════════════════════════════
  async function handleSend({ text, uploadedFile }) {
    const trimmed = text.trim();
    if ((!trimmed && !uploadedFile) || !activeConversation) return false;

    const fallback =
      uploadedFile?.type === "image"
        ? "Phân tích ảnh 1C này giúp tôi."
        : uploadedFile?.type === "document"
          ? "Phân tích file \"" + uploadedFile.name + "\" giúp tôi."
          : "Hãy hỗ trợ tôi về 1C:Enterprise.";

    const userPrompt = trimmed || fallback;
    const conversationId = activeConversation.id;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userPrompt,
      image: uploadedFile?.type === "image"
        ? "data:" + uploadedFile.mimeType + ";base64," + uploadedFile.base64
        : null,
      attachedFile: uploadedFile?.type === "document"
        ? { name: uploadedFile.name, charCount: uploadedFile.charCount || 0 }
        : null,
      createdAt: Date.now(),
    };

    const assistantMessageId = crypto.randomUUID();
    const requestMessages = [...activeConversation.messages, userMessage];

    setConversations((cur) =>
      updateConversationList(cur, conversationId, (c) => ({
        ...c,
        title: c.messages.length === 0 ? buildConversationTitle(userPrompt) : c.title,
        messages: [
          ...c.messages,
          userMessage,
          { id: assistantMessageId, role: "assistant", content: "", createdAt: Date.now() },
        ],
      }))
    );

    setIsStreaming(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const baseParams = {
      requestMessages,
      image: uploadedFile?.type === "image" ? uploadedFile.base64 : null,
      fileText: uploadedFile?.type === "document" ? uploadedFile.text : null,
      fileName: uploadedFile?.type === "document" ? uploadedFile.name : null,
      assistantMessageId,
      conversationId,
    };

    const result = await executeWithRetry({ baseParams, assistantMessageId, conversationId });
    finishStream(conversationId, assistantMessageId, result);
    return result.success;
  }

  if (!activeConversation) return null;

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <Sidebar
        activeConversationId={activeConversation.id}
        collapsed={desktopSidebarCollapsed}
        conversations={conversations}
        isMobileOpen={mobileSidebarOpen}
        model="1C Expert AI"
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />

      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-white"
        style={{ position: "relative" }}
        onDragEnter={handleGlobalDragEnter}
        onDragLeave={handleGlobalDragLeave}
        onDragOver={handleGlobalDragOver}
        onDrop={handleGlobalDrop}
      >
        {/* ✅ Global drop overlay — phủ toàn bộ vùng chat */}
        {globalDragOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(239, 246, 255, 0.88)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              border: "3px dashed #2563eb",
              borderRadius: "0",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "20px",
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
              }}
            >
              <Upload size={32} color="white" />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1d4ed8", margin: 0 }}>
              Thả file vào đây
            </p>
            <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>
              Ảnh, docx, pdf, txt, csv, md
            </p>
          </div>
        )}

        <header className="app-header flex items-center justify-between border-b border-gray-100">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-gray-600 hover:bg-gray-100 md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-gray-600 hover:bg-gray-100 md:inline-flex"
              onClick={() => setDesktopSidebarCollapsed((current) => !current)}
            >
              {desktopSidebarCollapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 md:text-xs">
                {activeConversation.messages.length > 0
                  ? `${Math.ceil(activeConversation.messages.length / 2)} câu hỏi`
                  : "Cuộc trò chuyện mới"}
              </p>
              <h1 className="max-w-[50vw] truncate text-sm font-semibold text-gray-900 md:max-w-[32rem] md:text-base">
                {activeConversation.title}
              </h1>
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] md:gap-2 md:px-3 md:py-1.5 md:text-xs"
            style={{
              background: "linear-gradient(135deg, #eff6ff, #f0f9ff)",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              fontWeight: 500,
            }}
          >
            <Bot className="size-3.5 md:size-4" />
            <span className="hidden sm:inline">1C Expert AI via HoangAnhVnua</span>
            <span className="sm:hidden">1C Expert</span>
          </div>
        </header>

        <MessageList
          isStreaming={isStreaming}
          messages={activeConversation.messages}
          onSuggestion={handleSuggestedQuestion}
          onRetry={handleRetry}
        />

        <div className="app-footer">
          <InputBar
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={handleStop}
            externalFile={droppedFile}
            onExternalFileConsumed={handleDroppedFileConsumed}
          />
        </div>
      </main>
    </div>
  );
}
