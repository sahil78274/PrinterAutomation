# Document storage

Customer PDFs live here at runtime under `documents/<documentId>/`.

- **Never served statically.** There is no `express.static` route pointing at this
  directory. Documents are only reachable through the authenticated
  `GET /api/documents/:documentId/file` handler or the agent download endpoint.
- **Ignored by git.** Everything under `documents/` is excluded; only this README
  and `.gitkeep` are tracked.
- **Permissions.** Created `0o700` at runtime with files written `0o600`, so other
  users on the host cannot read a customer's document.
- **Deleted after printing.** The document is removed once its job completes, or
  by the expiry sweep for abandoned uploads.
