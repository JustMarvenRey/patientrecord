import { actingUserId, checkResult, esc, getUserDetails } from "./common.js";

export const deleteModal = async (userId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";

  const users = await getUserDetails(userId);
  const u = users[0];

  document.getElementById("blank-main-div").innerHTML = `
    <p>This account will be <strong>deactivated</strong> (soft delete), not removed. The person will
    no longer be able to sign in, but their history stays intact. You can restore it later.</p>
    <table class="table table-sm">
      <tr><td>Name</td><td>${esc(u.FirstName)} ${esc(u.LastName)}</td></tr>
      <tr><td>Username</td><td>${esc(u.Username)}</td></tr>
      <tr><td>Role</td><td>${esc(u.RoleName)}</td></tr>
    </table>
  `;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
    <div class="btn-group w-100" role="group">
      <button type="button" class="btn btn-danger btn-sm w-100 me-2 btn-delete">Deactivate</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    </div>
  `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), { keyboard: true, backdrop: "static" });

  modalFooter.querySelector(".btn-delete").addEventListener("click", async () => {
    const response = await axios.get(`${sessionStorage.baseAPIUrl}/users.php`, {
      params: {
        operation: "deleteUser",
        json: JSON.stringify({ userId: u.UserID, actingUserId: actingUserId() }),
      },
    });
    if (checkResult(response.data, "Account has been deactivated!")) {
      refreshDisplay();
      myModal.hide();
    }
  });

  myModal.show();
};
