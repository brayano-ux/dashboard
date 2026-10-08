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
À la connexion, saisissez l'URL de l'API puis l'email et le mot de passe de votre compte habituel. Ce compte doit être listé dans `PLATFORM_ADMIN_EMAILS` côté backend (à défaut, le compte `DEFAULT_ADMIN_EMAIL`). Le jeton de session reste dans `sessionStorage` (effacé à la fermeture de l'onglet) ; aucun identifiant n'est inclus dans le build.

## Déploiement sur Vercel
1. Importer ce dépôt dans Vercel (preset Vite, aucune configuration à changer).
2. Variable optionnelle : `VITE_API_URL` = URL du backend.
3. Sur Render, ajouter l'URL Vercel (ex. `https://brayano-admin.vercel.app`) à `CORS_ALLOWED_ORIGINS` du backend, séparée par une virgule, sinon le navigateur bloquera les appels.

## Côté backend
- `PLATFORM_ADMIN_EMAILS` : emails autorisés, séparés par des virgules (ex. `moi@exemple.com`). Si absent, le compte `DEFAULT_ADMIN_EMAIL` est utilisé. Un compte d'entreprise non listé reçoit 403.
- `PLATFORM_ADMIN_TOKEN` (optionnel) reste accepté en `Authorization: Bearer` pour des scripts.
- La migration `20261008000000_add_platform_suspension` doit être appliquée à la base.
