# Suppression groupée ciblée / Targeted bulk cleanup

## Périmètre

Élèves → Suppression groupée. Réservé au School Admin et au Super Admin autorisé
à gérer l'école, jamais au personnel administratif ordinaire. Choisir Élèves ou
Responsables, rechercher, sélectionner jusqu'à 100 fiches (25 par page), puis
vérifier. Retirer les fiches bloquées, revérifier, saisir un motif de 10 caractères
minimum et `DELETE`, puis confirmer dans la fenêtre de confirmation.

Toutes les fiches doivent être autorisées : aucune suppression partielle silencieuse.
La validation est répétée dans la transaction, même après une prévisualisation valide.

- Élèves : uniquement PRE_REGISTERED/REGISTERED sans inscription académique,
  facture (même supprimée), paiement, présence, note, document, candidature liée
  ou autre dépendance protégée. Une seule entrée initiale d'historique de statut
  est tolérée. Les transitions de statut sont protégées.
- Les associations responsables sans compte sont masquées en même temps que l'élève.
  Aucune fiche responsable n'est supprimée automatiquement. Les autres enfants
  du même responsable conservent leur association.
- Un accès parent lié bloque le nettoyage ; aucune session ou autorisation n'est
  modifiée implicitement.
- Responsables : aucune association élève active, aucun compte utilisateur et
  aucune dépendance protégée (invitation, lien de compte, etc.). Après nettoyage
  des élèves inutilisés, les responsables orphelins peuvent être traités séparément.
- Personnel, comptes utilisateurs, finances, paie et audits ne sont pas des types
  sélectionnables. Utiliser leurs workflows de suspension/archivage/correction.

## Safety / operations

No hard DELETE is issued. Apply migration `081_student_number_soft_delete_uniqueness.sql`
to allow reuse of a student number after soft deletion. It replaces the legacy
all-row unique constraint with a live-row unique index, without changing records.
Older migration files must not be edited. Back up before applying; a lock timeout
requires retrying in a quieter deployment window, never bypassing the constraint.
The service discovers
database foreign keys so new record dependencies block cleanup by default. This
does not replace authorization review when adding a module that stores references
only inside JSON or external storage; add its explicit blocker before release.

POST `/school-students/cleanup/preview`, POST `/school-students/cleanup`.
GET `/school-students/cleanup?schoolId=...&kind=students|guardians&page=1&search=...`.
The authenticated web proxy enforces trusted origins for both mutations.

Each committed batch records `SCHOOL_RECORDS_BULK_SOFT_DELETED`, including batchId,
kind, exact record IDs, detached studentGuardianIds, reason and deletedAt. No audit,
status history or financial record is erased. Recovery is an operator operation,
not an unreviewed end-user bulk action.

### Recovery procedure (support only)

1. Identify the exact batchId in the audit log and verify school, actor and reason.
2. Back up the database. Review the record and link IDs from that batch; never
   restore every deleted row in a school or rely on a broad timestamp range.
3. In a transaction, lock the exact students/guardians and links. Verify their
   current deleted_at matches the audited deletion and they have not subsequently
   been repurposed. Check unique codes/references and primary contact conflicts.
   If a student code was reused by a new live record, restoration must stop until
   an operator resolves the identity/code conflict. Never merge the two UUIDs or
   transfer historical ownership automatically.
4. Restore only those exact rows by setting deleted_at=NULL and updated_at=NOW().
   Restore associated links only if both student and guardian are live. If their
   guardian was removed in a later batch, restore/review that batch first.
5. Record a separate recovery audit with operator and original batchId. Verify
   student directory, guardian relationships and unchanged financial history.

Do not run a blanket restore or change account/session state as part of recovery.
For UAT, use disposable staging records; never test deletion against real school
records without specific authorization.
