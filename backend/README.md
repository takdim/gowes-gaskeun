# Backend — Gowes Gaskeun API

Flask + Flask-SocketIO + SQLAlchemy (MySQL). Struktur modular (template) dengan
pola **app factory + blueprint**: tiap domain punya file sendiri, `app.py` hanya
merangkai semuanya.

## Struktur

```
backend/
├── app.py          # Entrypoint tipis: create_app() + socketio.run()
├── config.py       # Config — semua setting dari environment (.env)
├── extensions.py   # engine, SessionLocal, Base, socketio, db_available
├── models.py       # Model SQLAlchemy (tabel database)
├── utils.py        # Decorator auth (require_db/auth/admin) + hash password
├── sockets.py      # Handler Socket.IO (register_socket_handlers)
├── seed.py         # seed_data() — data contoh development
├── requirements.txt
├── .env / .env.example
└── routes/         # Blueprint per domain
    ├── __init__.py # register_blueprints(app)
    ├── public.py   # /api/events, /api/events/featured, /api/tikums, /api/stats
    ├── auth.py     # /api/auth/*
    ├── user.py     # /api/attendance*, /api/users/profile, /api/me/attendance
    ├── live.py     # /api/live/*
    ├── admin.py    # /api/admin/*
    └── dev.py      # /api/dev/seed
```

## Alur boot

1. `config.py` baca `.env` → `Config`.
2. `extensions.py` buat `engine`/`SessionLocal`/`Base` + instance `socketio`
   (belum terikat app) dan cek `db_available`.
3. `app.py` → `create_app()`: set SECRET_KEY, pasang CORS, `socketio.init_app()`,
   `init_db()` (create_all), daftar blueprint, daftar socket handler.

## Menambah endpoint baru

1. Tambah handler di blueprint yang sesuai di `routes/` (atau buat file baru + daftarkan
   di `routes/__init__.py`).
2. Gunakan decorator `@require_db` (dan `@require_auth` untuk endpoint privat).
3. Kalau perlu tabel/kolom baru, ubah `models.py` (tabel dibuat otomatis oleh `init_db()`).

## Menjalankan

```bash
python app.py        # http://localhost:5001 (auto-reload, debug=True)
```

Konvensi import: absolut antar modul (`from models import ...`, `from extensions import ...`)
karena `backend/` adalah root saat `python app.py` dijalankan.
