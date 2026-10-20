// Helper untuk menentukan API URL berdasarkan host user
// Fix CORS issue ketika user akses via 127.0.0.1 vs localhost

export function getApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  const host = window.location.hostname;
  const port = "5001";
  return `http://${host}:${port}`;
}

export const API_BASE = getApiBase();
