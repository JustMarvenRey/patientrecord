export const deleteModal = async (genericId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";

  const generic = await getGenericDetails(genericId);
  const g = generic[0];

  let myHtml = `
    <p>This generic may already be linked to one or more medicines, so it will be
    <strong>deactivated</strong> (soft delete) rather than removed. Medicines already
    linked to it are unaffected; it will just be hidden from the picker for new
    medicines. You can restore it later.</p>
    <table class="table table-sm">
      <tr>
        <td>Generic Name</td>
        <td>${g.GenericName}</td>
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
    if (await deleteGenericRecord(g.GenericID) == 1) {
      refreshDisplay();
      alert("Generic has been deactivated!");
      myModal.hide();
    } else {
      alert("ERROR");
    }
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

const deleteGenericRecord = async (genericId) => {
  const params = {
    operation: "deleteGeneric",
    json: JSON.stringify({ genericId: genericId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/generics.php`, {
    params: params,
  });
  return response.data;
};
