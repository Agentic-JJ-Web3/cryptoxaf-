const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (e.g. a proxy error) — status code alone drives the error below.
  }

  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.details);
  }

  return body;
}

export const api = {
  getMarketRate: () => request('/api/quotes/market'),
  previewQuote: (data) => request('/api/quotes/preview', { method: 'POST', body: JSON.stringify(data) }),
  createOrder: (data) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  getOrder: (reference) => request(`/api/orders/${encodeURIComponent(reference)}`),
  claimPayment: (reference, data) =>
    request(`/api/orders/${encodeURIComponent(reference)}/claim-payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
