const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

const CAN_UPDATE_CANCEL = ["Admin", "Staff"]; // only these roles see Update/Cancel
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) return;

  document.getElementById("sort-by").addEventListener("change", renderSorted);
  document.getElementById("hide-closed").addEventListener("change", renderSorted);

  // Doctors can't book appointments — hide the form entirely
  if (currentUser.RoleName === "Doctor") {
    document.getElementById("main-div")?.remove();
    displayAppointments();
    return;
  }

  await loadDropdowns();
  displayAppointments();

  document.getElementById("btn-submit").addEventListener("click", insertAppointment);
});

// ── Dropdowns ───────────────────────────────────────────────────────────────
const loadDropdowns = async () => {
  // Patients
  const pRes = await axios.get(`${baseApiUrl}/patients.php`, {
    params: { operation: "getActivePatients" },
  });
  const patientSel = document.getElementById("appt-patient");
  patientSel.innerHTML = `<option value="" disabled selected>Select Patient</option>`;
  pRes.data.forEach((p) => {
    patientSel.innerHTML += `<option value="${p.PatientID}">${p.LastName}, ${p.FirstName}</option>`;
  });

  // Block past dates in the date picker
  document.getElementById("appt-date").min = todayStr();

  // Doctors
  const dRes = await axios.get(`${baseApiUrl}/appointments.php`, {
    params: { operation: "getActiveDoctors" },
  });
  const doctorSel = document.getElementById("appt-doctor");
  const doctorWrap = document.getElementById("doctor-field-wrap");

  if (currentUser.RoleName === "Doctor") {
    // Doctor is booking for themselves — lock the field to their own account
    doctorWrap.innerHTML = `
      <label class="form-label">Doctor</label>
      <input type="text" class="form-control" value="${currentUser.LastName}, ${currentUser.FirstName}" disabled />
      <input type="hidden" id="appt-doctor" value="${currentUser.UserID}" />
    `;
  } else {
    doctorSel.innerHTML = `<option value="" disabled selected>Select Doctor</option>`;
    dRes.data.forEach((d) => {
      doctorSel.innerHTML += `<option value="${d.UserID}">${doctorLabel(d)}</option>`;
    });
  }
};

// ── Fetch & render table ────────────────────────────────────────────────────
const displayAppointments = async () => {
  let response;
  if (currentUser.RoleName === "Doctor") {
    response = await axios.get(`${baseApiUrl}/appointments.php`, {
      params: {
        operation: "getAppointmentsByDoctor",
        json: JSON.stringify({ userId: currentUser.UserID }),
      },
    });
  } else {
    response = await axios.get(`${baseApiUrl}/appointments.php`, {
      params: { operation: "getAllAppointments" },
    });
  }

  if (response.status === 200) {
    appointmentRows = response.data;
    renderSorted();
  } else alert("Error loading appointments.");
};

// ── Sorting ─────────────────────────────────────────────────────────────────
let appointmentRows = [];

const cmpText = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
const cmpRaw = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const dateTimeKey = (r) => `${r.AppointmentDate} ${r.AppointmentTime ?? ""}`;

const APPT_SORTS = {
  "date-desc":    (a, b) => cmpRaw(dateTimeKey(b), dateTimeKey(a)),
  "date-asc":     (a, b) => cmpRaw(dateTimeKey(a), dateTimeKey(b)),
  "patient-asc":  (a, b) => cmpText(a.PatientName, b.PatientName),
  "patient-desc": (a, b) => cmpText(b.PatientName, a.PatientName),
  "doctor-asc":   (a, b) => cmpText(a.DoctorName, b.DoctorName),
  "doctor-desc":  (a, b) => cmpText(b.DoctorName, a.DoctorName),
  "status-asc":   (a, b) => cmpText(a.Status, b.Status),
};

const renderSorted = () => {
  const sortKey = document.getElementById("sort-by").value;
  const hideClosed = document.getElementById("hide-closed").checked;
  const rows = appointmentRows.filter(
    (r) => !hideClosed || !["Completed", "Cancelled"].includes(r.Status)
  );
  renderTable(rows.sort(APPT_SORTS[sortKey]));
};

const renderTable = (rows) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableDiv.innerHTML = `<p class="text-muted">No appointments found.</p>`;
    return;
  }

  const canModify = CAN_UPDATE_CANCEL.includes(currentUser.RoleName);
  const isAdmin = currentUser.RoleName === "Admin";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");
  table.innerHTML = `
    <thead>
      <tr>
        <th>DATE</th>
        <th>TIME</th>
        <th>PATIENT</th>
        <th>DOCTOR</th>
        <th>REASON</th>
        <th>STATUS</th>
        <th>ACTION</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const badge = badgeColor(row.Status);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.AppointmentDate}</td>
      <td>${formatTime(row.AppointmentTime)}</td>
      <td>${row.PatientName}</td>
      <td>${row.DoctorName}</td>
      <td>${row.Reason ?? "—"}</td>
      <td><span class="badge ${badge}">${row.Status}</span></td>
      <td>
        <button class="btn btn-primary btn-sm btn-view me-1">View</button>
        ${canModify && row.Status === "Scheduled"
          ? `<button class="btn btn-success btn-sm btn-update me-1">Update</button>
             <button class="btn btn-danger btn-sm btn-cancel">${isAdmin ? "Deactivate" : "Cancel"}</button>`
          : ""}
        ${isAdmin && row.Status === "Cancelled"
          ? `<button class="btn btn-warning btn-sm btn-restore">Restore</button>`
          : ""}
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector(".btn-view").addEventListener("click", () => viewAppointment(row));
    if (canModify && row.Status === "Scheduled") {
      tr.querySelector(".btn-update").addEventListener("click", () => showUpdateModal(row));
      tr.querySelector(".btn-cancel").addEventListener("click", () => cancelAppointment(row));
    }
    tr.querySelector(".btn-restore")?.addEventListener("click", () => restoreAppointment(row));
  });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

// ── View modal ──────────────────────────────────────────────────────────────
const viewAppointment = (row) => {
  document.getElementById("blank-modal-title").innerText = "Appointment Details";
  document.getElementById("blank-main-div").innerHTML = `
    <table class="table table-sm">
      <tr><td><strong>Patient</strong></td><td>${row.PatientName}</td></tr>
      <tr><td><strong>Doctor</strong></td><td>${row.DoctorName}</td></tr>
      <tr><td><strong>Date</strong></td><td>${row.AppointmentDate}</td></tr>
      <tr><td><strong>Time</strong></td><td>${formatTime(row.AppointmentTime)}</td></tr>
      <tr><td><strong>Reason</strong></td><td>${row.Reason ?? "—"}</td></tr>
      <tr><td><strong>Notes</strong></td><td>${row.Notes ?? "—"}</td></tr>
      <tr><td><strong>Status</strong></td><td><span class="badge ${badgeColor(row.Status)}">${row.Status}</span></td></tr>
    </table>
  `;
  document.getElementById("blank-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
  `;
  new bootstrap.Modal(document.getElementById("blank-modal"), { backdrop: "static" }).show();
};

// ── Update modal (Admin/Staff only) ────────────────────────────────────────
const showUpdateModal = async (row) => {
  // Load fresh doctor list for the dropdown
  const dRes = await axios.get(`${baseApiUrl}/appointments.php`, {
    params: { operation: "getActiveDoctors" },
  });
  const pRes = await axios.get(`${baseApiUrl}/patients.php`, {
    params: { operation: "getActivePatients" },
  });

  const doctorOptions = dRes.data.map((d) =>
    `<option value="${d.UserID}" ${d.UserID == row.UserID ? "selected" : ""}>${doctorLabel(d)}</option>`
  ).join("");
  const patientOptions = pRes.data.map((p) =>
    `<option value="${p.PatientID}" ${p.PatientID == row.PatientID ? "selected" : ""}>${p.LastName}, ${p.FirstName}</option>`
  ).join("");

  const statusOptions = ["Scheduled", "Completed", "Cancelled", "No-Show"].map((s) =>
    `<option value="${s}" ${s === row.Status ? "selected" : ""}>${s}</option>`
  ).join("");

  document.getElementById("update-modal-body").innerHTML = `
    <div class="row g-2">
      <div class="col-md-6">
        <label class="form-label">Patient <span class="text-danger">*</span></label>
        <select class="form-select" id="upd-patient">${patientOptions}</select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Doctor <span class="text-danger">*</span></label>
        <select class="form-select" id="upd-doctor">${doctorOptions}</select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Date <span class="text-danger">*</span></label>
        <input type="date" class="form-control" id="upd-date" min="${todayStr()}" value="${row.AppointmentDate}" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Time <span class="text-danger">*</span></label>
        <input type="time" class="form-control" id="upd-time" value="${row.AppointmentTime}" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Status</label>
        <select class="form-select" id="upd-status">${statusOptions}</select>
      </div>
      <div class="col-12">
        <label class="form-label">Reason</label>
        <input type="text" class="form-control" id="upd-reason" value="${row.Reason ?? ""}" />
      </div>
      <div class="col-12">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="upd-notes" rows="2">${row.Notes ?? ""}</textarea>
      </div>
    </div>
  `;

  document.getElementById("update-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-update">Save Changes</button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("update-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-update").addEventListener("click", async () => {
    const data = {
      appointmentId:   row.AppointmentID,
      patientId:       document.getElementById("upd-patient").value,
      userId:          document.getElementById("upd-doctor").value,
      appointmentDate: document.getElementById("upd-date").value,
      appointmentTime: document.getElementById("upd-time").value,
      status:          document.getElementById("upd-status").value,
      reason:          document.getElementById("upd-reason").value,
      notes:           document.getElementById("upd-notes").value,
    };

    if (!data.patientId || !data.userId || !data.appointmentDate || !data.appointmentTime) {
      alert("Patient, Doctor, Date and Time are required.");
      return;
    }

    // Only enforce "no past date" if the date was actually changed
    if (data.appointmentDate !== row.AppointmentDate && data.appointmentDate < todayStr()) {
      alert("Appointment date cannot be in the past.");
      return;
    }

    const fd = new FormData();
    fd.append("operation", "updateAppointment");
    fd.append("json", JSON.stringify(data));
    const res = await axios({ url: `${baseApiUrl}/appointments.php`, method: "POST", data: fd });

    if (res.data == 1) {
      modal.hide();
      displayAppointments();
      alert("Appointment updated!");
    } else {
      alert(res.data?.error === "date_in_past" ? "Appointment date cannot be in the past." : "ERROR updating appointment.");
    }
  });
};

// ── Cancel (Admin/Staff only) ───────────────────────────────────────────────
const cancelAppointment = async (row) => {
  const adminUser = currentUser.RoleName === "Admin";
  if (!(await showConfirm(
    adminUser
      ? `Deactivate appointment for ${row.PatientName} on ${row.AppointmentDate}? It will be marked Cancelled and can be restored later.`
      : `Cancel appointment for ${row.PatientName} on ${row.AppointmentDate}?`,
    {
      type: "danger",
      title: adminUser ? "Deactivate appointment" : "Cancel appointment",
      confirmText: adminUser ? "Deactivate" : "Yes, cancel",
      cancelText: "Keep",
    }
  ))) return;
  const fd = new FormData();
  fd.append("operation", "cancelAppointment");
  fd.append("json", JSON.stringify({ appointmentId: row.AppointmentID }));
  const res = await axios({ url: `${baseApiUrl}/appointments.php`, method: "POST", data: fd });
  if (res.data == 1) {
    displayAppointments();
    alert("Appointment cancelled.");
  } else {
    alert("ERROR cancelling appointment.");
  }
};

// ── Restore (Admin only) ────────────────────────────────────────────────────
const restoreAppointment = async (row) => {
  const fd = new FormData();
  fd.append("operation", "restoreAppointment");
  fd.append("json", JSON.stringify({ appointmentId: row.AppointmentID }));
  const res = await axios({ url: `${baseApiUrl}/appointments.php`, method: "POST", data: fd });
  if (res.data == 1) {
    displayAppointments();
    alert("Appointment restored (set back to Scheduled).");
  } else {
    alert("ERROR restoring appointment.");
  }
};

// ── Insert (all roles) ──────────────────────────────────────────────────────
const insertAppointment = async () => {
  const patientId = document.getElementById("appt-patient").value;
  const userId    = document.getElementById("appt-doctor").value;
  const date      = document.getElementById("appt-date").value;
  const time      = document.getElementById("appt-time").value;

  if (!patientId || !userId || !date || !time) {
    alert("Patient, Doctor, Date and Time are required.");
    return;
  }

  if (date < todayStr()) {
    alert("Appointment date cannot be in the past.");
    return;
  }

  const data = {
    patientId,
    userId,
    appointmentDate: date,
    appointmentTime: time,
    reason: document.getElementById("appt-reason").value,
    notes:  document.getElementById("appt-notes").value,
  };

  const fd = new FormData();
  fd.append("operation", "insertAppointment");
  fd.append("json", JSON.stringify(data));
  const res = await axios({ url: `${baseApiUrl}/appointments.php`, method: "POST", data: fd });

  if (res.data == 1) {
    clearForm();
    displayAppointments();
    alert("Appointment booked successfully!");
  } else if (res.data?.error === "date_in_past") {
    alert("Appointment date cannot be in the past.");
  } else if (res.data?.error === "missing_required_fields") {
    alert("Please fill in all required fields.");
  } else {
    alert("ERROR booking appointment.");
  }
};

const clearForm = () => {
  document.getElementById("appt-patient").value = "";
  const doctorEl = document.getElementById("appt-doctor");
  if (doctorEl && doctorEl.tagName === "SELECT") doctorEl.value = "";
  document.getElementById("appt-date").value   = "";
  document.getElementById("appt-time").value   = "";
  document.getElementById("appt-reason").value = "";
  document.getElementById("appt-notes").value  = "";
};

// ── Helpers ─────────────────────────────────────────────────────────────────
// Today as YYYY-MM-DD in the user's local time (not UTC)
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// "Dela Cruz, Juan — Cardiology" (or "— No specialization")
const doctorLabel = (d) => `${d.DoctorName} — ${d.Specializations || "No specialization"}`;

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? "AM" : "PM"}`;
};

const badgeColor = (status) => {
  switch (status) {
    case "Completed":  return "bg-success";
    case "Scheduled":  return "bg-primary";
    case "Cancelled":  return "bg-danger";
    case "No-Show":    return "bg-warning text-dark";
    default:           return "bg-secondary";
  }
};
