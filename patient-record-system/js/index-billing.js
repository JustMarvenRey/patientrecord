import {
  actingUserId, canManageBills, canManageFees, esc, peso, statusBadge,
  postBilling, getBilling, checkBillingResult,
} from "./modules-billing/common.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

const todayStr = () => new Date().toISOString().slice(0, 10);

document.addEventListener("DOMContentLoaded", () => {
  const isAdmin = canManageFees();
  document.getElementById("billing-subtext").textContent = isAdmin
    ? "View and manage all patient bills and professional fees."
    : "Create and manage patient bills and record payments. Professional fees are managed by the administrator.";

  if (canManageBills()) {
    const btn = document.getElementById("btn-create-bill");
    btn.classList.remove("d-none");
    btn.addEventListener("click", showCreateBillModal);
  }

  document.getElementById("status-filter").addEventListener("change", renderTable);
  displayBills();
});

let allBills = [];

// ── Fetch & render all bills ────────────────────────────────────────────────
const displayBills = async () => {
  const data = await getBilling(baseApiUrl, "getAllBills");
  if (!Array.isArray(data)) {
    alert(data?.error === "forbidden" ? "Your role isn't allowed to view billing." : "Error loading billing records.");
    return;
  }
  allBills = data;
  renderTable();
};

const renderTable = () => {
  const filter = document.getElementById("status-filter").value;
  const rows = allBills.filter((b) => !filter || b.Status === filter);

  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  if (rows.length === 0) {
    tableDiv.innerHTML = `<p class="text-muted">No bills found.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-hover table-striped table-sm";
  table.innerHTML = `
    <thead>
      <tr>
        <th>BILL DATE</th>
        <th>PATIENT</th>
        <th>DOCTOR</th>
        <th>APPT DATE</th>
        <th>TOTAL (₱)</th>
        <th>STATUS</th>
        <th class="text-nowrap">ACTION</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const isCancelled = row.Status === "Cancelled";
    if (isCancelled) tr.classList.add("table-secondary");
    tr.innerHTML = `
      <td>${esc(row.BillDate)}</td>
      <td>${esc(row.PatientName)}</td>
      <td>${esc(row.DoctorName)}</td>
      <td>${esc(row.AppointmentDate)}</td>
      <td>${(parseFloat(row.TotalAmount) || 0).toFixed(2)}</td>
      <td><span class="badge ${statusBadge(row.Status)}">${esc(row.Status)}</span></td>
      <td class="text-nowrap" style="width: 1%;">
        <div class="d-flex flex-nowrap gap-1">
          <button class="btn btn-primary btn-sm btn-view">View</button>
          ${canManageBills() ? `<button class="btn btn-success btn-sm btn-edit">Edit</button>` : ""}
          ${canManageFees()
            ? (isCancelled
                ? `<button class="btn btn-warning btn-sm btn-restore">Restore</button>`
                : `<button class="btn btn-danger btn-sm btn-deactivate">Deactivate</button>`)
            : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector(".btn-view").addEventListener("click", () => viewBill(row));
    tr.querySelector(".btn-edit")?.addEventListener("click", () => showEditBillModal(row));
    tr.querySelector(".btn-deactivate")?.addEventListener("click", () => deactivateBill(row));
    tr.querySelector(".btn-restore")?.addEventListener("click", () => restoreBill(row));
  });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

// ── Deactivate / Restore (Admin only) ───────────────────────────────────────
const deactivateBill = async (bill) => {
  const ok = await showConfirm(
    `Deactivate the bill for ${bill.PatientName} (${bill.BillDate})? It will be marked Cancelled and can be restored later.`,
    { type: "danger", title: "Deactivate bill", confirmText: "Deactivate", cancelText: "Keep" }
  );
  if (!ok) return;
  const res = await postBilling(baseApiUrl, "deactivateBilling", { billId: bill.BillID });
  if (checkBillingResult(res, "Bill has been deactivated!")) displayBills();
};

const restoreBill = async (bill) => {
  const res = await postBilling(baseApiUrl, "restoreBilling", { billId: bill.BillID });
  if (checkBillingResult(res, "Bill restored (set back to Pending).")) displayBills();
};

// ── View Bill modal (with fees) ─────────────────────────────────────────────
const viewBill = async (bill) => {
  document.getElementById("bill-modal-title").innerText = `Bill — ${bill.PatientName}`;

  const fees = await getBilling(baseApiUrl, "getProfessionalFees", { billId: bill.BillID });
  const feeList = Array.isArray(fees) ? fees : [];
  const feesTotal = feeList.reduce((sum, f) => sum + (parseFloat(f.FeeAmount) || 0), 0);
  const isAdmin = canManageFees();

  const feesHtml = feeList.length > 0
    ? `<table class="table table-sm mt-2">
        <thead><tr><th>Doctor</th><th>Description</th><th>Amount (₱)</th>${isAdmin ? "<th>Action</th>" : ""}</tr></thead>
        <tbody>
          ${feeList.map((f) => `
            <tr>
              <td>${esc(f.DoctorName)}</td>
              <td class="text-muted small">${esc(f.Description ?? "—")}</td>
              <td>${(parseFloat(f.FeeAmount) || 0).toFixed(2)}</td>
              ${isAdmin ? `<td><button class="btn btn-danger btn-sm btn-remove-fee" data-id="${f.ProfessionalFeeID}">Remove</button></td>` : ""}
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr><th colspan="2" class="text-end">Fees subtotal</th><th>${feesTotal.toFixed(2)}</th>${isAdmin ? "<th></th>" : ""}</tr>
        </tfoot>
       </table>`
    : `<p class="text-muted small">No professional fees recorded.</p>`;

  document.getElementById("bill-modal-body").innerHTML = `
    <table class="table table-sm mb-3">
      <tr><td><strong>Patient</strong></td><td>${esc(bill.PatientName)}</td></tr>
      <tr><td><strong>Doctor</strong></td><td>${esc(bill.DoctorName)}</td></tr>
      <tr><td><strong>Appointment Date</strong></td><td>${esc(bill.AppointmentDate)}</td></tr>
      <tr><td><strong>Bill Date</strong></td><td>${esc(bill.BillDate)}</td></tr>
      <tr><td><strong>Total Amount</strong></td><td>${peso(bill.TotalAmount)}</td></tr>
      <tr><td><strong>Status</strong></td><td><span class="badge ${statusBadge(bill.Status)}">${esc(bill.Status)}</span></td></tr>
    </table>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>Professional Fees</strong>
      ${isAdmin ? `<button class="btn btn-success btn-sm" id="btn-add-fee-view">+ Add Fee</button>` : ""}
    </div>
    ${feesHtml}
  `;

  document.getElementById("bill-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("bill-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-add-fee-view")?.addEventListener("click", () => {
    modal.hide();
    showAddFeeModal(bill.BillID);
  });

  document.querySelectorAll(".btn-remove-fee").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm("Remove this fee?", { type: "danger", title: "Remove fee", confirmText: "Remove" }))) return;
      const res = await postBilling(baseApiUrl, "removeProfessionalFee", { professionalFeeId: btn.dataset.id });
      if (checkBillingResult(res)) { modal.hide(); displayBills(); }
    });
  });
};

// ── Create Bill modal (Admin + Staff) ───────────────────────────────────────
const showCreateBillModal = async () => {
  const consultations = await getBilling(baseApiUrl, "getUnbilledConsultations");
  if (!Array.isArray(consultations)) {
    checkBillingResult(consultations);
    return;
  }

  const options = consultations
    .map((c) => `<option value="${c.ConsultationID}">${esc(c.ConsultationDate)} — ${esc(c.PatientName)} (Dr. ${esc(c.DoctorName)})</option>`)
    .join("");

  document.getElementById("create-bill-modal-body").innerHTML = consultations.length === 0
    ? `<p class="text-muted mb-0">Every consultation already has a bill.</p>`
    : `
      <div class="mb-2">
        <label class="form-label">Consultation <span class="text-danger">*</span></label>
        <select class="form-select" id="create-bill-consultation">
          <option value="" disabled selected>-- Select consultation --</option>
          ${options}
        </select>
        <div class="form-text">Only consultations that don't have a bill yet are listed.</div>
      </div>
      <div class="mb-2">
        <label class="form-label">Bill Date <span class="text-danger">*</span></label>
        <input type="date" class="form-control" id="create-bill-date" value="${todayStr()}" />
      </div>
      <div class="mb-2">
        <label class="form-label">Total Amount (₱) <span class="text-danger">*</span></label>
        <input type="number" min="0" step="0.01" class="form-control" id="create-bill-amount" placeholder="0.00" />
      </div>
    `;

  document.getElementById("create-bill-modal-footer").innerHTML = `
    ${consultations.length > 0 ? `<button type="button" class="btn btn-success btn-sm me-2" id="btn-save-create-bill">Create Bill</button>` : ""}
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("create-bill-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-create-bill")?.addEventListener("click", async () => {
    const consultationId = document.getElementById("create-bill-consultation").value;
    const billDate = document.getElementById("create-bill-date").value;
    const totalAmount = document.getElementById("create-bill-amount").value;
    if (!consultationId || !billDate || totalAmount === "") {
      alert("Consultation, Bill Date and Total Amount are required.");
      return;
    }
    const res = await postBilling(baseApiUrl, "insertBilling", { consultationId, billDate, totalAmount });
    if (checkBillingResult(res, "Bill created!")) { modal.hide(); displayBills(); }
  });
};

// ── Edit Bill modal (Admin + Staff) ─────────────────────────────────────────
const showEditBillModal = (bill) => {
  const statusOptions = ["Pending", "Paid", "Cancelled"].map((s) =>
    `<option value="${s}" ${bill.Status === s ? "selected" : ""}>${s}</option>`
  ).join("");

  document.getElementById("edit-bill-modal-body").innerHTML = `
    <div class="mb-2">
      <label class="form-label"><strong>Patient:</strong> ${esc(bill.PatientName)}</label>
    </div>
    <div class="mb-2">
      <label class="form-label">Bill Date <span class="text-danger">*</span></label>
      <input type="date" class="form-control" id="edit-bill-date" value="${esc(bill.BillDate)}" />
    </div>
    <div class="mb-2">
      <label class="form-label">Total Amount (₱) <span class="text-danger">*</span></label>
      <input type="number" min="0" step="0.01" class="form-control" id="edit-bill-amount" value="${esc(bill.TotalAmount)}" />
    </div>
    <div class="mb-2">
      <label class="form-label">Status</label>
      <select class="form-select" id="edit-bill-status">${statusOptions}</select>
      <div class="form-text">Set to <strong>Paid</strong> once the patient has paid.</div>
    </div>
  `;

  document.getElementById("edit-bill-modal-footer").innerHTML = `
    <button type="button" class="btn btn-success btn-sm me-2" id="btn-save-edit-bill">Save Changes</button>
    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById("edit-bill-modal"), { backdrop: "static" });
  modal.show();

  document.getElementById("btn-save-edit-bill").addEventListener("click", async () => {
    const billDate    = document.getElementById("edit-bill-date").value;
    const totalAmount = document.getElementById("edit-bill-amount").value;
    const status      = document.getElementById("edit-bill-status").value;
    if (!billDate || totalAmount === "") { alert("Date and Amount are required."); return; }

    const res = await postBilling(baseApiUrl, "updateBilling", { billId: bill.BillID, billDate, totalAmount, status });
    if (checkBillingResult(res)) { modal.hide(); displayBills(); }
  });
};

// ── Add Professional Fee modal (Admin only) ─────────────────────────────────
const showAddFeeModal = async (billId) => {
  const docRes = await axios.get(`${baseApiUrl}/billing.php`, { params: { operation: "getActiveDoctors" } });
  const docOptions = docRes.data.map((d) =>
    `<option value="${d.UserID}">${esc(d.DoctorName)}</option>`
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
    if (checkBillingResult(res)) { modal.hide(); displayBills(); }
  });
};
