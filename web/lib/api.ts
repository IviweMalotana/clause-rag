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

export interface AppConfig {
  writes_protected: boolean;
  answers_enabled: boolean;
  embedding_provider: string;
}

export function getConfig(): Promise<AppConfig> {
  return getJson<AppConfig>("/api/config");
}

export interface ConversationListItem {
  id: number;
  title: string;
  message_count: number;
  updated_at: string;
}

export function listConversations(): Promise<ConversationListItem[]> {
  return getJson<ConversationListItem[]>("/api/conversations");
}

export interface MessageOut {
  id: number;
  role: string;
  content: string;
  confidence: number | null;
  no_answer: boolean;
  citations: Source[];
}

export interface ConversationDetail {
  id: number;
  title: string;
  messages: MessageOut[];
}

export function getConversation(id: number): Promise<ConversationDetail> {
  return getJson<ConversationDetail>(`/api/conversations/${id}`);
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError("Could not delete conversation", res.status);
  }
}

export function conversationExportUrl(id: number): string {
  return `${API_BASE_URL}/api/conversations/${id}/export`;
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return getJson<DocumentSummary[]>("/api/documents");
}

export function getDocument(slug: string): Promise<DocumentDetail> {
  return getJson<DocumentDetail>(`/api/documents/${slug}`);
}

export type IngestStage =
  | "queued"
  | "chunking"
  | "embedding"
  | "indexing"
  | "done"
  | "error";

export interface IngestStatus {
  document_id: number;
  slug: string;
  stage: IngestStage;
  chunks_done: number;
  chunks_total: number;
  provider: string;
  error: string | null;
}

// Client-side: upload a document for ingestion. Returns the created document.
export async function ingestDocument(form: FormData): Promise<DocumentSummary> {
  const headers: Record<string, string> = {};
  const token = getWriteToken();
  if (token) headers["X-Clause-Token"] = token;
  const res = await fetch(`${API_BASE_URL}/api/ingest`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    let detail = res.status === 401 ? "A valid write token is required." : "Upload failed";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as DocumentSummary;
}

export interface Source {
  marker: number | null;
  chunk_id: number;
  document_id: number;
  document_slug: string;
  document_title: string;
  section: string | null;
  page: number | null;
  char_start: number;
  char_end: number;
  content: string;
  score: number;
}

export type AnswerStatus = "answered" | "no_answer" | "needs_key" | "error";

export interface AnswerResponse {
  status: AnswerStatus;
  conversation_id: number;
  message_id: number | null;
  question: string;
  answer: string;
  no_answer: boolean;
  confidence: number;
  confidence_label: string;
  provider: string;
  model: string;
  citations: Source[];
  sources: Source[];
  error: string | null;
}

export interface EvalItem {
  question: string;
  expected_document: string;
  expected_section: string;
  passed: boolean;
  retrieved: Source;
}

export interface GuardrailItem {
  question: string;
  declined: boolean;
  top_score: number;
}

export interface EvalReport {
  passed: number;
  total: number;
  embedding_provider: string;
  min_score: number;
  items: EvalItem[];
  guardrail: GuardrailItem[];
}

export function getEvals(): Promise<EvalReport> {
  return getJson<EvalReport>("/api/evals");
}

export async function askQuestion(
  question: string,
  conversationId?: number | null,
): Promise<AnswerResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, conversation_id: conversationId ?? null }),
  });
  if (!res.ok) {
    let detail = "Could not get an answer";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as AnswerResponse;
}

// ---- Streaming ----

export type StreamEvent =
  | { type: "meta"; conversation_id: number; provider: string; model: string; supporting: Source[]; retrieved: Source[] }
  | { type: "delta"; text: string }
  | { type: "no_answer"; answer: string; message_id: number }
  | { type: "needs_key" }
  | { type: "done"; message_id: number; citations: Source[]; confidence: number; confidence_label: string }
  | { type: "error"; error: string };

export async function streamAnswer(
  question: string,
  conversationId: number | null | undefined,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/ask/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, conversation_id: conversationId ?? null }),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError("Stream failed", res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Parse SSE event blocks separated by a blank line.
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      try {
        const parsed = data ? JSON.parse(data) : {};
        onEvent({ type: event as StreamEvent["type"], ...parsed } as StreamEvent);
      } catch {
        /* skip malformed */
      }
    }
  }
}

// ---- Write-token (set in browser localStorage) ----

const TOKEN_KEY = "clause.write.token";

export function getWriteToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setWriteToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearWriteToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function getIngestStatus(documentId: number): Promise<IngestStatus> {
  const res = await fetch(`${API_BASE_URL}/api/ingest/${documentId}/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError("Status check failed", res.status);
  return (await res.json()) as IngestStatus;
}

export { ApiError };
