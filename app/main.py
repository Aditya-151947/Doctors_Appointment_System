from datetime import date, time, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, SessionLocal
from .models import Patient, Doctor, Appointment
from .schemas import (
    PatientCreate, PatientResponse,
    DoctorCreate, DoctorResponse,
    AppointmentCreate
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Doctor Appointment System",
    description="Mini Project 2 - Doctor scheduling system",
    version="1.0.0"
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND = BASE_DIR / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


# -------------------- Scheduling --------------------

WORK_START = time(9, 0)
WORK_END = time(17, 0)
SLOT_MINUTES = 30
MAX_PATIENTS = 16


def generate_slots():
    slots = []
    current = datetime.combine(date.today(), WORK_START)
    end = datetime.combine(date.today(), WORK_END)

    while current < end:
        slots.append(current.time())
        current += timedelta(minutes=SLOT_MINUTES)

    return slots


VALID_SLOTS = generate_slots()


def validate_slot(value: time):
    if value not in VALID_SLOTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid time slot. Choose a 30-minute slot between 09:00 and 16:30."
        )


def appointment_to_dict(appointment):
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "doctor_id": appointment.doctor_id,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "patient_name": appointment.patient.name,
        "doctor_name": appointment.doctor.name,
    }


# -------------------- Startup --------------------

@app.on_event("startup")
def seed_doctors():
    db = SessionLocal()
    try:
        if db.query(Doctor).count() == 0:
            db.add_all([
                Doctor(name="Dr. Ramesh", specialization="General Physician"),
                Doctor(name="Dr. Sharma", specialization="Cardiologist"),
                Doctor(name="Dr. Priya", specialization="Dermatologist"),
            ])
            db.commit()
    finally:
        db.close()


# -------------------- Frontend --------------------

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(FRONTEND / "index.html")


# -------------------- Patients --------------------

@app.post("/patients", response_model=PatientResponse)
def create_patient(data: PatientCreate, db: Session = Depends(get_db)):
    patient = Patient(**data.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/patients", response_model=list[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.id.desc()).all()


@app.get("/patients/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient


@app.put("/patients/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    data: PatientCreate,
    db: Session = Depends(get_db)
):
    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(404, "Patient not found")

    for key, value in data.model_dump().items():
        setattr(patient, key, value)

    db.commit()
    db.refresh(patient)
    return patient


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(404, "Patient not found")

    appointment_count = db.query(Appointment).filter(
        Appointment.patient_id == patient_id
    ).count()

    if appointment_count > 0:
        raise HTTPException(
            400,
            "Cannot delete this patient because they have an appointment. Delete the appointment first."
        )

    db.delete(patient)
    db.commit()

    return {"message": "Patient deleted successfully"}


# -------------------- Doctors --------------------

@app.post("/doctors", response_model=DoctorResponse)
def create_doctor(data: DoctorCreate, db: Session = Depends(get_db)):
    doctor = Doctor(**data.model_dump())
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@app.get("/doctors", response_model=list[DoctorResponse])
def get_doctors(db: Session = Depends(get_db)):
    return db.query(Doctor).order_by(Doctor.id).all()


@app.get("/doctors/{doctor_id}", response_model=DoctorResponse)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    return doctor


# -------------------- Appointments --------------------

@app.post("/appointments")
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db)):
    validate_slot(data.appointment_time)

    if not db.get(Patient, data.patient_id):
        raise HTTPException(404, "Patient not found")

    if not db.get(Doctor, data.doctor_id):
        raise HTTPException(404, "Doctor not found")

    count = db.query(Appointment).filter(
        Appointment.doctor_id == data.doctor_id,
        Appointment.appointment_date == data.appointment_date
    ).count()

    if count >= MAX_PATIENTS:
        raise HTTPException(
            400,
            "This doctor already has 16 patients for this day."
        )

    existing = db.query(Appointment).filter(
        Appointment.doctor_id == data.doctor_id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.appointment_time == data.appointment_time
    ).first()

    if existing:
        raise HTTPException(400, "This time slot is already booked.")

    appointment = Appointment(**data.model_dump())
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return appointment_to_dict(appointment)


@app.get("/appointments")
def get_appointments(
    appointment_date: date | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)

    if appointment_date:
        query = query.filter(
            Appointment.appointment_date == appointment_date
        )

    appointments = query.order_by(
        Appointment.appointment_date,
        Appointment.appointment_time
    ).all()

    return [appointment_to_dict(a) for a in appointments]


@app.get("/appointments/{appointment_id}")
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(404, "Appointment not found")

    return appointment_to_dict(appointment)


@app.put("/appointments/{appointment_id}")
def update_appointment(
    appointment_id: int,
    data: AppointmentCreate,
    db: Session = Depends(get_db)
):
    validate_slot(data.appointment_time)

    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(404, "Appointment not found")

    if not db.get(Patient, data.patient_id):
        raise HTTPException(404, "Patient not found")

    if not db.get(Doctor, data.doctor_id):
        raise HTTPException(404, "Doctor not found")

    existing = db.query(Appointment).filter(
        Appointment.id != appointment_id,
        Appointment.doctor_id == data.doctor_id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.appointment_time == data.appointment_time
    ).first()

    if existing:
        raise HTTPException(400, "This time slot is already booked.")

    if (
        appointment.doctor_id != data.doctor_id
        or appointment.appointment_date != data.appointment_date
    ):
        count = db.query(Appointment).filter(
            Appointment.id != appointment_id,
            Appointment.doctor_id == data.doctor_id,
            Appointment.appointment_date == data.appointment_date
        ).count()

        if count >= MAX_PATIENTS:
            raise HTTPException(400, "This doctor already has 16 patients for this day.")

    for key, value in data.model_dump().items():
        setattr(appointment, key, value)

    db.commit()
    db.refresh(appointment)

    return appointment_to_dict(appointment)


@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(404, "Appointment not found")

    db.delete(appointment)
    db.commit()

    return {"message": "Appointment deleted successfully"}


@app.get("/doctors/{doctor_id}/available-slots")
def available_slots(
    doctor_id: int,
    appointment_date: date,
    db: Session = Depends(get_db)
):
    if not db.get(Doctor, doctor_id):
        raise HTTPException(404, "Doctor not found")

    booked = db.query(Appointment.appointment_time).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date
    ).all()

    booked_times = {row[0] for row in booked}

    return {
        "doctor_id": doctor_id,
        "date": appointment_date,
        "max_patients": MAX_PATIENTS,
        "booked_count": len(booked_times),
        "available_slots": [
            slot.strftime("%H:%M")
            for slot in VALID_SLOTS
            if slot not in booked_times
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok"}
