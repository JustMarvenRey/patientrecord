import {
  actingUserId,
  checkResult,
  esc,
  getAssignableRoles,
  getSpecializations,
  getUserDetails,
  isValidPhone,
} from "./common.js";

export const updateModal = async (userId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Update Account";

  const [users, roles, specializations] = await Promise.all([
    getUserDetails(userId),
    getAssignableRoles(),
    getSpecializations(),
  ]);
  const u = users[0];
  const isSelf = Number(u.UserID) === Number(actingUserId());
  const selectedIds = (u.specializations || []).map((s) => String(s.SpecializationID));

  // If the account's current role has since been deactivated it isn't in the
  // "assignable" list; keep it visible so the form still shows the real role.
  if (!roles.some((r) => r.RoleID == u.RoleID)) {
    roles.push({ RoleID: u.RoleID, RoleName: u.RoleName });
  }

  const roleOptions = roles
    .map((r) => `<option value="${r.RoleID}" ${r.RoleID == u.RoleID ? "selected" : ""}>${esc(r.RoleName)}</option>`)
    .join("");

  const checkboxes = specializations
    .map(
      (s) => `
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="upd-spec-${s.SpecializationID}"
                 value="${s.SpecializationID}" ${selectedIds.includes(String(s.SpecializationID)) ? "checked" : ""} />
          <label class="form-check-label" for="upd-spec-${s.SpecializationID}">${esc(s.SpecializationName)}</label>
        </div>`
    )
    .join("");

  document.getElementById("blank-main-div").innerHTML = `
    <div class="col-md-6 mb-2">
      <label class="form-label">First Name</label>
      <input type="text" class="form-control" id="upd-first-name" value="${esc(u.FirstName)}" />
    </div>
    <div class="col-md-6 mb-2">
      <label class="form-label">Last Name</label>
      <input type="text" class="form-control" id="upd-last-name" value="${esc(u.LastName)}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Username</label>
      <input type="text" class="form-control" id="upd-username" value="${esc(u.Username)}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Phone</label>
      <input type="text" class="form-control" id="upd-phone" value="${esc(u.Phone)}" inputmode="numeric" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Role</label>
      <select class="form-select" id="upd-role" ${isSelf ? "disabled" : ""}>${roleOptions}</select>
      ${isSelf ? '<div class="form-text">You can\'t change your own role.</div>' : ""}
    </div>
    <div class="col-12 mb-2" id="upd-doctor-fields" style="display: none;">
      <label class="form-label">Specializations</label>
      <div id="upd-specializations" class="border rounded p-2" style="max-height: 140px; overflow-y: auto;">${checkboxes}</div>
      <div class="form-text">Check all specializations that apply.</div>
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">New Password</label>
      <input type="password" class="form-control" id="upd-password" placeholder="Leave blank to keep the current password" autocomplete="new-password" />
    </div>
  `;

  // Specializations only apply when the selected role is Doctor.
  const roleSelect = document.getElementById("upd-role");
  const isDoctorSelected = () => roleSelect.selectedOptions[0]?.textContent === "Doctor";
  const toggleDoctorFields = () => {
    document.getElementById("upd-doctor-fields").style.display = isDoctorSelected() ? "block" : "none";
  };
  roleSelect.addEventListener("change", toggleDoctorFields);
  toggleDoctorFields();

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
    <div class="btn-group w-100" role="group">
      <button type="button" class="btn btn-success btn-sm w-100 me-2 btn-save">Save Changes</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    </div>
  `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), { keyboard: true, backdrop: "static" });

  modalFooter.querySelector(".btn-save").addEventListener("click", async () => {
    const jsonData = {
      actingUserId: actingUserId(),
      userId: u.UserID,
      firstName: document.getElementById("upd-first-name").value,
      lastName: document.getElementById("upd-last-name").value,
      username: document.getElementById("upd-username").value,
      phone: document.getElementById("upd-phone").value,
      password: document.getElementById("upd-password").value,
      // a disabled <select> still has a value, so the current role is sent for yourself
      roleId: roleSelect.value,
    };

    if (!isValidPhone(jsonData.phone)) {
      alert("Phone must contain digits only (7-15 digits), with no negative sign or letters.");
      return;
    }
    if (isDoctorSelected()) {
      jsonData.specializationIds = [
        ...document.querySelectorAll("#upd-specializations input[type='checkbox']:checked"),
      ].map((c) => c.value);
    }

    const formData = new FormData();
    formData.append("operation", "updateUser");
    formData.append("json", JSON.stringify(jsonData));
    const response = await axios({ url: `${sessionStorage.baseAPIUrl}/users.php`, method: "POST", data: formData });

    if (checkResult(response.data, "Account updated!")) {
      refreshDisplay();
      myModal.hide();
    }
  });

  myModal.show();
};
