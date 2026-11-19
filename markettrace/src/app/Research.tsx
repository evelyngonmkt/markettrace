import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Crud, type FieldDef } from "../components/Crud";
import { Badge, EmptyState, Loading, Notice, PageHeader, Panel, Stat, Tabs, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { type Row } from "../lib/data";
import { date, integer, label } from "../lib/format";
import { errorMessage, supabase } from "../lib/supabase";
import { instagramUrl } from "../lib/site";

const OBJETIVOS = ["vendas", "posicionamento", "rebranding", "estrutura", "planejamento"];
const RAMOS = ["Distribuidora audiovisual · cinema", "Equipamentos para broadcast e cinema", "Tecnologia para produção audiovisual", "Varejo especializado B2B/B2C", "E-commerce", "Serviços", "Educação", "Saúde", "Indústria", "Agência de marketing"];
type Phase = { titulo: string; foco: string };
const DEFAULT_PHASES: Record<string, Phase[]> = {
  Anual: [
    { titulo: "Fundação", foco: "diagnóstico e território" },
    { titulo: "Presença", foco: "conteúdo e autoridade" },
    { titulo: "Tração", foco: "vendas e campanhas" },
    { titulo: "Consolidação", foco: "retenção e expansão" },
  ],
  Semestral: [
    { titulo: "Direção", foco: "posicionamento e estrutura" },
    { titulo: "Movimento", foco: "presença e resultados" },
  ],
};

function BrandProfile() {
  const { company, account, canEdit } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Row>({ ramo: company?.segmento ?? "", objetivos: [], ciclo: "Anual", fases: {}, publico_alvo: "", tensao: "", conteudos: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    supabase.from("brand_profiles").select("*").eq("company_id", company.id).maybeSingle().then(({ data }) => {
      if (data) setP(data);
      else setP({ ramo: company.segmento ?? "", objetivos: [], ciclo: "Anual", fases: {}, publico_alvo: "", tensao: "", conteudos: "" });
      setLoading(false);
    });
  }, [company]);

  const phases: Phase[] = p.fases?.[p.ciclo] ?? DEFAULT_PHASES[p.ciclo];
  const setPhase = (i: number, k: keyof Phase, v: string) => {
    const next = phases.map((ph, j) => (j === i ? { ...ph, [k]: v } : ph));
    setP({ ...p, fases: { ...p.fases, [p.ciclo]: next } });
  };
  const toggle = (o: string) => setP({ ...p, objetivos: p.objetivos.includes(o) ? p.objetivos.filter((x: string) => x !== o) : [...p.objetivos, o] });
  const save = async () => {
    setError("");
    const payload = {
      account_id: account!.id, company_id: company!.id, ramo: p.ramo || null, objetivos: p.objetivos, ciclo: p.ciclo,
      fases: { ...p.fases, [p.ciclo]: phases }, publico_alvo: p.publico_alvo || null, tensao: p.tensao || null, conteudos: p.conteudos || null,
    };
    const { error: err } = await supabase.from("brand_profiles").upsert(payload, { onConflict: "company_id" });
    if (err) setError(errorMessage(err)); else toast("Contexto da marca salvo");
  };

  if (loading) return <Loading />;
  return (
    <>
      <div className="grid-2-even">
        <Panel kicker="Contexto da marca" title="O que estamos construindo?">
          <div className="form-stack">
            <label className="field"><span>Ramo de atuação</span>
              <input list="ramos" value={p.ramo ?? ""} onChange={(e) => setP({ ...p, ramo: e.target.value })} placeholder="Escolha ou escreva" disabled={!canEdit} />
              <datalist id="ramos">{RAMOS.map((r) => <option key={r} value={r} />)}</datalist>
            </label>
            <div className="field"><span>O que você busca na marca?</span>
              <div className="chips">{OBJETIVOS.map((o) => (
                <button key={o} type="button" className={`chip ${p.objetivos.includes(o) ? "active" : ""}`} onClick={() => canEdit && toggle(o)}>
                  {p.objetivos.includes(o) && <Check size={12} />} {o}
                </button>
              ))}</div>
            </div>
            <label className="field"><span>Público-alvo</span><textarea rows={2} value={p.publico_alvo ?? ""} onChange={(e) => setP({ ...p, publico_alvo: e.target.value })} placeholder="Ex.: diretores, produtoras e criadores audiovisuais" disabled={!canEdit} /></label>
            <label className="field"><span>Principal tensão do público</span><input value={p.tensao ?? ""} onChange={(e) => setP({ ...p, tensao: e.target.value })} placeholder="Ex.: encontrar tecnologia confiável para cada set" disabled={!canEdit} /></label>
            <label className="field"><span>Conteúdo que mais responde</span><input value={p.conteudos ?? ""} onChange={(e) => setP({ ...p, conteudos: e.target.value })} placeholder="Ex.: demonstrações, educação e conhecimento de set" disabled={!canEdit} /></label>
          </div>
        </Panel>
        <Panel kicker="Planejamento de marca" title="Construir com horizonte" actions={<Tabs value={p.ciclo} onChange={(v) => setP({ ...p, ciclo: v })} items={[{ value: "Anual", label: "Anual" }, { value: "Semestral", label: "Semestral" }]} />}>
          <p className="muted small" style={{ marginBottom: 12 }}>Organize a intenção em ciclos. Clique nos textos para editar cada fase.</p>
          <div className="phases">
            {phases.map((ph, i) => (
              <div className="phase" key={i}>
                <span className="data-label">{p.ciclo === "Anual" ? `Q${i + 1}` : `S${i + 1}`}</span>
                <input value={ph.titulo} onChange={(e) => setPhase(i, "titulo", e.target.value)} disabled={!canEdit} aria-label="Título da fase" />
                <textarea rows={3} value={ph.foco} onChange={(e) => setPhase(i, "foco", e.target.value)} disabled={!canEdit} aria-label="Foco da fase" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Notice tone="error">{error}</Notice>
      {canEdit && <div style={{ margin: "14px 0 26px" }}><button className="btn btn-primary" onClick={save}>Salvar contexto e planejamento</button></div>}
    </>
  );
}

export default function Research() {
  const [competitors, setCompetitors] = useState<Row[]>([]);
  const scored = competitors.filter((c) => c.agressividade != null || c.presenca != null);
  const avg = (k: string) => { const xs = competitors.filter((c) => c[k] != null); return xs.length ? xs.reduce((t, c) => t + c[k], 0) / xs.length : null; };
  const ag = avg("agressividade"), pr = avg("presenca");
  const pressure = ag !== null || pr !== null ? Math.round(((ag ?? pr ?? 0) + (pr ?? ag ?? 0)) / 2) : null;
  const threats = competitors.filter((c) => c.ameaca === "alta" || c.ameaca === "media").sort((a, b) => (a.ameaca === b.ameaca ? 0 : a.ameaca === "alta" ? -1 : 1));

  const fields: FieldDef[] = [
    { key: "nome", label: "Concorrente", required: true, list: true, format: (v, r) => <><strong>{String(v)}</strong><br /><small className="muted">{r.instagram} · {String(r.site).replace(/^https?:\/\//, "")}</small></> },
    { key: "instagram", label: "@ do Instagram", required: true, half: true, placeholder: "@perfil" },
    { key: "site", label: "Site oficial", required: true, half: true, type: "url", placeholder: "https://" },
    { key: "seguidores", label: "Seguidores", type: "number", half: true, list: true, format: (v) => (v == null ? "—" : integer(Number(v))) },
    { key: "posts_semana", label: "Posts por semana", type: "number", half: true },
    { key: "agressividade", label: "Agressividade (0 a 100)", th: "Agressividade", type: "number", min: 0, max: 100, half: true, list: true, help: "Frequência, promoções, anúncios e tom de ataque.",
      format: (v) => (v == null ? "—" : <><span className="meter"><i style={{ width: `${v}%` }} /></span>{String(v)}</>) },
    { key: "presenca", label: "Presença social (0 a 100)", th: "Presença", type: "number", min: 0, max: 100, half: true, list: true, help: "Em quantas redes está ativo e com que consistência.",
      format: (v) => (v == null ? "—" : <><span className="meter"><i style={{ width: `${v}%` }} /></span>{String(v)}</>) },
    { key: "ameaca", label: "Nível de ameaça", th: "Ameaça", type: "select", options: [{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }], half: true, list: true,
      format: (v) => (v ? <Badge tone={v === "alta" ? "bad" : v === "media" ? "warn" : "ok"}>{label("ameaca", String(v))}</Badge> : "—") },
    { key: "ultima_leitura", label: "Data da leitura", th: "Leitura", type: "date", half: true, list: true },
    { key: "canais", label: "Canais ativos", type: "tags", placeholder: "Instagram, LinkedIn, YouTube" },
    { key: "movimento", label: "Movimento recente", type: "textarea", placeholder: "O que esse concorrente fez de novo? Campanha, lançamento, mudança de tom…" },
  ];

  return (
    <>
      <PageHeader kicker="Inteligência" title="Pesquisa de mercado" text="Defina o território da marca, organize os ciclos de planejamento e acompanhe a concorrência." />
      <BrandProfile />
      <div className="stats">
        <Stat label="Pressão competitiva" value={pressure === null ? "—" : `${pressure}/100`} note={pressure === null ? "sem leitura" : pressure >= 70 ? "alta" : pressure >= 40 ? "moderada" : "baixa"} tone={pressure !== null && pressure >= 70 ? "signal" : undefined} />
        <Stat label="Agressividade média" value={ag === null ? "—" : `${Math.round(ag)}/100`} />
        <Stat label="Presença social média" value={pr === null ? "—" : `${Math.round(pr)}/100`} note={`${competitors.length} concorrente(s) no radar`} />
        <Stat label="Ameaças ativas" value={String(competitors.filter((c) => c.ameaca === "alta").length)} note="classificadas como alta" />
      </div>
      <Crud table="competitors" title="Radar de concorrentes" kicker="Mapa competitivo" fields={fields} order={["nome"]} newLabel="Adicionar concorrente" onRows={setCompetitors}
        defaults={{ ultima_leitura: new Date().toISOString().slice(0, 10) }}
        empty={{ title: "Nenhum concorrente no radar", text: "Adicione com o @ do Instagram e o site oficial. A leitura automática chega com as integrações; até lá, registre sua análise." }}
        rowActions={(r) => <a className="icon-btn" href={instagramUrl(String(r.instagram))} target="_blank" rel="noreferrer" title="Abrir Instagram">@</a>} />
      <Panel kicker="Ameaças e oportunidades" title="O que merece uma resposta?" className="mt">
        {threats.length ? (
          <div className="list">{threats.map((c) => (
            <div className="list-item" key={c.id}>
              <Badge tone={c.ameaca === "alta" ? "bad" : "warn"}>{label("ameaca", c.ameaca)}</Badge>
              <div><strong>{c.nome}</strong><small>{c.movimento || "Sem movimento registrado."} {c.ultima_leitura ? `· leitura de ${date(c.ultima_leitura)}` : ""}</small></div>
            </div>
          ))}</div>
        ) : <EmptyState title={scored.length ? "Nenhuma ameaça média ou alta" : "Nenhum sinal registrado"} text="Concorrentes classificados com ameaça média ou alta aparecem aqui, com o movimento recente." />}
      </Panel>
    </>
  );
}
