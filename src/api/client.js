// ─────────────────────────────────────────────────────────────────────────────
//  REST API CLIENT v5 — with _userId injected for notification sender tracking
// ─────────────────────────────────────────────────────────────────────────────
import { API_BASE } from "../constants";

// Current user id — set by App.jsx on login
let _currentUserId = null;
export function setCurrentUserId(id) { _currentUserId = id; }

export async function apiFetch(path, opts = {}) {
  // Inject _userId into POST/PUT bodies for notification sender tracking
  if (opts.body && (opts.method === "POST" || opts.method === "PUT") && _currentUserId) {
    try {
      const parsed = JSON.parse(opts.body);
      if (!parsed._userId) { parsed._userId = _currentUserId; opts.body = JSON.stringify(parsed); }
    } catch(_) {}
  }
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok && !(res.status === 404 && opts.method === "DELETE")) {
    throw new Error(data.error || "API error " + res.status);
  }
  return data;
}

export async function loadDB() {
  const attempt = () =>
    fetch(API_BASE + "/api/db")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  try { return await attempt(); }
  catch (e) {
    console.warn("loadDB: retrying in 1.5s...", e.message);
    await new Promise(r => setTimeout(r, 1500));
    try { return await attempt(); }
    catch (e2) { console.error("loadDB failed:", e2.message); return null; }
  }
}

const api = {
  // Govs
  addGov:    (name)    => apiFetch("/api/govs",       { method:"POST",   body:JSON.stringify({ name }) }),
  updateGov: (id,name) => apiFetch(`/api/govs/${id}`, { method:"PUT",    body:JSON.stringify({ name }) }),
  deleteGov: (id)      => apiFetch(`/api/govs/${id}`, { method:"DELETE" }),
  // Areas
  addArea:    (d)    => apiFetch("/api/areas",        { method:"POST",  body:JSON.stringify(d) }),
  updateArea: (id,d) => apiFetch(`/api/areas/${id}`,  { method:"PUT",   body:JSON.stringify(d) }),
  deleteArea: (id)   => apiFetch(`/api/areas/${id}`,  { method:"DELETE" }),
  // Companies
  addCompany:    (d)    => apiFetch("/api/companies",       { method:"POST",  body:JSON.stringify(d) }),
  updateCompany: (id,d) => apiFetch(`/api/companies/${id}`, { method:"PUT",   body:JSON.stringify(d) }),
  deleteCompany: (id)   => apiFetch(`/api/companies/${id}`, { method:"DELETE" }),
  // Ports
  addPort:    (d)    => apiFetch("/api/ports",       { method:"POST",  body:JSON.stringify(d) }),
  updatePort: (id,d) => apiFetch(`/api/ports/${id}`, { method:"PUT",   body:JSON.stringify(d) }),
  deletePort: (id)   => apiFetch(`/api/ports/${id}`, { method:"DELETE" }),
  // Cycles
  addCycle:    (d)    => apiFetch("/api/cycles",        { method:"POST",  body:JSON.stringify(d) }),
  updateCycle: (id,d) => apiFetch(`/api/cycles/${id}`,  { method:"PUT",   body:JSON.stringify(d) }),
  deleteCycle: (id)   => apiFetch(`/api/cycles/${id}`,  { method:"DELETE" }),
  // Requests
  addRequest:           (d)           => apiFetch("/api/requests",                 { method:"POST", body:JSON.stringify(d) }),
  updateRequest:        (id,d)        => apiFetch(`/api/requests/${id}`,           { method:"PUT",  body:JSON.stringify(d) }),
  deleteRequest:        (id)          => apiFetch(`/api/requests/${id}?_userId=${_currentUserId||''}`, { method:"DELETE" }),
  setRequestStatus:     (id,status)   => apiFetch(`/api/requests/${id}/status`,    { method:"PUT",  body:JSON.stringify({ status }) }),
  setRequestPortStatus: (id,ps,skip)  => apiFetch(`/api/requests/${id}/port-status`,{ method:"PUT", body:JSON.stringify({ portStatus:ps, skipPortCreation:skip }) }),
  repriceRequests: (cycleId,companyId)=> apiFetch("/api/requests/reprice",         { method:"POST", body:JSON.stringify({ cycleId, companyId }) }),
  repriceAll:      (cycleId)          => apiFetch("/api/requests/reprice-all",     { method:"POST", body:JSON.stringify({ cycleId }) }),
  // Tiers & prices
  saveTiers:      (tiers)  => apiFetch("/api/tiers",       { method:"PUT", body:JSON.stringify(tiers) }),
  savePortPrices: (prices) => apiFetch("/api/port-prices", { method:"PUT", body:JSON.stringify(prices) }),
  // Users
  addUser:    (d)    => apiFetch("/api/users",       { method:"POST",  body:JSON.stringify(d) }),
  updateUser: (id,d) => apiFetch(`/api/users/${id}`, { method:"PUT",   body:JSON.stringify(d) }),
  deleteUser: (id)   => apiFetch(`/api/users/${id}`, { method:"DELETE" }),
  // Notifications
  getNotifications: (userId) => apiFetch(`/api/notifications?userId=${userId}`),
  markAllRead:      (userId) => apiFetch("/api/notifications/read", { method:"POST", body:JSON.stringify({ userId }) }),
  clearNotifications: ()     => apiFetch("/api/notifications",      { method:"DELETE" }),
  // Reset
  reset: () => apiFetch("/api/reset", { method:"POST" }),
};

export default api;
