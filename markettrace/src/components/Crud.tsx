import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useRows, type Row } from "../lib/data";
import { errorMessage, supabase } from "../lib/supabase";
import { date, dateTime, money } from "../lib/format";
import { EmptyState, Loading, Modal, Notice, Panel, useToast } from "./ui";

export type Option = { value: string; label: string };
export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "money" | "date" | "datetime" | "select" | "checkbox" | "tags" | "email" | "url";
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  list?: boolean;
  half?: boolean;
  min?: number;
  max?: number;
  readOnly?: boolean;
  listOnly?: boolean;
  th?: string;
  format?: (value: unknown, row: Row) => ReactNode;
};

/* ---------- Formulário reutilizável ---------- */
const toInput = (f: FieldDef, v: unknown): string | boolean => {
  if (f.type === "checkbox") return Boolean(v);
  if (v === null || v === undefined) return "";
  if (f.type === "tags") return Array.isArray(v) ? v.join(", ") : String(v);
  if (f.type === "datetime") {
    const d = new Date(String(v));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
};
const fromInput = (f: FieldDef, v: string | boolean): unknown => {
  if (f.type === "checkbox") return Boolean(v);
  const s = String(v).trim();
  if (s === "") return f.type === "tags" ? [] : null;
  if (f.type === "number" || f.type === "money") return Number(s.replace(",", "."));
  if (f.type === "datetime") return new Date(s).toISOString();
  if (f.type === "tags") return s.split(",").map((t) => t.trim()).filter(Boolean);
  return s;
};

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: string | boolean; onChange: (v: string | boolean) => void }) {
  const common = { id: `f-${f.key}`, required: f.required, placeholder: f.placeholder, disabled: f.readOnly };
  if (f.type === "checkbox")
    return <label className="check"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
  let input: ReactNode;
  if (f.type === "textarea") input = <textarea {...common} rows={4} value={String(value)} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === "select")
    input = (
      <select {...common} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        <option value="">{f.required ? "Selecione…" : "—"}</option>
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  else {
    const types: Record<string, string> = { number: "number", money: "number", date: "date", datetime: "datetime-local", email: "email", url: "url" };
    const type = types[f.type ?? ""] ?? "text";
    input = <input {...common} type={type} step={f.type === "money" ? "0.01" : f.type === "number" ? "any" : undefined} min={f.min} max={f.max} value={String(value)} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <label className="field" htmlFor={common.id}>
      <span>{f.label}{f.required && " *"}</span>
      {input}
      {f.help && <small>{f.help}</small>}
    </label>
  );
}

export function FormModal({ title, fields, initial = {}, onSubmit, onClose, onDelete, submitLabel = "Salvar" }: {
  title: string; fields: FieldDef[]; initial?: Row; onSubmit: (values: Row) => Promise<void>; onClose: () => void;
  onDelete?: () => void | Promise<void>; submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, toInput(f, initial[f.key])])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await onSubmit(Object.fromEntries(fields.filter((f) => !f.readOnly).map((f) => [f.key, fromInput(f, values[f.key])])));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} wide={fields.length > 6}>
      <form onSubmit={submit} className="form-grid">
        {fields.map((f) => (
          <div key={f.key} className={f.half ? "half" : "full"}>
            <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          </div>
        ))}
        <div className="full"><Notice tone="error">{error}</Notice></div>
        <div className="full form-actions">
          {onDelete && <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => void onDelete()}><Trash2 size={14} /> Apagar</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Valor formatado em tabelas ---------- */
export function cell(f: FieldDef, row: Row): ReactNode {
  const v = row[f.key];
  if (f.format) return f.format(v, row);
  if (v === null || v === undefined || v === "") return "—";
  switch (f.type) {
    case "money": return money(v);
    case "date": return date(v);
    case "datetime": return dateTime(v);
    case "checkbox": return v ? "Sim" : "Não";
    case "tags": return Array.isArray(v) ? v.join(", ") : String(v);
    case "select": return f.options?.find((o) => o.value === v)?.label ?? String(v);
    default: return String(v);
  }
}

/* ---------- Lista + criar/editar/apagar ---------- */
type CrudProps = {
  table: string;
  title?: string;
  kicker?: string;
  fields: FieldDef[];
  scope?: "company" | "account" | "none";
  eq?: Record<string, string | number | boolean | null | undefined>;
  gte?: [string, string];
  lte?: [string, string];
  order?: [string, boolean?];
  defaults?: Row;
  newLabel?: string;
  empty: { title: string; text?: string };
  summary?: (rows: Row[]) => ReactNode;
  rowActions?: (row: Row, reload: () => Promise<void>) => ReactNode;
  canEdit?: boolean;
  noCreate?: boolean;
  noDelete?: boolean;
  select?: string;
  onRows?: (rows: Row[]) => void;
  /** abre o formulário de cadastro assim que a página carrega */
  openNew?: boolean;
};

export function Crud(p: CrudProps) {
  const { account, company, canEdit: memberCanEdit } = useAuth();
  const toast = useToast();
  const scope = p.scope ?? "company";
  const canEdit = p.canEdit ?? memberCanEdit;
  const scopeEq = scope === "company" ? { company_id: company?.id } : scope === "account" ? { account_id: account?.id } : {};
  const skip = (scope === "company" && !company) || (scope === "account" && !account);
  const { rows, loading, error, reload } = useRows({ table: p.table, select: p.select, eq: { ...scopeEq, ...p.eq }, gte: p.gte, lte: p.lte, order: p.order ?? ["created_at", false], skip });
  const [editing, setEditing] = useState<Row | null>(p.openNew && !p.noCreate ? { ...p.defaults } : null);
  // avisa a página "mãe" quando as linhas mudam (para resumos e gráficos)
  const onRowsRef = useRef(p.onRows);
  onRowsRef.current = p.onRows;
  useEffect(() => { onRowsRef.current?.(rows); }, [rows]);

  const listFields = useMemo(() => p.fields.filter((f) => f.list), [p.fields]);

  const save = async (values: Row) => {
    const base: Row = scope === "company" ? { account_id: account!.id, company_id: company!.id } : scope === "account" ? { account_id: account!.id } : {};
    // campos vazios num cadastro novo ficam com o valor padrão do banco
    const payload: Row = Object.fromEntries(Object.entries({ ...p.defaults, ...values, ...base }).filter(([, v]) => v !== null));
    const res = editing?.id
      ? await supabase.from(p.table).update(values).eq("id", editing.id)
      : await supabase.from(p.table).insert(payload);
    if (res.error) throw res.error;
    toast(editing?.id ? "Alterações salvas" : "Registro criado");
    await reload();
  };
  const remove = async (row: Row) => {
    if (!window.confirm("Apagar este registro? Essa ação não pode ser desfeita.")) return;
    const { error: err } = await supabase.from(p.table).delete().eq("id", row.id);
    if (err) toast(errorMessage(err), "error"); else { toast("Registro apagado"); await reload(); }
  };

  return (
    <>
      {p.summary && !loading && p.summary(rows)}
      <Panel
        kicker={p.kicker}
        title={p.title}
        actions={canEdit && !skip && !p.noCreate ? <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...p.defaults })}><Plus size={15} /> {p.newLabel ?? "Novo"}</button> : undefined}
      >
        <Notice tone="error">{error}</Notice>
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title={p.empty.title} text={p.empty.text} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{listFields.map((f) => <th key={f.key}>{f.th ?? f.label}</th>)}<th aria-label="Ações" /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {listFields.map((f) => <td key={f.key} data-label={f.th ?? f.label}>{cell(f, r)}</td>)}
                    <td className="row-actions">
                      {p.rowActions?.(r, reload)}
                      {canEdit && <>
                        <button className="icon-btn" title="Editar" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                        {!p.noDelete && <button className="icon-btn danger" title="Apagar" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing && (
        <FormModal title={editing.id ? "Editar" : p.newLabel ?? "Novo registro"} fields={p.fields.filter((f) => !f.listOnly)} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
