import { viewModal } from "./modules-laboratory-tests/view.js";
import { updateModal } from "./modules-laboratory-tests/update.js";
import { deleteModal } from "./modules-laboratory-tests/delete.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  displayTests();

  document.getElementById("btn-submit").addEventListener("click", () => {
    insertTest();
  });

  document.getElementById("show-inactive").addEventListener("change", () => {
    displayTests();
  });
});

const displayTests = async () => {
  const response = await axios.get(`${baseApiUrl}/laboratory-tests.php`, {
    params: { operation: "getAllTests" },
  });
  if (response.status == 200) {
    displayTestsTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayTestsTable = (tests) => {
  const showInactive = document.getElementById("show-inactive").checked;
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>TEST NAME</th>
      <th>NORMAL RANGE</th>
      <th>DESCRIPTION</th>
      <th>STATUS</th>
      <th class="text-nowrap">ACTION</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  tests
    .filter((test) => showInactive || test.Status === "Active")
    .forEach((test) => {
      const isActive = test.Status === "Active";
      let row = document.createElement("tr");
      if (!isActive) row.classList.add("table-secondary");

      row.innerHTML = `
        <td>${test.TestName}</td>
        <td>${test.NormalRange ?? ""}</td>
        <td>${test.Description ?? ""}</td>
        <td>
          <span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${test.Status}</span>
        </td>
        <td class="text-nowrap" style="width: 1%;">
          <div class="d-flex flex-nowrap gap-1">
            <button type="button" class="btn btn-primary btn-sm btn-view">View</button>
            <button type="button" class="btn btn-success btn-sm btn-update">Update</button>
            ${
              isActive
                ? `<button type="button" class="btn btn-danger btn-sm btn-delete">Deactivate</button>`
                : `<button type="button" class="btn btn-warning btn-sm btn-restore">Restore</button>`
            }
          </div>
        </td>
      `;
      tbody.appendChild(row);

      row.querySelector(".btn-view").addEventListener("click", () => {
        viewModal(test.TestID);
      });

      row.querySelector(".btn-update").addEventListener("click", () => {
        updateModal(test.TestID, displayTests);
      });

      const deleteBtn = row.querySelector(".btn-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteModal(test.TestID, displayTests);
        });
      }

      const restoreBtn = row.querySelector(".btn-restore");
      if (restoreBtn) {
        restoreBtn.addEventListener("click", () => {
          restoreTest(test.TestID);
        });
      }
    });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertTest = async () => {
  const jsonData = {
    testName: document.getElementById("test-name").value,
    normalRange: document.getElementById("normal-range").value,
    description: document.getElementById("description").value,
  };

  if (!jsonData.testName) {
    alert("Please fill in the Test Name.");
    return;
  }

  const formData = new FormData();
  formData.append("operation", "insertTest");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${baseApiUrl}/laboratory-tests.php`,
    method: "POST",
    data: formData,
  });

  if (response.data == 1) {
    clearForm();
    displayTests();
    alert("Test successfully saved!");
  } else {
    alert("ERROR");
  }
};

const restoreTest = async (testId) => {
  const params = {
    operation: "restoreTest",
    json: JSON.stringify({ testId: testId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/laboratory-tests.php`, {
    params: params,
  });
  if (response.data == 1) {
    displayTests();
    alert("Test restored!");
  } else {
    alert("ERROR");
  }
};

const clearForm = () => {
  document.getElementById("test-name").value = "";
  document.getElementById("normal-range").value = "";
  document.getElementById("description").value = "";
};
