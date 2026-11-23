import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Crud, type FieldDef } from "../components/Crud";
import { MonthPicker } from "../components/MonthPicker";
import { Badge, EmptyState, HBars, PageHeader, Panel, Stat, Tabs } from "../components/ui";
import { useAuth } from "../lib/auth";
import { groupBy, sum, useRows, type Row } from "../lib/data";
import {
  CANAIS_MIDIA, date, firstOfMonth, integer, label, lastOfMonth, money, monthLabel, options, pct, ratio, times,
} from "../lib/format";

/* mês escolhido (AAAA-MM-01) com seletor */
function useMonth() {
  const [mes, setMes] = useState(firstOfMonth());
  const picker = (
    <MonthPicker value={mes} onChange={setMes} />
  );
  return { mes, fim: lastOfMonth(mes), picker };
}

/* ======================= EMPRESAS ======================= */
export function Companies() {
  const [params] = useSearchParams();
  const auth = useAuth();
  const fields: FieldDef[] = [
    { key: "nome", label: "Nome da empresa", required: true, list: true },
    { key: "segmento", label: "Segmento", list: true, half: true, placeholder: "Ex.: Broadcast & Cinema" },
    { key: "instagram", label: "Instagram", half: true, placeholder: "@perfil", list: true },
    { key: "site", label: "Site", type: "url", placeholder: "https://", half: true },
    { key: "logo_url", label: "Link da logo (imagem)", type: "url", half: true, help: "Opcional. Endereço de uma imagem já publicada." },
    { key: "ativa", label: "Empresa ativa", type: "checkbox", list: true, format: (v) => <Badge tone={v ? "ok" : "neutral"}>{v ? "Ativa" : "Arquivada"}</Badge> },
  ];
  return (
    <>
      <PageHeader kicker="Conta" title="Empresas" text="Cada empresa tem seus próprios dados: campanhas, agenda, orçamento, concorrentes. Para agências, cadastre uma por cliente." />
      <Crud
        table="companies" scope="account" fields={fields} order={["nome"]} newLabel="Nova empresa" defaults={{ ativa: true }} noCreate={!auth.canCreateCompany} openNew={params.get("nova") === "1"}
        empty={{ title: "Nenhuma empresa cadastrada", text: "Cadastre a sua empresa ou a de um cliente para começar." }}
        onRows={() => { void auth.reload(); }}
        rowActions={(r) => r.id === auth.company?.id
          ? <Badge tone="signal">Em uso</Badge>
          : <button className="btn btn-ghost btn-sm" onClick={() => auth.setCompanyId(r.id)}>Trabalhar nesta</button>}
      />
    </>
  );
}

/* ======================= CAMPANHAS & MÉTRICAS ======================= */
export function Campaigns() {
  const { company } = useAuth();
  const [tab, setTab] = useState<"metricas" | "campanhas">("metricas");
  const { mes, fim, picker } = useMonth();
  const camps = useRows({ table: "campaigns", select: "id,nome", eq: { company_id: company?.id }, order: ["nome"], skip: !company });
  const campOptions = camps.rows.map((c) => ({ value: c.id, label: c.nome }));
  const campName = Object.fromEntries(camps.rows.map((c) => [c.id, c.nome]));
  const canalOpts = CANAIS_MIDIA.map((c) => ({ value: c, label: c }));

  const campaignFields: FieldDef[] = [
    { key: "nome", label: "Nome da campanha", required: true, list: true },
    { key: "canal", label: "Canal principal", type: "select", options: canalOpts, half: true, list: true },
    { key: "status", label: "Status", type: "select", options: options("status_campanha"), required: true, half: true, list: true,
      format: (v) => <Badge tone={v === "ativa" ? "ok" : v === "pausada" ? "warn" : "neutral"}>{label("status_campanha", String(v))}</Badge> },
    { key: "objetivo", label: "Objetivo", placeholder: "Ex.: gerar leads para o lançamento" },
    { key: "inicio", label: "Início", type: "date", half: true, list: true },
    { key: "fim", label: "Fim", type: "date", half: true },
    { key: "verba", label: "Verba prevista (R$)", th: "Verba", type: "money", half: true, list: true },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ];
  const metricFields: FieldDef[] = [
    { key: "data", label: "Data", type: "date", required: true, half: true, list: true },
    { key: "canal", label: "Canal", type: "select", options: canalOpts, required: true, half: true, list: true },
    { key: "campaign_id", label: "Campanha", type: "select", options: campOptions, list: true, format: (v) => (v ? campName[String(v)] ?? "—" : "—") },
    { key: "investimento", label: "Investimento (R$)", th: "Investido", type: "money", half: true, list: true },
    { key: "receita", label: "Receita atribuída (R$)", th: "Receita", type: "money", half: true, list: true },
    { key: "conversoes", label: "Conversões", type: "number", half: true, list: true },
    { key: "leads", label: "Leads", type: "number", half: true },
    { key: "novos_clientes", label: "Novos clientes", type: "number", half: true },
    { key: "cliques", label: "Cliques", type: "number", half: true },
    { key: "impressoes", label: "Impressões", type: "number", half: true },
  ];

  const summary = (rows: Row[]) => {
    const inv = sum(rows, "investimento"), rec = sum(rows, "receita"), cli = sum(rows, "cliques"), imp = sum(rows, "impressoes");
    const r = ratio(rec, inv);
    return (
      <div className="stats">
        <Stat label="Investido no mês" value={money(inv)} />
        <Stat label="Receita no mês" value={money(rec)} />
        <Stat label="ROAS" value={r === null ? "—" : times(r)} />
        <Stat label="Conversões" value={integer(sum(rows, "conversoes"))} />
        <Stat label="CPC" value={cli ? money(inv / cli) : "—"} note={`${integer(cli)} cliques`} />
        <Stat label="CTR" value={imp ? pct((cli / imp) * 100) : "—"} note={`${integer(imp)} impressões`} />
      </div>
    );
  };

  return (
    <>
      <PageHeader kicker="Do dado à decisão" title="Campanhas & métricas" text="Cadastre as campanhas e lance os resultados por dia e por canal. Enquanto as integrações não chegam, é aqui que os números entram." actions={<Tabs value={tab} onChange={setTab} items={[{ value: "metricas", label: "Métricas" }, { value: "campanhas", label: "Campanhas" }]} />} />
      {tab === "metricas" ? (
        <>
          <div className="toolbar">{picker}</div>
          <Crud table="metrics" fields={metricFields} gte={["data", mes]} lte={["data", fim]} order={["data", false]} newLabel="Lançar métricas"
            defaults={{ data: new Date().toISOString().slice(0, 10) }} summary={summary}
            empty={{ title: "Nenhuma métrica neste mês", text: "Lance investimento, receita e conversões por canal para acompanhar o resultado." }} />
        </>
      ) : (
        <Crud table="campaigns" fields={campaignFields} order={["created_at", false]} newLabel="Nova campanha" defaults={{ status: "planejada" }}
          onRows={() => { void camps.reload(); }}
          empty={{ title: "Nenhuma campanha cadastrada", text: "Crie campanhas para ligar métricas e custos a cada ação." }} />
      )}
    </>
  );
}

/* ======================= ORÇAMENTOS ======================= */
export function Budgets() {
  const { mes, fim, picker } = useMonth();
  const [planned, setPlanned] = useState<Row[]>([]);
  const [spent, setSpent] = useState<Row[]>([]);
  const catOpts = options("categoria_custo");

  const byCat = useMemo(() => {
    const cats = new Set([...planned.map((r) => r.categoria), ...spent.map((r) => r.categoria)]);
    const p = groupBy(planned, "categoria"), s = groupBy(spent, "categoria");
    return [...cats].map((c) => ({ cat: c, plan: sum(p[c] ?? [], "valor_planejado"), gasto: sum(s[c] ?? [], "valor") }));
  }, [planned, spent]);
  const totalPlan = sum(planned, "valor_planejado"), totalGasto = sum(spent, "valor");
  const saldo = totalPlan - totalGasto;

  return (
    <>
      <PageHeader kicker="Planejamento" title="Orçamentos" text="Quanto o marketing tem para o mês, quanto já foi usado e em quê: mídia, eventos, ferramentas, ações internas e externas." actions={picker} />
      <div className="stats">
        <Stat label={`Planejado · ${monthLabel(mes)}`} value={money(totalPlan)} />
        <Stat label="Usado" value={money(totalGasto)} note={totalPlan ? `${pct((totalGasto / totalPlan) * 100)} do planejado` : undefined} />
        <Stat label="Saldo" value={money(saldo)} tone={saldo < 0 ? "down" : undefined} note={saldo < 0 ? "acima do planejado" : "disponível"} />
      </div>
      <Panel kicker="Planejado x usado" title="Por categoria" className="mb">
        {byCat.length ? (
          <div className="list">
            {byCat.map((c) => {
              const p = c.plan ? (c.gasto / c.plan) * 100 : c.gasto ? 100 : 0;
              return (
                <div className="list-item" key={c.cat}>
                  <div>
                    <strong>{label("categoria_custo", c.cat)}</strong>
                    <div className="progress" style={{ margin: "6px 0" }}><i className={p > 100 ? "over" : ""} style={{ width: `${Math.min(p, 100)}%` }} /></div>
                    <small>{money(c.gasto)} de {money(c.plan)}{c.plan ? ` · ${pct(p)}` : " · sem valor planejado"}</small>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title="Nada planejado neste mês" text="Cadastre a verba planejada por categoria e lance os custos conforme forem acontecendo." />}
      </Panel>
      <div className="grid-2-even" style={{ marginTop: 18 }}>
        <div className="stack">
          <Crud table="budgets" title="Verba planejada" fields={[
            { key: "categoria", label: "Categoria", type: "select", options: catOpts, required: true, list: true },
            { key: "descricao", label: "Descrição", list: true, placeholder: "Ex.: Black Friday" },
            { key: "valor_planejado", label: "Valor planejado (R$)", th: "Valor", type: "money", required: true, list: true },
          ]} eq={{ mes }} defaults={{ mes }} onRows={setPlanned} newLabel="Planejar"
            empty={{ title: "Sem verba planejada", text: "Defina quanto cada categoria pode usar no mês." }} />
        </div>
        <div className="stack">
          <Crud table="expenses" title="Custos lançados" fields={[
            { key: "data", label: "Data", type: "date", required: true, half: true, list: true },
            { key: "categoria", label: "Categoria", type: "select", options: catOpts, required: true, half: true, list: true, format: (v) => label("categoria_custo", String(v)) },
            { key: "descricao", label: "Descrição", required: true, list: true },
            { key: "valor", label: "Valor (R$)", th: "Valor", type: "money", required: true, half: true, list: true },
            { key: "responsavel", label: "Responsável", half: true },
          ]} gte={["data", mes]} lte={["data", fim]} order={["data", false]} defaults={{ data: new Date().toISOString().slice(0, 10) }} onRows={setSpent} newLabel="Lançar custo"
            empty={{ title: "Nenhum custo lançado", text: "Registre mídia, eventos, ferramentas e ações do mês." }} />
        </div>
      </div>
    </>
  );
}

/* ======================= CANAIS DE VENDA ======================= */
export function Sales() {
  const { mes, fim, picker } = useMonth();
  const [rows, setRows] = useState<Row[]>([]);
  const canais = useMemo(() => Object.entries(groupBy(rows, "canal")).map(([canal, rs]) => {
    const receita = sum(rs, "receita"), taxas = sum(rs, "taxas"), frete = sum(rs, "frete"), custo = sum(rs, "custo_produtos"), pedidos = sum(rs, "pedidos");
    const margem = receita - taxas - frete - custo;
    return { canal, receita, taxas, frete, custo, pedidos, margem };
  }).sort((a, b) => b.receita - a.receita), [rows]);
  const tot = canais.reduce((t, c) => ({ receita: t.receita + c.receita, taxas: t.taxas + c.taxas, margem: t.margem + c.margem, pedidos: t.pedidos + c.pedidos }), { receita: 0, taxas: 0, margem: 0, pedidos: 0 });

  return (
    <>
      <PageHeader kicker="Planejamento" title="Canais de venda" text="Mercado Livre, Amazon, loja oficial e outros: quanto entrou, quanto ficou nas taxas e no frete, e a margem que sobra de verdade." actions={picker} />
      <div className="stats">
        <Stat label={`Receita · ${monthLabel(mes)}`} value={money(tot.receita)} note={`${integer(tot.pedidos)} pedidos`} />
        <Stat label="Taxas e comissões" value={money(tot.taxas)} note={tot.receita ? `${pct((tot.taxas / tot.receita) * 100)} da receita` : undefined} />
        <Stat label="Margem líquida" value={money(tot.margem)} note={tot.receita ? `${pct((tot.margem / tot.receita) * 100)} da receita` : undefined} tone={tot.margem < 0 ? "down" : undefined} />
        <Stat label="Ticket médio" value={tot.pedidos ? money(tot.receita / tot.pedidos) : "—"} />
      </div>
      <div className="grid-2">
        <Panel kicker="Comparativo" title="Margem por canal">
          {canais.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Canal</th><th>Receita</th><th>Taxas</th><th>Frete</th><th>Custo</th><th>Margem</th></tr></thead>
              <tbody>{canais.map((c) => (
                <tr key={c.canal}>
                  <td data-label="Canal"><strong>{label("canal_venda", c.canal)}</strong></td>
                  <td data-label="Receita" className="num">{money(c.receita)}</td>
                  <td data-label="Taxas" className="num">{money(c.taxas)}</td>
                  <td data-label="Frete" className="num">{money(c.frete)}</td>
                  <td data-label="Custo" className="num">{money(c.custo)}</td>
                  <td data-label="Margem" className="num"><strong>{money(c.margem)}</strong> <small className="muted">{c.receita ? pct((c.margem / c.receita) * 100) : ""}</small></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState title="Nenhuma venda lançada neste mês" text="Registre o fechamento de cada canal (diário, semanal ou mensal) para comparar as margens." />}
        </Panel>
        <Panel kicker="Receita" title="Participação dos canais">
          {canais.length ? <HBars data={canais.map((c) => ({ label: label("canal_venda", c.canal), value: c.receita, sub: `${integer(c.pedidos)} pedidos` }))} format={money} />
            : <EmptyState title="Sem dados" />}
        </Panel>
      </div>
      <Crud table="sales" title="Lançamentos" fields={[
        { key: "data", label: "Data", type: "date", required: true, half: true, list: true, format: (v) => date(String(v)) },
        { key: "canal", label: "Canal", type: "select", options: options("canal_venda"), required: true, half: true, list: true },
        { key: "pedidos", label: "Pedidos", type: "number", half: true, list: true },
        { key: "receita", label: "Receita (R$)", th: "Receita", type: "money", half: true, list: true },
        { key: "taxas", label: "Taxas e comissões (R$)", th: "Taxas", type: "money", half: true, list: true },
        { key: "frete", label: "Frete (R$)", type: "money", half: true },
        { key: "custo_produtos", label: "Custo dos produtos (R$)", type: "money", half: true, help: "Opcional. Ajuda a calcular a margem real." },
      ]} gte={["data", mes]} lte={["data", fim]} order={["data", false]} defaults={{ data: new Date().toISOString().slice(0, 10) }} onRows={setRows} newLabel="Lançar vendas"
        empty={{ title: "Nenhum lançamento", text: "Lance pedidos, receita, taxas e frete de cada canal." }} />
    </>
  );
}
