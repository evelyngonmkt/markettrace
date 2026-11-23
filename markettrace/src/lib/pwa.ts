import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Chave pública das notificações (a privada fica só no servidor) */
export const VAPID_PUBLIC_KEY = "BIJICGLtiA5OkqcBxJwAR_iRjOtNdsHvCddV98DFfWKhAz-hLlEvBSSEn8M4UMIoELK1F-96wPa9pVhB8FWyj70";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function registerSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => undefined); });
}

export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Estado da instalação do app no aparelho */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const r = await deferred.userChoice;
    deferred = null; listeners.forEach((l) => l());
    return r.outcome === "accepted";
  };
  return { canPrompt: !!deferred, installed: isStandalone(), ios: isIOS(), install };
}

/* ---------- notificações ---------- */
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Pede permissão, assina este aparelho e guarda no banco */
export async function enablePush(): Promise<{ ok: boolean; erro?: string }> {
  if (!pushSupported()) return { ok: false, erro: isIOS() && !isStandalone() ? "No iPhone, primeiro adicione o MarketTrace à Tela de Início e abra por lá." : "Este navegador não aceita notificações." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, erro: "As notificações foram bloqueadas. Libere nas configurações do navegador para este site." };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: navigator.userAgent.slice(0, 200) });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
