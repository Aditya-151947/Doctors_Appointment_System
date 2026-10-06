# Doctor Appointment System

Mini Project 2:

> Create a Patient class and a Doctor class. A doctor can handle multiple patients and a scheduling program where a doctor can only handle 16 patients during an 8-hour work day.

## Features

- Patient management
- Doctor management
- New appointment
- Scheduled appointments
- Update appointment
- Delete appointment
- Update patient
- Delete patient
- Available time-slot checking
- Maximum 16 patients per doctor per day
- 30-minute appointment slots
- 9:00 AM to 5:00 PM working day
- SQLite database
- FastAPI Swagger documentation

## Technology

- Python
- FastAPI
- SQLite3
- SQLAlchemy
- HTML
- CSS
- JavaScript

## Run on Windows

Double-click:

`run.bat`

Or:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

The database file `doctor_appointment.db` is created automatically.

## Scheduling logic

8 hours = 480 minutes

480 / 16 = 30 minutes

Therefore:

09:00 - 09:30 -> Patient 1
09:30 - 10:00 -> Patient 2
...
16:30 - 17:00 -> Patient 16
