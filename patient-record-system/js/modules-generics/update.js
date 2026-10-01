export const updateModal = async (genericId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Update Generic";

  const generic = await getGenericDetails(genericId);
  const g = generic[0];

  const myHtml = `
    <div class="col-12 mb-2">
      <label class="form-label">Generic Name</label>
      <input type="text" class="form-control" id="upd-generic-name" value="${g.GenericName}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Description</label>
      <textarea class="form-control" id="upd-description" rows="2">${g.Description ?? ""}</textarea>
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
      genericId: g.GenericID,
      genericName: document.getElementById("upd-generic-name").value,
      description: document.getElementById("upd-description").value,
    };

    if (await updateGeneric(jsonData) == 1) {
      refreshDisplay();
      alert("Generic updated!");
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

const updateGeneric = async (jsonData) => {
  const formData = new FormData();
  formData.append("operation", "updateGeneric");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/generics.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
