"use client";

import { useEffect, useRef, useState } from "react";

type Source = {
  chunkIndex: number;
  page: number | null;
  content: string;
  similarity: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type Props = {
  documentId: string;
  filename: string;
};

export default function Chat({ documentId, filename }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function send() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, question: q, history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur chat");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "delta") {
              setMessages((m) => {
                const copy = m.slice();
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + evt.text,
                };
                return copy;
              });
            } else if (evt.type === "sources") {
              setMessages((m) => {
                const copy = m.slice();
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, sources: evt.sources };
                return copy;
              });
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch {
            /* skip malformed SSE payloads */
          }
        }
      }
    } catch (err) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Erreur : ${err instanceof Error ? err.message : "inconnue"}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="flex h-[80vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Discuter avec {filename}
        </h2>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Pose une question sur ce document. Les réponses sont générées par
              Claude à partir des passages les plus pertinents trouvés dans le
              document — jamais depuis ses connaissances externes.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Exemples : « Quel est le point principal ? », « Y a-t-il une date
              limite mentionnée ? »
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {m.content || (streaming ? "…" : "")}
              </p>
              {m.sources && m.sources.length > 0 && (
                <details className="mt-3 border-t border-slate-300/60 pt-2 text-xs">
                  <summary className="cursor-pointer text-slate-600">
                    {m.sources.length} source
                    {m.sources.length > 1 ? "s" : ""} citée
                    {m.sources.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {m.sources.map((s) => (
                      <li
                        key={s.chunkIndex}
                        className="rounded-lg bg-white/70 p-2"
                      >
                        <p className="font-medium text-slate-700">
                          {s.page ? `Page ${s.page}` : `Chunk ${s.chunkIndex}`}{" "}
                          <span className="text-slate-500">
                            · similarité {(s.similarity * 100).toFixed(0)}%
                          </span>
                        </p>
                        <p className="mt-1 text-slate-600">
                          {s.content.slice(0, 240)}
                          {s.content.length > 240 && "…"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pose une question sur le document…"
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {streaming ? "…" : "Envoyer"}
          </button>
        </div>
      </div>
    </section>
  );
}
