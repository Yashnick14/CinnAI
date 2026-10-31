# Opt-in cloud data API

All `/cloud` routes are registered only when CLOUD_STORAGE_ENABLED=true. Existing inference endpoints are unchanged. DATABASE_URL used by legacy modules is not used; CLOUD_DATABASE_URL is mandatory and requires PostgreSQL + psycopg and sslmode=verify-full. Set sslrootcert to the OS CA bundle (container: /etc/ssl/certs/ca-certificates.crt). No schema is created at startup.

Run from backend: `python -m alembic upgrade head` with a migration identity. Runtime uses a separate least-privilege login with SELECT/INSERT/UPDATE/DELETE only on the cloud tables; no CREATE ROLE or database ownership. Supply the runtime DSN through Key Vault, not source or logs.

Firebase tokens are verified by google-auth with cached Google public certificates and explicit issuer/subject/algorithm checks against FIREBASE_PROJECT_ID. Signature, issuer, audience and expiry are validated by the SDK. No Firebase password or service-account file goes to devices. Standard ID-token verification does not check per-user revocation; tokens may remain valid until their normal expiry. Adding revocation checks requires a separately authorized Firebase admin credential and is not claimed here.

Routes:
- POST /cloud/profile {display_name}: authenticated Firebase UID, never client-supplied owner.
- GET /cloud/devices: caller's associated devices.
- POST /cloud/device/pair-code: device bearer credential only. Generates one random 128-bit, single-use, 10-minute code, one/minute, shown via USB Serial only.
- POST /cloud/devices/pair {code}: Firebase user claims an unowned device.
- POST /cloud/devices/{id}/unpair: owner only; previous-owner readings are not exposed to a new owner.
- POST /cloud/devices/{id}/revoke: owner only; disables device uploads/pairing.
- POST /cloud/telemetry {device_id,event_id,adc}: device bearer credential, integer 0..4095, DB row-locked rate limit one/2 seconds, idempotent event ID per device, server timestamp, null percentage.
- GET /cloud/devices/{id}/latest: owner only, no-store, age/stale from server; 30-second limit. Older reading timestamps never get refreshed by phone polling.
- POST /cloud/history {record}: immutable owner-scoped saved assessment metadata, 64 KiB maximum; strips local image URI. Provenance is client_saved_assessment, NOT a server-attested certificate.
- GET /cloud/history?offset=0&limit=100: owner-scoped pages, including deletion tombstones for safe sync.
- POST /cloud/history/{id}/delete: owner-scoped tombstone prevents local re-upload resurrection.

Provision via `python -m app.cloud.manage provision --device cinnai-probe-001 --output <private-path>/device-credentials-001.json`. Output path must not exist. Credential is never printed; restrict the folder ACL to the operator on Windows. Copy the token to the untracked firmware cloud_credentials.h by USB. Keep files out of sync folders/Git. Device secrets are stored as SHA256 hashes because the credentials are cryptographically random 256-bit values. No low-entropy passwords are hashed this way.

Rotate using `rotate` with the same device ID and a NEW output file, then flash/update the ESP32 over USB. Old token stops working immediately; no grace token. Revoke via owner app or operator CLI. Delete the local plaintext provisioning file after verified flashing using your approved secret-management process. Key Vault holds database/admin secrets; device-specific secrets exist only during provisioning and on the physical device.

Firmware sends latest samples ~10 seconds apart, backs off to 60 seconds with jitter, and discards offline backlog so stale historical values cannot receive a misleading new timestamp. Run `python -m app.cloud.manage prune` as a deliberate maintenance job to retain seven days of raw telemetry; it never deletes grading history. Without maintenance, telemetry grows (about 8,640 rows/day/device). No new paid scheduler is provisioned.

Tests use actual Alembic upgrade/downgrade with SQLite plus PostgreSQL DDL compilation and mocked Firebase verification for route tests plus real RSA signature/claim verification with test certificates. Set TEST_CLOUD_DATABASE_URL to a disposable local PostgreSQL service to run the optional real PostgreSQL test, which uses an isolated random schema and removes only that schema.
