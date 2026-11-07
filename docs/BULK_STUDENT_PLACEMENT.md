# Affectation groupée / Bulk class placement

Dans **Élèves → Affectation groupée** :

1. Choisir l'année scolaire puis la classe. Les effectifs et capacités sont affichés.
2. Rechercher les élèves sans classe, sélectionner les lignes ou la page entière.
   La sélection est conservée entre pages, limitée à 100 élèves par opération.
   Une nouvelle recherche efface la sélection pour éviter les affectations cachées.
3. Choisir si les élèves doivent aussi être activés (case explicite, cochée par défaut).
4. Prévisualiser. Corriger les blocages ou retirer les élèves concernés et revérifier.
5. Confirmer dans la fenêtre de confirmation. Le lot est atomique : tout ou rien.

Un élève déjà affecté ne peut pas être transféré par ce workflow, même vers une
autre année. Utiliser le transfert individuel avec son motif. Les statuts autorisés
sont PRE_REGISTERED, REGISTERED et ACTIVE. Les élèves supprimés/suspendus/archivés
et les années clôturées sont bloqués. Les contrôles sont répétés à la confirmation.

## Implementation / release

- No new migration. Existing enrollment, status-history and audit tables are reused.
- POST `/school-students/bulk-placement/preview` and `/school-students/bulk-placement`.
- Active authorized School Admin or platform operator only, checked server-side.
- School, academic year and destination section must agree. Student IDs must be
  unique, same-school, non-deleted and free of any active enrollment.
- Ordered student locks and a destination section lock serialize capacity checks
  with individual placement. The existing transactional enrollment workflow is
  shared; no per-student commits or background partial imports are used.
- Activation is optional. Each activation preserves a status-history entry and
  each placement preserves its existing per-student audit event, plus a batch event.
- A retry after success is rejected as already assigned, not duplicated.
- This batch does not implement CSV `class_code` resolution or bulk transfers.

UAT on staging: assign a small unassigned cohort, verify roster and attendance
visibility; test insufficient seats, stale preview, another-school IDs and closed
year; verify no silent transfer; check French/English, both themes and mobile view.
Use a new isolated cohort for the 100-student load case. Never enlarge real class
capacities solely to make a test pass.
