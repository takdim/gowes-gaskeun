# PRD — Critical Mass Makassar (Web Komunitas Pesepeda)

**Versi:** 1.0
**Tanggal:** 13 Oktober 2026
**Status:** Draft

---

## 1. Ringkasan

Web untuk komunitas pesepeda yang mengelola event rutin (contoh: Critical Mass Makassar, setiap Jumat terakhir bulan). Admin menentukan event, titik kumpul utama, titik finish, dan titik kumpul wilayah (Tikum). Peserta bisa mendaftar hadir, memilih Tikum, dan membagikan posisi secara realtime saat **On The Way** sehingga semua orang bisa melihat pergerakan konvoi di peta.

Tema visual: **iOS 27 Liquid Glass** — permukaan kaca translusen, blur, refraksi lembut, highlight tepi, dan animasi yang halus.
Tagline: “Gaskeun, Kuasai Jalan Bareng!” atau tetap “Bergerak Bersama, Merayakan Kota”

## 2. Tujuan & Metrik

| Tujuan | Metrik |
|---|---|
| Memudahkan peserta tahu info event terbaru | Halaman utama memuat < 2 detik; event aktif selalu tampil |
| Meningkatkan konfirmasi kehadiran | % pengunjung yang menekan "I'm Attending" lalu menyelesaikan login |
| Koordinasi konvoi realtime | Update posisi rider tampil di peta ≤ 5 detik |
| Admin mudah mengelola event | Admin bisa membuat/mengubah event + lokasi < 5 menit |

## 3. Peran Pengguna

1. **Pengunjung (guest)** — melihat beranda, event, Tikum, dan peta tanpa login. Tidak bisa attending / on the way.
2. **Rider (user terdaftar)** — attending, memilih Tikum, on the way, melihat live map penuh.
3. **Admin** — mengelola event, titik lokasi, Tikum, dan data peserta.

## 4. Ruang Lingkup

**In scope (MVP):** beranda, event, Tikum, live map, autentikasi, dashboard user, panel admin, live tracking.
**Out of scope (MVP):** chat antar rider, riwayat rute/statistik jarak, notifikasi push native, aplikasi mobile native, pembayaran.

## 5. User Flow

### 5.1 Alur Utama "I'm Attending"
```
Beranda → klik "I'M ATTENDING"
  ├─ Belum login → Halaman Login/Register → (sukses) → Dashboard User
  └─ Sudah login → Dashboard User (pilih Tikum & konfirmasi hadir)
```

### 5.2 Alur Live Map (setelah login)
```
Login → Live Map → klik "ON THE WAY" → izin GPS browser
  → posisi dibagikan realtime → muncul di daftar "Rider Aktif" & peta
  → klik rider di daftar → peta fokus (fly-to) ke posisi rider
  → klik "Selesai / Finish" → status berubah, posisi berhenti dibagikan
```

### 5.3 Alur Admin
```
Login Admin → Panel Admin → buat/ubah Event → set Start, Finish, Tikum
  → publish → tampil otomatis di Beranda
```

## 6. Kebutuhan Fungsional

### 6.1 Halaman Beranda (`/`)

Publik, menampilkan event aktif terbaru yang ditentukan admin.

| ID | Kebutuhan | Prioritas |
|---|---|---|
| H-01 | Hero: badge jadwal ("Jumat terakhir setiap bulan"), judul event, tagline, tanggal event | Must |
| H-02 | Countdown realtime (hari, jam, menit, detik) menuju waktu mulai event | Must |
| H-03 | Statistik ringkas: **Riders Attending**, **Tikum Peserta**, **On The Way** (realtime) | Must |
| H-04 | Tombol **I'M ATTENDING** (guest → login, user → dashboard) | Must |
| H-05 | Tombol **LIHAT LIVE MAP** | Must |
| H-06 | Kartu **Titik Kumpul Utama / Start** (nama, jam, deskripsi, koordinat, link "Lihat di Maps") — ditentukan admin | Must |
| H-07 | Kartu **Official Finish** (nama, jam, deskripsi, koordinat, link "Lihat di Maps") — ditentukan admin | Must |
| H-08 | Peta ringkas: marker Start, Finish, dan seluruh Tikum beserta jumlah peserta per Tikum | Must |
| H-09 | Tombol "Buka di Live Map" dari peta ringkas | Should |
| H-10 | Jika belum ada event aktif: tampilkan state kosong "Belum ada event terjadwal" | Must |
| H-11 | Setelah event berlangsung, tampilkan label "Sedang Berlangsung"; setelah selesai tampilkan event berikutnya | Should |

### 6.2 Halaman Event (`/event`)
- Daftar event mendatang dan yang lalu.
- Detail event: deskripsi, aturan, rute (opsional), daftar Tikum, jumlah attending.

### 6.3 Halaman Tikum (`/tikum`)
- Daftar Tikum: nama, lokasi, jam kumpul, jumlah peserta terdaftar.
- Peta lokasi Tikum, tombol "Pilih Tikum ini" (jika login).

### 6.4 Autentikasi (`/login`, `/register`)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| A-01 | Registrasi & login (email + password; opsi Google OAuth) | Must |
| A-02 | Nama tampilan di peta (display name) wajib diisi, bisa diubah | Must |
| A-03 | Redirect balik ke tujuan awal setelah login (`?next=`) | Must |
| A-04 | Logout & sesi aman (cookie httpOnly) | Must |
| A-05 | Reset password via email | Should |

### 6.5 Dashboard User (`/dashboard`)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| D-01 | Ringkasan event aktif + status kehadiran user | Must |
| D-02 | Konfirmasi hadir (attending) & pilih Tikum | Must |
| D-03 | Batalkan kehadiran / ganti Tikum sebelum event mulai | Must |
| D-04 | Edit profil (nama tampilan, avatar opsional) | Should |
| D-05 | Pintasan ke Live Map | Must |

### 6.6 Live Map (`/live`)

Hanya bisa **berbagi posisi** setelah login. Guest boleh melihat peta tanpa daftar rider detail (opsional, ditentukan admin).

**Layout:** panel kiri (kontrol + daftar rider), peta di sisi kanan.

| ID | Kebutuhan | Prioritas |
|---|---|---|
| L-01 | Header status: indikator **Live**, jumlah rider aktif, counter **On The Way / Di Tikum / Finish** | Must |
| L-02 | Kartu **GPS Saya**: nama di peta + tombol **Ubah** | Must |
| L-03 | Tombol **ON THE WAY** → minta izin geolokasi, mulai kirim posisi; tombol berubah menjadi **Berhenti / Selesai** | Must |
| L-04 | Peringatan: lokasi live hanya bekerja saat halaman aktif | Must |
| L-05 | **Daftar Rider Aktif**: avatar/nama, Tikum asal, status, waktu update terakhir | Must |
| L-06 | Klik rider di daftar → peta *fly-to* ke posisi rider + highlight marker | Must |
| L-07 | Peta menampilkan marker: Start, Finish, Tikum (dengan jumlah peserta), dan rider On The Way (marker bergerak halus) | Must |
| L-08 | Legenda peta (Start, Tikum, Finish, Rider On The Way) | Should |
| L-09 | Indikator koneksi: "Tersambung Realtime" / "Terputus – mencoba lagi" | Must |
| L-10 | Kontrol peta: zoom, ke lokasi saya, fullscreen | Should |
| L-11 | Rider dianggap offline jika tidak ada update > 60 detik (marker redup, lalu dihapus > 5 menit) | Must |
| L-12 | Auto-status: "Di Tikum" saat rider masuk radius Tikum, "Finish" saat masuk radius finish (mis. 100 m) | Should |
| L-13 | State kosong: "Belum Ada Rider Live — klik ON THE WAY untuk membagikan posisi" | Must |

### 6.7 Panel Admin (`/admin`)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| AD-01 | CRUD **Event**: judul, tagline, deskripsi, tanggal, jam mulai, status (draft/published/selesai) | Must |
| AD-02 | Set **Titik Kumpul Utama / Start**: nama, deskripsi, jam, koordinat (pilih di peta) | Must |
| AD-03 | Set **Finish**: nama, deskripsi, jam, koordinat | Must |
| AD-04 | CRUD **Tikum**: nama, koordinat, jam kumpul, kuota (opsional), PIC/kontak | Must |
| AD-05 | Pilih event mana yang menjadi **event utama di Beranda** | Must |
| AD-06 | Lihat daftar peserta (attending) per Tikum, ekspor CSV | Should |
| AD-07 | Moderasi: hapus/blokir rider, paksa hentikan tracking | Should |
| AD-08 | Manajemen role (promosikan user jadi admin) | Should |

## 7. Desain & UX — Liquid Glass (iOS 27)

### 7.1 Prinsip
- Semua panel utama berupa **kaca translusen** yang memantulkan latar di belakangnya.
- Hierarki lewat kedalaman (blur, bayangan, ketebalan highlight), bukan warna solid.
- Animasi lembut, responsif, dan terasa "cair" (spring easing).
- Mode gelap sebagai default (sesuai tampilan saat ini), dengan dukungan mode terang.

### 7.2 Token Visual

| Elemen | Spesifikasi |
|---|---|
| Latar | Foto/gradien kota malam + overlay gelap; peta tetap dark style |
| Panel kaca | `background: rgba(255,255,255,0.06–0.12)`, `backdrop-filter: blur(24–40px) saturate(160%)` |
| Border | 1px gradien tipis putih 20% → 4% (highlight tepi atas-kiri) |
| Bayangan | Lembut berlapis + inner glow tipis (`inset 0 1px 0 rgba(255,255,255,.25)`) |
| Radius | 20–28px untuk kartu, 999px untuk tombol/pill |
| Warna aksen | Hijau neon (aksi utama), Ungu (Tikum), Merah/pink (Finish) |
| Tipografi | Heading monospace tebal (gaya saat ini) + sans-serif (Inter/SF-like) untuk teks |
| Tombol utama | Kaca berwarna hijau dengan specular highlight dan efek tekan (scale 0.97) |
| Navigasi | Bar melayang (floating pill) berbahan kaca; di mobile menjadi tab bar bawah |
| Motion | Spring 250–400 ms, hover shimmer pada tepi, transisi halaman fade + blur |

### 7.3 Komponen Kunci
- Navbar kaca melayang dengan tab aktif berupa "lensa" kaca.
- Kartu statistik, kartu lokasi, dan panel Live Map berbahan kaca.
- Countdown dengan kotak kaca per unit waktu.
- Marker peta berbentuk gelembung kaca dengan ikon.
- Toast, modal, dan bottom sheet berbahan kaca.

### 7.4 Responsif & Aksesibilitas
- Mobile-first; di mobile Live Map: peta penuh + bottom sheet geser berisi daftar rider.
- Kontras teks minimal WCAG AA di atas panel kaca (tambahkan scrim jika perlu).
- Fallback tanpa `backdrop-filter` → warna solid semi-transparan.
- Hormati `prefers-reduced-motion` dan `prefers-color-scheme`.

## 8. Arsitektur & Teknis (Rekomendasi)

| Lapisan | Opsi |
|---|---|
| Frontend | HTML/CSS/JS atau framework (Next.js/React) + Tailwind; CSS custom untuk efek glass |
| Peta | Leaflet atau MapLibre GL + tile gelap (OpenStreetMap-based) |
| Backend | Python Flask (REST + WebSocket/SSE) atau Next.js API routes |
| Realtime | WebSocket / Socket.IO, atau Supabase Realtime / Firebase |
| Database | MySQL |
| Auth | Session cookie / JWT + opsi Google OAuth |
| Hosting | Vercel (frontend) + layanan backend/DB terkelola |

### Realtime Tracking
- Klien memakai `navigator.geolocation.watchPosition` dengan `enableHighAccuracy: true`.
- Kirim posisi ke server tiap **3–5 detik** (throttle) hanya jika bergerak > ±5 m.
- Server menyiarkan (broadcast) update ke semua klien di halaman Live Map.
- Gunakan **Wake Lock API** agar layar tetap aktif saat tracking (jika didukung).
- Keterbatasan: tracking background pada browser/ponsel dapat terbatas (tampilkan peringatan).

## 9. Model Data (Ringkas)

```
users          (id, email, password_hash, display_name, role[user|admin], created_at)
events         (id, title, tagline, description, start_at, status[draft|published|done], is_featured)
locations      (id, event_id, type[start|finish], name, description, time, lat, lng)
tikums         (id, event_id, name, lat, lng, meet_time, quota, contact)
attendances    (id, event_id, user_id, tikum_id, status[attending|on_the_way|at_tikum|finished|cancelled], updated_at)
live_positions (id, event_id, user_id, lat, lng, speed, heading, accuracy, updated_at)
```

## 10. Endpoint API (Draft)

| Method | Endpoint | Deskripsi | Akses |
|---|---|---|---|
| GET | `/api/events/featured` | Event utama + Start, Finish, Tikum, statistik | Publik |
| GET | `/api/events` | Daftar event | Publik |
| GET | `/api/tikums?event_id=` | Daftar Tikum + jumlah peserta | Publik |
| POST | `/api/auth/register` · `/login` · `/logout` | Autentikasi | Publik |
| POST | `/api/attendance` | Konfirmasi hadir + pilih Tikum | User |
| PATCH | `/api/attendance/:id` | Ganti Tikum / batal / ubah status | User |
| POST | `/api/live/start` · `/stop` | Mulai / hentikan On The Way | User |
| POST | `/api/live/position` | Kirim posisi | User |
| GET | `/api/live/riders` | Daftar rider aktif | User |
| WS | `/ws/live` | Stream posisi & statistik realtime | User/Publik* |
| CRUD | `/api/admin/events`, `/locations`, `/tikums` | Manajemen konten | Admin |

\*Tingkat akses guest di Live Map ditentukan admin (lihat Pertanyaan Terbuka).

## 11. Kebutuhan Non-Fungsional

- **Performa:** LCP < 2,5 detik; peta lazy-load; update marker dianimasikan tanpa re-render penuh.
- **Skalabilitas:** minimal 300 rider aktif bersamaan per event.
- **Keamanan:** HTTPS wajib, validasi input, rate limit pada endpoint posisi, proteksi CSRF, RBAC untuk admin.
- **Privasi:** lokasi hanya dibagikan setelah user menekan ON THE WAY dan izin GPS diberikan; data posisi dihapus/diarsipkan setelah event selesai (mis. 24 jam); user bisa berhenti kapan saja.
- **Keandalan:** auto-reconnect WebSocket; fallback polling jika WebSocket gagal.
- **Kompatibilitas:** Safari iOS, Chrome Android, Chrome/Brave/Safari/Firefox desktop terbaru.
- **Bahasa:** Indonesia (default); struktur siap multi-bahasa.

## 12. Edge Case

- User menolak izin GPS → tampilkan panduan mengaktifkan izin, status tetap "Attending".
- GPS tidak akurat (> 100 m) → tandai marker "akurasi rendah".
- User menutup tab saat On The Way → status otomatis offline setelah timeout.
- Event belum dipublish / tidak ada event aktif → beranda menampilkan state kosong.
- Tikum penuh (kuota) → tombol pilih dinonaktifkan.
- Satu user login di beberapa perangkat → hanya satu sesi tracking aktif.

## 13. Rencana Rilis

| Fase | Cakupan | Estimasi |
|---|---|---|
| **M1 — Fondasi** | Desain sistem liquid glass, beranda statis, auth, model data | 1–2 minggu |
| **M2 — Event & Admin** | Panel admin (event, start/finish, Tikum), beranda dinamis, attending + dashboard user | 2 minggu |
| **M3 — Live Map** | On the way, realtime tracking, daftar rider aktif + fly-to, statistik realtime | 2 minggu |
| **M4 — Polish & Uji** | Responsif mobile, aksesibilitas, uji lapangan saat event, perbaikan performa | 1 minggu |

## 14. Kriteria Penerimaan (MVP)

1. Admin dapat membuat event dan menetapkan Start, Finish, serta Tikum; semuanya otomatis tampil di beranda.
2. Guest yang menekan "I'm Attending" diarahkan ke login, lalu kembali ke dashboard setelah sukses.
3. User login dapat memilih Tikum dan jumlah peserta Tikum bertambah di peta/statistik.
4. User dapat menekan ON THE WAY; posisinya muncul di peta semua pengguna dalam ≤ 5 detik.
5. Mengklik rider pada daftar memusatkan peta ke posisi rider tersebut.
6. Counter Riders Attending, Tikum Peserta, dan On The Way di beranda terupdate realtime.
7. Seluruh halaman memakai gaya liquid glass yang konsisten dan nyaman dipakai di ponsel.

## 15. Pertanyaan Terbuka

1. Apakah guest boleh melihat posisi rider di Live Map, atau hanya user login? = guest bisa lihat posisi rider di live map
2. Apakah perlu verifikasi email saat registrasi? = tidak perlu
3. Apakah satu event hanya boleh aktif satu per satu, atau bisa beberapa sekaligus? = bisa beberapa mungkin lebih bagus, akan tetapi jika berat/ribet, 1 saja dahulu
4. Apakah diperlukan gambar rute/jalur resmi di peta (polyline) selain titik? = tidak usah
5. Berapa lama data posisi disimpan setelah event selesai? = ini saya bingung, kamu saja yang putuskan
6. Apakah perlu role tambahan, mis. "Koordinator Tikum"? = ya, mungkin lebih bagus jika ada koordinator tikum
