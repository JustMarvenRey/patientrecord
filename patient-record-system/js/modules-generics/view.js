export const viewModal = async (genericId) => {
  document.getElementById("blank-modal-title").innerText = "Generic Details";

  const generic = await getGenericDetails(genericId);

  const myHtml = `
    <table class="table table-sm">
      <tr>
        <td>Generic Name</td>
        <td>${generic[0].GenericName}</td>
      </tr>
      <tr>
        <td>Description</td>
        <td>${generic[0].Description ?? ""}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${generic[0].Status}</td>
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

const getGenericDetails = async (genericId) => {
  const params = {
    operation: "getGeneric",
    json: JSON.stringify({ genericId: genericId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/generics.php`, {
    params: params,
  });
  return response.data;
};
