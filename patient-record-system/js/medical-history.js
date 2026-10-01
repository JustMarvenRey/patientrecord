const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

// Get patientId from URL: medical-history.html?patientId=3
const params    = new URLSearchParams(window.location.search);
const patientId = params.get("patientId");

document.addEventListener("DOMContentLoaded", async () => {
  if (!patientId) {
    document.getElementById("history-loading").style.display = "none";
    document.getElementById("history-empty").style.display   = "block";
    document.getElementById("history-empty").textContent     = "No patient specified.";
    return;
  }
  try {
    await loadPatientInfo();
  } catch (err) {
    console.error("Could not load patient info:", err);
  }
  await loadMedicalHistory();
});

// ── Patient info ────────────────────────────────────────────────────────────
const loadPatientInfo = async () => {
  const res = await axios.get(`${baseApiUrl}/patients.php`, {
    params: { operation: "getPatient", json: JSON.stringify({ patientId }) },
  });
  if (!res.data || res.data.length === 0) return;
  const p = res.data[0];

  document.getElementById("history-heading").textContent  = `${p.LastName}, ${p.FirstName} — Medical History`;
  document.getElementById("history-subtext").textContent  = `Patient ID #${p.PatientID} · ${p.Gender} · DOB: ${p.DateOfBirth}`;

  const card = document.getElementById("patient-info-card");
  card.style.display = "block";
  document.getElementById("patient-info-body").innerHTML = `
    <div class="row g-2" style="font-size:.875rem;">
      <div class="col-sm-4"><span class="text-muted">Full Name</span><br/><strong>${p.LastName}, ${p.FirstName}</strong></div>
      <div class="col-sm-2"><span class="text-muted">Gender</span><br/><strong>${p.Gender}</strong></div>
      <div class="col-sm-3"><span class="text-muted">Date of Birth</span><br/><strong>${p.DateOfBirth}</strong></div>
      <div class="col-sm-3"><span class="text-muted">Phone</span><br/><strong>${p.Phone ?? "—"}</strong></div>
      <div class="col-12"><span class="text-muted">Address</span><br/><strong>${p.Address ?? "—"}</strong></div>
    </div>
  `;
};

// ── Empty / error states ─────────────────────────────────────────────────────
const showEmptyBox = (html) => {
  const box = document.getElementById("history-empty");
  box.innerHTML = html;
  box.style.display = "block";
};

// When a patient has no consultations yet, still show the appointments on
// record so the page is never just blank.
const showNoConsultations = async () => {
  let appointments = [];
  try {
    const res = await axios.get(`${baseApiUrl}/patients.php`, {
      params: { operation: "getPatientAppointments", json: JSON.stringify({ patientId }) },
    });
    if (Array.isArray(res.data)) appointments = res.data;
  } catch (err) {
    console.error("Could not load appointments:", err);
  }

  if (appointments.length === 0) {
    showEmptyBox("No consultation records found for this patient.");
    return;
  }

  showEmptyBox(`
    <div class="mb-3">No consultation records found for this patient yet.</div>
    <div class="text-start">
      <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">📅 Appointments on Record</div>
      <table class="table table-sm mb-0" style="font-size:.85rem;">
        <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>
          ${appointments.map(a => `
            <tr>
              <td>${a.AppointmentDate}</td>
              <td>${a.AppointmentTime}</td>
              <td>${a.DoctorName}</td>
              <td>${a.Reason ?? "—"}</td>
              <td><span class="badge bg-secondary">${a.Status}</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `);
};

// ── Medical History timeline ─────────────────────────────────────────────────
const loadMedicalHistory = async () => {
  let history;
  try {
    const res = await axios.get(`${baseApiUrl}/patients.php`, {
      params: { operation: "getPatientMedicalHistory", json: JSON.stringify({ patientId }) },
    });
    history = res.data;
  } catch (err) {
    console.error("Could not load medical history:", err);
    document.getElementById("history-loading").style.display = "none";
    showEmptyBox("Could not load the medical history. Please check that the server and database are running.");
    return;
  }

  document.getElementById("history-loading").style.display = "none";

  // The API returns a JSON array. Anything else (e.g. a PHP warning/error
  // printed before the JSON) means the request did not work.
  if (!Array.isArray(history)) {
    console.error("Unexpected medical history response:", history);
    showEmptyBox("Could not load the medical history (unexpected response from the server).");
    return;
  }

  if (history.length === 0) {
    await showNoConsultations();
    return;
  }

  const timeline = document.getElementById("history-timeline");
  timeline.innerHTML = `
    <div class="d-flex align-items-center gap-2 mb-3">
      <span style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">
        ${history.length} Consultation${history.length > 1 ? "s" : ""} on Record
      </span>
    </div>
  `;

  history.forEach((con, idx) => {
    const diagBadges = con.diagnoses.length > 0
      ? con.diagnoses.map(d => `<span class="badge bg-primary me-1">${d.ICD10Code} — ${d.DiagnosisName}</span>`).join("")
      : `<span class="text-muted small">None recorded</span>`;

    const vitalsHtml = con.vitals.length > 0 ? (() => {
      const v = con.vitals[0];
      return `
        <div class="row g-2 mt-1" style="font-size:.8rem;">
          ${v.Temperature    ? `<div class="col-auto"><span class="badge bg-light text-dark border">🌡 ${v.Temperature}°C</span></div>` : ""}
          ${v.BloodPressure  ? `<div class="col-auto"><span class="badge bg-light text-dark border">💉 ${v.BloodPressure} mmHg</span></div>` : ""}
          ${v.HeartRate      ? `<div class="col-auto"><span class="badge bg-light text-dark border">❤️ ${v.HeartRate} bpm</span></div>` : ""}
          ${v.OxygenSaturation ? `<div class="col-auto"><span class="badge bg-light text-dark border">🫁 SpO₂ ${v.OxygenSaturation}%</span></div>` : ""}
          ${v.Weight         ? `<div class="col-auto"><span class="badge bg-light text-dark border">⚖️ ${v.Weight} kg</span></div>` : ""}
          ${v.Height         ? `<div class="col-auto"><span class="badge bg-light text-dark border">📏 ${v.Height} cm</span></div>` : ""}
        </div>`;
    })() : `<span class="text-muted small">No vitals recorded</span>`;

    const labsHtml = con.labs.length > 0
      ? `<table class="table table-sm mt-2 mb-0" style="font-size:.8rem;">
           <thead><tr><th>Test</th><th>Date</th><th>Result</th><th>Reference</th></tr></thead>
           <tbody>${con.labs.map(l => `
             <tr><td>${l.TestName}</td><td>${l.TestDate}</td>
                 <td>${l.Result ?? "—"}</td><td class="text-muted">${l.ReferenceRange ?? "—"}</td></tr>`).join("")}
           </tbody>
         </table>`
      : `<span class="text-muted small">No lab results recorded</span>`;

    const rxHtml = con.prescriptions.length > 0
      ? `<table class="table table-sm mt-2 mb-0" style="font-size:.8rem;">
           <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
           <tbody>${con.prescriptions.map(rx => `
             <tr><td>${rx.MedicineName} <span class="text-muted">(${rx.GenericName})</span></td>
                 <td>${rx.Dosage ?? "—"}</td><td>${rx.Frequency ?? "—"}</td><td>${rx.Duration ?? "—"}</td></tr>`).join("")}
           </tbody>
         </table>`
      : `<span class="text-muted small">No prescriptions recorded</span>`;

    const card = document.createElement("div");
    card.className = "section-card mb-3";
    card.innerHTML = `
      <!-- Header -->
      <div class="d-flex align-items-start justify-content-between mb-3">
        <div>
          <span class="badge bg-success me-2">#${idx + 1}</span>
          <strong style="font-size:1rem;">${con.ConsultationDate}</strong>
          <span class="text-muted ms-2" style="font-size:.85rem;">${con.AppointmentDate} · ${con.DoctorName}</span>
        </div>
      </div>

      <!-- Chief Complaint -->
      <div class="mb-3">
        <div class="text-muted" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Chief Complaint</div>
        <div style="font-size:.875rem;">${con.ChiefComplaint ?? "—"}</div>
      </div>

      <div class="row g-3">
        <!-- Symptoms & Treatment -->
        <div class="col-md-6">
          <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Symptoms</div>
          <div style="font-size:.8rem;">${con.Symptoms ?? "—"}</div>
        </div>
        <div class="col-md-6">
          <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Treatment</div>
          <div style="font-size:.8rem;">${con.Treatment ?? "—"}</div>
        </div>
      </div>

      <hr class="my-3"/>

      <!-- Vital Signs -->
      <div class="mb-3">
        <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">🩺 Vital Signs</div>
        ${vitalsHtml}
      </div>

      <!-- Diagnoses -->
      <div class="mb-3">
        <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">📋 Diagnoses</div>
        <div>${diagBadges}</div>
      </div>

      <!-- Lab Results -->
      <div class="mb-3">
        <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">🧪 Laboratory Results</div>
        ${labsHtml}
      </div>

      <!-- Prescriptions -->
      <div>
        <div class="text-muted mb-1" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">💊 Prescriptions</div>
        ${rxHtml}
      </div>
    `;
    timeline.appendChild(card);
  });
};
