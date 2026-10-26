import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminApi, login, normalizeBaseUrl } from "./api.js";
import { describeNotification } from "./notification.js";
import { SORTS, barPercent, buildCsv, formatCount, sortOrganizations, usageOf } from "./usage.js";

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

const WHATSAPP_STATUS = {
  CONNECTED: { label: "Connecté", className: "on" },
  QR_PENDING: { label: "QR à scanner", className: "warn" },
  DISCONNECTED: { label: "Déconnecté", className: "off" },
};

function WhatsAppCell({ whatsapp }) {
  const info = WHATSAPP_STATUS[whatsapp?.status] ?? WHATSAPP_STATUS.DISCONNECTED;
  const connected = whatsapp?.status === "CONNECTED";
  return (
    <>
      <span className={`badge ${info.className}`}>{info.label}</span>
      {whatsapp?.phoneNumber && <div className="muted mono">+{String(whatsapp.phoneNumber).replace(/^\+/, "")}</div>}
      {!connected && whatsapp?.lastDisconnectedAt && (
        <div className="muted">Coupé le {formatDate(whatsapp.lastDisconnectedAt)}</div>
      )}
      {!connected && whatsapp?.lastDisconnectReason && <div className="muted">{whatsapp.lastDisconnectReason}</div>}
      {!connected && !whatsapp?.lastDisconnectedAt && whatsapp?.updatedAt && (
        <div className="muted">Dernier changement le {formatDate(whatsapp.updatedAt)} (cause non enregistrée)</div>
      )}
      {connected && whatsapp?.lastConnectedAt && <div className="muted">Connecté depuis le {formatDate(whatsapp.lastConnectedAt)}</div>}
    </>
  );
}

function UsageCell({ org, max }) {
  const usage = usageOf(org);
  return (
    <>
      <div className="usage-main"><strong>{formatCount(usage.today)}</strong> <span className="muted">aujourd'hui</span></div>
      <div className="usage-bar" aria-hidden="true"><i style={{ width: `${barPercent(usage.last30Days, max)}%` }} /></div>
      <div className="muted">7 j : {formatCount(usage.last7Days)} · 30 j : {formatCount(usage.last30Days)}</div>
      <div className="muted">Total : {formatCount(usage.total)}</div>
      {usage.lastAt ? <div className="muted">Dernière : {formatDate(usage.lastAt)}</div> : <div className="muted">Aucune réponse pour l'instant</div>}
    </>
  );
}

function UsageDialog({ organization, api, onClose }) {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });
    api.getAiUsage(organization.id, days)
      .then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err.message, data: null }); });
    return () => { cancelled = true; };
  }, [api, organization.id, days]);

  const daily = state.data?.daily ?? [];
  const max = Math.max(0, ...daily.map((day) => day.count));
  const busiest = daily.reduce((best, day) => (day.count > (best?.count ?? 0) ? day : best), null);
  const dayLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="usage-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card dialog wide">
        <h2 id="usage-title">Réponses de l'IA · {organization.name}</h2>
        {organization.owner && <p className="muted">{organization.owner.name} · {organization.owner.email}</p>}
        <label className="inline">
          Période
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
        </label>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.loading && <p className="muted">Chargement…</p>}
        {state.data && (
          <>
            <p><strong>{formatCount(state.data.total)}</strong> réponse{state.data.total > 1 ? "s" : ""} sur {days} jours
              {busiest && <span className="muted"> · pic le {dayLabel(busiest.date)} ({formatCount(busiest.count)})</span>}</p>
            <div className="chart" role="img" aria-label={`Réponses de l'IA par jour sur ${days} jours`}>
              {daily.map((day) => (
                <div className="bar" key={day.date} title={`${dayLabel(day.date)} : ${formatCount(day.count)} réponse${day.count > 1 ? "s" : ""}`}>
                  <i style={{ height: `${barPercent(day.count, max)}%` }} />
                </div>
              ))}
            </div>
            <div className="chart-axis muted"><span>{dayLabel(daily[0].date)}</span><span>{dayLabel(daily[daily.length - 1].date)}</span></div>
          </>
        )}
        <div className="actions"><button type="button" className="secondary" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}

function SummaryCards({ totals }) {
  if (!totals) return null;
  const items = [
    ["Réponses IA aujourd'hui", totals.today],
    ["7 derniers jours", totals.last7Days],
    ["30 derniers jours", totals.last30Days],
    ["Depuis le début", totals.total],
  ];
  return (
    <section className="summary" aria-label="Réponses générées par l'IA sur toute la plateforme">
      {items.map(([label, value]) => (
        <div className="stat" key={label}><span className="muted">{label}</span><strong>{formatCount(value)}</strong></div>
      ))}
    </section>
  );
}

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
        {/* Quand VITE_API_URL est défini au déploiement, l'adresse du serveur est figée : le formulaire ne peut pas envoyer vos identifiants ailleurs. */}
        {!DEFAULT_API_URL && (
          <label>
            URL de l'API
            <input type="url" required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://votre-api.onrender.com" />
          </label>
        )}
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
  const [totals, setTotals] = useState(null);
  const [sort, setSort] = useState("recent");
  const [usageTarget, setUsageTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const overview = await api.getOverview();
      setOrganizations(overview.organizations);
      setTotals(overview.totals);
    } catch (err) {
      if (err.status === 401) onLogout();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, onLogout]);

  useEffect(() => { load(); }, [load]);

  async function run(organizationId, kind, action) {
    setBusyId(organizationId);
    setError("");
    setNotice(null);
    try {
      const result = await action();
      setTarget(null);
      setNotice(describeNotification(kind, result?.notification));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const visible = sortOrganizations(organizations.filter((org) => {
    if (filter === "suspended" && !org.platformSuspended) return false;
    if (filter === "active" && org.platformSuspended) return false;
    const needle = query.trim().toLowerCase();
    return !needle
      || org.name.toLowerCase().includes(needle)
      || org.id.toLowerCase().includes(needle)
      || (org.owner?.email ?? "").toLowerCase().includes(needle);
  }), sort);
  const maxMonth = Math.max(0, ...organizations.map((org) => usageOf(org).last30Days));

  function exportCsv() {
    const blob = new Blob([buildCsv(visible)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `brayano-entreprises-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const suspendedCount = organizations.filter((org) => org.platformSuspended).length;

  return (
    <main className="dashboard">
      <header>
        <div>
          <h1>Entreprises</h1>
          <p className="muted">{organizations.length} au total · {suspendedCount} suspendue{suspendedCount > 1 ? "s" : ""}</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={exportCsv} disabled={visible.length === 0}>Exporter (CSV)</button>
          <button className="secondary" onClick={load} disabled={loading}>Actualiser</button>
          <button className="secondary" onClick={onLogout}>Se déconnecter</button>
        </div>
      </header>

      <SummaryCards totals={totals} />

      <div className="toolbar">
        <input type="search" placeholder="Rechercher par nom, email ou identifiant" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer">
          <option value="all">Toutes</option>
          <option value="active">IA autorisée</option>
          <option value="suspended">Suspendues</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
          {Object.entries(SORTS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className={notice.ok ? "success" : "warning"} role="status">{notice.message}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Entreprise</th><th>Réponses de l'IA</th><th>Forfait</th><th>WhatsApp</th><th>Réglage client</th><th>Statut plateforme</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((org) => (
              <tr key={org.id}>
                <td>
                  <strong>{org.name}</strong>
                  {org.owner && <div className="muted">{org.owner.email}</div>}
                  <div className="muted">Créée le {formatDate(org.createdAt)}</div>
                  <div className="muted mono">{org.id}</div>
                </td>
                <td className="usage"><UsageCell org={org} max={maxMonth} /></td>
                <td>
                  {org.billing ? (
                    <>
                      <strong>{org.billing.planName}</strong>
                      <div className="muted">{formatCount(org.billing.messagesUsed)} / {formatCount(org.billing.messageLimit)} messages</div>
                      {org.billing.expiresAt && <div className="muted">Jusqu'au {formatDate(org.billing.expiresAt)}</div>}
                    </>
                  ) : "—"}
                </td>
                <td><WhatsAppCell whatsapp={org.whatsapp} /></td>
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
                  <button className="secondary" onClick={() => setUsageTarget(org)}>Détail</button>{" "}
                  {org.platformSuspended ? (
                    <button className="secondary" disabled={busyId === org.id} onClick={() => run(org.id, "unsuspend", () => api.unsuspend(org.id))}>Réactiver</button>
                  ) : (
                    <button className="danger" disabled={busyId === org.id} onClick={() => setTarget(org)}>Suspendre</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={7} className="empty">Aucune entreprise à afficher.</td></tr>
            )}
            {loading && organizations.length === 0 && (
              <tr><td colSpan={7} className="empty">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {usageTarget && <UsageDialog organization={usageTarget} api={api} onClose={() => setUsageTarget(null)} />}

      {target && (
        <SuspendDialog
          organization={target}
          busy={busyId === target.id}
          onCancel={() => setTarget(null)}
          onConfirm={(reason) => run(target.id, "suspend", () => api.suspend(target.id, reason))}
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
