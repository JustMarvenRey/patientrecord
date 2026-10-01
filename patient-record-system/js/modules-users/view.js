import { esc, getUserDetails } from "./common.js";

export const viewModal = async (userId) => {
  document.getElementById("blank-modal-title").innerText = "Account Details";

  const users = await getUserDetails(userId);
  const u = users[0];
  const isDoctor = u.RoleName === "Doctor";
  const specNames = (u.specializations || []).map((s) => s.SpecializationName).join(", ") || "None";

  document.getElementById("blank-main-div").innerHTML = `
    <table class="table table-sm">
      <tr><td>Name</td><td>${esc(u.FirstName)} ${esc(u.LastName)}</td></tr>
      <tr><td>Username</td><td>${esc(u.Username)}</td></tr>
      <tr><td>Phone</td><td>${esc(u.Phone)}</td></tr>
      <tr><td>Role</td><td>${esc(u.RoleName)}</td></tr>
      ${isDoctor ? `<tr><td>Specializations</td><td>${esc(specNames)}</td></tr>` : ""}
      <tr><td>Status</td><td>${esc(u.Status)}</td></tr>
    </table>
  `;

  document.getElementById("blank-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
  `;

  new bootstrap.Modal(document.getElementById("blank-modal"), { keyboard: true, backdrop: "static" }).show();
};
