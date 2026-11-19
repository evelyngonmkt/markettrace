import { useCallback, useEffect, useState } from "react";
import { configured, errorMessage, supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export type Query = {
  table: string;
  select?: string;
  eq?: Record<string, string | number | boolean | null | undefined>;
  gte?: [string, string];
  lte?: [string, string];
  order?: [string, boolean?];
  limit?: number;
  skip?: boolean;
};

/** Lê linhas de uma tabela e devolve { rows, loading, error, reload } */
export function useRows<T extends Row = Row>(q: Query) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const key = JSON.stringify(q);

  const reload = useCallback(async () => {
    if (!configured || q.skip) { setRows([]); setLoading(false); return; }
    setLoading(true);
    let req = supabase.from(q.table).select(q.select ?? "*");
    for (const [k, v] of Object.entries(q.eq ?? {})) if (v !== undefined) req = v === null ? req.is(k, null) : req.eq(k, v);
    if (q.gte) req = req.gte(q.gte[0], q.gte[1]);
    if (q.lte) req = req.lte(q.lte[0], q.lte[1]);
    if (q.order) req = req.order(q.order[0], { ascending: q.order[1] ?? true });
    if (q.limit) req = req.limit(q.limit);
    const { data, error: err } = await req;
    setRows((data as unknown as T[]) ?? []);
    setError(err ? errorMessage(err) : "");
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { void reload(); }, [reload]);
  return { rows, loading, error, reload, setRows };
}

/** soma um campo numérico */
export const sum = (rows: Row[], field: string) => rows.reduce((t, r) => t + Number(r[field] || 0), 0);

/** agrupa linhas por um campo */
export function groupBy<T extends Row>(rows: T[], field: string) {
  const out: Record<string, T[]> = {};
  for (const r of rows) (out[r[field] ?? "—"] ??= []).push(r);
  return out;
}
