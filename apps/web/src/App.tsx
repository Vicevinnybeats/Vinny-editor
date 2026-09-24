import { useServerConnection } from "./useServerConnection";

export function App() {
  const { status, settings } = useServerConnection();

  return (
    <main className="app">
      <h1>Vinny Editor</h1>
      <p>Server: {status}</p>
      {settings && <p>Model: {settings.ollamaModel}</p>}
    </main>
  );
}
