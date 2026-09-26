import type { ReactNode } from "react";
import { parseProposedCommands, parseProposedEdits, type ChatMessage } from "@vinny-editor/shared";
import { useConnection } from "../connection";
import { CommandApproval } from "./CommandApproval";
import { DiffApproval } from "./DiffApproval";

function collectItems(chatMessages: ChatMessage[]): ReactNode[] {
  const items: ReactNode[] = [];
  for (const message of chatMessages) {
    if (message.role !== "assistant") continue;
    for (const edit of parseProposedEdits(message.content)) {
      items.push(<DiffApproval key={`${message.id}-edit-${edit.path}`} edit={edit} />);
    }
    parseProposedCommands(message.content).forEach((command, i) => {
      items.push(<CommandApproval key={`${message.id}-cmd-${i}`} command={command} />);
    });
  }
  return items;
}

export function ChangesPanel() {
  const { chatMessages } = useConnection();
  const items = collectItems(chatMessages);

  return (
    <div className="changes-panel">
      <div className="panel-title">Changes</div>
      {items.length === 0 ? (
        <p className="muted">Vinny hasn't proposed any edits or commands yet.</p>
      ) : (
        <div className="changes-list">{items}</div>
      )}
    </div>
  );
}
