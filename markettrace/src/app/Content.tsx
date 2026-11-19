import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarPlus, ChevronLeft, ChevronRight, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { Crud, FormModal, type FieldDef } from "../components/Crud";
import { Badge, EmptyState, Loading, PageHeader, Panel, Tabs, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { addDays, date, dateTime, integer, label, options, toISODate } from "../lib/format";
import { errorMessage, supabase } from "../lib/supabase";

const FORMATOS = ["Reels", "Carrossel", "Post estático", "Stories", "Vídeo", "Artigo", "Live", "Newsletter", "Outro"].map((f) => ({ value: f, label: f }));

/* ======================= AGENDA EDITORIAL ======================= */
const postFields: FieldDef[] = [
  { key: "titulo", label: "Título / tema", required: true },
  { key: "rede", label: "Rede", type: "select", options: options("rede"), required: true, half: true },
  { key: "formato", label: "Formato", type: "select", options: FORMATOS, half: true },
  { key: "data_hora", label: "Data e hora", type: "datetime", half: true },
  { key: "status", label: "Status", type: "select", options: options("status_post"), required: true, half: true },
  { key: "legenda", label: "Legenda / roteiro", type: "textarea" },
  { key: "link", label: "Link do post publicado", type: "url" },
  { key: "alcance", label: "Alcance", type: "number", half: true, help: "Preencha depois de publicado." },
  { key: "engajamento", label: "Engajamento (interações)", type: "number", half: true },
  { key: "salvamentos", label: "Salvamentos", type: "number", half: true },
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function monday(d: Date) { const day = d.getDay(); return addDays(d, day === 0 ? -6 : 1 - day); }

export function Agenda() {
  const { company, account, canEdit } = useAuth();
  const toast = useToast();
  const [start, setStart] = useState(() => monday(new Date()));
  const [editing, setEditing] = useState<Row | null>(null);
  const end = addDays(start, 7);
  const week = useRows({ table: "posts", eq: { company_id: company?.id }, gte: ["data_hora", start.toISOString()], lte: ["data_hora", end.toISOString()], order: ["data_hora"], skip: !company });
  const undated = useRows({ table: "posts", eq: { company_id: company?.id, data_hora: null }, order: ["created_at", false], skip: !company });
  const published = useRows({ table: "posts", eq: { company_id: company?.id, status: "publicado" }, order: ["engajamento", false], skip: !company });

  const reloadAll = async () => { await Promise.all([week.reload(), undated.reload(), published.reload()]); };
  const save = async (values: Row) => {
    const res = editing?.id
      ? await supabase.from("posts").update(values).eq("id", editing.id)
      : await supabase.from("posts").insert({ ...values, account_id: account!.id, company_id: company!.id });
    if (res.error) throw res.error;
    toast(editing?.id ? "Conteúdo atualizado" : "Conteúdo adicionado à agenda");
    await reloadAll();
  };
  const remove = async () => {
    if (!editing?.id || !window.confirm("Apagar este conteúdo?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", editing.id);
    if (error) toast(errorMessage(error), "error"); else { toast("Conteúdo apagado"); setEditing(null); await reloadAll(); }
  };

  // melhores horários: média de engajamento por dia da semana + hora, a partir dos posts publicados
  const slots = useMemo(() => {
    const m = new Map<string, { total: number; n: number; dow: number; h: number }>();
    for (const p of published.rows) {
      if (!p.data_hora || p.engajamento == null) continue;
      const d = new Date(p.data_hora); const key = `${d.getDay()}-${d.getHours()}`;
      const cur = m.get(key) ?? { total: 0, n: 0, dow: d.getDay(), h: d.getHours() };
      cur.total += Number(p.engajamento); cur.n += 1; m.set(key, cur);
    }
    return [...m.values()].map((s) => ({ ...s, avg: s.total / s.n })).sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [published.rows]);
  const ranked = published.rows.filter((p) => p.engajamento != null).slice(0, 8);
  const today = toISODate(new Date());

  return (
    <>
      <PageHeader kicker="Planejamento" title="Agenda editorial" text="Planeje a semana por rede social e acompanhe cada conteúdo da ideia à publicação."
        actions={<>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(monday(new Date()))}>Hoje</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(start, 7))} aria-label="Próxima semana"><ChevronRight size={16} /></button>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing({ status: "rascunho", rede: "instagram" })}><Plus size={15} /> Novo conteúdo</button>}
        </>} />
      <p className="muted small" style={{ marginBottom: 10 }}>{date(toISODate(start))} a {date(toISODate(addDays(start, 6)))}</p>
      {week.loading ? <Loading /> : (
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i); const iso = toISODate(d);
            const items = week.rows.filter((p) => toISODate(new Date(p.data_hora)) === iso);
            return (
              <div className={`day ${iso === today ? "day-today" : ""}`} key={iso}>
                <div className="day-head"><span>{WEEKDAYS[d.getDay()]}</span><span>{d.getDate()}</span></div>
                {items.map((p) => (
                  <button key={p.id} className="post-chip" onClick={() => setEditing(p)}>
                    <strong>{p.titulo}</strong>
                    <small>{new Date(p.data_hora).toTimeString().slice(0, 5)} · {label("rede", p.rede)} · {label("status_post", p.status)}</small>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid-2-even" style={{ marginTop: 18 }}>
        <Panel kicker="Ranking de posts" title="O que mais engajou">
          {ranked.length ? (
            <div className="list">{ranked.map((p, i) => (
              <div className="list-item" key={p.id}>
                <span className="data-label">{String(i + 1).padStart(2, "0")}</span>
                <div><strong>{p.titulo}</strong><small>{label("rede", p.rede)} · {dateTime(p.data_hora)}</small></div>
                <span className="num">{integer(p.engajamento)}</span>
              </div>
            ))}</div>
          ) : <EmptyState title="Nenhum post medido ainda" text="Marque os conteúdos como publicados e preencha o engajamento para montar o ranking." />}
        </Panel>
        <Panel kicker="Melhores horários" title="Quando seu público mais responde">
          {slots.length >= 1 && published.rows.length >= 3 ? (
            <div className="list">{slots.map((s) => (
              <div className="list-item" key={`${s.dow}-${s.h}`}>
                <div><strong>{WEEKDAYS[s.dow]} · {String(s.h).padStart(2, "0")}h</strong><small>{s.n} post(s) publicados nesse horário</small></div>
                <span className="num">{integer(s.avg)} interações em média</span>
              </div>
            ))}</div>
          ) : <EmptyState title="Ainda sem histórico suficiente" text="Com pelo menos 3 posts publicados e com engajamento preenchido, os horários com melhor resposta aparecem aqui." />}
        </Panel>
      </div>

      {undated.rows.length > 0 && (
        <Panel kicker="Sem data" title="Conteúdos aguardando data" className="mt">
          <div className="list">{undated.rows.map((p) => (
            <div className="list-item" key={p.id}><div><strong>{p.titulo}</strong><small>{label("rede", p.rede)} · {label("status_post", p.status)}</small></div>
              {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Definir data</button>}</div>
          ))}</div>
        </Panel>
      )}

      {editing && (
        <FormModal title={editing.id ? "Editar conteúdo" : "Novo conteúdo"} fields={postFields} initial={editing} onSubmit={save} onClose={() => setEditing(null)}
          onDelete={editing.id && canEdit ? remove : undefined} />
      )}
    </>
  );
}

/* ======================= ROTINAS & TAREFAS ======================= */
const COLUMNS = [
  { key: "a_fazer", label: "A fazer" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluido", label: "Concluído" },
];
const taskFields: FieldDef[] = [
  { key: "titulo", label: "Tarefa", required: true },
  { key: "descricao", label: "Detalhes", type: "textarea" },
  { key: "responsavel", label: "Responsável", half: true },
  { key: "prazo", label: "Prazo", type: "date", half: true },
  { key: "etiqueta", label: "Etiqueta", half: true, placeholder: "Ex.: Mídia paga, Evento, Conteúdo" },
  { key: "status", label: "Coluna", type: "select", options: options("status_tarefa"), required: true, half: true },
];

export function Tasks() {
  const { company, account, canEdit } = useAuth();
  const toast = useToast();
  const { rows, loading, reload, setRows } = useRows({ table: "tasks", eq: { company_id: company?.id }, order: ["created_at"], skip: !company });
  const [editing, setEditing] = useState<Row | null>(null);
  const today = toISODate(new Date());

  const save = async (values: Row) => {
    const res = editing?.id
      ? await supabase.from("tasks").update(values).eq("id", editing.id)
      : await supabase.from("tasks").insert({ ...values, account_id: account!.id, company_id: company!.id });
    if (res.error) throw res.error;
    toast(editing?.id ? "Tarefa atualizada" : "Tarefa criada");
    await reload();
  };
  const move = async (t: Row, dir: -1 | 1) => {
    const idx = COLUMNS.findIndex((c) => c.key === t.status) + dir;
    const status = COLUMNS[idx]?.key; if (!status) return;
    setRows(rows.map((r) => (r.id === t.id ? { ...r, status } : r)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) { toast(errorMessage(error), "error"); await reload(); }
  };
  const remove = async (t: Row) => {
    if (!window.confirm(`Apagar a tarefa “${t.titulo}”?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) toast(errorMessage(error), "error"); else { toast("Tarefa apagada"); await reload(); }
  };

  return (
    <>
      <PageHeader kicker="Planejamento" title="Rotinas & tarefas" text="Do briefing à análise: cada rotina com responsável, prazo e próximo passo." />
      {loading ? <Loading /> : (
        <div className="board">
          {COLUMNS.map((col, ci) => {
            const items = rows.filter((t) => t.status === col.key);
            return (
              <section className="column" key={col.key}>
                <div className="column-head">
                  <h2>{col.label} <small className="muted">· {items.length}</small></h2>
                  {canEdit && <button className="icon-btn" title="Nova tarefa" onClick={() => setEditing({ status: col.key })}><Plus size={17} /></button>}
                </div>
                {items.length === 0 && <EmptyState title="Vazio" />}
                {items.map((t) => (
                  <article className="card" key={t.id}>
                    {t.etiqueta && <Badge tone="info">{t.etiqueta}</Badge>}
                    <strong>{t.titulo}</strong>
                    {t.descricao && <p>{t.descricao}</p>}
                    <div className="card-foot">
                      <span style={{ color: t.prazo && t.prazo < today && t.status !== "concluido" ? "var(--bad)" : undefined }}>
                        {t.prazo ? `Prazo ${date(t.prazo)}` : "Sem prazo"}{t.responsavel ? ` · ${t.responsavel}` : ""}
                      </span>
                      {canEdit && (
                        <span className="card-actions">
                          {ci > 0 && <button className="icon-btn" title="Voltar coluna" onClick={() => move(t, -1)}><ArrowLeft size={15} /></button>}
                          {ci < COLUMNS.length - 1 && <button className="icon-btn" title="Avançar coluna" onClick={() => move(t, 1)}><ArrowRight size={15} /></button>}
                          <button className="icon-btn" title="Editar" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                          <button className="icon-btn danger" title="Apagar" onClick={() => remove(t)}><Trash2 size={14} /></button>
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 14 }}>Sincronização com o Google Agenda: em desenvolvimento.</p>
      {editing && <FormModal title={editing.id ? "Editar tarefa" : "Nova tarefa"} fields={taskFields} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ======================= ESTÚDIO CRIATIVO ======================= */
export function Studio() {
  const { company, account, canEdit } = useAuth();
  const toast = useToast();
  const [publico, setPublico] = useState<"todas" | "B2B" | "B2C">("todas");
  const fields: FieldDef[] = [
    { key: "titulo", label: "Ideia", required: true, list: true },
    { key: "publico", label: "Público", type: "select", options: [{ value: "B2B", label: "B2B" }, { value: "B2C", label: "B2C" }], required: true, half: true, list: true, format: (v) => <Badge tone="info">{String(v)}</Badge> },
    { key: "formato", label: "Formato", type: "select", options: FORMATOS, half: true, list: true },
    { key: "canal", label: "Canal", type: "select", options: options("rede"), half: true, list: true },
    { key: "status", label: "Status", type: "select", options: options("status_ideia"), required: true, half: true, list: true,
      format: (v) => <Badge tone={v === "aprovada" ? "ok" : v === "descartada" ? "neutral" : v === "em_briefing" ? "warn" : "signal"}>{label("status_ideia", String(v))}</Badge> },
    { key: "objetivo", label: "Objetivo", placeholder: "Ex.: autoridade, conversa, conversão" },
    { key: "motivo", label: "Por que agora?", type: "textarea", placeholder: "O assunto está em alta? Responde a uma dúvida do público? Casa com uma campanha?" },
  ];
  const toTask = async (r: Row) => {
    const { error } = await supabase.from("tasks").insert({ account_id: account!.id, company_id: company!.id, titulo: `Briefing: ${r.titulo}`, descricao: r.motivo, etiqueta: "Conteúdo", status: "a_fazer" });
    if (error) return toast(errorMessage(error), "error");
    await supabase.from("ideas").update({ status: "em_briefing" }).eq("id", r.id);
    toast("Tarefa de briefing criada em Rotinas & tarefas");
  };
  const toPost = async (r: Row) => {
    const { error } = await supabase.from("posts").insert({ account_id: account!.id, company_id: company!.id, titulo: r.titulo, rede: r.canal || "instagram", formato: r.formato, status: "ideia" });
    if (error) toast(errorMessage(error), "error"); else toast("Ideia enviada para a Agenda (sem data)");
  };
  return (
    <>
      <PageHeader kicker="Inteligência" title="Estúdio criativo" text="Banco de ideias de conteúdo para B2B e B2C. Anote o que está sendo comentado, o que casa com o público e com o objetivo da marca."
        actions={<Tabs value={publico} onChange={setPublico} items={[{ value: "todas", label: "Todas" }, { value: "B2B", label: "B2B" }, { value: "B2C", label: "B2C" }]} />} />
      <Crud table="ideas" fields={fields} eq={{ publico: publico === "todas" ? undefined : publico }} newLabel="Nova ideia" defaults={{ status: "nova", publico: publico === "B2C" ? "B2C" : "B2B" }}
        empty={{ title: "Nenhuma ideia ainda", text: "Anote ideias de conteúdo com público, formato e motivo. Depois transforme em briefing ou mande para a agenda." }}
        rowActions={(r) => canEdit ? <>
          <button className="icon-btn" title="Criar tarefa de briefing" onClick={() => toTask(r)}><ListTodo size={15} /></button>
          <button className="icon-btn" title="Mandar para a agenda" onClick={() => toPost(r)}><CalendarPlus size={15} /></button>
        </> : null} />
      <p className="muted small" style={{ marginTop: 14 }}>Sugestões automáticas a partir de tendências e redes conectadas: em desenvolvimento, junto com as integrações.</p>
    </>
  );
}
