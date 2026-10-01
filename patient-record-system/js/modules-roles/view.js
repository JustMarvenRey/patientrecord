export const viewModal = async (roleId) => {
  document.getElementById("blank-modal-title").innerText = "Role Details";

  const role = await getRoleDetails(roleId);

  const myHtml = `
    <table class="table table-sm">
      <tr>
        <td>Role Name</td>
        <td>${role[0].RoleName}</td>
      </tr>
      <tr>
        <td>Description</td>
        <td>${role[0].Description ?? ""}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${role[0].Status}</td>
      </tr>
    </table>
  `;

  document.getElementById("blank-main-div").innerHTML = myHtml;

  document.getElementById("blank-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
  `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
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
