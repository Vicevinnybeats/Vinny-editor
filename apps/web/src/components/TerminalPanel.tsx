import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { useConnection } from "../connection";

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalInitialBuffer, subscribeTerminalOutput, sendTerminalInput, sendTerminalResize } =
    useConnection();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      theme: {
        background: "#12141c",
        foreground: "#e6e6ef",
        cursor: "#7c6cf6",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    if (terminalInitialBuffer) term.write(terminalInitialBuffer);
    fitAddon.fit();
    sendTerminalResize(term.cols, term.rows);

    const unsubscribe = subscribeTerminalOutput((data) => term.write(data));
    const dataDisposable = term.onData((data) => sendTerminalInput(data));

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendTerminalResize(term.cols, term.rows);
    });
    resizeObserver.observe(container);

    return () => {
      unsubscribe();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [sendTerminalInput, sendTerminalResize, subscribeTerminalOutput, terminalInitialBuffer]);

  return <div className="terminal-panel" ref={containerRef} />;
}
