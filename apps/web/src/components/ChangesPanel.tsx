import { useState, type ReactNode } from "react";
import {
  parseProposedCommands,
  parseProposedEdits,
  parseProposedNewProjects,
  type ChatMessage,
} from "@vinny-editor/shared";
import { useConnection } from "../connection";
import { CommandApproval } from "./CommandApproval";
import { DiffApproval } from "./DiffApproval";
import { NewProjectApproval } from "./NewProjectApproval";

// In a long-running chat every edit/command Vinny has ever proposed stays in
// the message history, so without a cap this list only grows - after a long
// session it turns into dozens of collapsed cards with nothing useful to
// look at. Only the most recent ones are worth seeing by default; older
// ones are still there, just tucked behind a toggle instead of permanently
// filling the tab.
const VISIBLE_BY_DEFAULT = 12;

function collectItems(chatMessages: ChatMessage[]): ReactNode[] {
  const items: ReactNode[] = [];
  for (const message of chatMessages) {
    if (message.role !== "assistant") continue;
    for (const edit of parseProposedEdits(message.content)) {
      const id = `${message.id}-edit-${edit.path}`;
      items.push(<DiffApproval key={id} id={id} edit={edit} />);
    }
    parseProposedCommands(message.content).forEach((command, i) => {
      const id = `${message.id}-cmd-${i}`;
      items.push(
        <CommandApproval key={id} id={id} messageId={message.id} index={i} command={command} />,
      );
    });
    parseProposedNewProjects(message.content).forEach((item, i) => {
      const id = `${message.id}-newproject-${i}`;
      items.push(<NewProjectApproval key={id} id={id} item={item} />);
    });
  }
  return items;
}

export function ChangesPanel() {
  const { chatMessages } = useConnection();
  const [showAll, setShowAll] = useState(false);
  const items = collectItems(chatMessages);
  const hiddenCount = items.length - VISIBLE_BY_DEFAULT;
  const visibleItems = showAll || hiddenCount <= 0 ? items : items.slice(-VISIBLE_BY_DEFAULT);

  return (
    <div className="changes-panel">
      <div className="panel-title">Changes</div>
      {items.length === 0 ? (
        <p className="muted">Vinny hasn't proposed any edits or commands yet.</p>
      ) : (
        <>
          {!showAll && hiddenCount > 0 && (
            <button className="btn btn-small changes-show-earlier" onClick={() => setShowAll(true)}>
              Show {hiddenCount} earlier change{hiddenCount === 1 ? "" : "s"}
            </button>
          )}
          <div className="changes-list">{visibleItems}</div>
        </>
      )}
    </div>
  );
}
