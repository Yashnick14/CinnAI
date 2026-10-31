import { API } from "../config/api";
import { firebaseAuth } from "./firebaseAuth";
export const CLOUD_ENABLED = process.env.EXPO_PUBLIC_CLOUD_STORAGE_ENABLED === "true";
export function cloudUid() { return firebaseAuth().currentUser?.uid ?? null; }
export async function cloudRequest(path: string, init: RequestInit = {}, owner = cloudUid()) {
  const user = firebaseAuth().currentUser;
  if (!user || !owner || user.uid !== owner) throw new Error("Sign in to access cloud data.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) abort();
  const timer = setTimeout(abort, API.timeoutMs);
  try {
    const token = await user.getIdToken();
    if (cloudUid() !== owner) throw new Error("Account changed. Please retry.");
    const response = await fetch(`${API.baseUrl}/cloud${path}`, {
      ...init, signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (cloudUid() !== owner) throw new Error("Account changed. Please retry.");
    if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to continue." :
      response.status === 503 ? "Cloud storage is not available yet. Your local data is preserved." :
      response.status === 400 ? "Pairing code is invalid or expired." : "Cloud request could not complete. Please retry.");
    return await response.json() as unknown;
  } finally {
    clearTimeout(timer); init.signal?.removeEventListener("abort", abort);
  }
}
