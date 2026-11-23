import { useEffect, useState } from "react";
import { Pipette, RotateCcw } from "lucide-react";
import { hexToRgb, isHex, normalizeColor, rgbToHex } from "../lib/brand";

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** Seletor de cor: painel de cores do sistema, conta-gotas, código HEX e valores RGB */
export function ColorField({ label, help, value, fallback, onChange, disabled }: {
  label: string; help?: string; value: string | null; fallback: string; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  const color = isHex(value) ? value.toUpperCase() : fallback;
  const [hex, setHex] = useState(color);
  const [msg, setMsg] = useState("");
  useEffect(() => setHex(color), [color]);
  const [r, g, b] = hexToRgb(color);
  const Dropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  const pickFromScreen = async () => {
    if (!Dropper) return;
    setMsg("");
    try {
      const res = await new Dropper().open();
      const c = normalizeColor(res.sRGBHex);
      if (c) onChange(c);
    } catch { /* a pessoa apertou Esc */ }
  };
  const commitHex = () => {
    const c = normalizeColor(hex);
    if (c) { onChange(c); setMsg(""); } else { setHex(color); setMsg("Código inválido. Use o formato #RRGGBB, por exemplo #A866FF."); }
  };
  const setChannel = (i: 0 | 1 | 2, v: string) => {
    const n = Math.max(0, Math.min(255, Number(v) || 0));
    const rgb: [number, number, number] = [r, g, b];
    rgb[i] = n;
    onChange(rgbToHex(...rgb));
  };

  return (
    <div className="field color-field">
      <span>{label}</span>
      <div className="color-row">
        <label className="color-swatch" style={{ background: color }} title="Abrir o painel de cores">
          <input type="color" value={color.toLowerCase()} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label}: painel de cores`} />
        </label>
        <div className="color-inputs">
          <div className="color-hex">
            <span className="data-label">HEX</span>
            <input value={hex} disabled={disabled} maxLength={7} spellCheck={false} onChange={(e) => setHex(e.target.value)} onBlur={commitHex}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitHex(); } }} aria-label={`${label}: código HEX`} />
          </div>
          {(["R", "G", "B"] as const).map((ch, i) => (
            <div className="color-ch" key={ch}>
              <span className="data-label">{ch}</span>
              <input type="number" min={0} max={255} value={[r, g, b][i]} disabled={disabled} onChange={(e) => setChannel(i as 0 | 1 | 2, e.target.value)} aria-label={`${label}: ${ch}`} />
            </div>
          ))}
        </div>
        <div className="color-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={pickFromScreen} disabled={disabled || !Dropper}
            title={Dropper ? "Clique e escolha qualquer cor da tela" : "O conta-gotas funciona no Chrome e no Edge do computador. Use o painel de cores ou o código."}>
            <Pipette size={14} /> Conta-gotas
          </button>
          {value && <button type="button" className="icon-btn" title="Voltar para a cor padrão" onClick={() => onChange(null)} disabled={disabled}><RotateCcw size={15} /></button>}
        </div>
      </div>
      {help && <small className="muted">{help}</small>}
      {!Dropper && <small className="muted">O conta-gotas funciona no Chrome e no Edge do computador. Nos outros navegadores, use o painel de cores ou digite o código.</small>}
      {msg && <small style={{ color: "var(--bad)" }}>{msg}</small>}
    </div>
  );
}
