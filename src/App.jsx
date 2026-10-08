import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminApi, login, normalizeBaseUrl } from "./api.js";

const SESSION_KEY = "brayano_admin_session";
const DEFAULT_API_URL = import.meta.env.VITE_API_URL ?? "";

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // le stockage peut être indisponible (navigation privée) : la session reste en mémoire
  }
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "—");

function Login({ onLogin }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const baseUrl = normalizeBaseUrl(apiUrl);
    try {
      const token = await login({ baseUrl, email, password });
      const session = { apiUrl: baseUrl, token };
      await createAdminApi({ baseUrl, token }).listOrganizations();
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>Brayano Admin</h1>
        <p className="muted">Espace réservé au propriétaire de la plateforme.</p>
        <label>
          URL de l'API
          <input type="url" required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://votre-api.onrender.com" />
        </label>
        <label>
          Email
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mot de passe
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </main>
  );
}

function SuspendDialog({ organization, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
      <form className="card dialog" onSubmit={(e) => { e.preventDefault(); onConfirm(reason.trim()); }}>
        <h2 id="suspend-title">Suspendre {organization.name} ?</h2>
        <p className="muted">L'agent IA cessera de répondre à ses prospects. Les messages restent reçus et ses équipes peuvent répondre à la main.</p>
        <label>
          Motif (visible par le client)
          <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : abonnement impayé" autoFocus />
        </label>
        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel}>Annuler</button>
          <button type="submit" className="danger" disabled={busy}>{busy ? "Suspension…" : "Suspendre l'IA"}</button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ session, onLogout }) {
  const api = useMemo(() => createAdminApi({ baseUrl: session.apiUrl, token: session.token }), [session]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrganizations(await api.listOrganizations());
    } catch (err) {
      if (err.status === 401) onLogout();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, onLogout]);

  useEffect(() => { load(); }, [load]);

  async function run(organizationId, action) {
    setBusyId(organizationId);
    setError("");
    try {
      await action();
      setTarget(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const visible = organizations.filter((org) => {
    if (filter === "suspended" && !org.platformSuspended) return false;
    if (filter === "active" && org.platformSuspended) return false;
    const needle = query.trim().toLowerCase();
    return !needle || org.name.toLowerCase().includes(needle) || org.id.toLowerCase().includes(needle);
  });
  const suspendedCount = organizations.filter((org) => org.platformSuspended).length;

  return (
    <main className="dashboard">
      <header>
        <div>
          <h1>Entreprises</h1>
          <p className="muted">{organizations.length} au total · {suspendedCount} suspendue{suspendedCount > 1 ? "s" : ""}</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={load} disabled={loading}>Actualiser</button>
          <button className="secondary" onClick={onLogout}>Se déconnecter</button>
        </div>
      </header>

      <div className="toolbar">
        <input type="search" placeholder="Rechercher par nom ou identifiant" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer">
          <option value="all">Toutes</option>
          <option value="active">IA autorisée</option>
          <option value="suspended">Suspendues</option>
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Entreprise</th><th>Créée le</th><th>Réglage client</th><th>Statut plateforme</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((org) => (
              <tr key={org.id}>
                <td>
                  <strong>{org.name}</strong>
                  <div className="muted mono">{org.id}</div>
                </td>
                <td>{formatDate(org.createdAt)}</td>
                <td>{org.aiSettings?.aiEnabled === false ? "IA coupée par le client" : "IA activée"}</td>
                <td>
                  {org.platformSuspended ? (
                    <span className="badge off">Suspendue</span>
                  ) : (
                    <span className="badge on">Autorisée</span>
                  )}
                  {org.platformSuspended && (
                    <div className="muted">{org.suspensionReason || "Sans motif"} · {formatDate(org.suspendedAt)}</div>
                  )}
                </td>
                <td className="right">
                  {org.platformSuspended ? (
                    <button className="secondary" disabled={busyId === org.id} onClick={() => run(org.id, () => api.unsuspend(org.id))}>Réactiver</button>
                  ) : (
                    <button className="danger" disabled={busyId === org.id} onClick={() => setTarget(org)}>Suspendre</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="empty">Aucune entreprise à afficher.</td></tr>
            )}
            {loading && organizations.length === 0 && (
              <tr><td colSpan={5} className="empty">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <SuspendDialog
          organization={target}
          busy={busyId === target.id}
          onCancel={() => setTarget(null)}
          onConfirm={(reason) => run(target.id, () => api.suspend(target.id, reason))}
        />
      )}
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const login = (next) => { saveSession(next); setSession(next); };
  const logout = useCallback(() => { saveSession(null); setSession(null); }, []);
  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLogin={login} />;
}
