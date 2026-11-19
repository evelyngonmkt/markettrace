import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Bars, EmptyState, HBars, Loading, PageHeader, Panel, Stat, Tabs } from "../components/ui";
import { useAuth } from "../lib/auth";
import { groupBy, sum, useRows, type Row } from "../lib/data";
import { addDays, dateTime, firstOfMonth, integer, label, money, moneyShort, parseDate, pct, ratio, timeAgo, times, toISODate } from "../lib/format";

type Period = "7" | "15" | "30" | "mes";

function range(p: Period) {
  const today = new Date();
  const end = toISODate(today);
  if (p === "mes") {
    const start = firstOfMonth(today);
    const days = today.getDate();
    const prevEnd = addDays(parseDate(start), -1);
    return { start, end, prevStart: toISODate(addDays(prevEnd, -(days - 1))), prevEnd: toISODate(prevEnd), days };
  }
  const days = Number(p);
  const startD = addDays(today, -(days - 1));
  return { start: toISODate(startD), end, prevStart: toISODate(addDays(startD, -days)), prevEnd: toISODate(addDays(startD, -1)), days };
}

function delta(cur: number, prev: number, inverse = false) {
  if (!prev) return undefined;
  const d = ((cur - prev) / prev) * 100;
  const good = inverse ? d < 0 : d > 0;
  return { text: `${d > 0 ? "+" : ""}${pct(d)} vs. período anterior`, tone: (d === 0 ? undefined : good ? "up" : "down") as "up" | "down" | undefined };
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

export default function Overview() {
  const { company, profile } = useAuth();
  const [period, setPeriod] = useState<Period>("7");
  const r = useMemo(() => range(period), [period]);
  const cid = company?.id;
  const cur = useRows({ table: "metrics", eq: { company_id: cid }, gte: ["data", r.start], lte: ["data", r.end], skip: !cid });
  const prev = useRows({ table: "metrics", eq: { company_id: cid }, gte: ["data", r.prevStart], lte: ["data", r.prevEnd], skip: !cid });
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const posts = useRows({ table: "posts", eq: { company_id: cid }, gte: ["data_hora", nowIso], order: ["data_hora"], limit: 5, skip: !cid });
  const acts = useRows({ table: "activities", eq: { company_id: cid }, order: ["created_at", false], limit: 8, skip: !cid });
  const tasks = useRows({ table: "tasks", select: "id,status,prazo", eq: { company_id: cid }, skip: !cid });

  const k = (rows: Row[]) => {
    const inv = sum(rows, "investimento"), rec = sum(rows, "receita");
    return { inv, rec, conv: sum(rows, "conversoes"), leads: sum(rows, "leads"), clientes: sum(rows, "novos_clientes"), roas: ratio(rec, inv) };
  };
  const a = k(cur.rows), b = k(prev.rows);

  const daily = useMemo(() => {
    const by = groupBy(cur.rows, "data");
    return Array.from({ length: r.days }, (_, i) => {
      const d = toISODate(addDays(parseDate(r.start), i));
      return { label: d.slice(8, 10) + "/" + d.slice(5, 7), value: sum(by[d] ?? [], "receita") };
    });
  }, [cur.rows, r]);

  const channels = useMemo(() => Object.entries(groupBy(cur.rows, "canal")).map(([canal, rows]) => {
    const inv = sum(rows, "investimento"), rec = sum(rows, "receita");
    return { canal, inv, rec, roas: ratio(rec, inv) };
  }).sort((x, y) => y.rec - x.rec), [cur.rows]);

  const best = channels.filter((c) => c.roas !== null && c.inv > 0).sort((x, y) => (y.roas ?? 0) - (x.roas ?? 0))[0];
  const worst = channels.filter((c) => c.roas !== null && c.inv > 0).sort((x, y) => (x.roas ?? 0) - (y.roas ?? 0))[0];
  const today = toISODate(new Date());
  const late = tasks.rows.filter((t) => t.status !== "concluido" && t.prazo && t.prazo < today).length;
  const open = tasks.rows.filter((t) => t.status !== "concluido").length;

  let next: { title: string; text: string; to: string; cta: string };
  if (!cur.rows.length) next = { title: "Lance as primeiras métricas", text: "Com investimento e receita por canal, a visão geral passa a mostrar ROAS, evolução e onde está o melhor resultado.", to: "/app/campanhas", cta: "Lançar métricas" };
  else if (late) next = { title: `${late} tarefa(s) com prazo vencido`, text: "Reorganize prazos ou responsáveis antes que o atraso vire gargalo.", to: "/app/tarefas", cta: "Ver tarefas" };
  else if (best && worst && best.canal !== worst.canal) next = { title: `${best.canal} entregou o melhor ROAS (${times(best.roas)})`, text: `${worst.canal} ficou em ${times(worst.roas)}. Vale avaliar mover verba para onde o retorno está maior.`, to: "/app/orcamentos", cta: "Abrir orçamento" };
  else next = { title: "Agenda editorial", text: "Mantenha a próxima semana planejada para não perder ritmo nos canais.", to: "/app/agenda", cta: "Abrir agenda" };

  const loading = cur.loading || prev.loading;
  const dRec = delta(a.rec, b.rec), dInv = delta(a.inv, b.inv, true), dConv = delta(a.conv, b.conv), dRoas = a.roas && b.roas ? delta(a.roas, b.roas) : undefined;

  return (
    <>
      <PageHeader
        kicker={new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
        title={`${greeting()}, ${profile?.nome?.split(" ")[0] ?? ""}.`}
        text={`Visão de ${company?.nome}${company?.segmento ? ` · ${company.segmento}` : ""}.`}
        actions={<Tabs value={period} onChange={setPeriod} items={[{ value: "7", label: "7 dias" }, { value: "15", label: "15 dias" }, { value: "30", label: "30 dias" }, { value: "mes", label: "Este mês" }]} />}
      />

      <div className="next-action">
        <span className="dot" />
        <div><strong>{next.title}</strong><span>{next.text}</span></div>
        <Link to={next.to} className="btn btn-dark btn-sm">{next.cta}</Link>
      </div>

      {loading ? <Loading /> : (
        <div className="stats">
          <Stat label="Receita atribuída" value={money(a.rec)} note={dRec?.text ?? "no período"} tone={dRec?.tone} />
          <Stat label="Investimento em mídia" value={money(a.inv)} note={dInv?.text ?? "no período"} tone={dInv?.tone} />
          <Stat label="ROAS" value={a.roas === null ? "—" : times(a.roas)} note={dRoas?.text ?? "receita ÷ investimento"} tone={dRoas?.tone} />
          <Stat label="Conversões" value={integer(a.conv)} note={dConv?.text ?? "no período"} tone={dConv?.tone} />
          <Stat label="CPL" value={a.leads ? money(a.inv / a.leads) : "—"} note={`${integer(a.leads)} leads`} />
          <Stat label="CAC" value={a.clientes ? money(a.inv / a.clientes) : "—"} note={`${integer(a.clientes)} novos clientes`} />
        </div>
      )}

      <div className="grid-2">
        <Panel kicker="Performance" title="Receita por dia">
          {a.rec > 0 ? <Bars data={daily} format={moneyShort} /> : <EmptyState title="Sem receita lançada no período" text="Lance as métricas das campanhas para ver a evolução dia a dia." />}
        </Panel>
        <Panel kicker="Mix de canais" title="Onde o resultado acontece">
          {channels.length ? (
            <HBars data={channels.map((c) => ({ label: c.canal, value: c.rec, sub: `investido ${money(c.inv)} · ROAS ${c.roas === null ? "—" : times(c.roas)}` }))} format={money} />
          ) : <EmptyState title="Nenhum canal com dados" text="Os canais aparecem quando houver métricas no período." />}
        </Panel>
      </div>

      <div className="grid-2-even">
        <Panel kicker="Agenda editorial" title="Próximos conteúdos" actions={<Link to="/app/agenda" className="btn btn-ghost btn-sm"><Plus size={14} /> Agenda</Link>}>
          {posts.rows.length ? (
            <div className="list">{posts.rows.map((p) => (
              <div className="list-item" key={p.id}><div><strong>{p.titulo}</strong><small>{label("rede", p.rede)} · {dateTime(p.data_hora)}</small></div><span className="badge badge-neutral">{label("status_post", p.status)}</span></div>
            ))}</div>
          ) : <EmptyState title="Nenhum conteúdo agendado" text="Os próximos posts da agenda aparecem aqui." />}
        </Panel>
        <Panel kicker="Atividade recente" title="O que mudou" actions={<span className="badge badge-neutral">{open} tarefa(s) aberta(s)</span>}>
          {acts.rows.length ? (
            <div className="list">{acts.rows.map((x) => (
              <div className="list-item" key={x.id}><div><strong>{x.descricao}</strong><small>{timeAgo(x.created_at)}</small></div></div>
            ))}</div>
          ) : <EmptyState title="Nenhuma atividade ainda" text="Campanhas, posts, tarefas e custos criados aparecem aqui." />}
        </Panel>
      </div>
    </>
  );
}
