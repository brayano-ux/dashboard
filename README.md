# Brayano Admin

Tableau de bord du propriétaire de la plateforme Brayano AI : lister les entreprises, suspendre ou réactiver leur agent IA.
Il appelle les routes `/admin` du backend (`brayano_ia`), protégées par `PLATFORM_ADMIN_TOKEN`.

## Utilisation
```bash
npm install
cp .env.example .env   # optionnel : pré-remplit l'URL de l'API
npm run dev
npm test
```
À la connexion, saisissez l'URL de l'API et le token administrateur. Le token reste dans `sessionStorage` (effacé à la fermeture de l'onglet) et n'est jamais inclus dans le build.

## Déploiement sur Vercel
1. Importer ce dépôt dans Vercel (preset Vite, aucune configuration à changer).
2. Variable optionnelle : `VITE_API_URL` = URL du backend.
3. Sur Render, ajouter l'URL Vercel (ex. `https://brayano-admin.vercel.app`) à `CORS_ALLOWED_ORIGINS` du backend, séparée par une virgule, sinon le navigateur bloquera les appels.

## Côté backend
- `PLATFORM_ADMIN_TOKEN` (32 caractères minimum, ex. `openssl rand -hex 32`) doit être défini sur Render. Sans lui, `/admin` répond 503.
- La migration `20261008000000_add_platform_suspension` doit être appliquée à la base.
