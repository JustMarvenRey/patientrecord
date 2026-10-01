import { canManageBills, canManageFees, postBilling, checkBillingResult } from "./modules-billing/common.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

// Read ?id=X from the URL
const params = new URLSearchParams(window.location.search);
const consultationId = params.get("id");

document.addEventListener("DOMContentLoaded", async () => {
  if (!consultationId) {
    showError("No consultation ID provided. Please go back and select a consultation.");
    return;
  }
  await loadPage();
});

// ── Main loader ───────────────────────────────────────────────────────────────
const loadPage = async () => {
  try {
    const [consultation, vitals, diagnoses, prescriptions, laboratories] = await Promise.all([
      fetchConsultation(consultationId),
      fetchVitalSign(consultationId),
      fetchConsultationDiagnoses(consultationId),
      fetchPrescriptions(consultationId),
      fetchLaboratories(consultationId),
    ]);

    if (!consultation || consultation.length === 0) {
      showError("Consultation not found.");
      return;
    }

    const c = consultation[0];
    document.getElementById("page-loading").classList.add("d-none");
    renderConsultation(c);
    renderVitals(vitals, c);
    renderDiagnoses(diagnoses, c);
    renderPrescriptions(prescriptions, c);
    renderLaboratories(laboratories, c);

    // Coming straight from "Add Consultation" (?new=1): the next step is
    // recording vital signs. Open the form once, then clear the flag.
    const user = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
    if (params.get("new") === "1" && user?.RoleName === "Doctor") {
      params.delete("new");
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      if (!vitals || vitals.length === 0) showVitalsForm(null, c, false);
    }

    // Billing: fetch after we have consultation
    const billing = await fetchBilling(consultationId);
    renderBilling(billing, c);
  } catch (e) {
    showError("Failed to load consultation. Please try again.");
  }
};

// ── Consultation summary ──────────────────────────────────────────────────────
const renderConsultation = (c) => {
  const section = document.getElementById("section-consultation");
  const grid    = document.getElementById("consultation-summary");
  section.classList.remove("d-none");

  const fields = [
    { label: "Patient",           value: c.PatientName },
    { label: "Consultation Date", value: c.ConsultationDate },
    { label: "Appointment Date",  value: `${c.AppointmentDate} ${formatTime(c.AppointmentTime)}` },
    { label: "Reason",            value: c.Reason || "—" },
    { label: "Chief Complaint",   value: c.ChiefComplaint || "—", wide: true },
    { label: "Symptoms",          value: c.Symptoms || "—",       wide: true },
    { label: "Treatment",         value: c.Treatment || "—",      wide: true },
    { label: "Notes",             value: c.Notes || "—",          wide: true },
  ];

  grid.innerHTML = fields.map(f => `
    <div class="col-12 ${f.wide ? "" : "col-md-6 col-lg-4"}">
      <div class="detail-label">${f.label}</div>
      <div class="detail-value">${f.value}</div>
    </div>
  `).join("");
};

// ── Vital Signs display ───────────────────────────────────────────────────────
const renderVitals = (vitals, consultation) => {
  const section    = document.getElementById("section-vitals");
  const content    = document.getElementById("vitals-content");
  const actionBtn  = document.getElementById("vitals-action-btn");
  const user       = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
  const isDoctor   = user?.RoleName === "Doctor";

  section.classList.remove("d-none");

  const hasVitals = vitals && vitals.length > 0;
  const v = hasVitals ? vitals[0] : null;

  // Action button — only doctors can add/edit
  if (isDoctor) {
    if (hasVitals) {
      actionBtn.innerHTML = `
        <button class="btn btn-success btn-sm" id="btn-edit-vitals">&#9998; Edit Vital Signs</button>
      `;
      document.getElementById("btn-edit-vitals").addEventListener("click", () => {
        showVitalsForm(v, consultation, true);
      });
    } else {
      actionBtn.innerHTML = `
        <button class="btn btn-warning btn-sm" id="btn-add-vitals">+ Record Vital Signs</button>
      `;
      document.getElementById("btn-add-vitals").addEventListener("click", () => {
        showVitalsForm(null, consultation, false);
      });
    }
  }

  if (!hasVitals) {
    content.innerHTML = `
      <p class="text-muted mb-0">
        ${isDoctor
          ? "No vital signs recorded yet for this consultation. Click <strong>Record Vital Signs</strong> to add them."
          : "No vital signs have been recorded for this consultation."}
      </p>`;
    return;
  }

  // Helper to flag abnormal values
  const tempClass  = v.Temperature  !== null
    ? (v.Temperature > 37.5 ? "alert-high" : v.Temperature < 36.0 ? "alert-low" : "")
    : "";
  const spo2Class  = v.OxygenSaturation !== null
    ? (v.OxygenSaturation < 95 ? "alert-low" : "")
    : "";
  const hrClass    = v.HeartRate !== null
    ? (v.HeartRate > 100 ? "alert-high" : v.HeartRate < 60 ? "alert-low" : "")
    : "";
  const rrClass    = v.RespiratoryRate !== null
    ? (v.RespiratoryRate > 20 ? "alert-high" : v.RespiratoryRate < 12 ? "alert-low" : "")
    : "";

  const bmiDisplay = (() => {
    if (!v.Weight || !v.Height) return null;
    const bmi = v.Weight / Math.pow(v.Height / 100, 2);
    return bmi.toFixed(1);
  })();

  content.innerHTML = `
    <div class="vital-grid">
      ${vitalCard("Temperature",       v.Temperature,      "°C",         tempClass)}
      ${vitalCard("Blood Pressure",    v.BloodPressure,    "mmHg",       "")}
      ${vitalCard("Heart Rate",        v.HeartRate,        "bpm",        hrClass)}
      ${vitalCard("Respiratory Rate",  v.RespiratoryRate,  "breaths/min",rrClass)}
      ${vitalCard("O₂ Saturation",     v.OxygenSaturation, "%",          spo2Class)}
      ${vitalCard("Weight",            v.Weight,           "kg",         "")}
      ${vitalCard("Height",            v.Height,           "cm",         "")}
      ${bmiDisplay ? vitalCard("BMI (calc.)", bmiDisplay, "kg/m²", "") : ""}
    </div>
    ${(tempClass || spo2Class || hrClass || rrClass)
      ? `<p class="text-danger small mt-2 mb-0">&#9888; Red values are outside normal range.</p>`
      : ""}
  `;
};

const vitalCard = (label, value, unit, cssClass) => {
  const display = (value !== null && value !== undefined && value !== "")
    ? value
    : `<span class="text-muted" style="font-size:1rem">—</span>`;
  return `
    <div class="vital-item ${cssClass}">
      <div class="vital-label">${label}</div>
      <div class="vital-value">${display}</div>
      ${(value !== null && value !== undefined && value !== "") ? `<div class="vital-unit">${unit}</div>` : ""}
    </div>
  `;
};

// ── Vital Signs form modal ────────────────────────────────────────────────────
const showVitalsForm = (v, consultation, isUpdate) => {
  document.getElementById("vitals-modal-title").innerText =
    isUpdate ? "Edit Vital Signs" : "Record Vital Signs";

  document.getElementById("vitals-modal-body").innerHTML = `
    <p class="text-muted small mb-3">
      Patient: <strong>${consultation.PatientName}</strong> &nbsp;|&nbsp;
      Consultation: <strong>${consultation.ConsultationDate}</strong>
    </p>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label">Temperature (°C)</label>
        <input type="number" step="0.1" min="30" max="45" class="form-control"
               id="f-temperature" value="${isUpdate && v.Temperature != null ? v.Temperature : ""}"
               placeholder="e.g. 36.8" />
      </div>
      <div class="col-md-6">
        <label class="form-label">Blood Pressure (mmHg)</label>
        <input type="text" class="form-control" id="f-blood-pressure"
               value="${isUpdate && v.BloodPressure ? v.BloodPressure : ""}"
               placeholder="e.g. 120/80" />
      </div>
      <div class="col-md-6">
        <label class="form-label">Heart Rate (bpm)</label>
        <input type="number" min="0" max="300" class="form-control"
               id="f-heart-rate" value="${isUpdate && v.HeartRate != null ? v.HeartRate : ""}"
               placeholder="e.g. 72" />
      </div>
      <div class="col-md-6">
        <label class="form-label">Respiratory Rate (breaths/min)</label>
        <input type="number" min="0" max="60" class="form-control"
               id="f-respiratory-rate" value="${isUpdate && v.RespiratoryRate != null ? v.RespiratoryRate : ""}"
               placeholder="e.g. 16" />
      </div>
      <div class="col-md-6">
        <label class="form-label">O₂ Saturation (%)</label>
        <input type="number" min="0" max="100" class="form-control"
               id="f-oxygen-saturation" value="${isUpdate && v.OxygenSaturation != null ? v.OxygenSaturation : ""}"
               placeholder="e.g. 98" />
      </div>
      <div class="col-md-3">
        <label class="form-label">Weight (kg)</label>
        <input type="number" step="0.1" min="0" max="500" class="form-control"
               id="f-weight" value="${isUpdate && v.Weight != null ? v.Weight : ""}"
               placeholder="e.g. 65.5" />
      </div>
      <div class="col-md-3">
        <label class="form-label">Height (cm)</label>
        <input type="number" step="0.1" min="0" max="300" class="form-control"
               id="f-height" value="${isUpdate && v.Height != null ? v.Height : ""}"
               placeholder="e.g. 165.0" />
      </div>
    </div>
  `;

  const footer = document.getElementById("vitals-modal-footer");
  footer.innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-vitals">
      ${isUpdate ? "Save Changes" : "Save Vital Signs"}
    </button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("vitals-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-vitals").addEventListener("click", async () => {
    const data = {
      consultationId:   consultationId,
      temperature:      document.getElementById("f-temperature").value      || null,
      bloodPressure:    document.getElementById("f-blood-pressure").value   || null,
      heartRate:        document.getElementById("f-heart-rate").value       || null,
      respiratoryRate:  document.getElementById("f-respiratory-rate").value || null,
      oxygenSaturation: document.getElementById("f-oxygen-saturation").value|| null,
      weight:           document.getElementById("f-weight").value           || null,
      height:           document.getElementById("f-height").value           || null,
    };

    if (isUpdate) {
      data.vitalSignId = v.VitalSignID;
    }

    const operation = isUpdate ? "updateVitalSign" : "insertVitalSign";
    const fd = new FormData();
    fd.append("operation", operation);
    fd.append("json", JSON.stringify(data));

    const res = await axios({ url: `${baseApiUrl}/vital-signs.php`, method: "POST", data: fd });

    if (res.data == 1) {
      modal.hide();
      alert(isUpdate ? "Vital signs updated!" : "Vital signs saved!");
      await loadPage(); // Refresh the whole page content
      // Labs are optional — only offered right after vitals are first recorded
      if (!isUpdate && (await showConfirm("Does this patient need a laboratory test?", { type: "info", title: "Laboratory test", confirmText: "Yes, add lab test", cancelText: "Not needed" }))) {
        showLaboratoryModal(consultation, null);
      }
    } else if (res.data?.error === "already_has_vital_sign") {
      alert("Vital signs are already recorded for this consultation. Use Edit instead.");
    } else {
      alert("ERROR saving vital signs.");
    }
  });
};

// ── Consultation Diagnoses ────────────────────────────────────────────────────
const renderDiagnoses = (diagnoses, consultation) => {
  const section   = document.getElementById("section-diagnoses");
  const content   = document.getElementById("diagnoses-content");
  const actionBtn = document.getElementById("diagnoses-action-btn");
  const user      = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
  const isDoctor  = user?.RoleName === "Doctor";

  // Diagnoses (ICD-10) belong to the doctor — hidden from Admin
  if (user?.RoleName === "Admin") return;

  section.classList.remove("d-none");

  // Only doctors can add/remove diagnoses
  if (isDoctor) {
    actionBtn.innerHTML = `
      <button class="btn btn-warning btn-sm" id="btn-add-diagnosis">+ Add Diagnosis</button>
    `;
    document.getElementById("btn-add-diagnosis").addEventListener("click", () => {
      showAddDiagnosisModal(consultation);
    });
  }

  if (!diagnoses || diagnoses.length === 0) {
    content.innerHTML = `
      <p class="text-muted mb-0">
        ${isDoctor
          ? "No diagnoses recorded yet. Click <strong>Add Diagnosis</strong> to link an ICD-10 code."
          : "No diagnoses have been recorded for this consultation."}
      </p>`;
    return;
  }

  // Build the diagnoses table
  const table = document.createElement("table");
  table.className = "table table-sm table-hover";
  table.innerHTML = `
    <thead>
      <tr>
        <th>ICD-10 CODE</th>
        <th>DIAGNOSIS</th>
        <th>DESCRIPTION</th>
        ${isDoctor ? "<th>ACTION</th>" : ""}
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  diagnoses.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge bg-secondary">${d.ICD10Code}</span></td>
      <td>${d.DiagnosisName}</td>
      <td class="text-muted small">${d.Description ?? "—"}</td>
      ${isDoctor
        ? `<td><button class="btn btn-danger btn-sm btn-remove-diag">Remove</button></td>`
        : ""}
    `;
    tbody.appendChild(tr);

    if (isDoctor) {
      tr.querySelector(".btn-remove-diag").addEventListener("click", async () => {
        if (!(await showConfirm(`Remove "${d.DiagnosisName}" from this consultation?`, { type: "danger", title: "Remove diagnosis", confirmText: "Remove" }))) return;
        const fd = new FormData();
        fd.append("operation", "removeDiagnosis");
        fd.append("json", JSON.stringify({ consultationDiagnosisId: d.ConsultationDiagnosisID }));
        const res = await axios({ url: `${baseApiUrl}/consultation-diagnosis.php`, method: "POST", data: fd });
        if (res.data == 1) {
          await loadPage();
        } else {
          alert("ERROR removing diagnosis.");
        }
      });
    }
  });

  table.appendChild(tbody);
  content.innerHTML = "";
  content.appendChild(table);
};

// ── Add Diagnosis Modal ───────────────────────────────────────────────────────
const showAddDiagnosisModal = async (consultation) => {
  // Load the active ICD-10 list into the select
  const select = document.getElementById("diagnosis-select");
  const descEl = document.getElementById("diagnosis-select-description");
  select.innerHTML = `<option value="" disabled selected>Loading...</option>`;

  const res = await axios.get(`${baseApiUrl}/diagnoses.php`, {
    params: { operation: "getActiveDiagnoses" },
  });
  const allDiagnoses = res.data;

  select.innerHTML = `<option value="" disabled selected>-- Select a diagnosis --</option>`;
  allDiagnoses.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.DiagnosisID;
    opt.textContent = `${d.ICD10Code} — ${d.DiagnosisName}`;
    opt.setAttribute("data-description", d.Description ?? "");
    select.appendChild(opt);
  });

  // Show description when user picks one
  select.onchange = () => {
    const chosen = select.selectedOptions[0];
    descEl.textContent = chosen?.getAttribute("data-description") ?? "";
  };
  descEl.textContent = "";

  const modal = new bootstrap.Modal(document.getElementById("diagnosis-modal"), { backdrop: "static" });
  modal.show();

  // Wire save button (replace listener to avoid stacking)
  const saveBtn = document.getElementById("btn-save-diagnosis");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.addEventListener("click", async () => {
    const diagnosisId = select.value;
    if (!diagnosisId) {
      alert("Please select a diagnosis.");
      return;
    }

    const fd = new FormData();
    fd.append("operation", "addDiagnosis");
    fd.append("json", JSON.stringify({
      consultationId: consultationId,
      diagnosisId:    diagnosisId,
    }));
    const res = await axios({ url: `${baseApiUrl}/consultation-diagnosis.php`, method: "POST", data: fd });

    if (res.data == 1) {
      modal.hide();
      await loadPage();
    } else if (res.data?.error === "already_linked") {
      alert("This diagnosis is already linked to this consultation.");
    } else {
      alert("ERROR adding diagnosis.");
    }
  });
};

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchConsultation = async (id) => {
  const res = await axios.get(`${baseApiUrl}/consultations.php`, {
    params: { operation: "getConsultation", json: JSON.stringify({ consultationId: id }) },
  });
  return res.data;
};

const fetchVitalSign = async (consultationId) => {
  const res = await axios.get(`${baseApiUrl}/vital-signs.php`, {
    params: { operation: "getVitalSign", json: JSON.stringify({ consultationId: consultationId }) },
  });
  return res.data;
};

const fetchConsultationDiagnoses = async (consultationId) => {
  const res = await axios.get(`${baseApiUrl}/consultation-diagnosis.php`, {
    params: { operation: "getDiagnosesByConsultation", json: JSON.stringify({ consultationId: consultationId }) },
  });
  return res.data;
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? "AM" : "PM"}`;
};

const showError = (msg) => {
  document.getElementById("page-loading").classList.add("d-none");
  const el = document.getElementById("page-error");
  el.textContent = msg;
  el.classList.remove("d-none");
};

// ═══════════════════════════════════════════════════════════════════════════
// PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

const renderPrescriptions = (prescriptions, consultation) => {
  const section   = document.getElementById("section-prescriptions");
  const content   = document.getElementById("prescriptions-content");
  const actionBtn = document.getElementById("prescriptions-action-btn");
  const user      = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
  const isDoctor  = user?.RoleName === "Doctor";

  section.classList.remove("d-none");

  if (isDoctor) {
    actionBtn.innerHTML = `<button class="btn btn-success btn-sm" id="btn-add-prescription">+ Add Prescription</button>`;
    document.getElementById("btn-add-prescription").addEventListener("click", () =>
      showPrescriptionModal(consultation, null)
    );
  }

  if (!prescriptions || prescriptions.length === 0) {
    content.innerHTML = `<p class="text-muted">No prescriptions recorded.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-sm table-hover";
  table.innerHTML = `
    <thead>
      <tr>
        <th>MEDICINE</th>
        <th>GENERIC</th>
        <th>FORM</th>
        <th>DOSAGE</th>
        <th>FREQUENCY</th>
        <th>DURATION</th>
        <th>INSTRUCTIONS</th>
        ${isDoctor ? "<th>ACTION</th>" : ""}
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  prescriptions.forEach((rx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rx.MedicineName}</td>
      <td class="text-muted small">${rx.GenericName}</td>
      <td class="text-muted small">${rx.DosageForm ?? "—"}</td>
      <td>${rx.Dosage ?? "—"}</td>
      <td>${rx.Frequency ?? "—"}</td>
      <td>${rx.Duration ?? "—"}</td>
      <td class="text-muted small">${rx.Instructions ?? "—"}</td>
      ${isDoctor ? `<td>
        <button class="btn btn-success btn-sm btn-edit-rx me-1">Edit</button>
        <button class="btn btn-danger btn-sm btn-remove-rx">Remove</button>
      </td>` : ""}
    `;
    tbody.appendChild(tr);

    if (isDoctor) {
      tr.querySelector(".btn-edit-rx").addEventListener("click", () =>
        showPrescriptionModal(consultation, rx)
      );
      tr.querySelector(".btn-remove-rx").addEventListener("click", async () => {
        if (!(await showConfirm(`Remove ${rx.MedicineName} from this prescription?`, { type: "danger", title: "Remove prescription", confirmText: "Remove" }))) return;
        const fd = new FormData();
        fd.append("operation", "removePrescription");
        fd.append("json", JSON.stringify({ prescriptionId: rx.PrescriptionID }));
        const res = await axios({ url: `${baseApiUrl}/prescriptions.php`, method: "POST", data: fd });
        if (res.data == 1) await loadPage();
        else alert("ERROR removing prescription.");
      });
    }
  });

  table.appendChild(tbody);
  content.innerHTML = "";
  content.appendChild(table);
};

const showPrescriptionModal = async (consultation, rx) => {
  const isEdit = !!rx;
  document.getElementById("prescription-modal-title").innerText =
    isEdit ? "Edit Prescription" : "Add Prescription";

  // Load medicines
  const medRes = await axios.get(`${baseApiUrl}/prescriptions.php`, {
    params: { operation: "getActiveMedicines" },
  });
  const medicines = medRes.data;
  const medOptions = medicines.map((m) =>
    `<option value="${m.MedicineID}" ${isEdit && m.MedicineID == rx.MedicineID ? "selected" : ""}>${m.MedicineName} (${m.GenericName}) — ${m.DosageForm ?? ""}</option>`
  ).join("");

  const today = new Date().toISOString().split("T")[0];

  document.getElementById("prescription-modal-body").innerHTML = `
    <div class="row g-2">
      <div class="col-12">
        <label class="form-label">Medicine <span class="text-danger">*</span></label>
        <select class="form-select" id="rx-medicine">
          <option value="" disabled ${!isEdit ? "selected" : ""}>-- Select Medicine --</option>
          ${medOptions}
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Date <span class="text-danger">*</span></label>
        <input type="date" class="form-control" id="rx-date" value="${isEdit ? rx.PrescriptionDate : today}" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Dosage</label>
        <input type="text" class="form-control" id="rx-dosage" placeholder="e.g. 500mg" value="${isEdit ? (rx.Dosage ?? "") : ""}" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Frequency</label>
        <input type="text" class="form-control" id="rx-frequency" placeholder="e.g. 3x a day" value="${isEdit ? (rx.Frequency ?? "") : ""}" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Duration</label>
        <input type="text" class="form-control" id="rx-duration" placeholder="e.g. 7 days" value="${isEdit ? (rx.Duration ?? "") : ""}" />
      </div>
      <div class="col-12">
        <label class="form-label">Instructions</label>
        <textarea class="form-control" id="rx-instructions" rows="2" placeholder="e.g. Take after meals">${isEdit ? (rx.Instructions ?? "") : ""}</textarea>
      </div>
    </div>
  `;

  document.getElementById("prescription-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-rx">
      ${isEdit ? "Save Changes" : "Add Prescription"}
    </button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("prescription-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-rx").addEventListener("click", async () => {
    const medicineId = document.getElementById("rx-medicine").value;
    const date       = document.getElementById("rx-date").value;
    if (!medicineId || !date) { alert("Medicine and Date are required."); return; }

    const data = {
      consultationId:   consultationId,
      medicineId,
      prescriptionDate: date,
      dosage:           document.getElementById("rx-dosage").value || null,
      frequency:        document.getElementById("rx-frequency").value || null,
      duration:         document.getElementById("rx-duration").value || null,
      instructions:     document.getElementById("rx-instructions").value || null,
    };

    const fd = new FormData();
    if (isEdit) {
      fd.append("operation", "updatePrescription");
      fd.append("json", JSON.stringify({ ...data, prescriptionId: rx.PrescriptionID }));
    } else {
      fd.append("operation", "insertPrescription");
      fd.append("json", JSON.stringify(data));
    }

    const res = await axios({ url: `${baseApiUrl}/prescriptions.php`, method: "POST", data: fd });
    if (res.data == 1) { modal.hide(); await loadPage(); }
    else alert("ERROR saving prescription.");
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// BILLING
// ═══════════════════════════════════════════════════════════════════════════

const renderBilling = async (billing, consultation) => {
  const section   = document.getElementById("section-billing");
  const content   = document.getElementById("billing-content");
  const actionBtn = document.getElementById("billing-action-btn");
  const user      = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
  // Admin + Staff handle the bill itself; only Admin manages professional fees.
  const canBill   = canManageBills();
  const isAdmin   = canManageFees();

  section.classList.remove("d-none");

  const hasBill = billing && billing.length > 0;
  const bill    = hasBill ? billing[0] : null;

  if (canBill) {
    if (hasBill) {
      actionBtn.innerHTML = `<button class="btn btn-success btn-sm" id="btn-edit-bill">Edit Bill</button>`;
      document.getElementById("btn-edit-bill").addEventListener("click", () =>
        showBillingModal(consultation, bill)
      );
    } else {
      actionBtn.innerHTML = `<button class="btn btn-warning btn-sm" id="btn-create-bill">Create Bill</button>`;
      document.getElementById("btn-create-bill").addEventListener("click", () =>
        showBillingModal(consultation, null)
      );
    }
  }

  if (!hasBill) {
    content.innerHTML = `<p class="text-muted">No bill generated yet.</p>`;
    return;
  }

  const statusColor = bill.Status === "Paid" ? "bg-success" : bill.Status === "Cancelled" ? "bg-danger" : "bg-warning text-dark";
  content.innerHTML = `
    <table class="table table-sm">
      <tr><td><strong>Bill Date</strong></td><td>${bill.BillDate}</td></tr>
      <tr><td><strong>Total Amount</strong></td><td>₱ ${parseFloat(bill.TotalAmount).toFixed(2)}</td></tr>
      <tr><td><strong>Status</strong></td><td><span class="badge ${statusColor}">${bill.Status}</span></td></tr>
    </table>
  `;

  // Render Professional Fees
  const feesSection = document.getElementById("section-professional-fees");
  const feesContent = document.getElementById("professional-fees-content");
  const feesBtn     = document.getElementById("professional-fees-action-btn");
  feesSection.classList.remove("d-none");

  if (isAdmin) {
    feesBtn.innerHTML = `<button class="btn btn-success btn-sm" id="btn-add-fee">+ Add Fee</button>`;
    document.getElementById("btn-add-fee").addEventListener("click", () =>
      showFeeModal(bill.BillID)
    );
  }

  const fees = await fetchProfessionalFees(bill.BillID);
  if (!fees || fees.length === 0) {
    feesContent.innerHTML = `<p class="text-muted">No professional fees recorded.</p>`;
    return;
  }

  const feeTable = document.createElement("table");
  feeTable.className = "table table-sm table-hover";
  feeTable.innerHTML = `
    <thead>
      <tr>
        <th>DOCTOR</th>
        <th>DESCRIPTION</th>
        <th>AMOUNT</th>
        ${isAdmin ? "<th>ACTION</th>" : ""}
      </tr>
    </thead>
  `;
  const feeTbody = document.createElement("tbody");
  fees.forEach((fee) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fee.DoctorName}</td>
      <td class="text-muted small">${fee.Description ?? "—"}</td>
      <td>₱ ${parseFloat(fee.FeeAmount).toFixed(2)}</td>
      ${isAdmin ? `<td><button class="btn btn-danger btn-sm btn-remove-fee">Remove</button></td>` : ""}
    `;
    feeTbody.appendChild(tr);
    if (isAdmin) {
      tr.querySelector(".btn-remove-fee").addEventListener("click", async () => {
        if (!(await showConfirm("Remove this fee?", { type: "danger", title: "Remove fee", confirmText: "Remove" }))) return;
        const res = await postBilling(baseApiUrl, "removeProfessionalFee", { professionalFeeId: fee.ProfessionalFeeID });
        if (checkBillingResult(res)) await loadPage();
      });
    }
  });
  feeTable.appendChild(feeTbody);
  feesContent.innerHTML = "";
  feesContent.appendChild(feeTable);
};

const showBillingModal = (consultation, bill) => {
  const isEdit = !!bill;
  document.getElementById("billing-modal-title").innerText = isEdit ? "Edit Bill" : "Create Bill";
  const today = new Date().toISOString().split("T")[0];
  const statusOptions = ["Pending", "Paid", "Cancelled"].map((s) =>
    `<option value="${s}" ${isEdit && bill.Status === s ? "selected" : ""}>${s}</option>`
  ).join("");

  document.getElementById("billing-modal-body").innerHTML = `
    <div class="mb-2">
      <label class="form-label">Bill Date <span class="text-danger">*</span></label>
      <input type="date" class="form-control" id="bill-date" value="${isEdit ? bill.BillDate : today}" />
    </div>
    <div class="mb-2">
      <label class="form-label">Total Amount (₱) <span class="text-danger">*</span></label>
      <input type="number" min="0" step="0.01" class="form-control" id="bill-amount" value="${isEdit ? bill.TotalAmount : ""}" placeholder="0.00" />
    </div>
    ${isEdit ? `<div class="mb-2">
      <label class="form-label">Status</label>
      <select class="form-select" id="bill-status">${statusOptions}</select>
    </div>` : ""}
  `;

  document.getElementById("billing-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-bill">
      ${isEdit ? "Save Changes" : "Create Bill"}
    </button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("billing-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-bill").addEventListener("click", async () => {
    const date   = document.getElementById("bill-date").value;
    const amount = document.getElementById("bill-amount").value;
    if (!date || !amount) { alert("Bill Date and Total Amount are required."); return; }

    const res = isEdit
      ? await postBilling(baseApiUrl, "updateBilling", {
          billId: bill.BillID,
          billDate: date,
          totalAmount: amount,
          status: document.getElementById("bill-status").value,
        })
      : await postBilling(baseApiUrl, "insertBilling", { consultationId, billDate: date, totalAmount: amount });

    if (checkBillingResult(res)) { modal.hide(); await loadPage(); }
  });
};

const showFeeModal = async (billId) => {
  const docRes = await axios.get(`${baseApiUrl}/billing.php`, { params: { operation: "getActiveDoctors" } });
  const docOptions = docRes.data.map((d) =>
    `<option value="${d.UserID}">${d.DoctorName}</option>`
  ).join("");

  document.getElementById("fee-modal-body").innerHTML = `
    <div class="mb-2">
      <label class="form-label">Doctor <span class="text-danger">*</span></label>
      <select class="form-select" id="fee-doctor">
        <option value="" disabled selected>-- Select Doctor --</option>
        ${docOptions}
      </select>
    </div>
    <div class="mb-2">
      <label class="form-label">Fee Amount (₱) <span class="text-danger">*</span></label>
      <input type="number" min="0.01" step="0.01" class="form-control" id="fee-amount" placeholder="0.00" />
    </div>
    <div class="mb-2">
      <label class="form-label">Description</label>
      <input type="text" class="form-control" id="fee-description" placeholder="e.g. Consultation fee" />
    </div>
  `;

  document.getElementById("fee-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-fee">Add Fee</button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("fee-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-fee").addEventListener("click", async () => {
    const userId    = document.getElementById("fee-doctor").value;
    const feeAmount = document.getElementById("fee-amount").value;
    if (!userId || !feeAmount) { alert("Doctor and Fee Amount are required."); return; }

    const res = await postBilling(baseApiUrl, "insertProfessionalFee", {
      billId,
      userId,
      feeAmount,
      description: document.getElementById("fee-description").value || null,
    });
    if (checkBillingResult(res)) { modal.hide(); await loadPage(); }
  });
};

// ── New API helpers ───────────────────────────────────────────────────────────
const fetchPrescriptions = async (consultationId) => {
  const res = await axios.get(`${baseApiUrl}/prescriptions.php`, {
    params: { operation: "getPrescriptionsByConsultation", json: JSON.stringify({ consultationId }) },
  });
  return res.data;
};

const fetchBilling = async (consultationId) => {
  const res = await axios.get(`${baseApiUrl}/billing.php`, {
    params: { operation: "getBillingByConsultation", json: JSON.stringify({ consultationId }) },
  });
  return res.data;
};

const fetchLaboratories = async (consultationId) => {
  const res = await axios.get(`${baseApiUrl}/laboratory.php`, {
    params: { operation: "getLaboratoriesByConsultation", json: JSON.stringify({ consultationId }) },
  });
  return res.data;
};

// ═══════════════════════════════════════════════════════════════════════════
// LABORATORY
// ═══════════════════════════════════════════════════════════════════════════

const renderLaboratories = (laboratories, consultation) => {
  const section   = document.getElementById("section-laboratories");
  const content   = document.getElementById("laboratories-content");
  const actionBtn = document.getElementById("laboratories-action-btn");
  const user      = JSON.parse(sessionStorage.getItem("currentUser") ?? "null");
  const isDoctor  = user?.RoleName === "Doctor";

  section.classList.remove("d-none");

  if (isDoctor) {
    actionBtn.innerHTML = `<button class="btn btn-success btn-sm" id="btn-add-laboratory">+ Add Laboratory Test</button>`;
    document.getElementById("btn-add-laboratory").addEventListener("click", () =>
      showLaboratoryModal(consultation, null)
    );
  }

  if (!laboratories || laboratories.length === 0) {
    content.innerHTML = `<p class="text-muted">No laboratory tests for this consultation. Add one only if needed.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-sm table-hover";
  table.innerHTML = `
    <thead>
      <tr>
        <th>TEST NAME</th>
        <th>TEST DATE</th>
        <th>RESULT</th>
        <th>REFERENCE RANGE</th>
        <th>NORMAL RANGE</th>
        ${isDoctor ? "<th>ACTION</th>" : ""}
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  laboratories.forEach((lab) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${lab.TestName}</td>
      <td>${lab.TestDate}</td>
      <td>${lab.Result ?? "—"}</td>
      <td class="text-muted small">${lab.ReferenceRange ?? "—"}</td>
      <td class="text-muted small">${lab.NormalRange ?? "—"}</td>
      ${isDoctor ? `<td>
        <button class="btn btn-success btn-sm btn-edit-lab me-1">Edit</button>
        <button class="btn btn-danger btn-sm btn-remove-lab">Remove</button>
      </td>` : ""}
    `;
    tbody.appendChild(tr);

    if (isDoctor) {
      tr.querySelector(".btn-edit-lab").addEventListener("click", () =>
        showLaboratoryModal(consultation, lab)
      );
      tr.querySelector(".btn-remove-lab").addEventListener("click", async () => {
        if (!(await showConfirm(`Remove "${lab.TestName}" result from this consultation?`, { type: "danger", title: "Remove lab result", confirmText: "Remove" }))) return;
        const fd = new FormData();
        fd.append("operation", "removeLaboratory");
        fd.append("json", JSON.stringify({ laboratoryId: lab.LaboratoryID }));
        const res = await axios({ url: `${baseApiUrl}/laboratory.php`, method: "POST", data: fd });
        if (res.data == 1) await loadPage();
        else alert("ERROR removing laboratory result.");
      });
    }
  });

  table.appendChild(tbody);
  content.innerHTML = "";
  content.appendChild(table);
};

const showLaboratoryModal = async (consultation, lab) => {
  const isEdit = !!lab;
  document.getElementById("laboratory-modal-title").innerText =
    isEdit ? "Edit Lab Result" : "Add Lab Result";

  // Load active tests for dropdown
  const testRes = await axios.get(`${baseApiUrl}/laboratory.php`, {
    params: { operation: "getActiveTests" },
  });
  const tests = testRes.data;
  const testOptions = tests.map((t) =>
    `<option value="${t.TestID}"
      data-normal="${t.NormalRange ?? ""}"
      ${isEdit && t.TestID == lab.TestID ? "selected" : ""}>
      ${t.TestName}
    </option>`
  ).join("");

  const today = new Date().toISOString().split("T")[0];

  document.getElementById("laboratory-modal-body").innerHTML = `
    <div class="row g-2">
      <div class="col-12">
        <label class="form-label">Laboratory Test <span class="text-danger">*</span></label>
        <select class="form-select" id="lab-test">
          <option value="" disabled ${!isEdit ? "selected" : ""}>-- Select Test --</option>
          ${testOptions}
        </select>
        <div class="form-text" id="lab-normal-range-hint"></div>
      </div>
      <div class="col-md-4">
        <label class="form-label">Test Date <span class="text-danger">*</span></label>
        <input type="date" class="form-control" id="lab-date"
               value="${isEdit ? lab.TestDate : today}" />
      </div>
      <div class="col-md-8">
        <label class="form-label">Reference Range</label>
        <input type="text" class="form-control" id="lab-reference-range"
               placeholder="e.g. 70–100 mg/dL"
               value="${isEdit ? (lab.ReferenceRange ?? "") : ""}" />
      </div>
      <div class="col-12">
        <label class="form-label">Result</label>
        <textarea class="form-control" id="lab-result" rows="3"
                  placeholder="Enter the result details here...">${isEdit ? (lab.Result ?? "") : ""}</textarea>
      </div>
    </div>
  `;

  // Show normal range hint when test is selected
  const labTestSelect = document.getElementById("lab-test");
  const hintEl = document.getElementById("lab-normal-range-hint");
  const updateHint = () => {
    const opt = labTestSelect.selectedOptions[0];
    const nr = opt?.getAttribute("data-normal") ?? "";
    hintEl.textContent = nr ? `Normal range: ${nr}` : "";
  };
  labTestSelect.addEventListener("change", updateHint);
  if (isEdit) updateHint();

  document.getElementById("laboratory-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-lab">
      ${isEdit ? "Save Changes" : "Add Lab Result"}
    </button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("laboratory-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-lab").addEventListener("click", async () => {
    const testId = document.getElementById("lab-test").value;
    const date   = document.getElementById("lab-date").value;
    if (!testId || !date) { alert("Laboratory Test and Test Date are required."); return; }

    const data = {
      consultationId: consultationId,
      testId,
      testDate:       date,
      result:         document.getElementById("lab-result").value         || null,
      referenceRange: document.getElementById("lab-reference-range").value || null,
    };

    const fd = new FormData();
    if (isEdit) {
      fd.append("operation", "updateLaboratory");
      fd.append("json", JSON.stringify({ ...data, laboratoryId: lab.LaboratoryID }));
    } else {
      fd.append("operation", "insertLaboratory");
      fd.append("json", JSON.stringify(data));
    }

    const res = await axios({ url: `${baseApiUrl}/laboratory.php`, method: "POST", data: fd });
    if (res.data == 1) { modal.hide(); await loadPage(); }
    else alert("ERROR saving laboratory result.");
  });
};

const fetchProfessionalFees = async (billId) => {
  const res = await axios.get(`${baseApiUrl}/billing.php`, {
    params: { operation: "getProfessionalFees", json: JSON.stringify({ billId }) },
  });
  return res.data;
};
