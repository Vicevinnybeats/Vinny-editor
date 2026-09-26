import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  EDIT_BLOCK_PATTERN,
  RUN_BLOCK_PATTERN,
  parseProposedCommands,
  parseProposedEdits,
} from "@vinny-editor/shared";
import { chatApi } from "../api";
import { useConnection } from "../connection";
import { CommandApproval } from "./CommandApproval";
import { DiffApproval } from "./DiffApproval";

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return undefined;
    }
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

/** Keeps the chat scrolled to the bottom as content grows - including growth
 * that happens after the fact, like a diff card's Monaco editor finishing its
 * async load and expanding taller. Stops following once the user scrolls up
 * to read something, and resumes once they scroll back near the bottom. */
function useStickToBottom(containerRef: RefObject<HTMLDivElement | null>) {
  const innerRef = useRef<HTMLDivElement>(null);
  const stuckRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return undefined;

    function scrollToBottomIfStuck() {
      if (stuckRef.current) container!.scrollTop = container!.scrollHeight;
    }

    function handleScroll() {
      const distance = container!.scrollHeight - container!.scrollTop - container!.clientHeight;
      stuckRef.current = distance < STICK_TO_BOTTOM_THRESHOLD_PX;
    }

    container.addEventListener("scroll", handleScroll);
    const observer = new ResizeObserver(scrollToBottomIfStuck);
    observer.observe(inner);
    scrollToBottomIfStuck();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [containerRef]);

  return innerRef;
}

export function ChatPanel() {
  const { chatMessages } = useConnection();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useStickToBottom(listRef);
  const isStreaming = sending || chatMessages.some((m) => m.pending);
  const elapsed = useElapsedSeconds(isStreaming);

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
      {isStreaming && (
        <div className="chat-status">
          <span className="spinner" />
          Generating... {elapsed}s
        </div>
      )}
      <div className="chat-messages" ref={listRef}>
        <div className="chat-messages-inner" ref={innerRef}>
          {chatMessages.length === 0 && <p className="muted">Ask Vinny about your code.</p>}
          {chatMessages.map((message) => {
            const edits = message.role === "assistant" ? parseProposedEdits(message.content) : [];
            const commands =
              message.role === "assistant" ? parseProposedCommands(message.content) : [];
            const text = message.content
              .replace(EDIT_BLOCK_PATTERN, "")
              .replace(RUN_BLOCK_PATTERN, "")
              .trim();
            return (
              <div key={message.id} className={`chat-message chat-message-${message.role}`}>
                <div className="chat-message-role">{message.role === "user" ? "You" : "Vinny"}</div>
                {text && <div className="chat-message-body">{text}</div>}
                {message.pending && !text && (
                  <div className="chat-message-body muted">
                    <span className="spinner" /> Thinking...
                  </div>
                )}
                {edits.map((edit) => (
                  <DiffApproval key={edit.path} edit={edit} />
                ))}
                {commands.map((command, i) => (
                  <CommandApproval key={`${command.command}-${i}`} command={command} />
                ))}
              </div>
            );
          })}
        </div>
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
