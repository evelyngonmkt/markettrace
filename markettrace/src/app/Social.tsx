import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bookmark, CalendarClock, Check, ChevronLeft, ChevronRight, Clipboard, Crop, Download,
  ExternalLink, Heart, ImagePlus, Lightbulb, Loader2, MessageCircle, Pencil, Plus, Send, Settings2, Sparkles, Trash2, X,
} from "lucide-react";
import { Crud, type FieldDef } from "../components/Crud";
import { Badge, EmptyState, Loading, Modal, Notice, PageHeader, Panel, Tabs, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { dateTime, label, options, toISODate } from "../lib/format";
import { instagramUrl } from "../lib/site";
import { errorMessage, supabase } from "../lib/supabase";

/* ---------------- tipos e regras ---------------- */
type Midia = { url: string; path?: string; tipo: "imagem" | "video"; largura: number; altura: number; nome?: string; file?: File };
type Canal = "feed" | "stories" | "reels" | "post";
type Horario = { data: string; hora: string };

const CANAIS: Array<{ value: Canal; label: string; help: string }> = [
  { value: "feed", label: "Feed", help: "Imagem ou carrossel · 4:5 a 1,91:1" },
  { value: "stories", label: "Stories", help: "Vertical · 9:16" },
  { value: "reels", label: "Reels", help: "Vídeo vertical · 9:16" },
];
// limite de caracteres da legenda por rede
const LIMITE: Record<string, number> = { instagram: 2200, facebook: 63206, tiktok: 2200, linkedin: 3000, x: 280, youtube: 5000, pinterest: 500, outro: 5000 };
const STORY = 9 / 16;
const ratioOk = (m: Midia, canal: Canal) => {
  const r = m.largura / m.altura;
  if (canal === "stories" || canal === "reels") return Math.abs(r - STORY) < 0.02;
  if (canal === "feed") return r >= 0.8 - 0.01 && r <= 1.91 + 0.01;
  return true;
};
const targetRatio = (m: Midia, canal: Canal) => (canal === "feed" ? (m.largura / m.altura < 0.8 ? 4 / 5 : 1.91) : STORY);
const countHashtags = (t: string) => (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
const pad = (n: number) => String(n).padStart(2, "0");
const nextSlot = () => { const d = new Date(Date.now() + 60 * 60 * 1000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return { data: toISODate(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/* ---------------- mídias: leitura, recorte e envio ---------------- */
function readSize(file: File): Promise<{ largura: number; altura: number; tipo: "imagem" | "video" }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => { resolve({ largura: v.videoWidth, altura: v.videoHeight, tipo: "video" }); URL.revokeObjectURL(url); };
      v.onerror = () => reject(new Error("Não foi possível ler este vídeo."));
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => { resolve({ largura: img.naturalWidth, altura: img.naturalHeight, tipo: "imagem" }); URL.revokeObjectURL(url); };
      img.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
      img.src = url;
    }
  });
}

/** recorta a imagem no centro na proporção pedida e devolve um arquivo JPG */
async function cropToRatio(m: Midia, ratio: number): Promise<File> {
  // usa o arquivo original quando ainda está no navegador; senão baixa a imagem publicada
  const src = m.file ? URL.createObjectURL(m.file) : m.url;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("Não foi possível abrir a imagem para ajustar.")); img.src = src; });
  if (m.file) URL.revokeObjectURL(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  let cw = w, ch = Math.round(w / ratio);
  if (ch > h) { ch = h; cw = Math.round(h * ratio); }
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  canvas.getContext("2d")!.drawImage(img, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
  const blob: Blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Falha ao gerar a imagem."))), "image/jpeg", 0.92));
  return new File([blob], (m.nome ?? "imagem").replace(/\.\w+$/, "") + "-ajustada.jpg", { type: "image/jpeg" });
}

async function uploadMidia(file: File, accountId: string, companyId: string): Promise<Midia> {
  const size = await readSize(file);
  const ext = (file.name.split(".").pop() || (size.tipo === "video" ? "mp4" : "jpg")).toLowerCase();
  const path = `${accountId}/${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("midias").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const url = supabase.storage.from("midias").getPublicUrl(path).data.publicUrl;
  return { url, path, nome: file.name, file, ...size };
}

/* ---------------- pré-visualização estilo Instagram ---------------- */
function Preview({ profile, canal, midias, legenda, assinatura }: { profile?: Row; canal: Canal; midias: Midia[]; legenda: string; assinatura: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= midias.length) setI(0); }, [midias.length, i]);
  const m = midias[i];
  const vertical = canal === "stories" || canal === "reels";
  const ratio = vertical ? "9 / 16" : m ? `${Math.min(Math.max(m.largura / m.altura, 0.8), 1.91)}` : "4 / 5";
  const name = profile?.usuario?.replace(/^@/, "") || profile?.nome || "seu.perfil";
  return (
    <div className={`ig ${vertical ? "ig-vertical" : ""}`}>
      <div className="ig-head">
        <span className="ig-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
        <strong>{name}</strong>
        <span className="ig-canal">{label("canal_post", canal)}</span>
      </div>
      <div className="ig-media" style={{ aspectRatio: ratio }}>
        {m ? (m.tipo === "video" ? <video src={m.url} muted playsInline controls /> : <img src={m.url} alt="" />) : <span className="ig-empty"><ImagePlus size={28} />Sem mídia</span>}
        {midias.length > 1 && (
          <>
            {i > 0 && <button className="ig-nav left" onClick={() => setI(i - 1)} aria-label="Anterior"><ChevronLeft size={16} /></button>}
            {i < midias.length - 1 && <button className="ig-nav right" onClick={() => setI(i + 1)} aria-label="Próxima"><ChevronRight size={16} /></button>}
            <span className="ig-count">{i + 1}/{midias.length}</span>
          </>
        )}
      </div>
      {!vertical && (
        <>
          <div className="ig-actions"><Heart size={22} /><MessageCircle size={22} /><Send size={22} /><Bookmark size={22} className="ig-save" /></div>
          <p className="ig-caption"><strong>{name}</strong> {legenda || <span className="muted">Legenda do post</span>}{assinatura ? <><br /><br />{assinatura}</> : null}</p>
        </>
      )}
    </div>
  );
}

/* ---------------- gerenciar perfis ---------------- */
const profileFields: FieldDef[] = [
  { key: "rede", label: "Rede", type: "select", options: options("rede"), required: true, half: true, list: true },
  { key: "nome", label: "Nome do perfil", required: true, half: true, list: true, placeholder: "Ex.: MCI Store" },
  { key: "usuario", label: "Usuário (@)", half: true, list: true, placeholder: "@perfil" },
  { key: "avatar_url", label: "Foto do perfil (link)", type: "url", half: true },
  { key: "assinatura", label: "Assinatura e hashtags fixas", type: "textarea", help: "Entra no fim de todo post deste perfil. Dá para mudar em cada post." },
  { key: "ativo", label: "Perfil ativo", type: "checkbox", list: true, format: (v) => <Badge tone={v ? "ok" : "neutral"}>{v ? "Ativo" : "Inativo"}</Badge> },
];

/* =====================================================================
   COMPOSITOR
   ===================================================================== */
function Composer({ editId, onDone }: { editId: string | null; onDone: () => void }) {
  const { account, company, canEdit } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const profiles = useRows({ table: "social_profiles", eq: { company_id: company?.id, ativo: true }, order: ["nome"], skip: !company });
  const published = useRows({ table: "posts", select: "data_hora,engajamento", eq: { company_id: company?.id, status: "publicado" }, skip: !company });
  const ideas = useRows({ table: "ideas", select: "id,titulo,motivo,publico,status", eq: { company_id: company?.id }, order: ["created_at", false], skip: !company });

  const [selected, setSelected] = useState<string[]>([]);
  const [canais, setCanais] = useState<Canal[]>(["feed"]);
  const [legenda, setLegenda] = useState("");
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({});
  const [assinaturaTab, setAssinaturaTab] = useState(0);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([nextSlot()]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [managing, setManaging] = useState(false);
  const [pickIdea, setPickIdea] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // modo edição: carrega um post já agendado
  useEffect(() => {
    if (!editId) { setEditing(null); return; }
    supabase.from("posts").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setEditing(data);
      if (data.profile_id) setSelected([data.profile_id]);
      setCanais([data.canal === "post" ? "feed" : data.canal]);
      setLegenda(data.legenda ?? "");
      if (data.profile_id) setAssinaturas({ [data.profile_id]: data.assinatura ?? "" });
      setMidias(data.midias ?? []);
      if (data.data_hora) { const d = new Date(data.data_hora); setHorarios([{ data: toISODate(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}` }]); }
    });
  }, [editId]);

  const profById = useMemo(() => Object.fromEntries(profiles.rows.map((p) => [p.id, p])), [profiles.rows]);
  const chosen = selected.map((id) => profById[id]).filter(Boolean);
  const hasInstagram = chosen.some((p) => p.rede === "instagram") || chosen.length === 0;
  const limit = Math.min(...(chosen.length ? chosen.map((p) => LIMITE[p.rede] ?? 5000) : [2200]));
  const assinaturaOf = (id: string) => assinaturas[id] ?? profById[id]?.assinatura ?? "";
  const tabProfile = chosen[assinaturaTab] ?? chosen[0];
  const fullTextFor = (id?: string) => (legenda + (id && assinaturaOf(id) ? `\n\n${assinaturaOf(id)}` : "")).trim();
  const longest = Math.max(legenda.length, ...chosen.map((p) => fullTextFor(p.id).length));
  const hashtags = Math.max(countHashtags(legenda), ...chosen.map((p) => countHashtags(fullTextFor(p.id))));

  const toggleProfile = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleCanal = (c: Canal) => setCanais((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !account || !company) return;
    setError("");
    for (const f of Array.from(files)) {
      if (!/^image\/|^video\//.test(f.type)) { toast(`${f.name}: formato não aceito`, "error"); continue; }
      if (f.size > 100 * 1024 * 1024) { toast(`${f.name}: arquivo acima de 100 MB`, "error"); continue; }
      setUploading((n) => n + 1);
      try { const m = await uploadMidia(f, account.id, company.id); setMidias((s) => [...s, m]); }
      catch (e) { toast(`${f.name}: ${errorMessage(e)}`, "error"); }
      finally { setUploading((n) => n - 1); }
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const move = (i: number, dir: -1 | 1) => setMidias((s) => { const c = [...s]; const j = i + dir; if (j < 0 || j >= c.length) return s; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const removeMidia = (i: number) => setMidias((s) => s.filter((_, j) => j !== i));
  const adjust = async (i: number, canal: Canal) => {
    const m = midias[i];
    try {
      setUploading((n) => n + 1);
      const file = await cropToRatio(m, targetRatio(m, canal));
      const novo = await uploadMidia(file, account!.id, company!.id);
      setMidias((s) => s.map((x, j) => (j === i ? novo : x)));
      toast("Imagem ajustada");
    } catch (e) { toast(errorMessage(e), "error"); } finally { setUploading((n) => n - 1); }
  };

  // avisos de proporção por canal
  const warnings = canais.filter((c) => c !== "post").flatMap((c) =>
    midias.map((m, i) => ({ m, i, c })).filter(({ m, c: cc }) => !ratioOk(m, cc as Canal)),
  );

  // melhores horários a partir do histórico de posts publicados
  const bestSlots = useMemo(() => {
    const map = new Map<string, { total: number; n: number; dow: number; h: number }>();
    for (const p of published.rows) {
      if (!p.data_hora || p.engajamento == null) continue;
      const d = new Date(p.data_hora); const k = `${d.getDay()}-${d.getHours()}`;
      const cur = map.get(k) ?? { total: 0, n: 0, dow: d.getDay(), h: d.getHours() };
      cur.total += Number(p.engajamento); cur.n++; map.set(k, cur);
    }
    return [...map.values()].map((s) => ({ ...s, avg: s.total / s.n })).sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [published.rows]);
  const applySlot = (dow: number, h: number) => {
    const d = new Date(); d.setHours(h, 0, 0, 0);
    while (d.getDay() !== dow || d < new Date()) d.setDate(d.getDate() + 1);
    setHorarios((s) => [...s.filter((x) => x.data), { data: toISODate(d), hora: `${pad(h)}:00` }]);
    setShowBest(false);
  };

  const problems = (): string | null => {
    if (!chosen.length) return "Selecione pelo menos um perfil.";
    if (hasInstagram && !canais.length) return "Selecione pelo menos um canal (Feed, Stories ou Reels).";
    if (!legenda.trim() && !midias.length) return "Escreva a legenda ou adicione uma mídia.";
    if (chosen.some((p) => p.rede === "instagram") && !midias.length) return "O Instagram exige pelo menos uma imagem ou vídeo.";
    if (canais.includes("reels") && chosen.some((p) => p.rede === "instagram") && !midias.some((m) => m.tipo === "video")) return "Reels precisa de um vídeo.";
    if (longest > limit) return `A legenda passou do limite de ${limit.toLocaleString("pt-BR")} caracteres.`;
    if (horarios.some((h) => !h.data || !h.hora)) return "Preencha a data e o horário de todas as publicações.";
    return null;
  };

  const save = async (status: "agendado" | "rascunho") => {
    const p = status === "agendado" ? problems() : !chosen.length ? "Selecione pelo menos um perfil." : null;
    if (p) { setError(p); return; }
    setBusy(true); setError("");
    const titulo = (legenda.trim().split("\n")[0] || "Post sem legenda").slice(0, 80);
    const midiasDb = midias.map(({ file: _f, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
    const formato = (c: Canal) => (c === "stories" ? "Stories" : c === "reels" ? "Reels" : !midias.length ? "Texto" : midias.length > 1 ? "Carrossel" : midias[0]?.tipo === "video" ? "Vídeo" : "Post estático");
    try {
      if (editing) {
        const pr = profById[selected[0]];
        const c = pr?.rede === "instagram" ? canais[0] ?? "feed" : "post";
        const h = horarios[0];
        const { error: err } = await supabase.from("posts").update({
          titulo, legenda, assinatura: assinaturaOf(selected[0]) || null, midias: midiasDb, canal: c, formato: formato(c),
          rede: pr?.rede ?? editing.rede, profile_id: selected[0] ?? null, status,
          data_hora: h?.data && h?.hora ? new Date(`${h.data}T${h.hora}`).toISOString() : null,
        }).eq("id", editing.id);
        if (err) throw err;
        toast("Post atualizado");
      } else {
        const grupo = crypto.randomUUID();
        const rows: Row[] = [];
        for (const pr of chosen) {
          const lista: Canal[] = pr.rede === "instagram" ? canais : ["post"];
          for (const c of lista) for (const h of horarios) rows.push({
            account_id: account!.id, company_id: company!.id, profile_id: pr.id, rede: pr.rede, canal: c, formato: formato(c),
            titulo, legenda, assinatura: assinaturaOf(pr.id) || null, midias: midiasDb, status, grupo_id: grupo,
            data_hora: h.data && h.hora ? new Date(`${h.data}T${h.hora}`).toISOString() : null,
          });
        }
        const { error: err } = await supabase.from("posts").insert(rows);
        if (err) throw err;
        toast(status === "agendado" ? `${rows.length} publicação(ões) agendada(s)` : "Rascunho salvo");
        setLegenda(""); setMidias([]); setHorarios([nextSlot()]); setAssinaturas({});
      }
      onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  if (profiles.loading && !profiles.rows.length && !managing) return <Loading />;
  if (!profiles.rows.length)
    return (
      <>
        <EmptyState title="Cadastre o primeiro perfil" text={`Para agendar, cadastre os perfis de redes sociais de ${company?.nome} (Instagram, Facebook, TikTok, LinkedIn…).`}
          action={canEdit ? <button className="btn btn-primary" onClick={() => setManaging(true)}><Plus size={15} /> Cadastrar perfil</button> : undefined} />
        {managing && <Modal title="Perfis de redes sociais" onClose={() => { setManaging(false); void profiles.reload(); }} wide>
          <Crud table="social_profiles" fields={profileFields} order={["nome"]} newLabel="Novo perfil" defaults={{ rede: "instagram", ativo: true }} empty={{ title: "Nenhum perfil" }} />
        </Modal>}
      </>
    );

  const previewProfile = chosen[previewIndex] ?? chosen[0];
  const previewCanal: Canal = previewProfile?.rede && previewProfile.rede !== "instagram" ? "post" : canais[0] ?? "feed";

  return (
    <div className="composer">
      <div className="composer-main">
        {editing && <Notice tone="info">Editando uma publicação já agendada ({label("canal_post", editing.canal)} · {dateTime(editing.data_hora)}). <button className="link-btn" onClick={() => nav("/app/social")}>Criar um post novo</button></Notice>}

        {/* 1. Perfis */}
        <Panel kicker="1" title="Selecione perfis" actions={canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setManaging(true)}><Settings2 size={14} /> Perfis</button>}>
          <div className="chips">
            {profiles.rows.map((p) => (
              <button key={p.id} className={`chip profile-chip ${selected.includes(p.id) ? "active" : ""}`} onClick={() => (editing ? setSelected([p.id]) : toggleProfile(p.id))}>
                {selected.includes(p.id) && <Check size={13} />} {p.nome} <small>{label("rede", p.rede)}</small>
              </button>
            ))}
          </div>
          {!editing && profiles.rows.length > 1 && <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setSelected(selected.length === profiles.rows.length ? [] : profiles.rows.map((p) => p.id))}>{selected.length === profiles.rows.length ? "Limpar seleção" : "Selecionar todos"}</button>}
        </Panel>

        {/* 2. Canais */}
        {hasInstagram && (
          <Panel kicker="2" title="Selecione canais do Instagram">
            <div className="canal-grid">
              {CANAIS.map((c) => (
                <button key={c.value} className={`canal ${canais.includes(c.value) ? "active" : ""}`} onClick={() => (editing ? setCanais([c.value]) : toggleCanal(c.value))}>
                  <strong>{canais.includes(c.value) && <Check size={14} />} {c.label}</strong><small>{c.help}</small>
                </button>
              ))}
            </div>
            {chosen.some((p) => p.rede !== "instagram") && <p className="muted small" style={{ marginTop: 8 }}>Nos outros perfis o conteúdo sai como post comum.</p>}
          </Panel>
        )}

        {/* 3. Texto */}
        <Panel kicker="3" title="Texto do post" actions={<button className="btn btn-ghost btn-sm" onClick={() => setPickIdea(true)}><Lightbulb size={14} /> Usar ideia do Estúdio</button>}>
          <textarea className="caption-box" rows={7} value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Escreva a legenda do post…" aria-label="Legenda" />
          {chosen.length > 0 && (
            <div className="signature">
              <div className="signature-head">
                {chosen.length > 1 && <button className="icon-btn" onClick={() => setAssinaturaTab((assinaturaTab - 1 + chosen.length) % chosen.length)} aria-label="Perfil anterior"><ChevronLeft size={16} /></button>}
                <span>Hashtags e assinatura · <strong>{tabProfile?.nome}</strong></span>
                {chosen.length > 1 && <button className="icon-btn" onClick={() => setAssinaturaTab((assinaturaTab + 1) % chosen.length)} aria-label="Próximo perfil"><ChevronRight size={16} /></button>}
              </div>
              <textarea rows={3} value={tabProfile ? assinaturaOf(tabProfile.id) : ""} onChange={(e) => tabProfile && setAssinaturas({ ...assinaturas, [tabProfile.id]: e.target.value })} placeholder="#hashtags e assinatura deste perfil" aria-label="Assinatura" />
            </div>
          )}
          <div className="caption-meta">
            <span className={hashtags > 30 ? "over" : ""}>{hashtags} hashtag(s){hashtags > 30 ? " · o Instagram aceita até 30" : ""}</span>
            <span className={longest > limit ? "over" : ""}>{longest.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")}</span>
          </div>
        </Panel>

        {/* 4. Mídias */}
        <Panel kicker="4" title="Mídias" actions={<span className="muted small">{midias.filter((m) => m.tipo === "imagem").length} imagem(ns) · {midias.filter((m) => m.tipo === "video").length} vídeo(s)</span>}>
          <div className="media-grid">
            {midias.map((m, i) => (
              <div className="media-thumb" key={m.url}>
                {m.tipo === "video" ? <video src={m.url} muted /> : <img src={m.url} alt="" />}
                <span className="media-size">{m.largura}×{m.altura}</span>
                <div className="media-tools">
                  {i > 0 && <button onClick={() => move(i, -1)} title="Mover para a esquerda"><ArrowLeft size={13} /></button>}
                  {i < midias.length - 1 && <button onClick={() => move(i, 1)} title="Mover para a direita"><ArrowRight size={13} /></button>}
                  <button onClick={() => removeMidia(i)} title="Remover"><X size={13} /></button>
                </div>
              </div>
            ))}
            <button className="media-add" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
              {uploading ? <Loader2 size={22} className="spin" /> : <Plus size={22} />}
              <span>{uploading ? "Enviando…" : "Adicionar"}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
          {warnings.length > 0 && (
            <div className="ratio-warn">
              {canais.includes("feed") && (canais.includes("stories") || canais.includes("reels")) && midias.some((m) => m.tipo === "imagem") && (
                <span className="small">Dica: Feed e Stories/Reels pedem formatos diferentes. Para usar a imagem certa em cada um, agende em dois posts separados.</span>
              )}
              {warnings.map(({ m, i, c }) => (
                <div key={`${i}-${c}`}>
                  <strong>⚠ Mídia {i + 1} fora da proporção de {label("canal_post", c)} ({c === "feed" ? "4:5 a 1,91:1" : "9:16"})</strong>
                  <span>Dimensões: {m.largura} × {m.altura}. {c === "feed" ? "O Instagram corta ou recusa." : "O post pode sair com bordas pretas."}</span>
                  {m.tipo === "imagem" ? <button className="btn btn-ghost btn-sm" onClick={() => adjust(i, c)} disabled={uploading > 0}><Crop size={14} /> Ajustar para {c === "feed" ? (m.largura / m.altura < 0.8 ? "4:5" : "1,91:1") : "9:16"}</button>
                    : <span className="muted small">Vídeos precisam ser ajustados antes do envio.</span>}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* 5. Data e horário */}
        <Panel kicker="5" title="Data e horário das publicações" actions={<button className="btn btn-ghost btn-sm" onClick={() => setShowBest(!showBest)}><Sparkles size={14} /> Melhores horários</button>}>
          {showBest && (
            <div className="best-slots">
              {bestSlots.length >= 1 && published.rows.length >= 3 ? bestSlots.map((s) => (
                <button key={`${s.dow}-${s.h}`} className="chip" onClick={() => applySlot(s.dow, s.h)}>{WEEKDAYS[s.dow]} · {pad(s.h)}h <small>{Math.round(s.avg)} interações em média</small></button>
              )) : <p className="muted small">Ainda sem histórico suficiente. Os melhores horários aparecem depois de 3 posts publicados com engajamento preenchido na Agenda.</p>}
            </div>
          )}
          <div className="stack" style={{ gap: 10 }}>
            {horarios.map((h, i) => (
              <div className="slot-row" key={i}>
                <label className="field"><span>Data</span><input type="date" value={h.data} onChange={(e) => setHorarios(horarios.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))} /></label>
                <label className="field"><span>Horário</span><input type="time" value={h.hora} onChange={(e) => setHorarios(horarios.map((x, j) => (j === i ? { ...x, hora: e.target.value } : x)))} /></label>
                {horarios.length > 1 && <button className="icon-btn danger" onClick={() => setHorarios(horarios.filter((_, j) => j !== i))} title="Remover horário"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
          {!editing && <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setHorarios([...horarios, nextSlot()])}><Plus size={14} /> Incluir mais dias e horários</button>}
        </Panel>

        <Notice tone="error">{error}</Notice>
        {canEdit && (
          <div className="composer-actions">
            <button className="btn btn-ghost" onClick={() => save("rascunho")} disabled={busy || uploading > 0}>Salvar rascunho</button>
            <button className="btn btn-primary btn-lg" onClick={() => save("agendado")} disabled={busy || uploading > 0}><CalendarClock size={17} /> {busy ? "Salvando…" : editing ? "Salvar agendamento" : "Agendar"}</button>
          </div>
        )}
      </div>

      {/* 6. Pré-visualização */}
      <aside className="composer-preview">
        <div className="preview-head">
          <span className="kicker">Pré-visualização</span>
          {chosen.length > 1 && (
            <div className="preview-switch">
              <button className="icon-btn" onClick={() => setPreviewIndex((previewIndex - 1 + chosen.length) % chosen.length)} aria-label="Perfil anterior"><ChevronLeft size={16} /></button>
              <span>{previewProfile?.nome}</span>
              <button className="icon-btn" onClick={() => setPreviewIndex((previewIndex + 1) % chosen.length)} aria-label="Próximo perfil"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
        <Preview profile={previewProfile} canal={previewCanal} midias={midias} legenda={legenda} assinatura={previewProfile ? assinaturaOf(previewProfile.id) : ""} />
        <p className="muted small">Aproximação de como o post aparece. A publicação automática chega com a integração da Meta; até lá, o post entra na fila “Para publicar”.</p>
      </aside>

      {managing && <Modal title="Perfis de redes sociais" onClose={() => { setManaging(false); void profiles.reload(); }} wide>
        <Crud table="social_profiles" fields={profileFields} order={["nome"]} newLabel="Novo perfil" defaults={{ rede: "instagram", ativo: true }} empty={{ title: "Nenhum perfil" }} />
      </Modal>}
      {pickIdea && <Modal title="Usar ideia do Estúdio criativo" onClose={() => setPickIdea(false)}>
        {ideas.rows.filter((x) => x.status !== "descartada").length ? (
          <div className="list">{ideas.rows.filter((x) => x.status !== "descartada").map((x) => (
            <button key={x.id} className="list-item idea-pick" onClick={() => { setLegenda(x.titulo + (x.motivo ? `\n\n${x.motivo}` : "")); setPickIdea(false); }}>
              <div><strong>{x.titulo}</strong><small>{x.publico} · {label("status_ideia", x.status)}</small></div>
            </button>
          ))}</div>
        ) : <EmptyState title="Nenhuma ideia no Estúdio" action={<Link to="/app/estudio" className="btn btn-ghost btn-sm">Abrir Estúdio criativo</Link>} />}
      </Modal>}
    </div>
  );
}

/* =====================================================================
   FILA DE PUBLICAÇÃO
   ===================================================================== */
function Queue({ refreshKey }: { refreshKey: number }) {
  const { company, canEdit } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { rows, loading, reload } = useRows({ table: "posts", select: "*, social_profiles(nome,usuario,rede)", eq: { company_id: company?.id, status: "agendado" }, order: ["data_hora"], skip: !company, limit: 100 });
  const drafts = useRows({ table: "posts", select: "id,titulo,canal,rede,created_at,profile_id", eq: { company_id: company?.id, status: "rascunho" }, order: ["created_at", false], skip: !company, limit: 30 });
  useEffect(() => { void reload(); void drafts.reload(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Date.now();
  const due = rows.filter((r) => r.data_hora && new Date(r.data_hora).getTime() <= now);
  const next = rows.filter((r) => !r.data_hora || new Date(r.data_hora).getTime() > now);

  const text = (r: Row) => [r.legenda, r.assinatura].filter(Boolean).join("\n\n");
  const copy = async (r: Row) => { try { await navigator.clipboard.writeText(text(r)); toast("Legenda copiada"); } catch { toast("Não foi possível copiar. Selecione o texto manualmente.", "error"); } };
  const download = (r: Row) => { (r.midias as Midia[]).forEach((m, i) => { const a = document.createElement("a"); a.href = `${m.url}?download=${encodeURIComponent(`post-${i + 1}-${m.nome ?? "midia"}`)}`; a.target = "_blank"; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); }); };
  const markPublished = async (r: Row) => {
    const { error } = await supabase.from("posts").update({ status: "publicado", publicado_em: new Date().toISOString() }).eq("id", r.id);
    if (error) toast(errorMessage(error), "error"); else { toast("Marcado como publicado. Preencha o engajamento depois na Agenda."); await reload(); }
  };
  const remove = async (r: Row) => {
    if (!window.confirm("Apagar esta publicação agendada?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", r.id);
    if (error) toast(errorMessage(error), "error"); else { toast("Publicação apagada"); await reload(); await drafts.reload(); }
  };

  const Item = ({ r, highlight }: { r: Row; highlight?: boolean }) => (
    <div className={`queue-item ${highlight ? "queue-due" : ""}`}>
      <div className="queue-thumb">{r.midias?.[0] ? (r.midias[0].tipo === "video" ? <video src={r.midias[0].url} muted /> : <img src={r.midias[0].url} alt="" />) : <ImagePlus size={18} />}</div>
      <div className="queue-info">
        <strong>{r.titulo}</strong>
        <small>{r.social_profiles?.nome ?? label("rede", r.rede)} · {label("canal_post", r.canal)} · {dateTime(r.data_hora)}{r.midias?.length > 1 ? ` · ${r.midias.length} mídias` : ""}</small>
      </div>
      <div className="queue-actions">
        <button className="icon-btn" title="Copiar legenda" onClick={() => copy(r)}><Clipboard size={15} /></button>
        {r.midias?.length > 0 && <button className="icon-btn" title="Baixar mídias" onClick={() => download(r)}><Download size={15} /></button>}
        {r.social_profiles?.rede === "instagram" && r.social_profiles?.usuario && <a className="icon-btn" title="Abrir perfil no Instagram" href={instagramUrl(r.social_profiles.usuario)} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}
        {canEdit && <>
          <button className="icon-btn" title="Editar" onClick={() => nav(`/app/social?post=${r.id}`)}><Pencil size={15} /></button>
          <button className="icon-btn danger" title="Apagar" onClick={() => remove(r)}><Trash2 size={15} /></button>
          <button className={`btn btn-sm ${highlight ? "btn-primary" : "btn-ghost"}`} onClick={() => markPublished(r)}><Check size={14} /> Publicado</button>
        </>}
      </div>
    </div>
  );

  if (loading) return <Loading />;
  return (
    <div className="stack">
      <Panel kicker="Hora de publicar" title={`Para publicar agora${due.length ? ` (${due.length})` : ""}`}>
        {due.length ? (
          <>
            <p className="muted small" style={{ marginBottom: 10 }}>Copie a legenda, baixe as mídias, publique no app da rede e marque como publicado.</p>
            {due.map((r) => <Item key={r.id} r={r} highlight />)}
          </>
        ) : <EmptyState title="Nada para publicar agora" text="Quando chegar o horário de um post agendado, ele aparece aqui." />}
      </Panel>
      <Panel kicker="Agendados" title={`Próximas publicações (${next.length})`}>
        {next.length ? next.map((r) => <Item key={r.id} r={r} />) : <EmptyState title="Nenhuma publicação agendada" />}
      </Panel>
      {drafts.rows.length > 0 && (
        <Panel kicker="Rascunhos" title="Continuar depois">
          <div className="list">{drafts.rows.map((d) => (
            <div className="list-item" key={d.id}><div><strong>{d.titulo}</strong><small>{label("rede", d.rede)} · {label("canal_post", d.canal)} · criado {dateTime(d.created_at)}</small></div>
              {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/social?post=${d.id}`)}>Continuar</button>}</div>
          ))}</div>
        </Panel>
      )}
    </div>
  );
}

/* =====================================================================
   PÁGINA
   ===================================================================== */
export default function Social() {
  const [params, setParams] = useSearchParams();
  const editId = params.get("post");
  const [tab, setTab] = useState<"novo" | "fila">(params.get("aba") === "fila" ? "fila" : "novo");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { if (editId) setTab("novo"); }, [editId]);
  return (
    <>
      <PageHeader kicker="Social media" title={editId ? "Editar publicação" : "Agendar post"} text="Monte o post uma vez e programe para vários perfis, canais e horários."
        actions={<Tabs value={tab} onChange={(v) => { setTab(v); if (v === "fila") setParams({ aba: "fila" }); else setParams({}); }} items={[{ value: "novo", label: "Novo post" }, { value: "fila", label: "Fila de publicação" }]} />} />
      {tab === "novo"
        ? <Composer editId={editId} onDone={() => { setRefreshKey((k) => k + 1); setParams({ aba: "fila" }); setTab("fila"); }} />
        : <Queue refreshKey={refreshKey} />}
    </>
  );
}
