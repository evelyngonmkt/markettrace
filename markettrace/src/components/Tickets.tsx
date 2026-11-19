import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { dateTime } from "../lib/format";
import { errorMessage, supabase } from "../lib/supabase";
import { Loading, Notice } from "./ui";

/** Conversa de um chamado de suporte (usada pelo cliente e pela admin) */
export function TicketThread({ ticket, onChange }: { ticket: Row; onChange?: () => void }) {
  const { profile } = useAuth();
  const { rows, loading, reload } = useRows({ table: "ticket_messages", select: "*, profiles(nome)", eq: { ticket_id: ticket.id }, order: ["created_at"] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [rows.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, mensagem: text.trim() });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setText("");
    await reload();
    onChange?.();
  };

  return (
    <div>
      {loading ? <Loading /> : (
        <div className="thread">
          {rows.length === 0 && <p className="muted small">Nenhuma mensagem ainda.</p>}
          {rows.map((m) => (
            <div key={m.id} className={`msg ${m.do_admin ? "msg-admin" : ""} ${m.autor_id === profile?.id ? "msg-mine" : ""}`}>
              <p>{m.mensagem}</p>
              <small>{m.do_admin ? "Equipe MarketTrace" : m.profiles?.nome ?? "Cliente"} · {dateTime(m.created_at)}</small>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
      {ticket.status !== "fechado" ? (
        <form className="reply" onSubmit={send}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua mensagem…" rows={2} aria-label="Mensagem" />
          <button className="btn btn-primary" disabled={busy || !text.trim()}><Send size={15} /> Enviar</button>
        </form>
      ) : <p className="muted small">Chamado fechado.</p>}
      <Notice tone="error">{error}</Notice>
    </div>
  );
}
