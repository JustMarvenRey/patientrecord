const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

const user = JSON.parse(sessionStorage.getItem("currentUser"));
const isAdmin = user ? user.RoleName === 'Admin' : false;

document.addEventListener("DOMContentLoaded", () => {
  // Doctor column only exists for Admin, so only offer that sort to Admin
  if (!isAdmin) document.querySelector('#sort-by option[value="doctor-asc"]')?.remove();
  document.getElementById("sort-by").addEventListener("change", renderSorted);
  document.getElementById("hide-closed").addEventListener("change", renderSorted);
  displayConsultations();
});

// ── Sorting ─────────────────────────────────────────────────────────────────
let consultationRows = [];

const cmpText = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
const cmpRaw = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const dateTimeKey = (r) => `${r.AppointmentDate} ${r.AppointmentTime ?? ""}`;
// Recorded = 0, Inactive = 1, None = 2
const consultRank = (r) => (!r.ConsultationID ? 2 : r.ConsultationStatus === "Inactive" ? 1 : 0);

const CONSULT_SORTS = {
  "date-desc":        (a, b) => cmpRaw(dateTimeKey(b), dateTimeKey(a)),
  "date-asc":         (a, b) => cmpRaw(dateTimeKey(a), dateTimeKey(b)),
  "patient-asc":      (a, b) => cmpText(a.PatientName, b.PatientName),
  "patient-desc":     (a, b) => cmpText(b.PatientName, a.PatientName),
  "doctor-asc":       (a, b) => cmpText(a.DoctorName, b.DoctorName),
  "appt-status-asc":  (a, b) => cmpText(a.AppointmentStatus, b.AppointmentStatus),
  "consult-recorded": (a, b) => consultRank(a) - consultRank(b),
  "consult-none":     (a, b) => consultRank(b) - consultRank(a),
};

const renderSorted = () => {
  const sortKey = document.getElementById("sort-by").value;
  const hideClosed = document.getElementById("hide-closed").checked;
  const rows = consultationRows.filter(
    (r) => !hideClosed || !["Completed", "Cancelled"].includes(r.AppointmentStatus)
  );
  renderTable(rows.sort(CONSULT_SORTS[sortKey]));
};

// ── Fetch & render ─────────────────────────────────────────────────────────
const displayConsultations = async () => {
  if (!user) return;

  const response = await axios.get(`${baseApiUrl}/consultations.php`, {
    params: {
      operation: "getAppointmentsByDoctor",
      json: JSON.stringify({ userId: user.UserID, role: user.RoleName }),
    },
  });

  if (response.status === 200) {
    consultationRows = response.data;
    renderSorted();
  } else {
    alert("Error loading consultations.");
  }
};

const renderTable = (rows) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableDiv.innerHTML = `<p class="text-muted">No appointments found for your account.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  table.innerHTML = `
    <thead>
      <tr>
        <th>DATE</th>
        <th>TIME</th>
        <th>PATIENT</th>
        ${isAdmin ? '<th>DOCTOR</th>' : ''}
        <th>REASON</th>
        <th class="text-nowrap">APPT STATUS</th>
        <th class="text-nowrap">CONSULTATION</th>
        <th class="text-nowrap">ACTION</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");

  rows.forEach((row) => {
    const hasConsultation = !!row.ConsultationID;
    const isInactive = hasConsultation && row.ConsultationStatus === "Inactive";
    const canAdd = !isAdmin && ["Confirmed", "Scheduled", "Pending"].includes(row.AppointmentStatus);
    const apptBadge = badgeColor(row.AppointmentStatus);
    const tr = document.createElement("tr");
    if (isInactive) tr.classList.add("table-secondary");

    let consultCell;
    if (!hasConsultation) consultCell = `<span class="badge bg-secondary">None</span>`;
    else if (isInactive) consultCell = `<span class="badge bg-dark">Inactive</span>`;
    else consultCell = `<span class="badge bg-success">Recorded</span>`;

    let actionCell;
    if (hasConsultation) {
      actionCell = `<button class="btn btn-primary btn-sm btn-view-consult">View</button>`;
      if (!isInactive) actionCell += `<button class="btn btn-success btn-sm btn-update-consult">Update</button>`;
      if (isAdmin) {
        actionCell += isInactive
          ? `<button class="btn btn-warning btn-sm btn-restore-consult">Restore</button>`
          : `<button class="btn btn-danger btn-sm btn-deactivate-consult">Deactivate</button>`;
      }
    } else if (canAdd) {
      actionCell = `<button class="btn btn-warning btn-sm btn-add-consult">Add Consultation</button>`;
    } else {
      actionCell = `<span class="text-muted small">—</span>`;
    }

    tr.innerHTML = `
      <td class="text-nowrap">${row.AppointmentDate}</td>
      <td class="text-nowrap">${formatTime(row.AppointmentTime)}</td>
      <td>${row.PatientName}</td>
      ${isAdmin ? `<td>${row.DoctorName ?? ''}</td>` : ''}
      <td>${row.Reason ?? ""}</td>
      <td><span class="badge ${apptBadge}">${row.AppointmentStatus}</span></td>
      <td>${consultCell}</td>
      <td class="text-nowrap"><div class="d-flex flex-nowrap gap-1">${actionCell}</div></td>
    `;

    tbody.appendChild(tr);

    tr.querySelector(".btn-view-consult")?.addEventListener("click", () => {
      window.location.href = `consultation-detail.html?id=${row.ConsultationID}`;
    });
    tr.querySelector(".btn-update-consult")?.addEventListener("click", () => showConsultationForm(row, true));
    tr.querySelector(".btn-deactivate-consult")?.addEventListener("click", () => deactivateConsultation(row));
    tr.querySelector(".btn-restore-consult")?.addEventListener("click", () => restoreConsultation(row));
    tr.querySelector(".btn-add-consult")?.addEventListener("click", () => showConsultationForm(row, false));
  });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

// ── Add / Update form modal ─────────────────────────────────────────────────
const showConsultationForm = (row, isUpdate) => {
  const title = isUpdate ? "Update Consultation" : "Add Consultation";
  document.getElementById("consultation-modal-title").innerText = title;

  const today = new Date().toISOString().split("T")[0];

  document.getElementById("consultation-modal-body").innerHTML = `
    <div class="mb-2">
      <label class="form-label fw-bold">Patient</label>
      <p class="form-control-plaintext">${row.PatientName}</p>
    </div>
    <div class="mb-2">
      <label class="form-label fw-bold">Appointment</label>
      <p class="form-control-plaintext">${row.AppointmentDate} ${formatTime(row.AppointmentTime)} — ${row.Reason ?? ""}</p>
    </div>
    <div class="mb-2">
      <label class="form-label">Consultation Date <span class="text-danger">*</span></label>
      <input type="date" class="form-control" id="f-consult-date" value="${isUpdate ? row.ConsultationDate : today}" />
    </div>
    <div class="mb-2">
      <label class="form-label">Chief Complaint <span class="text-danger">*</span></label>
      <textarea class="form-control" id="f-chief-complaint" rows="2">${isUpdate ? (row.ChiefComplaint ?? "") : ""}</textarea>
    </div>
    <div class="mb-2">
      <label class="form-label">Symptoms</label>
      <textarea class="form-control" id="f-symptoms" rows="2">${isUpdate ? (row.Symptoms ?? "") : ""}</textarea>
    </div>
    <div class="mb-2">
      <label class="form-label">Treatment</label>
      <textarea class="form-control" id="f-treatment" rows="2">${isUpdate ? (row.Treatment ?? "") : ""}</textarea>
    </div>
    <div class="mb-2">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="f-notes" rows="2">${isUpdate ? (row.ConsultationNotes ?? "") : ""}</textarea>
    </div>
  `;

  const footer = document.getElementById("consultation-modal-footer");
  footer.innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-consult">
      ${isUpdate ? "Save Changes" : "Save Consultation"}
    </button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("consultation-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-consult").addEventListener("click", async () => {
    const consultDate    = document.getElementById("f-consult-date").value;
    const chiefComplaint = document.getElementById("f-chief-complaint").value.trim();

    if (!consultDate || !chiefComplaint) {
      alert("Consultation Date and Chief Complaint are required.");
      return;
    }

    let result;
    if (isUpdate) {
      result = await updateConsultation({
        consultationId:   row.ConsultationID,
        consultationDate: consultDate,
        chiefComplaint,
        symptoms:  document.getElementById("f-symptoms").value,
        treatment: document.getElementById("f-treatment").value,
        notes:     document.getElementById("f-notes").value,
      });
    } else {
      result = await insertConsultation({
        appointmentId:    row.AppointmentID,
        consultationDate: consultDate,
        chiefComplaint,
        symptoms:  document.getElementById("f-symptoms").value,
        treatment: document.getElementById("f-treatment").value,
        notes:     document.getElementById("f-notes").value,
      });
    }

    if (!isUpdate && result?.success == 1) {
      // New consultation → go to the detail page to record vital signs next
      modal.hide();
      window.location.href = `consultation-detail.html?id=${result.consultationId}&new=1`;
    } else if (isUpdate && result == 1) {
      modal.hide();
      displayConsultations();
      alert("Consultation updated!");
    } else if (result?.error === "already_has_consultation") {
      alert("This appointment already has a consultation recorded.");
    } else {
      alert("ERROR saving consultation.");
    }
  });
};

// ── API calls ───────────────────────────────────────────────────────────────
const insertConsultation = async (data) => {
  const fd = new FormData();
  fd.append("operation", "insertConsultation");
  fd.append("json", JSON.stringify(data));
  const res = await axios({ url: `${baseApiUrl}/consultations.php`, method: "POST", data: fd });
  return res.data;
};

const updateConsultation = async (data) => {
  const fd = new FormData();
  fd.append("operation", "updateConsultation");
  fd.append("json", JSON.stringify(data));
  const res = await axios({ url: `${baseApiUrl}/consultations.php`, method: "POST", data: fd });
  return res.data;
};

// ── Deactivate / Restore (Admin only) ───────────────────────────────────────
const CONSULT_ERRORS = { forbidden: "Only an Admin can do that." };

const postConsultStatus = async (operation, row) => {
  const fd = new FormData();
  fd.append("operation", operation);
  fd.append("json", JSON.stringify({ consultationId: row.ConsultationID, actingUserId: user.UserID }));
  const res = await axios({ url: `${baseApiUrl}/consultations.php`, method: "POST", data: fd });
  return res.data;
};

const deactivateConsultation = async (row) => {
  const ok = await showConfirm(
    `Deactivate the consultation for ${row.PatientName} (${row.AppointmentDate})? The record is kept and can be restored later.`,
    { type: "danger", title: "Deactivate consultation", confirmText: "Deactivate", cancelText: "Keep" }
  );
  if (!ok) return;
  const res = await postConsultStatus("deactivateConsultation", row);
  if (res == 1) {
    displayConsultations();
    alert("Consultation has been deactivated!");
  } else {
    alert(CONSULT_ERRORS[res?.error] || "ERROR deactivating consultation.");
  }
};

const restoreConsultation = async (row) => {
  const res = await postConsultStatus("restoreConsultation", row);
  if (res == 1) {
    displayConsultations();
    alert("Consultation restored!");
  } else {
    alert(CONSULT_ERRORS[res?.error] || "ERROR restoring consultation.");
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────
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
    case "Confirmed":  return "bg-info text-dark";
    case "Pending":    return "bg-warning text-dark";
    case "Cancelled":  return "bg-danger";
    case "No-Show":    return "bg-warning text-dark";
    default:           return "bg-secondary";
  }
};
