# Guide de lecture et de commentaire du code

Ce guide complète le [manuel technique](MANUEL_TECHNIQUE_MAINTENANCE.md). Il décrit le code local, pas une certification de la version déployée.

## Où chercher

| Besoin | Point d'entrée |
|---|---|
| Identité, expiration et révocation | `apps/api/src/auth/auth.service.ts`, méthode `requireSession` |
| Droits opérationnels et changement de périmètre | `apps/api/src/access-management/access-management.service.ts` |
| Reprise sûre des paiements/factures | `apps/api/src/finance-operations/finance-operations.service.ts`, helpers d'idempotence |
| Historique et exécution SQL | `apps/api/src/database-migrations/migration-runner.ts` |
| Langue côté navigateur | `apps/web/components/i18n-provider.tsx` |
| Langue côté serveur | `apps/web/lib/i18n/index.ts`, `apps/web/i18n.config.ts` |
| Apparence et navigation | `apps/web/components/layout/app-shell.tsx`, `sidebar.tsx`, `theme-provider.tsx` |

## Invariants à préserver

- Une session valide ne suffit pas à autoriser l'accès à une école ou à un dossier. Vérifier le rôle actif et le périmètre côté API.
- Une modification du périmètre opérationnel et la révocation des sessions doivent être atomiques. La révocation globale des sessions ne signifie pas une suspension globale du compte.
- Une clé d'idempotence identifie une tentative financière : conserver la même clé et le même contenu lors d'une reprise incertaine. Un résultat rejoué doit correspondre au même acteur.
- L'enregistrement d'idempotence et la mutation financière utilisent la même transaction. Ne pas sauvegarder un succès avant le commit métier.
- Les migrations sont identifiées par leur nom complet. Ne pas modifier une migration appliquée ni réécrire son empreinte pour contourner un refus.
- Les anciennes migrations sans transaction peuvent laisser des changements partiels après échec. Le chemin de compatibilité n'est pas une garantie d'atomicité; voir le runbook avant reprise.
- Les thèmes utilisent des couleurs sémantiques. Les traductions doivent fournir les mêmes clés en français et anglais; la parité des clés ne prouve pas l'absence de textes codés en dur.

## Comment écrire les commentaires

Expliquer le **pourquoi**, les frontières de confiance, les transactions, les effets de bord et les contraintes de compatibilité. Éviter de répéter ce que le nom d'une variable ou la syntaxe exprime déjà. Utiliser JSDoc pour un contrat partagé quand ses entrées, sorties ou exceptions ne sont pas évidentes.

Les commentaires source restent en anglais pour cohérence technique; les manuels opérateur peuvent être en français. Ne jamais mettre de secrets, jetons réels, données d'élèves ou identifiants de connexion dans les exemples. Mettre à jour commentaire, tests et documentation dans le même changement lorsque la règle évolue.

## Vérifier un changement documentaire

1. Lire la branche de code concernée avant de décrire son comportement.
2. Ne pas présenter une intention future comme une garantie existante.
3. Pour un commentaire seulement, vérifier le diff et la compilation du paquet touché.
4. Pour un changement fonctionnel, ajouter des tests ciblés puis exécuter les contrôles de release.
5. Ne pas exécuter une migration ou une restauration pour une simple mise à jour documentaire.

## Couverture de cette première passe

Commentaires ajoutés sur validation des sessions, invalidation des droits, idempotence financière et migration SQL. Le payroll, les invitations, imports CSV et dossiers étudiants restent à commenter lors de passes ciblées; ce guide ne prétend pas que tous les modules sont documentés.

## Deuxième passe : contrats inter-modules

Commentaires supplémentaires : acceptation d'invitation pour compte existant, import du personnel, transition payroll, soumission des présences, transaction PostgreSQL, parsing CSV, relais HTTP authentifié et file locale des présences.

### Lecture d'un module API

Lire dans cet ordre : module NestJS → contrôleur (routes et session) → DTO (forme de la requête) → service (permissions, règles métier, SQL) → migrations (contraintes et historique) → tests. Un DTO valide ne prouve ni l'appartenance à l'école ni l'autorisation sur un dossier. Certaines méthodes de lecture délèguent les contrôles au contrôleur : vérifier la chaîne complète avant réutilisation.

### Carte des domaines

| Domaine | Répertoires à examiner ensemble | Documentation métier |
|---|---|---|
| Comptes et accès | auth, internal-auth, access-management, me | Manuel technique, ADMINISTRATIVE_ROLES |
| Écoles et plateforme | schools, platform-schools, platform-onboarding, platform-staff, platform-bootstrap | DEPLOYMENT, OPERATIONS_RUNBOOK |
| Élèves et responsables | students, school-students, guardians, enrollments | Manuel utilisateur, UX_ROADMAP |
| Admissions | admissions | ADMISSIONS_UX_VALIDATION |
| Enseignement | academic, subjects, section-subjects, teachers, assessments, assessment-scores, gradebooks, attendance, report-cards | Manuel de fonctionnement |
| Finances | finance-operations, finance-admin, invoices, payments, fee-plans, student-discounts | FINANCE_CORE_INTEGRITY et guides FINANCE_* |
| Paie | finance-payroll, staff-management | STAFF_MANAGEMENT_LIFECYCLE, manuel de fonctionnement |
| Personnel et conformité | staff-management, access-management | STAFF_DIRECTORY_FOUNDATION, STAFF_COMPLIANCE_AND_LEAVE, STAFF_SELF_SERVICE |
| Infrastructure | db, database-migrations, common, health, email, platform-activity | BACKUP_AND_RECOVERY, OPERATIONS_RUNBOOK |
| Interface | app, components, lib | I18N_MIGRATION, SCHOOL_APPEARANCE, UX7_USER_TESTING |

Cette carte couvre les domaines du dépôt, mais ne certifie pas une revue ligne par ligne. Les services historiques et opérationnels coexistent : ne pas supprimer l'un parce que son nom ressemble à un autre sans vérifier ses consommateurs.

### Règles pratiques du frontend

- Les fichiers `app/api/**/route.ts` sont des relais serveur; ne pas copier un jeton dans le stockage JavaScript.
- Garder la clé d'idempotence d'un paiement incertain. Le changement de clé est une nouvelle opération, pas une reprise.
- Un parsing CSV réussi ne signifie pas que l'import sera autorisé. La prévisualisation doit être recalculée côté API.
- La file hors ligne des présences contient des données locales et peut conserver des échecs. Vérifier les procédures de nettoyage sur appareil partagé; ne pas la considérer comme un journal officiel.
- Le changement de langue est une présentation, pas une modification des codes métier. Ne pas traduire les valeurs envoyées dans les DTO.
- Les tests de contraste des tokens ne prouvent pas que tous les composants utilisent ces tokens.

### Infrastructure et documentation

Lire les scripts avant exécution, vérifier la cible résolue et distinguer lecture, migration, sauvegarde et restauration. Les manifests CI/Docker décrivent une configuration, pas une preuve d'exécution. Une modification de documentation n'autorise pas un déploiement ni une opération destructive.

### Poursuite de la revue

Restent à relire en détail : calculs payroll et snapshots, transitions d'admission, inscriptions/affectations élèves, documents privés et conformité, publication des bulletins, reporting, scripts de déploiement/restauration et méthodes historiques. Ajouter des commentaires aux branches délicates après lecture, pas des en-têtes génériques à tous les fichiers.
