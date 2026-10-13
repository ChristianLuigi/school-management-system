# Documentation ALMAC

Point d'entrée pour les développeurs, opérateurs et utilisateurs. Les documents décrivent le dépôt; seuls les rapports datés avec une release identifiée constituent des preuves de vérification.

## Comprendre et utiliser

- [Manuel de fonctionnement](MANUEL_DE_FONCTIONNEMENT.md) : processus métier et responsabilités.
- [Manuel utilisateur](MANUEL_UTILISATEUR.md) : utilisation des écrans.
- [Manuel technique et maintenance](MANUEL_TECHNIQUE_MAINTENANCE.md) : architecture, installation, configuration et diagnostic.
- [Guide de lecture/commentaires du code](CODE_MAINTENANCE_GUIDE.md) : carte des modules, invariants et conventions.

## Déployer et exploiter

- [Déploiement](DEPLOYMENT.md), [runbook](OPERATIONS_RUNBOOK.md), [sauvegarde et reprise](BACKUP_AND_RECOVERY.md).
- [Checklist de release](RELEASE_CHECKLIST.md), [recette UAT](UAT_CHECKLIST.md), [plan pilote](PILOT_PLAN.md).
- [Topologie du dépôt API](decisions/ADR-API-REPOSITORY-TOPOLOGY.md) et [historique des migrations](decisions/ADR-LEGACY-MIGRATION-CANONICALIZATION.md).
- [Déplacement du poste Windows](MOVE_DEVELOPMENT_TO_WINDOWS_11.md).

## Modules métier

- Finances : [intégrité](FINANCE_CORE_INTEGRITY.md), [caisse](FINANCE_CASHIER_WORKFLOW.md), [facturation](FINANCE_BILLING_RUNS.md), [corrections](FINANCE_CONTROLLED_CORRECTIONS.md), [rapprochement/clôture](FINANCE_RECONCILIATION_AND_PERIOD_CLOSE.md).
- Personnel : [annuaire](STAFF_DIRECTORY_FOUNDATION.md), [cycle de vie](STAFF_MANAGEMENT_LIFECYCLE.md), [conformité/congés](STAFF_COMPLIANCE_AND_LEAVE.md), [libre-service](STAFF_SELF_SERVICE.md), [réconciliation de roadmap](STAFF_ROADMAP_RECONCILIATION.md).
- [Rôles administratifs](ADMINISTRATIVE_ROLES.md), [validation admissions](ADMISSIONS_UX_VALIDATION.md).
- Interface : [roadmap UX](UX_ROADMAP.md), [tests utilisateurs](UX7_USER_TESTING.md), [résultats à renseigner](UX7_RESULTS.md), [langues](I18N_MIGRATION.md), [apparence](SCHOOL_APPEARANCE.md).

## Preuves historiques

- [Vérification du 24 juillet 2026](RELEASE_EVIDENCE_2026-07-24.md).
- [Répétition staging du 25 juillet 2026](STAGING_REHEARSAL_EVIDENCE_2026-07-25.md).

Ne pas présenter ces résultats historiques comme validation de la branche actuelle.

## Entretien documentaire

Pour toute modification fonctionnelle, mettre à jour le guide métier concerné et ses étapes de recette. Documenter les préconditions, droits, états, effets de bord et limitations réelles. Pour un changement de configuration, actualiser les exemples et le runbook sans recopier de secrets. Ajouter un lien ici pour tout nouveau guide de référence; éviter de dupliquer les mêmes procédures dans plusieurs fichiers.
