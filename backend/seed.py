"""Data contoh untuk development (dipakai endpoint /api/dev/seed)."""
import random
import uuid
from datetime import datetime, timedelta

from extensions import SessionLocal
from models import AttendanceModel, EventModel, LocationModel, TikumModel, UserModel
from utils import hash_password


def seed_data():
    """Isi database dengan data contoh.

    Return `(payload, status_code)` — payload siap di-`jsonify`.
    """
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(EventModel).first():
            return {"message": "Already seeded"}, 200

        # Create user
        admin = UserModel(
            id=str(uuid.uuid4()),
            email="admin@gowes.id",
            password_hash=hash_password("password"),
            display_name="Admin Gowes",
            role="ADMIN"
        )
        rider = UserModel(
            id=str(uuid.uuid4()),
            email="rider@gowes.id",
            password_hash=hash_password("password"),
            display_name="Rider Sample",
            role="USER"
        )
        db.add(admin)
        db.add(rider)
        db.flush()

        # Create event
        event_start = datetime.utcnow() + timedelta(days=7)
        event_end = event_start + timedelta(hours=3)
        event = EventModel(
            id=str(uuid.uuid4()),
            title="Critical Mass Makassar #42",
            tagline="Gaskeun, Kuasai Jalan Bareng!",
            description="Event bersepeda bulanan bersama komunitas pesepeda Makassar. Mari bergerak bersama merayakan kota kita!\n\nRute: Simpang Lima → Jl. A. Manoppo → Jl. H.M. Rasuna Said → Jl. Perintis Kemerdekaan → Finish di Alun-Alun Sudirman.",
            start_at=event_start,
            end_at=event_end,
            status="PUBLISHED",
            is_featured=True
        )
        db.add(event)
        db.flush()

        # Add Start location
        start_loc = LocationModel(
            id=str(uuid.uuid4()),
            event_id=event.id, type="START",
            name="Simpang Lima",
            description="Titik kumpul utama di Simpang Lima, Kota Makassar",
            time="17:00 WITA",
            lat=-5.1415, lng=119.4327
        )
        db.add(start_loc)

        # Add Finish location
        finish_loc = LocationModel(
            id=str(uuid.uuid4()),
            event_id=event.id, type="FINISH",
            name="Alun-Alun Sudirman",
            description="Finish di area Alun-Alun Sudirman, ada hiburan dan refreshment",
            time="19:30 WITA",
            lat=-5.1500, lng=119.4450
        )
        db.add(finish_loc)

        # Add Tikums with Coordinators (PRD Q6: role Koordinator Tikum)
        coordinators = []
        tikum_data = [
            ("Tikum Mamajang", -5.1350, 119.4150, "16:30 WITA", "Koordinator Mamajang"),
            ("Tikum Panakkukang", -5.1600, 119.4200, "16:45 WITA", "Koordinator Panakkukang"),
            ("Tikum Marioriayang", -5.1550, 119.4550, "17:00 WITA", "Koordinator Marioriayang"),
            ("Tikum Biringkanaya", -5.1300, 119.4500, "16:30 WITA", "Koordinator Biringkanaya"),
        ]
        for name, lat, lng, mt, coord_name in tikum_data:
            coord = UserModel(
                id=str(uuid.uuid4()),
                email=f"koord.{name.lower().replace('tikum ','')}@gowes.id",
                password_hash=hash_password("password"),
                display_name=coord_name,
                role="TIKUM_COORDINATOR"
            )
            db.add(coord)
            db.flush()
            coordinators.append((coord.id, name))

        for i, (name, lat, lng, mt, _) in enumerate(tikum_data):
            db.add(TikumModel(
                id=str(uuid.uuid4()),
                event_id=event.id, name=name, lat=lat, lng=lng,
                meet_time=mt, contact=f"+62 812-{1000+i*100}-{1000+i}",
                coordinator_user_id=coordinators[i][0]
            ))

        # Add some sample attendances
        tikums = db.query(TikumModel).filter_by(event_id=event.id).all()
        for i in range(25):
            att = AttendanceModel(
                id=str(uuid.uuid4()),
                event_id=event.id,
                user_id=rider.id,
                tikum_id=random.choice(tikums).id if tikums else None,
                status=random.choice(["ATTENDING", "ATTENDING", "ON_THE_WAY"])
            )
            db.add(att)

        # Duplicate attendances with fake users
        for i in range(49):
            fake_email = f"rider{i}@gowes.id"
            u = UserModel(
                id=str(uuid.uuid4()),
                email=fake_email,
                password_hash=hash_password("test"),
                display_name=f"Rider {i+1}",
                role="USER"
            )
            db.add(u)
            att = AttendanceModel(
                id=str(uuid.uuid4()),
                event_id=event.id,
                user_id=u.id,
                tikum_id=random.choice(tikums).id if tikums else None,
                status="ATTENDING"
            )
            db.add(att)
            db.flush()

        db.commit()
        return {
            "message": "Seeded successfully!",
            "users": 4 + 4 + 50,
            "attendances": 51 + 25,
            "coordinators": 4
        }, 200
    except Exception as e:
        db.rollback()
        return {"error": str(e)}, 500
    finally:
        db.close()
