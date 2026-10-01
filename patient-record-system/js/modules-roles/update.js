export const updateModal = async (roleId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Update Role";

  const role = await getRoleDetails(roleId);
  const r = role[0];

  const myHtml = `
    <div class="col-12 mb-2">
      <label class="form-label">Role Name</label>
      <input type="text" class="form-control" id="upd-role-name" value="${r.RoleName}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Description</label>
      <textarea class="form-control" id="upd-description" rows="2">${r.Description ?? ""}</textarea>
    </div>
  `;

  document.getElementById("blank-main-div").innerHTML = myHtml;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
    <div class="btn-group w-100" role="group">
      <button type="button" class="btn btn-success btn-sm w-100 me-2 btn-save">Save Changes</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    </div>
  `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  modalFooter.querySelector(".btn-save").addEventListener("click", async () => {
    const jsonData = {
      roleId: r.RoleID,
      roleName: document.getElementById("upd-role-name").value,
      description: document.getElementById("upd-description").value,
    };

    if (await updateRole(jsonData) == 1) {
      refreshDisplay();
      alert("Role updated!");
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

const updateRole = async (jsonData) => {
  const formData = new FormData();
  formData.append("operation", "updateRole");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/roles.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
