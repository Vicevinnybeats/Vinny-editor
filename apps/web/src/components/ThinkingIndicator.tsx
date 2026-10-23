import { useEffect, useState } from "react";

const WORDS = [
  "Thinking",
  "Cogitating",
  "Pondering",
  "Noodling",
  "Percolating",
  "Synthesizing",
  "Untangling",
  "Reticulating splines",
  "Marinating",
  "Connecting the dots",
];

const WORD_INTERVAL_MS = 1800;

export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), WORD_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="thinking-indicator">
      <span className="thinking-logo">V</span>
      <span className="thinking-word" key={index}>
        {WORDS[index]}...
      </span>
    </div>
  );
}
