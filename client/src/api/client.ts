const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const apiClient = {
  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { /* ignore */ }
      throw new ApiError(`GET ${path} failed: ${res.status}`, res.status, body);
    }
    return res.json();
  },
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errBody: unknown;
      try { errBody = await res.json(); } catch { /* ignore */ }
      throw new ApiError(`POST ${path} failed: ${res.status}`, res.status, errBody);
    }
    return res.json();
  },
  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errBody: unknown;
      try { errBody = await res.json(); } catch { /* ignore */ }
      throw new ApiError(`PUT ${path} failed: ${res.status}`, res.status, errBody);
    }
    return res.json();
  },
  async delete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
    if (!res.ok) {
      let errBody: unknown;
      try { errBody = await res.json(); } catch { /* ignore */ }
      throw new ApiError(`DELETE ${path} failed: ${res.status}`, res.status, errBody);
    }
    return res.json();
  },
  async upload<T = unknown>(path: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let errBody: unknown;
      try { errBody = await res.json(); } catch { /* ignore */ }
      throw new ApiError(`UPLOAD ${path} failed: ${res.status}`, res.status, errBody);
    }
    return res.json();
  },
};

export default apiClient;
