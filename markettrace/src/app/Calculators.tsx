import { useState } from "react";
import { PageHeader, Panel } from "../components/ui";
import { decimal, money, pct, times } from "../lib/format";

type Input = { key: string; label: string; unit?: "R$" | "%" | "" };
type Calc = {
  key: string; name: string; full: string; inputs: Input[]; formula: string; about: string;
  compute: (v: Record<string, number>) => { value: string; read?: string } | null;
};

const CALCS: Calc[] = [
  { key: "roi", name: "ROI", full: "Retorno sobre investimento",
    inputs: [{ key: "receita", label: "Receita gerada", unit: "R$" }, { key: "invest", label: "Investimento total", unit: "R$" }],
    formula: "(receita − investimento) ÷ investimento × 100",
    about: "Mostra quanto voltou de lucro para cada real investido. Use o custo total da ação, não só a mídia.",
    compute: (v) => (v.invest ? { value: pct(((v.receita - v.invest) / v.invest) * 100), read: v.receita >= v.invest ? `Cada R$ 1 investido voltou R$ ${decimal(v.receita / v.invest)}.` : "A ação ainda não se pagou." } : null) },
  { key: "roas", name: "ROAS", full: "Retorno sobre investimento em anúncios",
    inputs: [{ key: "receita", label: "Receita atribuída aos anúncios", unit: "R$" }, { key: "invest", label: "Investimento em mídia", unit: "R$" }],
    formula: "receita atribuída ÷ investimento em mídia",
    about: "Indica quantos reais de receita cada real de mídia trouxe. Compare com o ROAS mínimo que paga sua margem.",
    compute: (v) => (v.invest ? { value: times(v.receita / v.invest), read: `R$ ${decimal(v.receita / v.invest)} de receita para cada R$ 1 em mídia.` } : null) },
  { key: "cac", name: "CAC", full: "Custo de aquisição de cliente",
    inputs: [{ key: "invest", label: "Investimento em marketing e vendas", unit: "R$" }, { key: "clientes", label: "Novos clientes no período" }],
    formula: "investimento total ÷ novos clientes",
    about: "Quanto custa, em média, conquistar um cliente novo. Compare sempre com o LTV.",
    compute: (v) => (v.clientes ? { value: money(v.invest / v.clientes) } : null) },
  { key: "ltv", name: "LTV", full: "Valor do cliente ao longo do tempo",
    inputs: [{ key: "ticket", label: "Ticket médio", unit: "R$" }, { key: "freq", label: "Compras por mês (média)" }, { key: "meses", label: "Tempo de relacionamento (meses)" }, { key: "margem", label: "Margem bruta", unit: "%" }],
    formula: "ticket médio × compras por mês × meses × margem",
    about: "Quanto um cliente deixa de margem durante todo o relacionamento. Um LTV pelo menos 3× maior que o CAC é um bom sinal.",
    compute: (v) => {
      const bruto = v.ticket * v.freq * v.meses;
      if (!bruto) return null;
      const m = v.margem ? bruto * (v.margem / 100) : bruto;
      return { value: money(m), read: v.margem ? `Receita total do cliente: ${money(bruto)}.` : "Sem margem informada: valor considera a receita total." };
    } },
  { key: "mer", name: "MER", full: "Eficiência de marketing (receita total ÷ mídia total)",
    inputs: [{ key: "receita", label: "Receita total do negócio no período", unit: "R$" }, { key: "invest", label: "Investimento total em marketing", unit: "R$" }],
    formula: "receita total ÷ investimento total em marketing",
    about: "Olha o negócio inteiro, sem depender de atribuição por canal. Bom para conferir se o ROAS dos canais conversa com o caixa.",
    compute: (v) => (v.invest ? { value: times(v.receita / v.invest) } : null) },
  { key: "cpl", name: "CPL", full: "Custo por lead",
    inputs: [{ key: "invest", label: "Investimento na campanha", unit: "R$" }, { key: "leads", label: "Leads gerados" }],
    formula: "investimento ÷ leads",
    about: "Quanto custou cada contato interessado. Olhe junto com a taxa de conversão de lead em cliente.",
    compute: (v) => (v.leads ? { value: money(v.invest / v.leads) } : null) },
  { key: "conv", name: "Conversão", full: "Taxa de conversão",
    inputs: [{ key: "conv", label: "Conversões (vendas, cadastros…)" }, { key: "base", label: "Visitantes, cliques ou leads" }],
    formula: "conversões ÷ base × 100",
    about: "Que parte das pessoas fez a ação desejada. Defina bem a base (visitas, cliques ou leads) para comparar períodos.",
    compute: (v) => (v.base ? { value: pct((v.conv / v.base) * 100) } : null) },
  { key: "markup", name: "Markup", full: "Preço de venda com taxas e margem (bom para marketplace)",
    inputs: [{ key: "custo", label: "Custo do produto", unit: "R$" }, { key: "taxas", label: "Taxas do canal (comissão, tarifa)", unit: "%" }, { key: "impostos", label: "Impostos", unit: "%" }, { key: "margem", label: "Margem desejada", unit: "%" }],
    formula: "preço = custo ÷ (1 − (taxas + impostos + margem))",
    about: "Calcula o preço que cobre a comissão do marketplace, os impostos e ainda deixa a margem desejada.",
    compute: (v) => {
      const soma = (v.taxas + v.impostos + v.margem) / 100;
      if (!v.custo || soma >= 1) return soma >= 1 ? { value: "—", read: "Taxas + impostos + margem precisam somar menos de 100%." } : null;
      const preco = v.custo / (1 - soma);
      return { value: money(preco), read: `Markup multiplicador: ${times(preco / v.custo)} sobre o custo.` };
    } },
  { key: "cpc", name: "CPC", full: "Custo por clique",
    inputs: [{ key: "invest", label: "Investimento", unit: "R$" }, { key: "cliques", label: "Cliques" }],
    formula: "investimento ÷ cliques",
    about: "Quanto cada clique custou. Um CPC subindo pode indicar criativo cansado ou público disputado.",
    compute: (v) => (v.cliques ? { value: money(v.invest / v.cliques) } : null) },
  { key: "churn", name: "Churn", full: "Taxa de cancelamento",
    inputs: [{ key: "perdidos", label: "Clientes perdidos no período" }, { key: "inicio", label: "Clientes no início do período" }],
    formula: "clientes perdidos ÷ clientes no início × 100",
    about: "Que parte da base foi embora. Para assinaturas, reduzir o churn costuma valer mais que aumentar a aquisição.",
    compute: (v) => (v.inicio ? { value: pct((v.perdidos / v.inicio) * 100) } : null) },
];

export default function Calculators() {
  const [active, setActive] = useState(CALCS[0].key);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const calc = CALCS.find((c) => c.key === active)!;
  const cur = vals[calc.key] ?? {};
  const nums = Object.fromEntries(calc.inputs.map((i) => [i.key, Number(String(cur[i.key] ?? "").replace(",", ".")) || 0]));
  const result = calc.compute(nums);
  const set = (k: string, v: string) => setVals({ ...vals, [calc.key]: { ...cur, [k]: v } });

  return (
    <>
      <PageHeader kicker="Do dado à decisão" title="Calculadoras" text="Os indicadores que todo marketing precisa, com a fórmula ao lado do resultado." />
      <div className="calc-layout">
        <nav className="calc-menu" aria-label="Indicadores">
          {CALCS.map((c) => (
            <button key={c.key} className={c.key === active ? "active" : ""} onClick={() => setActive(c.key)}>
              {c.name} <small>{c.full.split(" ")[0].toLowerCase()}</small>
            </button>
          ))}
        </nav>
        <Panel kicker={calc.full} title={calc.name}>
          <div className="form-grid">
            {calc.inputs.map((i) => (
              <label className="field half" key={i.key}>
                <span>{i.label}{i.unit ? ` (${i.unit})` : ""}</span>
                <input type="number" inputMode="decimal" step="any" value={cur[i.key] ?? ""} onChange={(e) => set(i.key, e.target.value)} placeholder="0" />
              </label>
            ))}
          </div>
          <div className="calc-result">
            <span className="data-label">Resultado</span>
            <strong>{result?.value ?? "—"}</strong>
            <p>{result?.read ?? "Preencha os campos acima para calcular."}</p>
          </div>
          <span className="formula">{calc.formula}</span>
          <p className="muted" style={{ marginTop: 12 }}>{calc.about}</p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setVals({ ...vals, [calc.key]: {} })}>Limpar valores</button>
        </Panel>
      </div>
    </>
  );
}
