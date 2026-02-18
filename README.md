# InvScan — Mobile Inventory Scanner

A self-hosted, mobile-first inventory management app. Scan UPC/EAN barcodes with your phone camera, manage stock levels, and sync to Sage Intacct.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + shadcn/ui + Tailwind CSS
- **Database:** MariaDB with Prisma ORM
- **Auth:** NextAuth.js (credentials)
- **Scanning:** html5-qrcode (phone camera, no native app needed)
- **Export:** CSV download + Sage Intacct XML API
- **Deployment:** Docker + Coolify

## Features

- **Barcode Scanning** — Use your phone camera to scan UPC/EAN barcodes
- **Manual Entry** — Type barcodes manually when camera isn't available
- **Smart Detection** — Automatically detects new vs. existing items
- **Quantity Tracking** — Increment stock on repeat scans
- **Item Details** — Name, description, location, category, condition
- **Audit Trail** — Every scan is logged with user, timestamp, and action
- **CSV Export** — Download full inventory as a spreadsheet
- **Sage Intacct Sync** — Push inventory data to Sage via XML API
- **Mobile-First PWA** — Add to home screen for native app feel
- **Dark Theme** — Easy on the eyes in warehouse lighting

## Quick Start (Local Development)

```bash
# 1. Clone and install
git clone <your-repo>
cd inventory-scanner
npm install

# 2. Start MariaDB (or use the Docker Compose db service)
docker compose up db -d

# 3. Copy env file and configure
cp .env.example .env
# Edit .env with your database credentials

# 4. Push schema to database
npx prisma db push

# 5. Seed default admin user
npx tsx prisma/seed.ts

# 6. Start dev server
npm run dev
```

Open http://localhost:3000 and log in with:
- **Email:** admin@inventory.local
- **Password:** admin123

> ⚠️ Change this password immediately after first login.

## Deploy to Coolify

### Option A: Docker Compose (Recommended)

1. Push this repo to GitHub/GitLab
2. In Coolify, create a new **Docker Compose** resource
3. Point it to your repository
4. Set these environment variables in Coolify:

```
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<strong-root-password>
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-domain.com
```

5. Deploy — Coolify will build the Docker image and start both services

### Option B: Separate Services

1. Create a **MariaDB** database in Coolify
2. Create a **Dockerfile** service pointing to this repo
3. Set `DATABASE_URL` to point to the MariaDB instance
4. Set other env vars as above
5. Deploy

### Post-Deploy Steps

```bash
# SSH into the app container and seed the database
npx tsx prisma/seed.ts
```

Or run the seed from Coolify's terminal feature.

## Sage Intacct Configuration

To enable Sage Intacct sync, set these environment variables:

```
SAGE_SENDER_ID=your-sender-id
SAGE_SENDER_PASSWORD=your-sender-password
SAGE_COMPANY_ID=your-company-id
SAGE_USER_ID=your-user-id
SAGE_USER_PASSWORD=your-user-password
```

You can get these from your Sage Intacct Web Services subscription. Go to **Settings > Company > Security > Web Services** to set up a sender.

Test the connection from the app's Settings page.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List items (supports `?search=`, `?category=`, `?stats=true`) |
| GET | `/api/inventory?barcode=X` | Look up single item by barcode |
| PUT | `/api/inventory` | Update an item |
| DELETE | `/api/inventory?id=X` | Delete an item |
| POST | `/api/scan` | Handle a scan event (CREATE, INCREMENT, DECREMENT, AUDIT) |
| GET | `/api/scan?logs=true` | Get scan audit logs |
| GET | `/api/export/csv` | Download inventory as CSV |
| POST | `/api/sage/sync` | Sync all items to Sage Intacct |
| GET | `/api/sage/sync?test=true` | Test Sage connection |

## Database Schema

- **User** — Auth accounts with roles (USER/ADMIN)
- **InventoryItem** — Products with barcode, quantity, location, condition
- **ScanLog** — Immutable audit trail of all scan events

## Mobile Setup

For the best experience on your phone:

1. Open the app in Chrome or Safari
2. Tap the share/menu button
3. Select "Add to Home Screen"
4. The app will launch in standalone mode (no browser chrome)

The camera permission prompt will appear on first scan.

## Project Structure

```
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Default admin user seed
├── src/
│   ├── app/
│   │   ├── page.tsx        # Login page
│   │   ├── dashboard/      # Stats overview
│   │   ├── scanner/        # Barcode scanner
│   │   ├── inventory/      # Item list & management
│   │   ├── settings/       # Config & Sage connection
│   │   └── api/            # REST endpoints
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── nav.tsx         # Top bar & bottom nav
│   │   └── providers.tsx   # Session provider
│   └── lib/
│       ├── prisma.ts       # DB client singleton
│       ├── auth.ts         # NextAuth config
│       ├── sage.ts         # Sage Intacct API client
│       └── utils.ts        # Tailwind merge utility
├── docker-compose.yml      # Coolify deployment
├── Dockerfile              # Multi-stage build
└── .env.example            # Environment template
```
