import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";

/* ---------- Marca ---------- */
export function Mark({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  // símbolo MarketTrace: três barras ligadas pelo M, a última perna faz a curva e termina no ponto (Sinal)
  return (
    <svg width={size} height={size * 0.8} viewBox="4 10 61 44" aria-hidden="true">
      <path className="mark-m" pathLength={1} d="M12 48V17l14 14 14-14v21q0 10 8 10" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="mark-dot" cx="58.5" cy="48" r="4.5" fill="var(--sinal)" />
    </svg>
  );
}

export function Logo({ size = 26, light = false }: { size?: number; light?: boolean }) {
  const color = light ? "var(--papel)" : "var(--tinta)";
  return (
    <span className="logo" style={{ color, fontSize: size * 0.92 }}>
      <Mark size={size} color={color} />
      <span className="logo-word">markettrace<span className="logo-dot">.</span></span>
    </span>
  );
}

/* ---------- Estrutura de página ---------- */
export function PageHeader({ kicker, title, text, actions }: { kicker?: string; title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {kicker && <span className="kicker">{kicker}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, kicker, actions, children, className = "" }: { title?: string; kicker?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>{kicker && <span className="kicker">{kicker}</span>}{title && <h2>{title}</h2>}</div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg width="56" height="22" viewBox="0 0 56 22" aria-hidden="true"><path d="M2 11h34q8 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="50" cy="19" r="3" fill="var(--sinal)" /></svg>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "up" | "down" | "signal" }) {
  return (
    <div className={`stat ${tone === "signal" ? "stat-signal" : ""}`}>
      <span className="data-label">{label}</span>
      <strong>{value}</strong>
      {note && <small className={tone === "up" ? "up" : tone === "down" ? "down" : ""}>{note}</small>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "signal" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Loading({ text = "Carregando…" }: { text?: string }) {
  return <div className="loading"><Loader2 size={18} className="spin" /> {text}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "ok" | "warn" }) {
  if (!children) return null;
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string }> }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} className={value === i.value ? "active" : ""} onClick={() => onChange(i.value)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Janela (modal) ---------- */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Gráfico de barras simples (SVG) ---------- */
export function Bars({ data, format = (v) => String(v), highlightMax = true, height = 180 }: {
  data: Array<{ label: string; value: number }>; format?: (v: number) => string; highlightMax?: boolean; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max === 0) return null;
  const maxIndex = data.findIndex((d) => d.value === max);
  const step = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d, i) => (
        <div className="bar-col" key={d.label + i} title={`${d.label}: ${format(d.value)}`}>
          <div className={`bar ${highlightMax && i === maxIndex ? "bar-max" : ""}`} style={{ height: `${(d.value / max) * 100}%` }}>
            {highlightMax && i === maxIndex && <span className="bar-tip">{format(d.value)}</span>}
          </div>
          <span className="bar-label">{i % step === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** barras horizontais para comparar categorias */
export function HBars({ data, format = (v) => String(v) }: { data: Array<{ label: string; value: number; sub?: string }>; format?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max === 0) return null;
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar" key={d.label}>
          <div className="hbar-top"><span>{d.label}</span><strong>{format(d.value)}</strong></div>
          <div className="hbar-track"><i style={{ width: `${(d.value / max) * 100}%`, background: SERIES[i % SERIES.length] }} /></div>
          {d.sub && <small>{d.sub}</small>}
        </div>
      ))}
    </div>
  );
}
// ordem das séries em gráficos, conforme o manual: Tinta, Maré, Cinza-musgo, Pólen
export const SERIES = ["var(--tinta)", "var(--mare)", "var(--musgo)", "var(--polen)"];

/* ---------- Avisos rápidos (toast) ---------- */
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.tone === "ok" ? <Check size={15} /> : <X size={15} />}{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
