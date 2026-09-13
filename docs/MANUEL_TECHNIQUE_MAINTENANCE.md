# Manuel technique et maintenance — ALMAC

**Révision :** 12 septembre 2026

**Public :** développeurs, mainteneurs et exploitants autorisés

**Référence :** code local examiné; ce document ne certifie pas la version actuellement déployée.

## Sommaire

1. [Architecture et fichiers](#1-architecture-et-fichiers)
2. [Installation de développement](#2-installation-de-développement)
3. [Configuration et secrets](#3-configuration-et-secrets)
4. [Authentification et autorisation](#4-authentification-et-autorisation)
5. [Maintenance du code](#5-maintenance-du-code)
6. [Base de données et migrations](#6-base-de-données-et-migrations)
7. [Tests et intégration continue](#7-tests-et-intégration-continue)
8. [Déploiement et retour arrière](#8-déploiement-et-retour-arrière)
9. [Exploitation et sauvegardes](#9-exploitation-et-sauvegardes)
10. [Diagnostic](#10-diagnostic)
11. [Limites et entretien documentaire](#11-limites-et-entretien-documentaire)

Les processus métier sont décrits dans le [manuel de fonctionnement](./MANUEL_DE_FONCTIONNEMENT.md); les manipulations à l’écran dans le [manuel utilisateur](./MANUEL_UTILISATEUR.md).

## 1. Architecture et fichiers

Parcours principal : navigateur HTTPS → Next.js → API NestJS → PostgreSQL. Le navigateur conserve un cookie de session HttpOnly; les routes serveur Next.js transmettent l’authentification à l’API. Les courriels sont envoyés par le fournisseur configuré, pas par le navigateur.

| Emplacement | Responsabilité |
|---|---|
| `apps/api/src` | Modules NestJS, contrôleurs, DTO, services et accès SQL |
| `apps/api/test` | Tests d’intégration PostgreSQL et fabriques de données |
| `apps/web/app` | Pages Next.js et routes serveur de relais `/api` |
| `apps/web/components` | Interfaces et composants interactifs |
| `apps/web/lib` | Contexte serveur, session, traduction, sécurité et utilitaires |
| `infra/db/migrations` | Historique SQL versionné |
| `infra/db/seeds` | Données d’exemple, séparées de l’exploitation |
| `infra/scripts` | Sauvegarde et restauration |
| `infra/deploy/Caddyfile` | Reverse proxy HTTPS du déploiement Compose |
| `compose.production.yml` | PostgreSQL, migration ponctuelle, API, web et Caddy |
| `.github/workflows/ci.yml` | Vérification de release, tests, audits et images |
| `typescript-starter-master` | Paquet secondaire encore inclus dans les contrôles racine |
| `docs` | Procédures métier, exploitation, décisions et preuves de recette |

`apps/api` fait partie du dépôt parent dans la topologie actuelle. Vérifier cette situation avant toute opération Git; consulter la [décision de topologie](./decisions/ADR-API-REPOSITORY-TOPOLOGY.md). Ne pas créer un nouveau dépôt imbriqué.

## 2. Installation de développement

### Prérequis

Utiliser Node.js 22 et pnpm 10.33.0 pour reproduire la CI, Git et PostgreSQL 16. Docker Desktop est utile pour la base locale et les images. Les outils clients PostgreSQL sont nécessaires pour les sauvegardes. Les fichiers de verrouillage des dépendances sont distincts : une installation à la racine ne remplace pas les trois installations ci-dessous.

Depuis `C:\Dev\school-management-system` :

```powershell
git status --short
node --version
pnpm --version
pnpm --dir apps/api install --frozen-lockfile
pnpm --dir apps/web install --frozen-lockfile
npm --prefix typescript-starter-master ci
docker compose up -d postgres
```

Créer la configuration locale à partir des exemples de l’API et du web, uniquement si les fichiers locaux n’existent pas déjà. Ne jamais écraser une configuration de travail. Configurer `DATABASE_URL` pour la base locale, puis lancer :

```powershell
pnpm db:migrate
pnpm db:migrate:verify
```

Dans deux terminaux séparés :

```powershell
pnpm dev:api
```

```powershell
pnpm dev:web
```

Vérifier les ports annoncés au démarrage : API habituellement 4000, web habituellement 3000. Aligner `APP_PUBLIC_URL`, les origines autorisées et l’adresse réellement ouverte; les exemples ne constituent pas une détection automatique du port.

Le script [de configuration du poste](../scripts/setup-development-pc.ps1) et le [guide de déplacement Windows](./MOVE_DEVELOPMENT_TO_WINDOWS_11.md) complètent cette procédure.

### Premier compte

Une base neuve n’hérite pas des comptes de développement. La procédure autorisée de création du premier Super Admin est :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-super-admin.ps1
```

Elle demande une confirmation explicite et les informations de connexion à la base cible. Utiliser la bonne base et saisir les secrets dans les invites prévues. La commande sous-jacente est `pnpm --dir apps/api admin:bootstrap`. Ce n’est ni une inscription publique ni un mécanisme de récupération arbitraire de comptes existants. Ne pas utiliser les données de démonstration pour initialiser une école réelle.

## 3. Configuration et secrets

Sources de référence : [exemple API](../apps/api/.env.example), [exemple web](../apps/web/.env.example), [exemple Compose](../.env.production.example).

| Variable / famille | Emplacement | Contrôle à effectuer |
|---|---|---|
| `NODE_ENV` | API et web | `production` pour un déploiement public |
| `PORT` | API | Port numérique attendu par l’hébergement |
| `DATABASE_URL` | API / tâche de migration | URL PostgreSQL de la bonne base; identités d’exécution et de migration distinctes en production |
| `API_BASE_URL` | Serveur web | API joignable depuis le serveur web, sans slash final; jamais `localhost` pour joindre un autre hébergeur |
| `APP_PUBLIC_URL` | API et web | Adresse canonique HTTPS de l’interface; utilisée notamment pour les liens envoyés |
| `TRUSTED_ORIGINS` | Web | Origines exactes autorisées pour les requêtes de mutation |
| `CORS_ALLOWED_ORIGINS` | API | Origines exactes, sans chemin ni joker permissif |
| `AUTH_COOKIE_NAME` | Web | `__Host-almac_session` en HTTPS production |
| `AUTH_COOKIE_SAME_SITE` | Web | Politique configurée, généralement `lax` |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | API | Clé privée valide et expéditeur autorisé par le fournisseur |
| `TRUST_PROXY` | API | Cohérent avec le reverse proxy réel; ne pas élargir aveuglément la confiance |
| `UPLOAD_STORAGE_ROOT` | Web | Emplacement privé persistant et accessible au processus non-root |
| `APP_VERSION` | Déploiement | Identifiant traçable de release / image |

Exemple d’origine valide : `https://ecole.example.org`. Une page comme `https://ecole.example.org/login` n’est pas une origine. Les domaines de prévisualisation sont différents du domaine canonique : ne pas autoriser tous les domaines d’un hébergeur.

Ne placer aucune clé, URL de base avec mot de passe ou donnée de session dans une variable `NEXT_PUBLIC_*`, une capture ou le dépôt. Après modification de l’environnement distant, redéployer les services concernés et vérifier la version réellement en service.

Le runner utilise `DATABASE_URL`. Une variable nommée `MIGRATION_DATABASE_URL` n’est utile que si le job la transmet explicitement comme `DATABASE_URL`; son nom seul ne change pas la connexion.

## 4. Authentification et autorisation

### Frontière de confiance

1. Le serveur web contrôle l’origine des opérations sensibles.
2. L’API valide la session, sa durée, sa révocation et sa cohérence avec le compte.
3. Le service vérifie le rôle actif dans l’école demandée.
4. Le service vérifie le périmètre de l’enregistrement : section, matière, élève ou permission financière.
5. La transaction enregistre les données et l’événement d’audit requis.

Les gardes doivent aussi couvrir les lectures, téléchargements, exports et routes parent. Un identifiant provenant du navigateur n’est jamais une preuve d’autorisation.

### Invariants à préserver

- Ne jamais retourner de hachage de mot de passe, jeton brut, version d’authentification ou erreur SQL interne.
- Les changements de rôle, adhésion, affectation ou permissions invalident les sessions selon leur workflow.
- Le personnel et le compte utilisateur restent distincts; ne pas rendre le compte obligatoire pour la paie.
- Les enseignants sont limités à leurs affectations actives; les parents aux élèves liés par les responsables autorisés.
- Les permissions financières sont explicites; le rôle finance ne donne pas automatiquement la paie.
- L’approbation et la clôture de paie exigent l’administrateur scolaire actif, pas seulement un rôle de plateforme.
- Les invitations et récupérations doivent rester à usage unique, expirable et révocable.
- Ne pas journaliser de corps de requête contenant mots de passe, données médicales, cookies ou liens d’activation.

Repères de code : `apps/api/src/auth`, `apps/api/src/access-management`, `apps/web/lib/auth`, `apps/web/lib/security/trusted-origin.ts`, `apps/web/lib/server-context.ts`.

## 5. Maintenance du code

### Procédure d’une modification

1. Lire le code, les tests et les instructions `AGENTS.md` du répertoire concerné.
2. Examiner `git status --short`; préserver les modifications étrangères à la tâche.
3. Reproduire le défaut avec un test ciblé lorsque possible.
4. Modifier DTO, contrôleur, service, relais web et interface de façon cohérente.
5. Ajouter les cas autorisé, interdit, autre école et donnée invalide.
6. Vérifier la traduction française et anglaise, les erreurs, l’état de chargement et le double clic.
7. Exécuter les tests ciblés puis les contrôles complets nécessaires.
8. Documenter le changement et préparer un commit contenant uniquement les chemins intentionnels.

### Transactions et concurrence

Conserver dans une même transaction les modifications dépendantes, leur audit et la révocation des sessions. Ne pas retirer un verrou ou un contrôle de version pour faire passer un test. Pour un paiement, conserver la clé d’idempotence du même essai logique : un délai réseau ne justifie pas la création immédiate d’une nouvelle opération.

Les montants, dates scolaires, devises et transitions doivent être contrôlés au serveur. Une période fermée ne doit pas être contournée en décalant la date d’une écriture. Les factures et paiements confirmés se corrigent par les événements prévus, pas par une suppression SQL.

### Points de maintenance métier

- **Imports CSV :** modèle exact, UTF-8, prévisualisation et contrôle serveur à la confirmation. Limites actuelles : élèves 1 000 lignes, personnel 500. Le personnel importé est en brouillon sans compte automatique. Le lot est transactionnel.
- **Personnel :** préserver emploi, liens utilisateurs, documents privés et historiques lors d’une suspension ou dissociation.
- **Paie :** versions de rémunération effectives au début de période et instantanés immuables. Cycle `DRAFT → UNDER_REVIEW → PENDING_APPROVAL → APPROVED → PROCESSING → PAID → CLOSED`. `REVIEWED` est un état de compatibilité, pas une nouvelle étape à générer.
- **Documents :** accès privé et contrôles de type, taille et signature. Pour les documents personnel, PDF/JPEG/PNG/WebP, limite 10 Mo. Ne pas généraliser cette limite à tous les autres téléversements sans vérifier leur code.
- **Encodage :** conserver UTF-8; vérifier les accents sur les écrans et dans les CSV. Un problème d’affichage du terminal n’établit pas, à lui seul, une corruption du fichier.

## 6. Base de données et migrations

### Règles

L’identité d’une migration est son nom complet, pas son préfixe numérique. L’ordre est lexical. Les préfixes dupliqués existants sont donc acceptés. Le runner conserve les empreintes SHA-256 dans `schema_migrations` et utilise un verrou consultatif PostgreSQL pour éviter deux migrations simultanées.

Ne jamais renommer une migration appliquée, modifier son contenu ou remplacer son empreinte pour masquer une divergence. Créer une nouvelle migration corrective. Ne pas envelopper aveuglément les fichiers SQL dans une transaction supplémentaire : certains ont leurs propres limites de transaction; utiliser le runner maintenu.

### Commandes

Avec `DATABASE_URL` injectée dans le processus et vérifiée comme cible voulue :

```powershell
pnpm db:migrate:status
pnpm db:migrate:verify
pnpm db:migrate
pnpm db:migrate:status
pnpm db:migrate:verify
```

Sur une base neuve isolée, exécuter une deuxième fois `pnpm db:migrate` et vérifier qu’aucune migration n’est rejouée. Les données de démonstration restent un choix explicite de développement. Ne pas exécuter `db:seed:demo` en staging de recette réelle ou en production.

### Installation existante sans historique fiable

La baseline est une opération administrative, pas une solution automatique à une erreur SQL. Sauvegarder, comparer le schéma réel avec la release d’origine et identifier exactement les migrations déjà appliquées. Le chemin historique documenté importe au plus jusqu’à `058_operational_user_access.sql`, après contrôles et confirmation `BASELINE_EXISTING_SCHEMA`; ne pas l’utiliser pour prétendre qu’une base plus récente a été vérifiée.

Les migrations `002_core_tables.sql` et `019_backfill_school_levels.sql` ont une histoire particulière : consulter la [décision de canonicalisation](./decisions/ADR-LEGACY-MIGRATION-CANONICALIZATION.md) et la [procédure de déploiement](./DEPLOYMENT.md). Une empreinte incompatible avec une installation existante exige une réconciliation avec sa source de release, pas un remplacement silencieux.

Pour les historiques personnel/paie, `pnpm db:staff:reconcile` et `pnpm db:staff:reconcile:strict` donnent les contrôles prévus. Lire leur résultat et la procédure associée avant de toucher aux liens historiques.

## 7. Tests et intégration continue

### Contrôles locaux

```powershell
pnpm lint
pnpm test
pnpm build:api
pnpm build:web
pnpm check
git diff --check
```

`pnpm check` rassemble lint, tests unitaires et builds, y compris le paquet secondaire. Les tests d’intégration PostgreSQL sont séparés; un `check` vert ne prouve pas qu’ils ont été exécutés.

Pour limiter le temps de développement, commencer par la suite touchée, par exemple :

```powershell
pnpm --dir apps/api test --runInBand
pnpm --dir apps/web lint
```

### Intégration sur base jetable

Reproduire les variables et étapes du [workflow CI](../.github/workflows/ci.yml). Préparer une instance PostgreSQL 16 de test avec une base dédiée `school_mgmt_test` et un rôle autorisé à créer les bases temporaires des scénarios de migration.

Injecter `TEST_DATABASE_URL` et `TEST_DATABASE_ADMIN_URL` par un mécanisme local de secrets, puis, dans un terminal réservé à ces tests :

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
pnpm db:migrate
pnpm db:migrate
pnpm db:migrate:verify
pnpm test:integration
```

Contrôler la destination avant exécution. Les helpers vident les tables applicatives de test; les garde-fous de nom ne remplacent pas une infrastructure isolée. Ne jamais donner à ces tests les identifiants de production ou une base contenant les dossiers réels d’une école. Retirer ensuite les variables de ce terminal ou le fermer.

Les fabriques se trouvent dans `apps/api/test/support`. Les suites couvrent notamment authentification, invitations, périmètres, migrations, imports, caisse, corrections, paie, personnel et inscriptions. Leur présence n’est pas une preuve de passage sur la release actuelle : conserver les résultats horodatés.

### Audit et images

```powershell
pnpm --dir apps/api audit --prod
pnpm --dir apps/web audit --prod
npm --prefix typescript-starter-master audit --omit=dev
docker compose --env-file .env.production -f compose.production.yml config --quiet
docker compose --env-file .env.production -f compose.production.yml build
```

`config --quiet` évite d’afficher les secrets interpolés. Corriger les dépendances par une mise à jour compatible et le fichier de verrouillage correspondant; ne pas désactiver l’audit pour obtenir du vert.

La CI actuelle s’exécute sur les pull requests et les branches configurées (`main`, `master`, `release/**`). Elle vérifie qualité, PostgreSQL, migrations et images; elle n’équivaut pas à un déploiement automatique. Après un push, contrôler le SHA du run et tous ses jobs.

## 8. Déploiement et retour arrière

### Option intégrée Compose

Suivre [DEPLOYMENT.md](./DEPLOYMENT.md). Préparer DNS, ports HTTPS, environnement privé et secrets distincts; conserver une copie hors dépôt de la configuration. Le déploiement inclut un job de migration ponctuel avant l’API, des contrôles de santé, des processus non-root et une base non exposée publiquement.

Après la sauvegarde préalable et les vérifications d’environnement :

```powershell
docker compose --env-file .env.production -f compose.production.yml config --quiet
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d
docker compose --env-file .env.production -f compose.production.yml ps
```

Vérifier la réussite de `migrate`, la santé API/web et `/login` par l’adresse HTTPS. Les volumes `postgres_data` et `uploaded_files` sont persistants et doivent être sauvegardés. Ne pas utiliser `docker compose down -v` sur cet environnement.

### Option staging répartie : web, API et base séparés

Dans un montage Vercel / Render / Neon, le web, l’API et PostgreSQL sont trois services distincts. Les procédures commerciales des hébergeurs peuvent évoluer : le présent manuel décrit les contraintes de l’application, pas leurs offres ni leurs écrans de configuration.

1. Appliquer les migrations à la base staging avec les identifiants de migration.
2. Déployer l’API avec la connexion d’exécution à cette même base et vérifier sa readiness.
3. Configurer le serveur web avec l’URL HTTPS publique de cette API, sans slash final.
4. Aligner les origines web/API et les liens de courriel sur le domaine canonique du web.
5. Créer le premier administrateur par la procédure de bootstrap, si la base est neuve.
6. Vérifier connexion, invitation, récupération et accès à une école de recette.

Les fichiers locaux d’un runtime éphémère ne constituent pas un stockage durable. Les téléversements privés doivent disposer d’un stockage persistant compatible avec le code, ou d’une intégration de stockage validée, avant une recette de documents. Le volume Compose ne se transpose pas automatiquement à un hébergement serverless.

### Upgrade et rollback

1. Noter les SHA/images actuels, l’environnement et le dernier point de sauvegarde validé.
2. Tester l’upgrade sur une copie isolée, y compris l’absence de doublons après migration.
3. Annoncer la fenêtre d’intervention et limiter les écritures si nécessaire.
4. Déployer la nouvelle version et relever migrations, readiness et tests de fumée.
5. En cas d’échec, arrêter l’arrivée de nouvelles écritures et conserver les journaux utiles.
6. Revenir aux images précédentes uniquement si elles sont compatibles avec le schéma actuel.
7. Sinon, restaurer le couple base/fichiers vers une infrastructure isolée, valider puis basculer le trafic selon le plan d’incident.

Il n’existe pas de promesse de migration inverse automatique. Restaurer une ancienne sauvegarde peut perdre les écritures postérieures : cette décision appartient au responsable d’incident et doit être tracée.

## 9. Exploitation et sauvegardes

### Santé et journaux

- `/health/live` : processus API vivant.
- `/health/ready` : API prête avec connexion base; échec de dépendance signalé par 503.
- `/health` : contrôle de readiness conservé pour compatibilité.

En local, utiliser par exemple `curl.exe -f http://localhost:4000/health/ready`. En Compose production, tester l’API depuis son réseau interne; ne pas supposer que le reverse proxy web expose les endpoints API publics au même chemin.

```powershell
docker compose --env-file .env.production -f compose.production.yml logs --tail 100 api
docker compose --env-file .env.production -f compose.production.yml logs --tail 100 migrate
```

Les journaux de production structurés servent à corréler heure, service/version, requête, statut et durée. Utiliser un identifiant de requête pour le support. Ne pas activer un dump de corps HTTP, cookies, en-têtes d’autorisation ou paramètres de connexion pour diagnostiquer un incident.

Alertes à mettre en place : indisponibilité, readiness, taux de 5xx, échecs de connexion, refus inter-écoles répétés, échecs de courriel, capacité disque, échecs de sauvegarde et ancienneté du dernier exercice de reprise. Les alertes doivent aboutir à une personne désignée; leur documentation ne les configure pas.

### Sauvegarde et exercice

Procédure complète : [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md). Objectifs du pilote : RPO de 24 heures, RTO de 4 heures, à mesurer lors des exercices; ce ne sont pas des garanties déjà démontrées.

Avec `DATABASE_URL` injectée et un répertoire protégé :

```powershell
.\infra\scripts\backup-postgres.ps1 -BackupDirectory C:\Secure\AlmacBackups -RetentionDays 14
```

Conserver ensemble archive compressée et empreinte `.sha256`; copier chiffré hors de l’hôte. Sauvegarder les fichiers privés au même rythme. Politique cible : 14 sauvegardes quotidiennes et 8 hebdomadaires; la copie et la rétention hebdomadaire doivent être organisées par l’exploitation.

L’exercice [verify-backup-restore.ps1](../infra/scripts/verify-backup-restore.ps1) crée une base jetable, vérifie l’archive et la restaure; lire ses paramètres dans le runbook et ne jamais viser une base existante. Les outils clients doivent correspondre à la version majeure PostgreSQL du serveur.

Après restauration : vérifier migrations, volumes, readiness, comptes/écoles, quelques dossiers élèves, factures, paiements, reçus et téléchargements; mesurer le temps réel et faire signer le résultat. Exercice avant pilote puis au moins trimestriel. Protéger aussi la récupération des clés, DNS et comptes fournisseurs avec deux mainteneurs autorisés.

## 10. Diagnostic

| Symptôme | Vérifications ciblées |
|---|---|
| `Request origin is not allowed` | Comparer l’origine réelle du navigateur avec `TRUSTED_ORIGINS` du web et l’environnement redéployé; ne pas ouvrir la politique à tous |
| `Cannot POST //auth/login` | Retirer le slash final de `API_BASE_URL`, vérifier le relais puis redéployer |
| `fetch failed` ou retour à `/login` après connexion | Tester API/readiness depuis le serveur web; vérifier URL interne, TLS, cookie et réponse du contexte utilisateur sans capturer ses secrets |
| Compte local absent sur staging | Vérifier la base utilisée; un déploiement n’importe pas les utilisateurs locaux |
| Identifiants refusés | Vérifier activation, statut et bonne base; utiliser récupération ou procédure administrateur, jamais modifier un hachage arbitrairement |
| Courriel non envoyé | Vérifier clé fournisseur, expéditeur autorisé, statut de livraison et URL publique; ne pas afficher la clé |
| `Active School Administrator access is required` | Vérifier l’adhésion active dans l’école ciblée; un rôle global ne remplace pas tous les contrôles métier |
| Méthode absente / nombre d’arguments TypeScript | Comparer contrat contrôleur/service, DTO et modifications locales; compléter le contrat et ses tests sans retirer les gardes |
| `ChunkLoadError` | Vérifier la version déployée, le chargement des fichiers statiques et le serveur dev; recharger une fois, ne pas supprimer les uploads |
| Accents incorrects dans CSV | Réexporter UTF-8 et vérifier le modèle, les en-têtes et la prévisualisation |
| Empreinte de migration différente | Stopper le déploiement, comparer avec la release d’origine et suivre la procédure de réconciliation |
| Readiness 503 | Vérifier connectivité, base cible, TLS, droits et disponibilité PostgreSQL; conserver les détails en logs internes |

Pour un incident : recueillir heure, release, rôle, école, action et identifiant de requête; minimiser les données personnelles. Utiliser le [runbook](./OPERATIONS_RUNBOOK.md) pour panne, migration échouée, révocation d’urgence et reprise.

## 11. Limites et entretien documentaire

- L’existence d’une API parent ne prouve pas un portail web complet; aucune page dédiée n’a été identifiée dans les routes examinées.
- Les documents du personnel ont des contrôles locaux de fichiers; l’antivirus, les rappels planifiés et les politiques avancées de congés restent à traiter selon les limites du module.
- Le contrôle financier ne remplace pas un grand livre comptable complet, une synchronisation bancaire ou un moteur fiscal.
- L’accès distant, les courriels réels, HTTPS, la persistance des uploads, les alertes et la restauration doivent être validés sur l’environnement cible.
- Les présentes procédures ne remplacent pas une recette signée. Consulter [UAT_CHECKLIST.md](./UAT_CHECKLIST.md), [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) et [PILOT_PLAN.md](./PILOT_PLAN.md).

Pour chaque release, inscrire le SHA réellement testé, la date de révision des manuels, les résultats CI/UAT, l’exercice de sauvegarde et le responsable support. Mettre à jour les procédures lors d’un changement de route, rôle, limite d’import, état métier ou variable d’environnement. Ne pas présenter un ancien rapport de vérification comme la preuve d’une nouvelle version.
