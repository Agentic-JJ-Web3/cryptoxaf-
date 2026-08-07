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
  // FormData (deposit-claim screenshot upload) sets its own multipart
  // boundary in the Content-Type header — forcing application/json here
  // would break the upload, so only default it for plain JSON bodies.
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
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

// Binary responses (the admin receipt image) — request() always expects
// JSON, so this is a small separate path. Fetched as a Blob and turned
// into an object URL by the caller, rather than a bare <img src=...> to
// the API origin: cross-origin <img> embeds don't reliably send the
// session cookie under SameSite=Lax, an authenticated fetch always does.
async function requestBlob(path) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status);
  }
  return res.blob();
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
  notify: (phone) => request('/api/notify', { method: 'POST', body: JSON.stringify({ phone }) }),
  previewSellQuote: (data) => request('/api/quotes/sell-preview', { method: 'POST', body: JSON.stringify(data) }),
  createSellOrder: (data) => request('/api/orders/sell', { method: 'POST', body: JSON.stringify(data) }),
  // txHash and/or a File — at least one is required by the backend.
  claimDeposit: (reference, { txHash, receipt }) => {
    const form = new FormData();
    if (txHash) form.append('txHash', txHash);
    if (receipt) form.append('receipt', receipt);
    return request(`/api/orders/${encodeURIComponent(reference)}/claim-deposit`, { method: 'POST', body: form });
  },
  submitReview: (reference, data) =>
    request(`/api/orders/${encodeURIComponent(reference)}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: () => request('/api/reviews'),
  getActivity: () => request('/api/activity'),
};

export const adminApi = {
  login: (email, password) =>
    request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/admin/auth/logout', { method: 'POST' }),
  me: () => request('/api/admin/auth/me'),
  listQueue: () => request('/api/admin/orders'),
  getOrderHistory: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return request(`/api/admin/orders/history${qs ? `?${qs}` : ''}`);
  },
  getSummary: () => request('/api/admin/summary'),
  getOrder: (reference) => request(`/api/admin/orders/${encodeURIComponent(reference)}`),
  verifyPayment: (reference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/verify-payment`, { method: 'POST' }),
  rejectPayment: (reference, reason) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/reject-payment`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  completeOrder: (reference, payoutReference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ payoutReference }),
    }),
  refundOrder: (reference, note) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  checkDeposit: (reference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/check-deposit`, { method: 'POST' }),
  verifyDeposit: (reference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/verify-deposit`, { method: 'POST' }),
  rejectDeposit: (reference, reason) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/reject-deposit`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  completeSellOrder: (reference, payoutReference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/complete-sell`, {
      method: 'POST',
      body: JSON.stringify({ payoutReference }),
    }),
  getReceiptBlob: (reference) => requestBlob(`/api/admin/orders/${encodeURIComponent(reference)}/receipt`),
  getSettings: () => request('/api/admin/settings'),
  updateSettings: (data) => request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  listNotifyRequests: () => request('/api/admin/notify-requests'),
  markNotified: (id) => request(`/api/admin/notify-requests/${encodeURIComponent(id)}/mark-notified`, { method: 'POST' }),
  listReviews: (status) => request(`/api/admin/reviews${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveReview: (id) => request(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  rejectReview: (id) => request(`/api/admin/reviews/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
};

export { ApiError };
