# School appearance

Apply `079_school_appearance.sql` using the existing migration runner before deploying the API/web changes. This migration has not been applied automatically.

School Admins open **Paramètres** to upload a PNG, JPG or WEBP logo (maximum 256 KB), choose primary/accent colors and set the school default theme. Logos are stored in PostgreSQL, not on the temporary Vercel/Render filesystem. Existing contact and report-card fields remain available. Initial school setup is retained in a collapsible section.

Personal appearance currently appears in the workspace as a collapsible control. Theme preferences are scoped to the signed-in user in this browser; they are not synchronized across devices. School colors apply to semantic UI components; legacy hardcoded colors still require visual review.

Before release:

- Verify migration status and checksums using the documented database commands.
- Save a logo and colors, reload and switch schools; verify no previous school's branding appears.
- Reject oversized, SVG and mismatched-content uploads.
- Check school administrators cannot update another school and ordinary users cannot update branding.
- Check light, dark and system themes on desktop/mobile, including all legacy forms.
- Finish moving personal appearance into a dedicated settings view for non-administrator roles.

No deployment, migration execution or visual UAT is implied by local compilation.
