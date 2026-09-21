# School administration roles

- **School Administrator (`SCHOOL_ADMIN`)**: full school-level authority, including user management and the existing payroll approval workflow. Can invite another School Administrator in the same school. Cannot grant platform Super Admin access. Existing self-suspension and final-administrator protections remain in force.
- **Administrative Staff (`ADMIN_STAFF`)**: student identity records and admission intake. Has an active school membership and linked employment record. Can view section choices without receiving teacher access.

Administrative Staff cannot change placement, student lifecycle status, admission decisions, examination results, medical fields, financial records, payroll, staff records, or account permissions. CSV student import remains School Admin-only. The office forms intentionally omit these controls; the API also enforces explicit field allowlists. Private admission notes, examination details, medical fields, document attachments and financial amounts are redacted from office-only responses. A separately granted role still retains its own permissions.

## Deploy and verify

1. Run the existing migration runner with the deployment's migration credentials: `pnpm --dir apps/api db:migrate`. Migration `078_administrative_staff_role.sql` adds the role to both legacy/current enums and text constraints; it does not edit migration history or assign the role to existing users.
2. Deploy the API and web changes together after migration succeeds.
3. As School Admin, open Users and invite either role. Selecting School Administrator shows a full-access warning. Activation creates the linked staff account. Administrative Staff starts at the Students directory.
4. Verify student identity creation/edit, admission intake, forbidden cross-school requests, forbidden financial/medical writes, and session revocation after suspension.
5. Run the API unit suite and `test:integration` against a disposable test database, including `administrative-staff.integration-spec.ts`.

No production database is migrated or account created by merely checking out this change. Never grant School Administrator just to work around an office permission denial.
