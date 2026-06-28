// Typed client for the Clause FastAPI backend.
// Server components call these directly; the base URL is read from env.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface DocumentSummary {
  id: number;
  slug: string;
  title: string;
  doc_type: string;
  summary: string;
  status: string;
  num_chunks: number;
  updated_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    // Always reflect live data in the demo; no static caching.
    cache: "no-store",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status);
  }
  return (await res.json()) as T;
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return getJson<DocumentSummary[]>("/api/documents");
}

export function getDocument(slug: string): Promise<DocumentDetail> {
  return getJson<DocumentDetail>(`/api/documents/${slug}`);
}

export { ApiError };
