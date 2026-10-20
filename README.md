# Gowes Gaskeun — Critical Mass Makassar

Web platform untuk komunitas pesepeda yang mengelola event rutin (Critical Mass Makassar, setiap Jumat terakhir bulan). Fitur: event management, titik kumpul (Tikum), live map dengan real-time tracking via WebSocket.

**Tema visual:** iOS 27 Liquid Glass — permukaan kaca translusen, blur, dan animasi halus.

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4 |
| Backend | **Python Flask** + Flask-SocketIO (WebSocket) |
| Database | **MySQL** (via pymysql) |
| Peta | **Leaflet** + OpenStreetMap tile (dark style) |
| Autentikasi | Session cookie + bcrypt |

## Project Structure

```
gowes-gaskeun/
├── web/                          # Next.js frontend
│   ├── src/app/
│   │   ├── page.tsx              # Beranda (/)
│   │   ├── event/page.tsx        # Event list (/event)
│   │   ├── tikum/page.tsx        # Titik Kumpul (/tikum)
│   │   ├── live/page.tsx         # Live Map (/live)
│   │   ├── login/page.tsx        # Autentikasi masuk (/login)
│   │   ├── register/page.tsx     # Autentikasi daftar (/register)
│   │   ├── dashboard/page.tsx    # Dashboard user (/dashboard)
│   │   ├── admin/page.tsx        # Panel admin (/admin)
│   │   ├── layout.tsx            # Root layout + Footer
│   │   └── globals.css           # Liquid Glass design system
│   ├── src/components/
│   │   ├── Navbar.tsx            # Floating glass navbar
│   │   ├── MapComponent.tsx      # Leaflet peta client-side
│   │   └── Footer.tsx            # Site footer
│   ├── public/                   # Static assets
│   ├── package.json
│   └── .env.local                # NEXT_PUBLIC_API_URL
├── backend/                      # Python Flask API (modular: app factory + blueprint)
│   ├── app.py                    # Entrypoint tipis: create_app() + socketio.run()
│   ├── config.py                 # Config dari environment (.env)
│   ├── extensions.py             # engine/SessionLocal/Base, socketio
│   ├── models.py                 # Model SQLAlchemy
│   ├── utils.py                  # Decorator auth + helper password
│   ├── sockets.py                # Handler Socket.IO
│   ├── seed.py                   # Data contoh development
│   ├── routes/                   # Endpoint per domain (blueprint)
│   │   ├── public.py             # event, tikum, stats
│   │   ├── auth.py               # register/login/logout
│   │   ├── user.py               # attendance, profil
│   │   ├── live.py               # tracking posisi
│   │   ├── admin.py              # event, lokasi, tikum, peserta, pengguna
│   │   └── dev.py                # seed
│   ├── .env                      # Flask env vars
│   └── requirements.txt          # Python deps
├── prd/
│   └── PRD-Critical-Mass-Makassar.md
└── package.json                  # Root scripts (concurrently)
```

## Quick Start

### Prerequisites

- Node.js 20+ 
- Python 3.10+
- MySQL 8+

### 1. Database Setup

```bash
mysql -u root -p -e "CREATE DATABASE gowes_gaskeun CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Edit password di `backend/.env`:
```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/gowes_gaskeun
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
python app.py                  # Server di http://localhost:5001
```

### 3. Frontend

```bash
cd web
npm install
npm run dev                    # Server di http://localhost:3008
```

### 4. Seed Data (Development)

Setelah backend berjalan:
```bash
curl -X POST http://localhost:5001/api/dev/seed
```

Ini akan membuat event sample, lokasi, Tikum, dan 50+ rider dummy.

### 5. Run Both Services (Concurrent)

Dari root project:
```bash
npm install concurrently --save-dev
npm run dev                    # Jalankan kedua server bersamaan
```

## Pages & Features

| Halaman | URL | Deskripsi |
|---|---|---|
| Beranda | `/` | Hero, countdown, statistik, kartu lokasi, peta ringkas |
| Event | `/event` | Daftar event mendatang & lalu |
| Tikum | `/tikum` | Daftar titik kumpul + peta |
| Login | `/login` | Masuk akun |
| Register | `/register` | Daftar akun baru |
| Dashboard | `/dashboard` | Kehadiran, pilih Tikum, profil |
| Live Map | `/live` | Realtime tracking GPS via WebSocket |
| Admin | `/admin` | CRUD event, lokasi, Tikum |

## API Endpoints

### Public
- `GET /api/events/featured` — Event utama + data lengkap
- `GET /api/events` — Daftar semua event
- `GET /api/tikums?event_id=` — Daftar Tikum (+ koordinator & jumlah peserta)
- `GET /api/stats?event_id=` — Statistik event
- `GET /api/live/riders?event_id=` — Rider aktif
- `WS /ws/live` — Realtime posisi rider (Socket.IO)

### Authenticated (User)
- `POST /api/auth/register` — Registrasi
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `POST /api/attendance` — Daftar hadir + pilih Tikum
- `PATCH /api/attendance/:id` — Ubah status / ganti Tikum
- `POST /api/live/start` — Mulai tracking
- `POST /api/live/position` — Kirim posisi GPS
- `POST /api/live/stop` — Hentikan tracking
- `GET /api/me/attendance` — Riwayat kehadiran user
- `GET /api/users/profile` — Profil pengguna
- `PUT /api/users/profile` — Update profil

### Admin
- `GET /api/admin/events` — List semua event
- `POST /api/admin/events` — Buat event baru
- `PUT /api/admin/events/:id` — Edit event (termasuk featured)
- `GET /api/admin/events/:id/locations` — List lokasi Start/Finish
- `POST /api/admin/events/:id/locations` — Tambah Start/Finish
- `POST /api/admin/events/:id/tikums` — Tambah Tikum (admin & koordinator)
- `PATCH /api/admin/tikums/:id` — Update Tikum (admin & koordinator, koordinator hanya miliknya)
- `DELETE /api/admin/tikums/:id` — Hapus Tikum (admin & koordinator, koordinator hanya miliknya)
- `GET /api/admin/events/:id/attendances` — Daftar peserta event
- `GET /api/admin/users` — List pengguna
- `POST /api/admin/users` — Buat akun (rider / admin / koordinator)

### Dev
- `POST /api/dev/seed` — Seed data sample

## Role & Akses

Role disimpan di kolom `users.role`. Endpoint privat memakai header `X-User-Id`
(selain `Authorization: Bearer <token>`) untuk mengecek role.

| Aksi | USER | TIKUM_COORDINATOR | ADMIN |
|---|---|---|---|
| Attending / on the way / profil sendiri | ✅ | ✅ | ✅ |
| Lihat event, Tikum, statistik | ✅ | ✅ | ✅ |
| Panel admin `/admin` | ❌ | ✅ (tab Overview, Tikum, Peserta) | ✅ (semua tab) |
| Buat/ubah event, tambah lokasi | ❌ | ❌ | ✅ |
| CRUD Tikum (tambah/lihat/ubah/hapus) | ❌ | ✅ tapi **hanya Tikum miliknya**, tanpa ubah koordinator | ✅ semua Tikum |
| Assign koordinator ke Tikum | ❌ | ❌ | ✅ |
| Lihat peserta event | ❌ | ✅ (hanya Tikum miliknya) | ✅ semua |
| Kelola pengguna (buat akun & role) | ❌ | ❌ | ✅ |

Kalau `X-User-Id` tidak dikirim/tidak dikenal → `401`; role tidak berwenang → `403`.

## Design Tokens — Liquid Glass

Kunci styling ada di `web/src/app/globals.css`:

- **Panel kaca:** `backdrop-filter: blur(32px) saturate(160%)`, border transparan
- **Warna aksen:** Hijau neon (#00e87b) aksi utama, Ungu (#a78bfa) Tikum, Merah (#f43f5e) Finish
- **Button:** Glass pill dengan specular highlight, scale 0.97 saat tekan
- **Typography:** Heading monospace tebal, body sans-serif
- **Radius:** 24px kartu, 9999px tombol/pill
- **Animasi:** Spring easing 250–400ms

## Development Notes

- **Port:** Frontend = `3008`, Backend/API = `5001`
- **Peta:** Tile OSM di-invert ke dark mode lewat CSS filter (`invert(0.85) hue-rotate(180deg)`)
- **Realtime:** Socket.IO fallback dari WebSocket ke polling otomatis
- **GPS:** `navigator.geolocation.watchPosition` dengan `enableHighAccuracy: true`
- **Auth token:** Disimpan di localStorage → dikirim via `Authorization: Bearer <token>` header
