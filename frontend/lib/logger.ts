const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FLUSH_INTERVAL_MS = 30_000;

interface LogEvent {
  session_id: string;
  event_type: string;
  page: string;
  event_data: Record<string, unknown>;
  client_timestamp: string;
}

class EventLogger {
  private buffer: LogEvent[] = [];
  private sessionId: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    this.sessionId = "";
  }

  /** Call once on the client after mount. */
  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.sessionId = this.getOrCreateSession();
    this.intervalId = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    window.addEventListener("beforeunload", () => this.flush());
  }

  track(eventType: string, data: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;
    this.buffer.push({
      session_id: this.sessionId,
      event_type: eventType,
      page: window.location.pathname,
      event_data: data,
      client_timestamp: new Date().toISOString(),
    });
  }

  /** Exposed so components can trigger an immediate flush (e.g. on recommend click). */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await fetch(`${API}/log-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // Put events back at the front so they're retried next flush
      this.buffer.unshift(...batch);
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  private getOrCreateSession(): string {
    const KEY = "cm_session_id";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  }
}

// Singleton — safe to import anywhere on the client
export const logger = new EventLogger();
