# InvScan — Mobile Inventory Scanner

A self-hosted, mobile-first inventory management app. Scan UPC/EAN barcodes with your phone camera, manage stock levels, run cycle counts, and sync to Sage Intacct.

---

## Project Phases

### Phase 1 — Cycle counts with Sage Intacct sync (current)

**Working today:**
- Barcode scanning + manual entry
- Inventory CRUD with spreadsheet-style inline editing
- **Cycle counting — refactored 2026-04-23 to match Intacct REST 1:1.** Warehouse + assignee required per count, separate `counted` / `damaged` quantities, `onHand` snapshots at start and end, Intacct-compatible state machine (`notStarted` → `inProgress` → `counted`). The app handles up to `counted`; **reconciliation (accepting adjustments, posting to GL) happens only in the Sage Intacct UI** — the app shows a "Reconcile in Sage" banner on completed counts.
- Cycle count exports in both Excel (.xlsx) and CSV
- Warehouse management in Settings
- Task/feature-request list
- CSV import + export for inventory
- Barcode label generation and printing
- Scan audit log
- Sage Intacct OAuth 2.0 scaffold (awaiting credentials — see below)
- Sage Intacct XML Gateway connection test (legacy fallback)

**In progress — awaiting Sage OAuth credentials:**
- **Wire cycle counts through the Intacct REST client.** The client and typed endpoints are built ([src/lib/intacct/cycle-count.ts](src/lib/intacct/cycle-count.ts)); right now `listCycleCounts` runs as a health probe on the status endpoint. Once OAuth creds arrive, flip the cycle-count create/update calls to go through Intacct first and mirror locally.
- See [Sage Intacct Integration](#sage-intacct-integration) for the exact pickup checklist.

### Phase 2 — Equipment staging workflow (deferred, pending source-system decision)

**Goal:** PO-driven workflow to move equipment through fixed stages (`Warehouse` → `Staging` → `OutForDelivery` → `Delivered`) as warehouse workers scan items.

**Deferred because the source system is not yet decided.** The PO data may live in **TaskRay (Salesforce)**, not Sage Intacct — open question as of 2026-04-23. This meaningfully changes the implementation:

- If TaskRay/Salesforce: build a second OAuth integration against Salesforce REST API (parallel to the Intacct one). Stage transitions likely post back to Salesforce task/custom-field updates.
- If Sage Intacct: use the existing `/src/lib/intacct/` client, extend with `/objects/purchasing/document::Purchase Order/{key}` fetch. Stage transitions become Intacct inventory transfers or outbound documents.

**Scoped design (source-agnostic, ready to build once confirmed):**
- New models: `DeliveryBatch` (keyed to PO number, customer, project) + `DeliveryItem` (one row per unit; tracks `stage` + history).
- Scanner advances one unit per scan with a ~2–3s undo/override toast (match an accidental scan or wrong-stage pick).
- Manual PO entry form for dev before external system is wired.

**Before implementing:** confirm with whoever owns the workflow whether the PO/equipment list lives in TaskRay or Sage.

### Not yet started / future hardening

- Token encryption at rest (currently plaintext in the `IntacctToken` table — fine for sandbox, harden before prod)
- Webhook or polling strategy for pulling Intacct changes back into the local mirror
- Multi-warehouse stock tracking per `InventoryItem` (Intacct has `item-warehouse-inventory`; app currently treats warehouse as metadata on the count header only)

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + shadcn/ui + Tailwind CSS
- **Database:** MariaDB 11 with Prisma ORM
- **Auth:** NextAuth.js (credentials provider, bcrypt-hashed passwords, JWT sessions)
- **Scanning:** html5-qrcode (phone camera, no native app)
- **Label printing:** JsBarcode (client-side barcode rendering)
- **Deployment:** Docker + Coolify

---

## Local Development

### Option A — Local Homebrew MariaDB (fastest for macOS)

```bash
# 1. Install and start MariaDB
brew install mariadb
brew services start mariadb

# 2. Create the database and user
mariadb -e "CREATE DATABASE inventory_db;
  CREATE USER 'inventory'@'localhost' IDENTIFIED BY 'inventory_pass';
  GRANT ALL ON inventory_db.* TO 'inventory'@'localhost';
  FLUSH PRIVILEGES;"

# 3. Clone, install, configure
git clone <your-repo>
cd inventory-scanner
npm install
cp .env.example .env
# Edit .env — at minimum set NEXTAUTH_SECRET to a random string

# 4. Push schema + seed admin user
npx prisma db push
npm run db:seed

# 5. Start dev server
npm run dev
```

Open http://localhost:3000 (or :3001 if 3000 is taken) and log in with:
- **Email:** `admin@inventory.local`
- **Password:** `admin123`

> ⚠️ Change the admin password immediately after first login.

### Option B — Docker Compose (closer to production)

```bash
# 1. Start both services
docker compose up -d

# 2. Create .env with the DATABASE_URL pointing at the compose network
cp .env.example .env
# Change DATABASE_URL to: mysql://inventory:inventory_pass@db:3306/inventory_db

# 3. Run migrations and seed inside the app container
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

App is at http://localhost:3000.

---

## Environment Variables

All vars live in `.env` (gitignored). `.env.example` is the template. Next.js also reads `.env.local` and **it takes precedence over `.env`** — keep them in sync if both exist, or use only one.

### Core (required)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MariaDB connection string. Defaults to `localhost:3306`. Docker Compose overrides via its own env block. |
| `NEXTAUTH_SECRET` | Random string used to sign JWT session tokens. Any secure random value. |
| `NEXTAUTH_URL` | Base URL of the running app (e.g. `http://localhost:3000` or your production URL). |

### Sage Intacct — REST API (primary, OAuth 2.0)

| Variable | Purpose |
|---|---|
| `INTACCT_CLIENT_ID` | OAuth client ID from Sage |
| `INTACCT_CLIENT_SECRET` | OAuth client secret from Sage |
| `INTACCT_REDIRECT_URI` | Must match the URI Sage registered against your client (default: `http://localhost:3000/api/intacct/callback`) |
| `INTACCT_API_URL` | REST API base URL. Default `https://api.intacct.com/ia/api/v1` |

### Sage Intacct — XML Gateway (fallback/legacy)

| Variable | Purpose |
|---|---|
| `SAGE_SENDER_ID` | Partner/app-level sender ID |
| `SAGE_SENDER_PASSWORD` | Partner/app-level sender password |
| `SAGE_COMPANY_ID` | Intacct company slug |
| `SAGE_USER_ID` | Web Services user ID |
| `SAGE_USER_PASSWORD` | Web Services user password |
| `SAGE_ENDPOINT` | XML Gateway URL. Default `https://api.intacct.com/ia/xml/xmlgw.phtml` |

---

## Deployment (Coolify)

### Option A — Docker Compose (recommended)

1. Push this repo to GitHub/GitLab.
2. In Coolify, create a new **Docker Compose** resource pointing at the repo.
3. Set these environment variables in Coolify:

```
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<strong-root-password>
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-domain.com
# Plus any INTACCT_* / SAGE_* vars once credentials are available
```

4. Deploy. Coolify will build the image and start both services.
5. Seed the admin user from Coolify's terminal: `npx tsx prisma/seed.ts`

### Option B — Separate services

1. Create a **MariaDB** database in Coolify.
2. Create a **Dockerfile** service pointing at this repo.
3. Set `DATABASE_URL` to the MariaDB instance.
4. Set other env vars as above.
5. Deploy, then seed from the app container terminal.

---

## Features

- **Barcode Scanning** — camera-based via html5-qrcode; automatic detection of new vs. existing items
- **Manual Entry** — text input fallback when camera isn't usable
- **Inventory Management** — full CRUD with inline-editable spreadsheet-style table, location (bin/row/aisle/zone), category, condition, cost, min-stock
- **Cycle Counting** — create counts scoped to warehouse/category, enter counted/damaged quantities, see variances, reconcile into inventory adjustments (local-only today; Intacct sync pending)
- **Audit Trail** — every scan logged with user, timestamp, and action type (`CREATED`, `INCREMENTED`, `DECREMENTED`, `UPDATED`, `AUDITED`)
- **CSV Export / Import** — full round-trip with a downloadable template
- **Barcode Labels** — print-ready HTML label sheets via JsBarcode
- **Task List** — simple team to-do / feature-request tracker with priority + status
- **Mobile-First PWA** — add to home screen for a native feel
- **Dark Theme** — default; easy on the eyes in warehouse lighting

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | NextAuth handler (login, session, csrf) |
| `GET` | `/api/inventory` | List items (`?search=`, `?category=`, `?stats=true`, `?barcode=X`) |
| `PUT` | `/api/inventory` | Update an item |
| `DELETE` | `/api/inventory?id=X` | Delete an item |
| `GET` | `/api/lookup?barcode=X` | Resolve a barcode to item details |
| `POST` | `/api/scan` | Handle a scan event (`CREATE` / `INCREMENT` / `DECREMENT` / `UPDATE` / `AUDIT`) |
| `GET` | `/api/scan?logs=true` | Fetch scan audit log |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/cycle-count` | Cycle count CRUD |
| `GET` | `/api/cycle-count/[id]` | Fetch a single cycle count with entries |
| `PUT` | `/api/cycle-count/[id]/entry` | Update a count entry (counted qty, notes) |
| `GET` | `/api/cycle-count/export?id=X` | CSV export of a cycle count |
| `GET` | `/api/cycle-count/export-xlsx?id=X` | Excel (.xlsx) export of a cycle count |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/warehouses` | Warehouse CRUD (writes admin-only) |
| `GET` | `/api/users` | List users (for assignee dropdowns) |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/todos` | Task list CRUD |
| `GET` | `/api/export/csv` | Download full inventory CSV |
| `POST` | `/api/import/csv` | Upload inventory CSV |
| `GET` | `/api/import/template` | Download the import template CSV |
| `GET` | `/api/labels` | Generate printable barcode labels |
| `GET` | `/api/intacct/auth` | Start Sage Intacct OAuth flow (admin only) |
| `GET` | `/api/intacct/callback` | OAuth redirect target — exchanges code for tokens |
| `POST` | `/api/intacct/disconnect` | Clear stored Intacct tokens (admin only) |
| `GET` | `/api/intacct/status` | Connection status + cycle-count count probe |
| `POST` | `/api/sage/sync` | Sync inventory items via XML Gateway (legacy path) |
| `GET` | `/api/sage/sync?test=true` | Test XML Gateway connection |

---

## Database Schema

Full schema in [prisma/schema.prisma](prisma/schema.prisma). Models:

| Model | Purpose |
|---|---|
| `User` | Auth accounts with roles (`USER` / `ADMIN`) |
| `InventoryItem` | Products — barcode, quantity, location, category, condition, cost |
| `ScanLog` | Immutable audit trail of every scan event |
| `Warehouse` | Warehouse header; required on cycle counts. Syncs from Intacct when connected. |
| `CycleCount` | Cycle-count header — mirrors Intacct's shape: documentNumber, description, warehouse, assignedTo, state, date fields |
| `CycleCountEntry` | Per-line counting record — `onHand` / `counted` / `damaged` / `onHandAtEnd` plus tracking snapshot (bin/aisle/zone/row/serial/lot) |
| `Todo` | Task / feature-request items (title, priority, status) |
| `IntacctToken` | OAuth 2.0 access/refresh tokens for Sage Intacct REST API |

Enums: `Role`, `Condition`, `ScanAction`, `CycleCountState` (`notStarted` / `inProgress` / `counted` / `voided`), `LineCountStatus` (`notCounted` / `inProgress` / `skipped` / `counted`), `TodoPriority`, `TodoStatus`.

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma            # All models + enums
│   └── seed.ts                  # Default admin user (loads .env inline; see troubleshooting)
├── scripts/
│   └── intacct-probe.ts         # Diagnostic: tests which auth schemes Intacct accepts
├── src/
│   ├── app/
│   │   ├── page.tsx             # Login
│   │   ├── dashboard/           # Stats overview
│   │   ├── scanner/             # Barcode scanner
│   │   ├── inventory/           # Inline-edit spreadsheet
│   │   ├── cycle-count/         # Cycle counting workflow
│   │   ├── todos/               # Task list
│   │   ├── labels/              # Label print UI
│   │   ├── settings/            # Account + Sage integration controls
│   │   └── api/                 # Route handlers (see API table above)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   ├── nav.tsx              # Top bar + bottom nav + sidebar
│   │   └── providers.tsx        # Session provider
│   └── lib/
│       ├── prisma.ts            # Prisma client singleton
│       ├── auth.ts              # NextAuth config
│       ├── sage.ts              # Sage Intacct XML Gateway client (legacy)
│       ├── intacct/             # Sage Intacct REST/OAuth client
│       │   ├── config.ts        #   env-backed config + URL builders
│       │   ├── tokens.ts        #   exchange / refresh / store OAuth tokens
│       │   ├── client.ts        #   intacctFetch() with auto-refresh on 401
│       │   └── cycle-count.ts   #   typed REST endpoints (list/get/create/update/delete)
│       └── utils.ts             # Tailwind merge helper
├── Dockerfile                   # Multi-stage production build
├── docker-compose.yml           # App + MariaDB for Coolify deployment
└── .env.example                 # Environment template
```

---

## Sage Intacct Integration

### Current state

**Sage Intacct is the source of truth.** The app is a fast, mobile-friendly UI over Intacct inventory — not an independent ledger. Writes should go to Intacct first and only update the local DB on success; on conflict, Intacct wins.

**Two paths are scaffolded:**

1. **REST API with OAuth 2.0 (primary)** — [src/lib/intacct/](src/lib/intacct/)
   - OAuth authorization-code flow fully wired: admin clicks "Connect to Sage" in Settings → redirected to Intacct → consent → callback stores tokens → all users share that connection.
   - Auto-refresh on 401 in [client.ts](src/lib/intacct/client.ts).
   - Typed endpoints for cycle counts in [cycle-count.ts](src/lib/intacct/cycle-count.ts) — full CRUD defined, currently only `listCycleCounts()` is used (for a connection-health probe in `/api/intacct/status`).
   - OpenAPI reference for cycle counts lives at the project root (`inventory_control_cycle-counts.json` if present) — used to derive the typed shape.

2. **XML Gateway (fallback)** — [src/lib/sage.ts](src/lib/sage.ts) + [src/app/api/sage/sync/route.ts](src/app/api/sage/sync/route.ts)
   - Older session-based API using sender + user credentials.
   - Kept working as a connectivity-test fallback if the REST OAuth path is unavailable.
   - Not recommended for new feature work.

### Where to pick up (handoff checklist)

1. **Get OAuth credentials from Sage.** Specifically request:
   - `client_id`
   - `client_secret`
   - Register the redirect URI (e.g. `http://localhost:3000/api/intacct/callback` for dev; production URL + `/api/intacct/callback` for prod)
2. **Populate `.env`** with `INTACCT_CLIENT_ID`, `INTACCT_CLIENT_SECRET`, `INTACCT_REDIRECT_URI`.
3. **Restart the dev server** (Prisma caches DB connection on instantiation; env changes need a full restart).
4. **Sign in as admin → Settings → "Sage Intacct (REST)" → click "Connect to Sage".** You should be redirected to Intacct, consent, land back on Settings showing "Connected" plus a count of cycle counts in the sandbox.
5. **Build out the cycle-count workflow end-to-end:**
   - When a user creates a cycle count in the app, POST it to Intacct first via [createCycleCount()](src/lib/intacct/cycle-count.ts), store the returned `key` locally.
   - When entering counts, PATCH lines via [updateCycleCount()](src/lib/intacct/cycle-count.ts). Hold line quantities locally during an active count session (autosave every N minutes as a backstop) and flush on "Finish counting."
   - Leave final reconciliation (accepting adjustments, posting to GL) to be done in the Sage Intacct UI — the app's job ends at "counted" state.
   - State transitions (`notStarted` → `inProgress` → `counted`) — `state` is read-only on the REST object, so there's likely a separate action endpoint for transitions. Check Sage docs.
6. **Inventory transfer / move-between-stages** — second use case, not yet scoped. Same architectural pattern: write to Intacct first, mirror locally.

### Architecture decisions worth preserving

- **Service connection, not per-user OAuth.** A single admin authorizes once; all warehouse users share the stored tokens. Employees don't each need their own Intacct login.
- **Write-through pattern.** Any scanner write hits Intacct first; local DB updates only on success. Offline scans should queue pending writes, not act as optimistic local state.
- **Local DB as read cache.** It exists for speed/offline reads, not authority. Conflict resolution is simple: Intacct wins.
- **Hold-local-during-count exception.** During an active cycle count, line quantities are held locally (scanning needs to be instant and no one else is editing the same lines). This matches Intacct's own flow — create count with empty lines, PATCH quantities at the end.

### Probe script

If you hit Intacct auth errors, [scripts/intacct-probe.ts](scripts/intacct-probe.ts) tests what the sandbox accepts with the credentials in your `.env`. Run it:

```bash
npx tsx scripts/intacct-probe.ts
```

It probes the REST API (no auth, Basic auth, sender headers) and the XML Gateway — the error responses are usually explicit about what's missing.

---

## Cycle count reconciliation guardrails

Cycle counts touch inventory valuation, and inventory valuation flows into COGS, gross margin, and the balance sheet. The guardrails below exist to protect that integrity. **Read this section before changing any code in [src/lib/intacct/cycle-count.ts](src/lib/intacct/cycle-count.ts) or the cycle-count API/UI.**

### Guardrail 1 — Only call Sage's standard cycle-count endpoints

When wiring the local cycle-count flow through to Sage, go through [src/lib/intacct/cycle-count.ts](src/lib/intacct/cycle-count.ts) exclusively. Those functions hit the standard REST resource:

- `POST /objects/inventory-control/cycle-count` — create
- `PATCH /objects/inventory-control/cycle-count/{key}` — update line quantities
- (State transition to `reconciled` happens in Sage's UI, not via our app.)

When a count is reconciled in Sage, Sage generates inventory adjustment transactions that respect the item's configured cost method:

- **FIFO / LIFO:** adjustments consume/add to the cost layers in the correct order, preserving the layered valuation model.
- **Average cost:** the weighted average is recalculated correctly.
- **Standard cost:** the variance posts to the standard-cost variance account.

**What you must never do:**
- ❌ Write quantities directly to `inventory-control/item` to "fix" inventory levels.
- ❌ Post a manual GL journal entry to adjust inventory value.
- ❌ Use any cost-override field on adjustment lines to bypass the configured cost method.
- ❌ Create a parallel "quick fix" endpoint that writes to inventory without going through a cycle count or a standard inventory transaction.

Any of those paths destroy the FIFO/LIFO cost layers. The immediate symptom is that COGS on future sales will be wrong. The deeper problem is that inventory valuation on the balance sheet disagrees with the sum of item cost layers, which is an audit red flag and, depending on materiality, a restatement-worthy accounting error. There is no easy "undo."

If a future feature appears to require one of the don'ts above, treat it as a design bug: the count or the inventory move should be modeled as a first-class Intacct transaction (cycle count, inventory adjustment, inventory transfer, receipt, shipment), not as a direct write.

### Guardrail 2 — Pre-post variance threshold review

Before a count can transition to `counted` (the hand-off state to Sage), the app computes the **total variance value**:

```
totalVarianceValue = sum over all counted lines of |counted - onHand| × unitCost
```

If `totalVarianceValue ≥ CYCLE_COUNT_VARIANCE_THRESHOLD_USD`, the count cannot be finished without:

1. An explicit **approval reason** (free-text, required). The app stores this reason, approver user, and timestamp on the cycle-count record — it's part of the audit trail.
2. **Optionally, ADMIN role.** When `CYCLE_COUNT_APPROVAL_REQUIRES_ADMIN=true`, only users with role `ADMIN` can provide the approval. This enables a two-person workflow (counter + approver).

The API returns HTTP `409 Conflict` with `code: "APPROVAL_REQUIRED"` when a transition attempt lacks the required approval. The UI surfaces this as a "Review & approve" dialog that lists the top 10 variant lines (by absolute variance) and requires the reason before the Finish button enables.

**Configuration (`.env`):**

```
CYCLE_COUNT_VARIANCE_THRESHOLD_USD="500"        # default: 500
CYCLE_COUNT_APPROVAL_REQUIRES_ADMIN="false"     # default: false
```

Tune the threshold to your organization's materiality. A good starting point is the smallest dollar amount your auditors would expect documentation for — often the same threshold used for expense receipts. Set lower during onboarding until counters settle into rhythm; raise it as trust in the scanning workflow grows.

**Audit fields on the `CycleCount` record:**

| Field | When it's set | Purpose |
|---|---|---|
| `approvedById` | At `counted` transition if over threshold | Who approved |
| `approvedAt` | At `counted` transition if over threshold | When they approved |
| `approvalReason` | At `counted` transition if over threshold | Why the variance is acceptable |
| `totalVarianceValue` | At `counted` transition (always) | Cached computed variance in USD |

These fields are displayed on the `counted`-state banner on the detail page and are included in the Excel export's Summary sheet. When Sage's own cycle-count API response includes reconciliation data, consider displaying that alongside the pre-post approval for a complete audit picture.

### Guardrail 3 — Separation of duties

When `CYCLE_COUNT_APPROVAL_REQUIRES_ADMIN=true`, the same user typically should not perform BOTH the count AND the approval. The current code does not enforce this automatically (the approver could in theory be the same as `assignedTo`), but the audit trail makes violations visible. If your auditors require hard enforcement, add a check in the `PUT` state-transition handler: `if (session.user.id === cycleCount.assignedToId) reject`.

### Guardrail 4 — Valuation is Sage's job, not ours

The app displays variance in both quantity and dollar terms for the counter's convenience. **Those dollar numbers are not authoritative.** They use `unitCost` snapshotted at count-create time, which may diverge from Sage's actual FIFO/LIFO layer cost at reconciliation time. When Sage reconciles, it may compute a different adjustment value. The app's number is decision-support; Sage's is ground truth.

Do not "fix" discrepancies between the app's variance dollars and Sage's reconciled adjustment dollars by overriding either side. They're expected to differ slightly under FIFO/LIFO cost layering.

### Concrete extension points for the incoming developer

When you wire actual Sage sync in `src/app/api/cycle-count/route.ts`:

1. **Create path:** after local `prisma.cycleCount.create`, call `intacctClient.createCycleCount(...)` (already typed in `src/lib/intacct/cycle-count.ts`). Store the returned `key` in `CycleCount.intacctKey`. If the Intacct call fails, roll back the local create — don't leave the two systems out of sync.
2. **Line update path:** when recording a count per line, `PATCH` the line to Intacct via `intacctClient.updateCycleCount(...)` with just the changed line. This is safe to batch: hold line edits locally during an active count (as the UI already does), and flush them on `state → counted`.
3. **State transition path:** at `counted`, after the approval gate passes, push the full line set to Intacct. Only mark local state = `counted` after Intacct returns 2xx. That's the write-through invariant (Sage is source of truth).
4. **Refresh path:** the status endpoint (`/api/intacct/status`) already calls `listCycleCounts` as a health probe. Add a "Refresh from Sage" button on the detail page that reloads the cycle count from Intacct and updates the local mirror. This is how you verify round-trip and catch drift.

---

## Troubleshooting

**Login returns 401 with no useful error**
- Check the terminal running `npm run dev` for the actual error. The browser only shows the HTTP status.
- If the terminal says "Can't reach database server," your DB isn't running or `DATABASE_URL` points at the wrong host.
- Default `DATABASE_URL` points at `localhost:3306` — change to the Docker service name `db:3306` if running via `docker compose up`.

**`npm run db:seed` fails with "Environment variable not found: DATABASE_URL"**
- Prisma only auto-loads `.env`, not `.env.local`. Ensure `DATABASE_URL` is in `.env`.
- The seed script has an inline `.env` loader ([prisma/seed.ts](prisma/seed.ts)) because `tsx` doesn't auto-load env files. Don't remove it.

**`.env.local` and `.env` disagree**
- Next.js reads `.env.local` and it takes precedence. Prisma CLI reads `.env` only. If you change `DATABASE_URL`, change it in both (or delete one).

**Port 3000 is in use**
- Next will shift to 3001 automatically. Update `NEXTAUTH_URL` in `.env` to match, otherwise auth callbacks break.

**Changes to `.env` aren't picked up**
- Prisma Client caches the DB connection string on instantiation. Restart the dev server fully (Ctrl+C, `npm run dev`) — Next.js hot-reload alone won't rebuild the Prisma client.

**Sage "Connect" button doesn't appear in Settings**
- Only shown when (a) you're logged in as `ADMIN` and (b) all three of `INTACCT_CLIENT_ID`, `INTACCT_CLIENT_SECRET`, `INTACCT_REDIRECT_URI` are set in the environment. Check `/api/intacct/status` directly to see what's missing.

---

## Mobile Setup

1. Open the app in Chrome or Safari on your phone.
2. Tap the share/menu button → "Add to Home Screen".
3. Launches in standalone mode (no browser chrome). Camera permission is requested on first scan.

---

## Default Admin (from seed)

- **Email:** `admin@inventory.local`
- **Password:** `admin123`
- **Role:** `ADMIN`

⚠️ **Change this password immediately after first login.** The seed only runs on request (`npm run db:seed`), so this user exists only if you seed it.
