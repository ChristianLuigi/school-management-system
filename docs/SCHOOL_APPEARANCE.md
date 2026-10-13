# School appearance

Apply `079_school_appearance.sql` using the existing migration runner before deploying the API/web changes. This migration has not been applied automatically.

School Admins open **Paramètres** to upload a PNG, JPG or WEBP logo (maximum 256 KB), choose primary/accent colors and set the school default theme. Logos are stored in PostgreSQL, not on the temporary Vercel/Render filesystem. Existing contact and report-card fields remain available. Initial school setup is retained in a collapsible section.

Personal appearance is in **Paramètres**: `/setup` for School Admins, `/preferences` for other school roles. The personal page does not grant access to administrator configuration. Theme preferences are scoped to the signed-in user in this browser; they are not synchronized across devices. School colors apply to semantic UI components; legacy hardcoded colors still require visual review.

Before release:

- Verify migration status and checksums using the documented database commands.
- Save a logo and colors, reload and switch schools; verify no previous school's branding appears.
- Reject oversized, SVG and mismatched-content uploads.
- Check school administrators cannot update another school and ordinary users cannot update branding.
- Check light, dark and system themes on desktop/mobile, including all legacy forms.
- Verify personal settings are accessible without exposing administrator setup actions.

No deployment, migration execution or visual UAT is implied by local compilation.

## Logo sources

- Local computer: select a PNG/JPEG/WEBP file, at most 256 KB.
- Public external image: use the direct HTTPS image link control. It checks image loading without reading cross-origin bytes. The URL is saved, not a copied upload; availability depends on the external host. HTML sharing pages, private files and blocked hosts cannot be used this way.
- Private Google Drive: download the image and use local upload for now. Native Drive browsing requires a separately configured Google OAuth/Picker integration; it is not implemented by the public-link importer.

External links use an image-loading check with no referrer and a timeout; they do not make the API fetch arbitrary remote URLs. The 256 KB/content-signature limits apply to local uploads, not externally hosted images. A preview is not proof of a completed save: click Save branding afterward. Saving is disabled while a file/link is being processed.
