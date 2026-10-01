export const deleteModal = async (roleId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";

  const role = await getRoleDetails(roleId);
  const r = role[0];

  let myHtml = `
    <p>This role may already be assigned to one or more accounts, so it will be
    <strong>deactivated</strong> (soft delete) rather than removed. Existing accounts
    keep this role; it will just be hidden from the role picker for new accounts.
    You can restore it later.</p>
    <table class="table table-sm">
      <tr>
        <td>Role Name</td>
        <td>${r.RoleName}</td>
      </tr>
    </table>
  `;
  document.getElementById("blank-main-div").innerHTML = myHtml;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
    <div class="btn-group w-100" role="group">
      <button type="button" class="btn btn-danger btn-sm w-100 me-2 btn-delete">Deactivate</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    </div>
  `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  modalFooter.querySelector(".btn-delete").addEventListener("click", async () => {
    if (await deleteRoleRecord(r.RoleID) == 1) {
      refreshDisplay();
      alert("Role has been deactivated!");
      myModal.hide();
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const getRoleDetails = async (roleId) => {
  const params = {
    operation: "getRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/roles.php`, {
    params: params,
  });
  return response.data;
};

const deleteRoleRecord = async (roleId) => {
  const params = {
    operation: "deleteRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/roles.php`, {
    params: params,
  });
  return response.data;
};
