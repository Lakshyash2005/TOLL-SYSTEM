const API_BASE_URL = "http://127.0.0.1:8000/api";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

let authErrorHandler = null;

export function setAuthErrorHandler(handler) {
  authErrorHandler = handler;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401 && authErrorHandler && !path.includes("/login") && !path.includes("/register")) {
      authErrorHandler();
    }
    let msg = data?.detail || data?.error || data?.message;
    let fieldErrors = {};
    if (data && typeof data === "object" && !Array.isArray(data)) {
      fieldErrors = data;
      if (!msg) {
        const parts = Object.entries(data).map(
          ([k, v]) => `${k.replace("_", " ")}: ${Array.isArray(v) ? v.join(", ") : v}`
        );
        if (parts.length > 0) msg = parts.join("; ");
      }
    }
    const err = new Error(
      msg || (typeof data === "string" ? data : null) || `Request failed (${response.status})`
    );
    err.fieldErrors = fieldErrors;
    err.status = response.status;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return { Authorization: `Token ${token}` };
}

function jsonHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...authHeaders(token),
  };
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

export async function loginUser(username, password) {
  return apiFetch("/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function registerUser(username, email, password) {
  return apiFetch("/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function logoutUser(token) {
  try {
    return await apiFetch("/logout/", {
      method: "POST",
      headers: jsonHeaders(token),
    });
  } catch (err) {
    return { message: "Logged out locally" };
  }
}

export async function getMe(token) {
  return apiFetch("/me/", { headers: authHeaders(token) });
}

export async function updateProfile(data, token) {
  return apiFetch("/me/", {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function changePassword(currentPassword, newPassword, confirmPassword, token) {
  return apiFetch("/password/change/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
}

// ─────────────────────────────────────────────
// Owner — Vehicles
// ─────────────────────────────────────────────

export async function getVehicles(token) {
  return apiFetch("/vehicles/", { headers: authHeaders(token) });
}

export async function addVehicle(vehicle, token) {
  return apiFetch("/vehicles/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(vehicle),
  });
}

export async function updateVehicle(id, data, token) {
  return apiFetch(`/vehicles/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function toggleVehicleActive(id, isActive, token) {
  return apiFetch(`/vehicles/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ is_active: isActive }),
  });
}

// ─────────────────────────────────────────────
// Owner — Wallet
// ─────────────────────────────────────────────

export async function getWallet(token) {
  return apiFetch("/wallet/", { headers: authHeaders(token) });
}

export async function demoTopUp(amount, token) {
  return apiFetch("/wallet/demo-topup/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ amount }),
  });
}

// Keep named alias for any legacy usage
export { demoTopUp as demoTopup };

// ─────────────────────────────────────────────
// Owner — Transactions & Toll
// ─────────────────────────────────────────────

export async function getTollTransactions(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "ALL") params.append("status", filters.status);
  if (filters.search) params.append("search", filters.search);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/transactions/${q}`, { headers: authHeaders(token) });
}

export async function getTollPlazas(token) {
  return apiFetch("/toll/plazas/", { headers: authHeaders(token) });
}

export async function processToll(rfidTag, tollPlazaId, token) {
  return apiFetch("/toll/process/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      rfid_tag: rfidTag,
      toll_plaza_id: Number(tollPlazaId),
    }),
  });
}

// ─────────────────────────────────────────────
// Admin — Stats
// ─────────────────────────────────────────────

export async function getAdminStats(token, range = "7d") {
  const query = range ? `?range=${encodeURIComponent(range)}` : "";
  return apiFetch(`/admin/stats/${query}`, { headers: authHeaders(token) });
}

// ─────────────────────────────────────────────
// Admin — Users
// ─────────────────────────────────────────────

export async function getAdminUsers(token, search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch(`/admin/users/${q}`, { headers: authHeaders(token) });
}

export async function updateAdminUser(id, data, token) {
  return apiFetch(`/admin/users/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

// ─────────────────────────────────────────────
// Admin — Vehicles
// ─────────────────────────────────────────────

export async function getAdminVehicles(token, search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch(`/admin/vehicles/${q}`, { headers: authHeaders(token) });
}

export async function updateAdminVehicle(id, data, token) {
  return apiFetch(`/admin/vehicles/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

// ─────────────────────────────────────────────
// Admin — Plazas
// ─────────────────────────────────────────────

export async function getAdminPlazas(token, search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch(`/admin/plazas/${q}`, { headers: authHeaders(token) });
}

export async function createAdminPlaza(data, token) {
  return apiFetch("/admin/plazas/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function updateAdminPlaza(id, data, token) {
  return apiFetch(`/admin/plazas/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

// ─────────────────────────────────────────────
// Admin — Rules
// ─────────────────────────────────────────────

export async function getAdminRules(token, plazaId = "") {
  const q = plazaId ? `?plaza_id=${plazaId}` : "";
  return apiFetch(`/admin/rules/${q}`, { headers: authHeaders(token) });
}

export async function createAdminRule(data, token) {
  return apiFetch("/admin/rules/", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function updateAdminRule(id, data, token) {
  return apiFetch(`/admin/rules/${id}/`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function deleteAdminRule(id, token) {
  const response = await fetch(`${API_BASE_URL}/admin/rules/${id}/`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to delete rule");
}

// ─────────────────────────────────────────────
// Admin — Transactions
// ─────────────────────────────────────────────

export async function getAdminTransactions(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.plaza_id) params.set("plaza_id", filters.plaza_id);
  if (filters.search) params.set("search", filters.search);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const q = params.toString() ? `?${params}` : "";
  return apiFetch(`/admin/transactions/${q}`, { headers: authHeaders(token) });
}

// ─────────────────────────────────────────────
// Admin — Reports & Export
// ─────────────────────────────────────────────

export async function getAdminReports(token) {
  return apiFetch("/admin/reports/", { headers: authHeaders(token) });
}

export async function exportAdminTransactionsCSV(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.plaza_id) params.set("plaza_id", filters.plaza_id);
  if (filters.search) params.set("search", filters.search);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const q = params.toString() ? `?${params}` : "";
  const res = await fetch(`${API_BASE_URL}/admin/transactions/export/${q}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to export transactions");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tollflow_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
