export const deleteModal = async (testId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";

  const test = await getTestDetails(testId);
  const t = test[0];

  let myHtml = `
    <p>This test may already have lab results recorded against it, so it will be
    <strong>deactivated</strong> (soft delete) rather than removed. Past lab results
    stay intact; it will just be hidden from the "order a test" picker going forward.
    You can restore it later.</p>
    <table class="table table-sm">
      <tr>
        <td>Test Name</td>
        <td>${t.TestName}</td>
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
    if (await deleteTestRecord(t.TestID) == 1) {
      refreshDisplay();
      alert("Test has been deactivated!");
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

const deleteTestRecord = async (testId) => {
  const params = {
    operation: "deleteTest",
    json: JSON.stringify({ testId: testId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/laboratory-tests.php`, {
    params: params,
  });
  return response.data;
};
