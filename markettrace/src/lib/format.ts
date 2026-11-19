const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pt-BR");
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (v: number | null | undefined) => brl.format(Number(v || 0));
export const moneyShort = (v: number | null | undefined) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${dec.format(n / 1_000_000)} mi`;
  if (Math.abs(n) >= 10_000) return `R$ ${dec.format(n / 1000)} mil`;
  return brlShort.format(n);
};
export const integer = (v: number | null | undefined) => num.format(Math.round(Number(v || 0)));
export const decimal = (v: number | null | undefined) => dec.format(Number(v || 0));
export const pct = (v: number | null | undefined) => `${dec.format(Number(v || 0))}%`;
export const times = (v: number | null | undefined) => `${dec.format(Number(v || 0))}×`;

/** divisão segura: devolve null quando o divisor é zero */
export const ratio = (a: number, b: number) => (b ? a / b : null);

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const date = (s?: string | null) =>
  s ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(s.length <= 10 ? parseDate(s) : new Date(s)) : "—";
export const dateTime = (s?: string | null) =>
  s ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(s)) : "—";
export const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(parseDate(iso));
export const firstOfMonth = (d = new Date()) => toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
export const lastOfMonth = (iso: string) => {
  const d = parseDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const timeAgo = (s: string) => {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return date(s);
};

// Rótulos usados em várias telas
export const LABELS: Record<string, Record<string, string>> = {
  status_conta: { trial: "Teste grátis", ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" },
  tipo_conta: { agencia: "Agência", profissional: "Profissional autônomo", empresa: "Empresa / time interno" },
  papel: { owner: "Dono(a)", editor: "Editor", leitor: "Leitor" },
  status_campanha: { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" },
  status_post: { ideia: "Ideia", rascunho: "Rascunho", aprovado: "Aprovado", agendado: "Agendado", publicado: "Publicado" },
  status_tarefa: { a_fazer: "A fazer", em_andamento: "Em andamento", concluido: "Concluído" },
  status_ideia: { nova: "Nova", em_briefing: "Em briefing", aprovada: "Aprovada", descartada: "Descartada" },
  status_ticket: { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido", fechado: "Fechado" },
  prioridade: { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" },
  categoria_ticket: { duvida: "Dúvida", problema: "Problema", financeiro: "Financeiro", sugestao: "Sugestão", outro: "Outro" },
  status_lead: { novo: "Novo", em_conversa: "Em conversa", convertido: "Convertido", perdido: "Perdido" },
  tipo_lgpd: { acesso: "Acesso aos meus dados", correcao: "Correção de dados", exclusao: "Exclusão da conta e dados", portabilidade: "Portabilidade", outro: "Outro" },
  status_lgpd: { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída", negada: "Negada" },
  ameaca: { baixa: "Baixa", media: "Média", alta: "Alta" },
  rede: { instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", facebook: "Facebook", youtube: "YouTube", pinterest: "Pinterest", x: "X (Twitter)", blog: "Blog / site", email: "E-mail", whatsapp: "WhatsApp", outro: "Outro" },
  canal_venda: { mercado_livre: "Mercado Livre", amazon: "Amazon", loja_oficial: "Loja oficial", shopee: "Shopee", loja_fisica: "Loja física", outro: "Outro" },
  categoria_custo: { midia_paga: "Mídia paga", eventos: "Eventos", ferramentas: "Ferramentas", conteudo: "Produção de conteúdo", acoes_internas: "Ações internas", acoes_externas: "Ações externas", brindes: "Brindes e materiais", outro: "Outro" },
};
export const label = (group: string, key?: string | null) => (key ? LABELS[group]?.[key] ?? key : "—");
export const options = (group: string) => Object.entries(LABELS[group]).map(([value, text]) => ({ value, label: text }));

export const CANAIS_MIDIA = ["Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn Ads", "YouTube", "Orgânico", "E-mail", "Influenciadores", "Eventos", "Outro"];
