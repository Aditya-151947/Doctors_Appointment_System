from datetime import date, time
from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    name: str = Field(min_length=1)
    age: int = Field(ge=0, le=150)
    phone: str = Field(min_length=1)
    disease: str = Field(min_length=1)
    address: str = Field(min_length=1)


class PatientResponse(PatientCreate):
    id: int

    model_config = {"from_attributes": True}


class DoctorCreate(BaseModel):
    name: str = Field(min_length=1)
    specialization: str = Field(min_length=1)


class DoctorResponse(DoctorCreate):
    id: int

    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: time


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: time
    patient_name: str
    doctor_name: str

    model_config = {"from_attributes": True}
