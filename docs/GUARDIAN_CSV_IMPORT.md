# Import CSV des responsables / Guardian CSV import

## Utilisation

Dans **Élèves → Importer des responsables**, télécharger le modèle, choisir un CSV UTF-8
séparé par des virgules (2 Mo, 1 000 lignes maximum), vérifier toutes les pages de
prévisualisation, puis confirmer. Une erreur bloque l'intégralité de l'import.
Le bilan indique les fiches créées/réutilisées et les associations créées.

Colonnes : `student_code,guardian_reference,first_name,last_name,relationship,email,phone,is_primary`.
`guardian_reference`, `first_name`, `last_name` sont obligatoires. Un email ou un
téléphone est nécessaire. `student_code` vide crée une fiche sans association.
Utiliser la même référence stable (unique dans l'école) pour tous les enfants d'un
même responsable. Relations : `MOTHER`, `FATHER`, `TUTOR`, `OTHER` (défaut `TUTOR`).
`is_primary` : true/false, oui/non, yes/no, 1/0 (défaut false).

Les coordonnées d'une même référence doivent être identiques. Un réimport identique
ne duplique ni fiches ni associations. Les données existantes et les contacts
principaux ne sont jamais écrasés : corriger via la fiche élève avant de réessayer.
Une collision de contact avec une fiche historique sans référence nécessite une
réconciliation manuelle ; aucune fusion automatique sur le nom/email/téléphone.
Ne pas inventer une nouvelle référence pour contourner un conflit.

**Aucun compte parent ni invitation n'est créé.** L'accès au portail parent reste
une étape explicite du workflow d'invitation existant.

## Deployment / maintenance

- Apply migration `080_guardian_import_reference.sql` before deploying the API.
- POST `/school-students/guardians/import/preview` and `/school-students/guardians/import`.
- Same school-admin policy as student import; frontend filtering is not authorization.
- Commit revalidates under a school-scoped advisory lock and row locks, in one transaction.
- Audit records contain counts, not guardian contact details or CSV content.
- Preview actions CREATE/REUSE refer to guardians, not login accounts.
- No CSV files are stored on disk; the authenticated proxy forwards bounded row data.
- Test command: `pnpm --dir apps/api test:integration --runInBand guardian-import`.
- Staging UAT: download template; import one standalone guardian; attach two existing
  same-school students using one reference; repeat import; verify no duplicates;
  reject unknown/cross-school student codes, conflicting details and primary contact
  conflicts; verify FR/EN labels and both themes; verify no invitation was sent.
