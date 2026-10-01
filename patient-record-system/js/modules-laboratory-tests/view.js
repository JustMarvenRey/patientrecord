export const viewModal = async (testId) => {
  document.getElementById("blank-modal-title").innerText = "Test Details";

  const test = await getTestDetails(testId);

  const myHtml = `
    <table class="table table-sm">
      <tr>
        <td>Test Name</td>
        <td>${test[0].TestName}</td>
      </tr>
      <tr>
        <td>Normal Range</td>
        <td>${test[0].NormalRange ?? ""}</td>
      </tr>
      <tr>
        <td>Description</td>
        <td>${test[0].Description ?? ""}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${test[0].Status}</td>
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
