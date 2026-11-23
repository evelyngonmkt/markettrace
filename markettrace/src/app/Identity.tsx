import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Search, Trash2 } from "lucide-react";
import { ColorField } from "../components/ColorField";
import { Badge, EmptyState, Notice, PageHeader, Panel, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { BRAND_DEFAULT, brandVars, contrastReport, FONT_CATS, FONTS, fontStack, loadFonts, TEXT_CATS, type FontCat } from "../lib/brand";
import { errorMessage, supabase } from "../lib/supabase";
import { initials } from "./Layout";

type Draft = { cor_destaque: string | null; cor_apoio: string | null; fonte_titulos: string | null; fonte_texto: string | null; usar_identidade: boolean; logo_url: string | null };

function FontPicker({ label, value, fallback, cats, onChange, disabled }: {
  label: string; value: string | null; fallback: string; cats: FontCat[]; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const current = value || fallback;
  const list = FONTS.filter((f) => cats.includes(f.cat) && f.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="field font-picker">
      <span>{label}: <strong style={{ fontFamily: fontStack(current), color: "var(--text)" }}>{current}</strong>{!value && <small> (padrão)</small>}</span>
      <div className="font-search"><Search size={14} /><input placeholder="Buscar fonte…" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} aria-label={`Buscar ${label.toLowerCase()}`} /></div>
      <div className="font-list" role="listbox" aria-label={label}>
        {cats.map((cat) => {
          const items = list.filter((f) => f.cat === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <span className="data-label font-cat">{cat}{cat === "Manuscrita" ? " · melhor em títulos curtos" : ""}</span>
              {items.map((f) => (
                <button type="button" key={f.name} role="option" aria-selected={current === f.name} disabled={disabled}
                  className={`font-item ${current === f.name ? "active" : ""}`} onClick={() => onChange(f.name === fallback ? null : f.name)}>
                  <span style={{ fontFamily: fontStack(f.name, f.cat) }}>Aa</span>
                  <span style={{ fontFamily: fontStack(f.name, f.cat) }}>{f.name}</span>
                  {current === f.name && <Check size={15} />}
                </button>
              ))}
            </div>
          );
        })}
        {!list.length && <p className="muted small" style={{ padding: 10 }}>Nenhuma fonte com esse nome.</p>}
      </div>
    </div>
  );
}

export default function Identity() {
  const { company, account, canEdit, reload } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = (): Draft => ({
    cor_destaque: company?.cor_destaque ?? null, cor_apoio: company?.cor_apoio ?? null,
    fonte_titulos: company?.fonte_titulos ?? null, fonte_texto: company?.fonte_texto ?? null,
    usar_identidade: company?.usar_identidade ?? true, logo_url: company?.logo_url ?? null,
  });
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setD(initial()); setError(""); }, [company?.id]);
  // carrega todas as fontes para mostrar a lista já desenhada em cada uma
  useEffect(() => { loadFonts(FONTS.map((f) => f.name)); }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const vars = useMemo(() => brandVars(d), [d]);
  const report = useMemo(() => contrastReport(d), [d]);
  const changed = JSON.stringify(d) !== JSON.stringify(initial());

  if (!company || !account) return <EmptyState title="Selecione uma empresa" text="A identidade visual é definida por empresa." />;

  const uploadLogo = async (file: File) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setError("Envie a logo em PNG, JPG, WEBP ou SVG.");
    if (file.size > 2 * 1024 * 1024) return setError("A logo pode ter no máximo 2 MB.");
    setUploading(true); setError("");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${account.id}/${company.id}/logo-${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage.from("midias").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (err) return setError(errorMessage(err));
    set("logo_url", supabase.storage.from("midias").getPublicUrl(path).data.publicUrl);
  };

  const save = async () => {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("companies").update(d).eq("id", company.id);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    toast("Identidade visual salva");
    await reload();
  };
  const restore = () => setD({ cor_destaque: null, cor_apoio: null, fonte_titulos: null, fonte_texto: null, usar_identidade: true, logo_url: d.logo_url });

  return (
    <>
      <PageHeader kicker="Conta" title="Identidade visual"
        text={`Logo, cores e fontes da ${company.nome}. Quando esta empresa está selecionada, o app inteiro passa a usar essa identidade. Os tons de texto são ajustados sozinhos para manter a leitura.`}
        actions={canEdit && <>
          <button className="btn btn-ghost btn-sm" onClick={restore} disabled={busy}>Voltar ao padrão MarketTrace</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !changed}>{busy ? "Salvando…" : "Salvar identidade"}</button>
        </>} />
      {!canEdit && <Notice>Você tem acesso de leitura: só editores e o dono(a) da conta mudam a identidade.</Notice>}
      <Notice tone="error">{error}</Notice>

      <div className="identity-grid">
        <div className="stack">
          <Panel title="Logo">
            <div className="logo-row">
              <div className="logo-box">{d.logo_url ? <img src={d.logo_url} alt={`Logo ${company.nome}`} /> : <span>{initials(company.nome)}</span>}</div>
              <div className="stack" style={{ gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading}><ImagePlus size={14} /> {uploading ? "Enviando…" : d.logo_url ? "Trocar logo" : "Enviar logo"}</button>
                  {d.logo_url && <button className="btn btn-ghost btn-sm" onClick={() => set("logo_url", null)} disabled={!canEdit}><Trash2 size={14} /> Remover</button>}
                </div>
                <small className="muted">PNG, JPG, WEBP ou SVG, até 2 MB. De preferência com fundo transparente.</small>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />
              </div>
            </div>
          </Panel>

          <Panel title="Cores">
            <div className="stack">
              <ColorField label="Cor de destaque" help="Botões, itens ativos e números em evidência." value={d.cor_destaque} fallback={BRAND_DEFAULT.destaque} onChange={(v) => set("cor_destaque", v)} disabled={!canEdit} />
              <ColorField label="Cor de apoio" help="Títulos pequenos, ícones e detalhes." value={d.cor_apoio} fallback={BRAND_DEFAULT.apoio} onChange={(v) => set("cor_apoio", v)} disabled={!canEdit} />
            </div>
          </Panel>

          <Panel title="Fontes">
            <div className="font-grid">
              <FontPicker label="Títulos" value={d.fonte_titulos} fallback={BRAND_DEFAULT.titulos} cats={FONT_CATS} onChange={(v) => set("fonte_titulos", v)} disabled={!canEdit} />
              <FontPicker label="Texto" value={d.fonte_texto} fallback={BRAND_DEFAULT.texto} cats={TEXT_CATS} onChange={(v) => set("fonte_texto", v)} disabled={!canEdit} />
            </div>
            <small className="muted">Manuscritas e fontes de impacto ficam só para os títulos, para o texto continuar fácil de ler.</small>
          </Panel>

          <label className="check"><input type="checkbox" checked={d.usar_identidade} disabled={!canEdit} onChange={(e) => set("usar_identidade", e.target.checked)} /> Aplicar esta identidade no app quando a {company.nome} estiver selecionada</label>
        </div>

        <div className="identity-preview-wrap">
          <span className="data-label">Pré-visualização</span>
          <div className="identity-preview" style={vars as React.CSSProperties}>
            <div className="ip-head">
              <div className="logo-box sm">{d.logo_url ? <img src={d.logo_url} alt="" /> : <span>{initials(company.nome)}</span>}</div>
              <strong>{company.nome}</strong>
            </div>
            <span className="ip-kicker">Campanhas & métricas</span>
            <h2 className="ip-title">Resultado do mês</h2>
            <p className="ip-text">O ROAS subiu e o custo por lead caiu. Veja quais campanhas puxaram o resultado.</p>
            <div className="ip-bars" aria-hidden="true">
              {[38, 55, 47, 72, 64, 90].map((h, i) => <i key={i} className={i === 5 ? "hi" : ""} style={{ height: `${h}%` }} />)}
            </div>
            <div className="ip-row">
              <span className="ip-number">4,8x</span>
              <span className="ip-badge">Em destaque</span>
            </div>
            <div className="ip-row"><button type="button" className="ip-btn">Criar campanha</button><button type="button" className="ip-btn ghost">Ver relatório</button></div>
            <p className="muted small" style={{ marginTop: 10 }}>Valores ilustrativos, só para mostrar as cores e fontes.</p>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            <div className="list-item"><div><strong>Texto do botão</strong><small>Contraste {report.botao.toFixed(1)}:1 (mínimo 4,5)</small></div><Badge tone={report.botao >= 4.5 ? "ok" : "warn"}>{report.botao >= 4.5 ? "Boa leitura" : "Leitura difícil"}</Badge></div>
            {report.botao < 4.5 && <p className="muted small">Dica: escureça ou clareie um pouco a cor de destaque para o texto dos botões ficar mais fácil de ler. Dá para salvar assim mesmo.</p>}
            <div className="list-item"><div><strong>Textos em destaque</strong><small>{report.ajustado ? "Tom ajustado automaticamente para ler bem no fundo claro e no escuro" : "A cor já tem bom contraste"}</small></div><Badge tone="ok">Boa leitura</Badge></div>
          </div>
        </div>
      </div>
    </>
  );
}
