let doctors = [];
let patients = [];

const $ = (id) => document.getElementById(id);

function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

    if (page === "appointments") {
        $("appointmentsPage").classList.remove("hidden");
        $("pageTitle").textContent = "Scheduled Appointment";
        loadAppointments();
    }

    if (page === "patients") {
        $("patientsPage").classList.remove("hidden");
        $("pageTitle").textContent = "Patients";
        loadPatientsPage();
    }

    if (page === "new") {
        $("newPage").classList.remove("hidden");
        $("pageTitle").textContent = "New Appointment";
        loadDoctors().then(() => loadSlots());
        $("aDate").value = $("aDate").value || todayString();
    }

    if (page === "update") {
        $("updatePage").classList.remove("hidden");
        $("pageTitle").textContent = "Update Appointment";
        Promise.all([loadDoctors(), loadPatients()]);
    }

    if (page === "editPatient") {
        $("editPatientPage").classList.remove("hidden");
        $("pageTitle").textContent = "Update Patient";
    }

    if (page === "doctors") {
        $("doctorsPage").classList.remove("hidden");
        $("pageTitle").textContent = "Doctors";
        loadDoctorList();
    }

    updateHeaderDate();
}

function toast(message, error = false) {
    const el = $("toast");
    el.textContent = message;
    el.style.display = "block";
    el.style.background = error ? "#b82d2d" : "#26332e";
    setTimeout(() => el.style.display = "none", 3500);
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.detail || "Something went wrong");
    }

    return data;
}

function todayString() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
}

function updateHeaderDate() {
    const date = new Date();

    $("dateDisplay").textContent = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    $("dayName").textContent = date.toLocaleDateString("en-IN", {
        weekday: "long"
    });
}

async function loadAppointments() {
    try {
        const selected = $("filterDate").value;
        const url = selected
            ? `/appointments?appointment_date=${selected}`
            : "/appointments";

        const data = await api(url);

        $("appointmentRows").innerHTML = "";

        if (data.length === 0) {
            $("appointmentRows").innerHTML =
                `<tr><td colspan="7" class="empty">No appointments found for this date.</td></tr>`;
        }

        data.forEach(a => {
            $("appointmentRows").innerHTML += `
                <tr>
                    <td>${a.id}</td>
                    <td><b>${escapeHtml(a.patient_name)}</b></td>
                    <td>${escapeHtml(getPatientDisease(a.patient_id))}</td>
                    <td>${escapeHtml(a.doctor_name)}</td>
                    <td>${a.appointment_date}</td>
                    <td><b>${formatTime(a.appointment_time.substring(0,5))}</b></td>
                    <td class="actions-cell">
                        <button class="primary small" onclick="openUpdate(${a.id})">Edit</button>
                        <button class="danger small" onclick="deleteAppointment(${a.id})">Delete</button>
                    </td>
                </tr>
            `;
        });

        $("summary").textContent =
            `${data.length} appointment(s) shown. Maximum 16 patients per doctor per day.`;
    } catch (e) {
        toast(e.message, true);
    }
}

function getPatientDisease(patientId) {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.disease : "-";
}

async function loadPatients() {
    patients = await api("/patients");
    return patients;
}

async function loadPatientsPage() {
    try {
        await loadPatients();

        $("patientRows").innerHTML = "";

        if (patients.length === 0) {
            $("patientRows").innerHTML =
                `<tr><td colspan="7" class="empty">No patients found.</td></tr>`;
        }

        patients.forEach(p => {
            $("patientRows").innerHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td><b>${escapeHtml(p.name)}</b></td>
                    <td>${p.age}</td>
                    <td>${escapeHtml(p.phone)}</td>
                    <td>${escapeHtml(p.disease)}</td>
                    <td>${escapeHtml(p.address)}</td>
                    <td class="actions-cell">
                        <button class="primary small" onclick="openPatientEdit(${p.id})">Edit</button>
                        <button class="danger small" onclick="deletePatient(${p.id})">Delete</button>
                    </td>
                </tr>
            `;
        });

        $("patientSummary").textContent =
            `${patients.length} patient(s) registered in the system.`;
    } catch (e) {
        toast(e.message, true);
    }
}

async function loadDoctors() {
    doctors = await api("/doctors");

    [$("doctor"), $("uDoctor")].filter(Boolean).forEach(select => {
        select.innerHTML = doctors.map(d =>
            `<option value="${d.id}">${escapeHtml(d.name)} - ${escapeHtml(d.specialization)}</option>`
        ).join("");
    });

    return doctors;
}

async function loadDoctorList() {
    try {
        doctors = await api("/doctors");

        $("doctorList").innerHTML = doctors.map(d => `
            <div class="doctor-item">
                <div>
                    <b>${escapeHtml(d.name)}</b>
                    <span>${escapeHtml(d.specialization)}</span>
                </div>
                <div class="doctor-rule">16 patients/day • 30 min/slot</div>
            </div>
        `).join("");
    } catch (e) {
        toast(e.message, true);
    }
}

async function loadSlots() {
    const doctorId = $("doctor").value;
    const date = $("aDate").value;
    const slot = $("slot");

    if (!doctorId || !date) {
        slot.innerHTML = `<option value="">Select doctor and date</option>`;
        return;
    }

    try {
        const data = await api(
            `/doctors/${doctorId}/available-slots?appointment_date=${date}`
        );

        if (data.available_slots.length === 0) {
            slot.innerHTML = `<option value="">No slots available</option>`;
        } else {
            slot.innerHTML = data.available_slots.map(s =>
                `<option value="${s}:00">${formatTime(s)}</option>`
            ).join("");
        }

        $("slotInfo").textContent =
            `${data.booked_count}/16 appointments booked. ${data.available_slots.length} slot(s) available.`;
    } catch (e) {
        toast(e.message, true);
    }
}

async function loadUpdateSlots() {
    const doctorId = $("uDoctor").value;
    const date = $("uDate").value;

    if (!doctorId || !date) return;

    try {
        const data = await api(
            `/doctors/${doctorId}/available-slots?appointment_date=${date}`
        );

        $("uSlot").innerHTML = data.available_slots.map(s =>
            `<option value="${s}:00">${formatTime(s)}</option>`
        ).join("");

        if (data.available_slots.length === 0) {
            $("uSlot").innerHTML = `<option value="">No slots available</option>`;
        }
    } catch (e) {
        toast(e.message, true);
    }
}

async function bookAppointment() {
    try {
        const patientData = {
            name: $("pName").value.trim(),
            age: Number($("pAge").value),
            phone: $("pPhone").value.trim(),
            disease: $("pDisease").value.trim(),
            address: $("pAddress").value.trim()
        };

        if (!patientData.name || !patientData.age || !patientData.phone ||
            !patientData.disease || !patientData.address ||
            !$("aDate").value || !$("slot").value) {
            toast("Please fill all fields and select a time slot.", true);
            return;
        }

        const patient = await api("/patients", {
            method: "POST",
            body: JSON.stringify(patientData)
        });

        await api("/appointments", {
            method: "POST",
            body: JSON.stringify({
                patient_id: patient.id,
                doctor_id: Number($("doctor").value),
                appointment_date: $("aDate").value,
                appointment_time: $("slot").value
            })
        });

        const bookedDate = $("aDate").value;

        toast("Appointment booked successfully.");
        clearForm();

        $("filterDate").value = bookedDate;
        showPage("appointments");
    } catch (e) {
        toast(e.message, true);
    }
}

async function findAppointment() {
    try {
        const id = $("updateId").value;

        if (!id) {
            toast("Enter an appointment ID.", true);
            return;
        }

        const a = await api(`/appointments/${id}`);

        await Promise.all([loadDoctors(), loadPatients()]);

        $("uPatient").value = a.patient_id;
        $("uDoctor").value = a.doctor_id;
        $("uDate").value = a.appointment_date;

        await loadUpdateSlots();

        const currentOption = [...$("uSlot").options]
            .find(o => o.value === a.appointment_time);

        if (currentOption) {
            $("uSlot").value = a.appointment_time;
        } else {
            const option = document.createElement("option");
            option.value = a.appointment_time;
            option.textContent = formatTime(a.appointment_time.substring(0,5)) + " (current)";
            $("uSlot").appendChild(option);
            $("uSlot").value = a.appointment_time;
        }

        $("updateForm").classList.remove("hidden");
    } catch (e) {
        toast(e.message, true);
    }
}

async function updateAppointment() {
    try {
        const id = $("updateId").value;

        await api(`/appointments/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                patient_id: Number($("uPatient").value),
                doctor_id: Number($("uDoctor").value),
                appointment_date: $("uDate").value,
                appointment_time: $("uSlot").value
            })
        });

        toast("Appointment updated successfully.");
        showPage("appointments");
    } catch (e) {
        toast(e.message, true);
    }
}

async function deleteAppointment(id) {
    if (!confirm("Delete this appointment?")) return;

    try {
        await api(`/appointments/${id}`, {method: "DELETE"});
        toast("Appointment deleted.");
        loadAppointments();
    } catch (e) {
        toast(e.message, true);
    }
}

function openUpdate(id) {
    showPage("update");
    $("updateId").value = id;
    setTimeout(findAppointment, 150);
}

function openPatientEdit(id) {
    const patient = patients.find(p => p.id === id);

    if (!patient) {
        toast("Patient not found.", true);
        return;
    }

    $("editPatientId").value = patient.id;
    $("eName").value = patient.name;
    $("eAge").value = patient.age;
    $("ePhone").value = patient.phone;
    $("eDisease").value = patient.disease;
    $("eAddress").value = patient.address;

    showPage("editPatient");
}

async function savePatient() {
    try {
        const id = $("editPatientId").value;

        const data = {
            name: $("eName").value.trim(),
            age: Number($("eAge").value),
            phone: $("ePhone").value.trim(),
            disease: $("eDisease").value.trim(),
            address: $("eAddress").value.trim()
        };

        if (!data.name || !data.age || !data.phone || !data.disease || !data.address) {
            toast("Please fill all patient fields.", true);
            return;
        }

        await api(`/patients/${id}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });

        toast("Patient updated successfully.");
        showPage("patients");
    } catch (e) {
        toast(e.message, true);
    }
}

async function deletePatient(id) {
    if (!confirm("Delete this patient?")) return;

    try {
        await api(`/patients/${id}`, {method: "DELETE"});
        toast("Patient deleted.");
        loadPatientsPage();
    } catch (e) {
        toast(e.message, true);
    }
}

function clearForm() {
    ["pName", "pAge", "pPhone", "pDisease", "pAddress"].forEach(id => {
        $(id).value = "";
    });

    $("aDate").value = todayString();
    $("slotInfo").textContent = "";
    loadSlots();
}

function formatTime(value) {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

$("filterDate").value = todayString();
$("aDate").value = todayString();

$("doctor").addEventListener("change", loadSlots);
$("aDate").addEventListener("change", loadSlots);
$("uDoctor").addEventListener("change", loadUpdateSlots);
$("uDate").addEventListener("change", loadUpdateSlots);

showPage("appointments");
