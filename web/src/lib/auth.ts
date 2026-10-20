const SESSION_KEYS = ["token", "userId", "role", "displayName"] as const;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userId ? { "X-User-Id": userId } : {}),
  };
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

export async function logout(apiBase: string): Promise<void> {
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearSession();
  }
}
