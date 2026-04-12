"use client";

import { useState } from "react";
import { Bot, MessageSquarePlus, SquareTerminal, Trash2, X } from "lucide-react";

function ConversationButton({ active, conversation, onDelete, onClick }) {
  const [hovered, setHovered] = useState(false);
  const updatedAt = new Date(conversation.updatedAt).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });

  return (
    <div
      style={{ position: "relative", marginBottom: "2px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 32px 10px 12px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          transition: "background-color 0.2s ease",
          backgroundColor: active ? "#252540" : hovered ? "#1f1f38" : "transparent",
          borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent",
        }}
      >
        <p style={{
          fontSize: "13px",
          fontWeight: active ? 600 : 500,
          margin: 0,
          color: active ? "#ffffff" : "#b0b0cc",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          transition: "color 0.15s",
        }}>
          {conversation.title}
        </p>
        <p style={{ fontSize: "11px", color: active ? "#8888bb" : "#5555aa", marginTop: "3px", marginBottom: 0 }}>
          {updatedAt}
        </p>
      </button>

      {(hovered || active) && (
        <button
          type="button"
          aria-label="Xóa cuộc trò chuyện"
          onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
          style={{
            position: "absolute",
            right: "6px",
            top: "50%",
            transform: "translateY(-50%)",
            padding: "5px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6666aa",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.15s, background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ff8080";
            e.currentTarget.style.backgroundColor = "rgba(255,80,80,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#6666aa";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function SidebarContent({ activeConversationId, conversations, model, onDeleteConversation, onNewChat, onSelectConversation }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <SquareTerminal size={16} color="white" />
        </div>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
            1C Enterprise QA
          </p>
          <p style={{ fontSize: "11px", color: "#6666aa", margin: 0 }}>
            AI Assistant
          </p>
        </div>
      </div>

      {/* New Chat button */}
      <div style={{ padding: "0 12px 14px", flexShrink: 0 }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.3)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <MessageSquarePlus size={15} />
          New Chat
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#2d2d4e", margin: "0 12px", flexShrink: 0 }} />

      {/* Conversation list - scroll ben trong */}
      <div
        className="sidebar-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}
      >
        {conversations.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#555580", textAlign: "center", marginTop: "20px" }}>
            Chưa có cuộc trò chuyện nào
          </p>
        ) : (
          conversations.map((conversation) => (
            <ConversationButton
              key={conversation.id}
              active={conversation.id === activeConversationId}
              conversation={conversation}
              onDelete={onDeleteConversation}
              onClick={() => onSelectConversation(conversation.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #2d2d4e",
          padding: "14px 16px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1f1f38"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bot size={13} color="white" />
        </div>
        <div>
          <p style={{ fontSize: "11px", color: "#6666aa", margin: 0 }}>Powered by</p>
          <p style={{ fontSize: "12px", color: "#a0a0cc", margin: 0, fontWeight: 500 }}>HoangAnhVnua</p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ activeConversationId, collapsed, conversations, isMobileOpen, model, onCloseMobile, onDeleteConversation, onNewChat, onSelectConversation }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          height: "100dvh", flexShrink: 0,
          backgroundColor: "#1a1a2e",
          borderRight: "1px solid #2d2d4e",
          width: collapsed ? "0px" : "260px",
          overflow: "hidden",
          transition: "width 0.25s ease",
        }}
      >
        <SidebarContent
          activeConversationId={activeConversationId}
          conversations={conversations}
          model={model}
          onDeleteConversation={onDeleteConversation}
          onNewChat={onNewChat}
          onSelectConversation={onSelectConversation}
        />
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} className="md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            className="sidebar-overlay-in"
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.45)",
              border: "none", cursor: "pointer",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            onClick={onCloseMobile}
          />
          {/* Panel */}
          <aside
            className="sidebar-slide-in mobile-safe-top"
            style={{
              position: "relative", zIndex: 10,
              height: "100%", width: "min(82vw, 300px)",
              backgroundColor: "#1a1a2e",
              borderRight: "1px solid #2d2d4e",
              display: "flex", flexDirection: "column",
              boxShadow: "4px 0 24px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "flex-end",
              padding: "10px 12px 0", flexShrink: 0,
            }}>
              <button
                onClick={onCloseMobile}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#6666aa", padding: "6px",
                  borderRadius: "8px", transition: "background 0.15s",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent
              activeConversationId={activeConversationId}
              conversations={conversations}
              model={model}
              onDeleteConversation={onDeleteConversation}
              onNewChat={onNewChat}
              onSelectConversation={onSelectConversation}
            />
          </aside>
        </div>
      )}
    </>
  );
}
