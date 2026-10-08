export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

/** Ouvre une session avec le compte habituel et renvoie le jeton de session. */
export async function login({ baseUrl, email, password, fetchImpl = (...args) => fetch(...args) }) {
  let response;
  try {
    response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez l'URL de l'API et CORS_ALLOWED_ORIGINS.", 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) {
    throw new ApiError(payload.message || "Email ou mot de passe incorrect.", response.status);
  }
  return payload.token;
}

/** Client de l'API /admin du backend. Aucun identifiant n'est écrit dans le build. */
export function createAdminApi({ baseUrl, token, fetchImpl = (...args) => fetch(...args) }) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch {
      throw new ApiError("Impossible de joindre le serveur. Vérifiez l'URL de l'API et CORS_ALLOWED_ORIGINS.", 0);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = {
        401: "Identifiants invalides ou session expirée.",
        403: "Ce compte n'est pas administrateur de la plateforme.",
        429: "Trop de tentatives. Réessayez dans une minute.",
        503: "L'administration est désactivée : aucun administrateur n'est configuré sur le serveur (PLATFORM_ADMIN_EMAILS).",
      }[response.status] ?? "Une erreur est survenue.";
      throw new ApiError(payload.message || fallback, response.status);
    }
    return payload;
  }

  return {
    async listOrganizations() {
      const { organizations } = await request("/admin/organizations");
      return organizations;
    },
    suspend(organizationId, reason) {
      return request(`/admin/organizations/${encodeURIComponent(organizationId)}/suspend`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
    },
    unsuspend(organizationId) {
      return request(`/admin/organizations/${encodeURIComponent(organizationId)}/unsuspend`, { method: "POST" });
    },
  };
}
