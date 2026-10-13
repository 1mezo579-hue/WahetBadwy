# واحة بدوي - Wahet Badawy POS System

نظام نقاط البيع لمطعم واحة بدوي - Dine-in Point of Sale System

## 🚀 Quick Start (Docker - Zero Config)

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Login Credentials
- **Username:** `admin`
- **Password:** `WahetBadawy@2026`

## 🛠️ Local Development (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### Setup

```bash
# Install dependencies
npm install

# Push database schema
npx prisma db push

# Seed the database
npx prisma db seed

# Start development server
npm run dev
```

## 📁 Project Structure

```
wahet-badawy/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Admin seed script
├── public/
│   ├── manifest.json          # PWA manifest (fullscreen kiosk)
│   └── icons/                 # PWA icons
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Arabic RTL)
│   │   ├── page.tsx           # Root redirect
│   │   ├── login/page.tsx     # Login screen
│   │   ├── dashboard/         # Protected dashboard
│   │   └── api/auth/          # NextAuth API routes
│   ├── lib/
│   │   ├── auth.ts            # NextAuth configuration
│   │   └── prisma.ts          # Prisma client singleton
│   ├── middleware.ts           # Route protection
│   └── types/
│       └── next-auth.d.ts     # Type augmentations
├── Dockerfile
├── docker-compose.yml
└── docker-entrypoint.sh
```

## 🔑 Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (RTL Arabic)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (Credentials)
- **PWA:** @ducanh2912/next-pwa (Fullscreen Kiosk)
- **Containerization:** Docker + Docker Compose
