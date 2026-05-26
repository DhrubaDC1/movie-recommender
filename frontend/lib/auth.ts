const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  username: string;
}

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: "include",   // send/receive httpOnly cookies
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export async function apiSignup(username: string, email: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Signup failed");
  }
  return res.json();
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Login failed");
  }
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function fetchUserHistory(): Promise<{ liked: string[]; disliked: string[] }> {
  const res = await apiFetch("/user/history");
  if (!res.ok) return { liked: [], disliked: [] };
  return res.json();
}

export async function submitFeedback(
  movieTitle: string,
  opinion: "liked" | "disliked",
  sessionId?: string,
  source = "post_recommendation"
): Promise<void> {
  await apiFetch("/user/feedback", {
    method: "POST",
    body: JSON.stringify({ movie_title: movieTitle, opinion, session_id: sessionId, source }),
  });
}
