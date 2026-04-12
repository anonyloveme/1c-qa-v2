"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Loader2, Paperclip, SendHorizontal, Square, X, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv", "text/markdown",
];

const ACCEPTED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".docx", ".txt", ".csv", ".md",
];

function isFileAccepted(file) {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? ACCEPTED_EXTENSIONS.includes(ext) : false;
}

// ✅ Compress ảnh trước upload để giảm vision token consumption
async function compressImage(file, maxDim = 768) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function InputBar({ isStreaming, onSend, onStop, externalFile, onExternalFileConsumed }) {
  const [text, setText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);  // multi-file
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const dragCounterRef = useRef(0);

  const MAX_FILES = 3;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [text]);

  const processFile = useCallback(async (file) => {
    if (!file) return;

    if (!isFileAccepted(file)) {
      setUploadError("Không hỗ trợ định dạng này. Chấp nhận: ảnh, docx, pdf, txt, csv, md");
      return;
    }

    if (uploadedFiles.length >= MAX_FILES) {
      setUploadError(`Tối đa ${MAX_FILES} file mỗi lần gửi.`);
      return;
    }

    let fileToUpload = file;

    if (file.type.startsWith("image/")) {
      try {
        const compressed = await compressImage(file, 768);
        if (compressed && compressed.size < file.size) {
          fileToUpload = new File([compressed], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          });
        }
      } catch { /* use original */ }
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.error || "Upload thất bại.");

      setUploadedFiles((prev) => [...prev, data]);
      setUploadError("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadedFiles]);

  // Nhận file từ global drop (ChatWindow)
  useEffect(() => {
    if (externalFile && !isUploading) {
      if (uploadedFiles.length < MAX_FILES) {
        processFile(externalFile);
      } else {
        setUploadError(`Tối đa ${MAX_FILES} file mỗi lần gửi.`);
      }
      onExternalFileConsumed?.();
    } else if (externalFile) {
      onExternalFileConsumed?.();
    }
  }, [externalFile, isUploading, uploadedFiles.length, processFile, onExternalFileConsumed]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    if (isStreaming || isUploading) return;

    // Support dropping multiple files at once (up to MAX_FILES)
    const droppedFiles = Array.from(e.dataTransfer?.files ?? []).slice(0, MAX_FILES);
    for (const file of droppedFiles) {
      processFile(file);
    }
  }, [isStreaming, isUploading, processFile]);

  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_FILES);
    for (const file of files) processFile(file);
  }

  async function handleSubmit() {
    const currentText = text;
    const currentFiles = uploadedFiles;

    if (!currentText.trim() && currentFiles.length === 0) return;

    setText("");
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await onSend({ uploadedFiles: currentFiles, text: currentText });
  }

  const handlePaste = useCallback((e) => {
    if (isStreaming || isUploading || uploadedFiles.length >= MAX_FILES) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && isFileAccepted(file)) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    }
  }, [isStreaming, isUploading, uploadedFiles.length, processFile]);

  function removeFile(index) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative rounded-2xl border bg-white p-3 transition-all duration-200"
        style={{
          borderColor: isDraggingOver ? "#2563eb" : "#e5e7eb",
          backgroundColor: isDraggingOver ? "#eff6ff" : "#ffffff",
          boxShadow: isDraggingOver
            ? "0 0 0 3px rgba(37,99,235,0.15)"
            : "0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
        }}
      >
        {isDraggingOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              backgroundColor: "rgba(239, 246, 255, 0.92)",
              border: "2px dashed #2563eb",
              pointerEvents: "none",
            }}
          >
            <Upload size={32} style={{ color: "#2563eb", marginBottom: "8px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#2563eb" }}>
              Thả file vào đây
            </p>
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              Hỗ trợ tối đa {MAX_FILES} file: ảnh, docx, pdf, txt, csv, md
            </p>
          </div>
        )}

        {uploadError ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <span className="flex-1">⚠️ {uploadError}</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 hover:bg-red-100"
              onClick={() => setUploadError("")}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        {/* Multi-file preview list */}
        {uploadedFiles.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5"
              >
                {file.type === "image" ? (
                  <img
                    alt={file.name}
                    src={`data:${file.mimeType};base64,${file.base64}`}
                    className="size-9 rounded-lg object-cover"
                    style={{ border: "1px solid #e5e7eb" }}
                  />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white text-gray-500">
                    <FileText className="size-5" />
                  </div>
                )}
                <div className="min-w-0 max-w-[120px]">
                  <p className="truncate text-xs font-medium leading-tight">{file.name}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {file.type === "image" ? "ảnh" : `${((file.charCount || 0) / 1000).toFixed(1)}k ký tự`}
                  </p>
                </div>
                <button
                  type="button"
                  className="ml-1 shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  onClick={() => removeFile(index)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {isUploading && (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Đang tải...</span>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-end gap-3">
          <Button
            variant="outline"
            size="icon"
            className="mb-0.5 size-10 shrink-0 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 md:size-11"
            disabled={isStreaming || isUploading || uploadedFiles.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            title={uploadedFiles.length >= MAX_FILES ? `Tối đa ${MAX_FILES} file` : "Đính kèm file"}
          >
            {isUploading ? <Loader2 className="size-4 animate-spin md:size-5" /> : <Paperclip className="size-4 md:size-5" />}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.docx,.pdf,.txt,.csv,.md"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={isStreaming || isUploading}
          />

          <Textarea
            ref={textareaRef}
            value={text}
            rows={1}
            className="max-h-[140px] min-h-[44px] flex-1 rounded-2xl border-gray-200 bg-white px-3 py-2.5 text-[16px] md:min-h-[48px] md:px-4 md:py-3 md:text-sm"
            placeholder="Hỏi về 1C:Enterprise..."
            disabled={isStreaming || isUploading}
            onChange={(event) => setText(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <Button
            size="icon"
            className={`mb-0.5 size-10 shrink-0 rounded-xl text-white transition-all duration-200 active:scale-95 md:size-11 ${
              isStreaming
                ? "bg-red-500 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25"
            }`}
            disabled={isUploading || (!isStreaming && !text.trim() && uploadedFiles.length === 0)}
            onClick={() => isStreaming ? onStop?.() : void handleSubmit()}
          >
            {isStreaming ? <Square className="size-4 md:size-5" fill="currentColor" /> : <SendHorizontal className="size-4 md:size-5" />}
          </Button>
        </div>

        <p className="mt-2 px-1 text-[10px] text-gray-500 md:mt-3 md:text-xs">
          <span className="md:hidden">Enter gửi · Shift+Enter xuống dòng · Tối đa {MAX_FILES} file</span>
          <span className="hidden md:inline">Enter để gửi, Shift+Enter để xuống dòng. Hỗ trợ kéo thả hoặc dán ảnh. Tối đa {MAX_FILES} file/lần.</span>
        </p>
      </div>
    </div>
  );
}