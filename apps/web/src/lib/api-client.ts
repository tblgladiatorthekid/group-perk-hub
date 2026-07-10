const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const clerk = window.Clerk;
  if (!clerk) return {};
  await clerk.load();
  const token = await clerk.session?.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader, ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
