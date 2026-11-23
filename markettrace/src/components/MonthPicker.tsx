import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Seletor de mês: setas para andar mês a mês e uma grade com os 12 meses do ano. value = "AAAA-MM-01" */
export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m] = value.split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [ano, setAno] = useState(y);
  const box = useRef<HTMLDivElement>(null);
  const hoje = new Date();
  const set = (yy: number, mm: number) => {
    const d = new Date(yy, mm - 1, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };
  useEffect(() => { if (open) setAno(y); }, [open, y]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="mpick" ref={box}>
      <button type="button" className="mpick-arrow" onClick={() => set(y, m - 1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
      <button type="button" className="mpick-label" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <CalendarDays size={15} /> {NOMES[m - 1]} {y}
      </button>
      <button type="button" className="mpick-arrow" onClick={() => set(y, m + 1)} aria-label="Próximo mês"><ChevronRight size={16} /></button>
      {open && (
        <div className="mpick-pop" role="dialog" aria-label="Escolher mês">
          <div className="mpick-year">
            <button type="button" className="icon-btn" onClick={() => setAno(ano - 1)} aria-label="Ano anterior"><ChevronLeft size={16} /></button>
            <strong>{ano}</strong>
            <button type="button" className="icon-btn" onClick={() => setAno(ano + 1)} aria-label="Próximo ano"><ChevronRight size={16} /></button>
          </div>
          <div className="mpick-grid">
            {MESES.map((nome, i) => {
              const atual = ano === y && i + 1 === m;
              const agora = ano === hoje.getFullYear() && i === hoje.getMonth();
              return (
                <button type="button" key={nome} className={`${atual ? "active" : ""} ${agora ? "now" : ""}`} onClick={() => { set(ano, i + 1); setOpen(false); }}>{nome}</button>
              );
            })}
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={() => { set(hoje.getFullYear(), hoje.getMonth() + 1); setOpen(false); }}>Este mês</button>
        </div>
      )}
    </div>
  );
}
