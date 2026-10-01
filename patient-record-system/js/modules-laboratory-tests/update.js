export const updateModal = async (testId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Update Test";

  const test = await getTestDetails(testId);
  const t = test[0];

  const myHtml = `
    <div class="col-12 mb-2">
      <label class="form-label">Test Name</label>
      <input type="text" class="form-control" id="upd-test-name" value="${t.TestName}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Normal Range</label>
      <input type="text" class="form-control" id="upd-normal-range" value="${t.NormalRange ?? ""}" />
    </div>
    <div class="col-12 mb-2">
      <label class="form-label">Description</label>
      <textarea class="form-control" id="upd-description" rows="2">${t.Description ?? ""}</textarea>
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
      testId: t.TestID,
      testName: document.getElementById("upd-test-name").value,
      normalRange: document.getElementById("upd-normal-range").value,
      description: document.getElementById("upd-description").value,
    };

    if (await updateTest(jsonData) == 1) {
      refreshDisplay();
      alert("Test updated!");
      myModal.hide();
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const getTestDetails = async (testId) => {
  const params = {
    operation: "getTest",
    json: JSON.stringify({ testId: testId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/laboratory-tests.php`, {
    params: params,
  });
  return response.data;
};

const updateTest = async (jsonData) => {
  const formData = new FormData();
  formData.append("operation", "updateTest");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/laboratory-tests.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
