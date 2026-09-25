import { useEffect, useRef, useState, type FormEvent } from "react";
import { EDIT_BLOCK_PATTERN, parseProposedEdits } from "@vinny-editor/shared";
import { chatApi } from "../api";
import { useConnection } from "../connection";
import { DiffApproval } from "./DiffApproval";

export function ChatPanel() {
  const { chatMessages } = useConnection();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isStreaming = sending || chatMessages.some((m) => m.pending);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    const content = draft;
    setDraft("");
    try {
      await chatApi.send(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="panel-title">Chat</div>
      <div className="chat-progress">{isStreaming && <div className="chat-progress-bar" />}</div>
      <div className="chat-messages" ref={listRef}>
        {chatMessages.length === 0 && <p className="muted">Ask Vinny about your code.</p>}
        {chatMessages.map((message) => {
          const edits = message.role === "assistant" ? parseProposedEdits(message.content) : [];
          const text = message.content.replace(EDIT_BLOCK_PATTERN, "").trim();
          return (
            <div key={message.id} className={`chat-message chat-message-${message.role}`}>
              <div className="chat-message-role">{message.role === "user" ? "You" : "Vinny"}</div>
              {text && <div className="chat-message-body">{text}</div>}
              {message.pending && !text && (
                <div className="chat-message-body muted">Thinking...</div>
              )}
              {edits.map((edit) => (
                <DiffApproval key={edit.path} edit={edit} />
              ))}
            </div>
          );
        })}
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Vinny..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
