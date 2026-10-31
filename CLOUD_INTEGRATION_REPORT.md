# Cloud moisture and persistence — local implementation report

29 October 2026. Branch: Development. Nothing pushed, merged, provisioned or deployed. Both cloud flags remain disabled by default. Existing production inference endpoints and models are unchanged.

## Architecture and infrastructure impact

ESP32 sends authenticated HTTPS telemetry to FastAPI; FastAPI stores server-timestamped ADC readings in PostgreSQL; the authenticated Expo application polls the owner's latest reading. The phone and ESP32 need internet access, not a shared Wi-Fi network. Existing local Wi-Fi mode remains selectable by configuration.

The existing Consumption environment has no VNet integration. Private PostgreSQL connectivity is not introduced because it would require a separately reviewed networking/environment migration. The proposed initial connection uses public PostgreSQL with TLS hostname/certificate verification and explicit individual IPv4 firewall rules only. No all-Azure rule, broad CIDR, NAT Gateway, private endpoint or environment replacement is included. Container Apps reports many outbound addresses; they are not dedicated or guaranteed static. An exact reviewed allowlist and connectivity validation remain deployment prerequisites. This is a networking limitation, not a guarantee of stable egress.

Optional foundation additions when approved: one B1ms Flexible Server, one Entra administrator assignment, one cinnai database, one require_secure_transport configuration, and N exact-IP firewall rules. Application Terraform adds a Key Vault secret reference and cloud environment variables to the existing Container App. No second app/environment or PostgreSQL resource is enabled now. No actual enabled-resource plan has been applied or claimed as reviewed.

## Eligibility and cost

Read-only checks found the Azure for Students subscription enabled and Central India advertising Standard_B1ms (1 vCore/2 GiB). SKU availability is not a capacity reservation. The user confirmed a free-service allowance of 750 B1ms hours, 32 GB storage and 32 GB backup; remaining allowance and benefit expiry must be rechecked before approval.

The regional retail snapshot was $0.0245/hour compute and $0.131/GB-month storage: approximately **$22.08/month at 730 hours and 32 GB before benefits**. Excess LRS backup was $0.095/GB-month. If the confirmed allowance is active and unused, eligible database usage can be covered; this is not a promise that the whole deployment is free. Existing registry, state storage, Key Vault operations, internet egress and Container Apps usage beyond allowances can consume credit. Frequent ESP32 uploads keep the app active and can reduce scale-to-zero savings. No new paid networking service is proposed.

Sources: [Azure PostgreSQL free-account guidance](https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-deploy-on-azure-free-account), [Container Apps networking](https://learn.microsoft.com/azure/container-apps/networking), [Azure retail pricing API](https://prices.azure.com/api/retail/prices).

## Schema and security

Alembic revision 0001_cloud creates cloud_users, cloud_devices, cloud_device_owners, cloud_readings and cloud_history, with keys, ownership indexes, timestamps, unique device/event IDs and deletion tombstones. Grading metadata is JSON in cloud_history. It is explicitly client-saved assessment metadata, not a server-certified result. Image files are not uploaded to PostgreSQL; existing local images remain local. Database schema is never created automatically at application startup.

New user-specific endpoints require Firebase ID tokens. Google public signing certificates verify signatures, expiry, issuer and audience; subject and token timing are checked. No Google service-account secret is needed. Per-user token revocation is not checked; existing tokens can remain valid until expiry. Device credentials are separate random 256-bit secrets, hashed in the database, provisioned through an operator command, and never embedded in the mobile app. Rotation/revocation is supported.

Pairing requires a device-authenticated, single-use random 128-bit code, valid ten minutes, printed through USB Serial after PAIR. Ownership is checked for every device/history access. Re-pairing does not expose previous-owner telemetry. Telemetry accepts integer ADC 0–4095, enforces one new reading per two seconds and idempotent event IDs. Cloud JSON bodies are limited to 128 KiB; saved history metadata to 64 KiB.

ADC >=2842 remains PASS_PROVISIONAL; otherwise FAIL_PROVISIONAL. Percentage is null. Received timestamps are assigned by the server and retained by the phone; polling does not refresh old readings. Thirty-second stale protection remains. Firmware sends current readings approximately every ten seconds and discards offline backlog, with bounded retry/backoff. TLS certificate validation is mandatory; no insecure fallback.

History is local-first with explicit synchronization and pending status on network failure. Existing local records are not erased. Remote tombstones prevent deleted records being uploaded again. Offline history is a cached view and may not yet reflect remote deletions. Legacy unscoped browser records are preserved but not automatically attributed to a signed-in user. Raw telemetry pruning is an explicit seven-day maintenance command; without it storage continues growing. No paid scheduler was added.

## Files in this integration

- Backend modified: .dockerignore, .env.example, Dockerfile, requirements.txt, app/main.py.
- Backend added: alembic.ini; migrations/env.py; migrations/versions/0001_cloud.py; app/cloud/{__init__.py,auth.py,database.py,limits.py,manage.py,models.py,routes.py,README.md}; tests/test_cloud.py; tests/test_cloud_auth.py.
- Frontend modified: .env.example; src/config/ble.ts; src/screens/History/HistoryScreen.tsx; src/screens/Sensor/SensorScreen.tsx; src/services/ble.ts; src/services/sessionMoisture.ts; src/storage/history.ts; src/storage/history.web.ts.
- Frontend added: src/services/cloudApi.ts; src/services/cloudSensor.ts; src/storage/cloudHistory.ts; tests/cloud.test.ts; tests/cloudApi.test.ts.
- Firmware modified: CinnamonGradingWifi/CinnamonGradingWifi.ino. Added cloud_transport.h and cloud_credentials.example.h in that folder.
- Terraform modified: foundation/main.tf, variables.tf, terraform.tfvars.example; application/main.tf, variables.tf. Added foundation/postgres.tf.
- Root: .gitignore and this report.

Other existing working-tree frontend changes (Azure connection, API timeout/error handling, analysis/assistant notices and visual API tests) predate this integration and were preserved.

## Validation

- Backend: **197 passed, 1 skipped**. Actual Alembic migrations/CRUD tested with SQLite, PostgreSQL DDL compiled; the optional real PostgreSQL migration/CRUD test was skipped because no disposable PostgreSQL instance was configured.
- Firebase tests exercise actual RSA signature verification with test certificates, including wrong project, forged signatures and expired tokens. Route tests cover ownership, pairing, revocation, telemetry persistence, invalid ADC, duplicate events, stale readings and history isolation.
- Frontend: **251 passed across 24 files**. TypeScript check passed. Includes cloud authentication, network failures, account switching, timestamps, history sync and existing grading/session regressions.
- Terraform foundation and application: local validation passed; formatting performed. No enabled PostgreSQL deployment plan executed.
- Docker rebuild, real PostgreSQL connectivity, firmware compilation and physical cross-network ESP32/iPhone tests remain pending. No claim of live end-to-end verification.

## Configuration and gated deployment sequence

1. Review these changes on Development; approve the code merge to main separately. Deployment remains main-only. Reconfirm student benefit expiry/remaining quota and the exact outbound-IP firewall strategy; generate and review the enabled foundation plan and cost before any apply.
2. After explicit approval, provision only the reviewed PostgreSQL resources. Keep PostgreSQL backups at seven days, storage at 32 GB and auto-grow disabled. Preserve current state/backend and Container Apps environment.
3. Store the administrator secret securely in Key Vault. Pass it transiently through TF_VAR_postgres_admin_password for the approved Terraform run, never a committed tfvars file. Terraform state will contain the sensitive database password; existing private state access controls remain essential.
4. Using an authorized migration/operator connection, create a separate least-privilege runtime login. Run `python -m alembic upgrade head` from backend. Runtime needs table CRUD, not database ownership or CREATE ROLE. Temporarily allow only the operator's exact IP if needed, with separate approval and removal afterward.
5. Store the runtime connection URL as Key Vault secret cloud-database-url. Use postgresql+psycopg, sslmode=verify-full and sslrootcert=/etc/ssl/certs/ca-certificates.crt in Linux. Set CLOUD_STORAGE_ENABLED=true and FIREBASE_PROJECT_ID=cinnai-7f4af through the approved application revision. Build/test/publish main only, review its Terraform plan and approve deployment.
6. Verify /health and authenticated cloud routes; anonymous access must fail. Test two-user isolation, real PostgreSQL CRUD, TLS and endpoint behavior before enabling clients.
7. Provision each device using the operator command documented in backend/app/cloud/README.md. Protect the output file with Windows ACLs. Copy credentials into ignored cloud_credentials.h, install a verified current CA certificate, and configure existing ignored Wi-Fi credentials. Install the firmware's ArduinoJson dependency, compile and flash; no device has been provisioned by this change.
8. Set EXPO_PUBLIC_CLOUD_STORAGE_ENABLED=true and EXPO_PUBLIC_SENSOR_MODE=cloud only after deployment. Pair using USB PAIR and the app. Keep wifi mode available as the local fallback. Explicitly sync this device's existing history; do not erase it.
9. Physically test ESP32 on one network and iPhone on mobile data, disconnection, stale status, retry, revocation and a grading session. Confirm no grade/calibration changes. Configure regular telemetry pruning and monitor credits/storage.
10. Rollback by disabling frontend cloud mode and application cloud flag using a reviewed revision; preserve PostgreSQL data. Do not destroy the database as a rollback shortcut.

**Approval required before any Azure provisioning, Key Vault writes, firewall changes, main merge, image publication or deployment.** The current work stops at local implementation and validation.
