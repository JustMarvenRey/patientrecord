import { viewModal } from "./modules-generics/view.js";
import { updateModal } from "./modules-generics/update.js";
import { deleteModal } from "./modules-generics/delete.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  displayGenerics();

  document.getElementById("btn-submit").addEventListener("click", () => {
    insertGeneric();
  });

  document.getElementById("show-inactive").addEventListener("change", () => {
    displayGenerics();
  });
});

const displayGenerics = async () => {
  const response = await axios.get(`${baseApiUrl}/generics.php`, {
    params: { operation: "getAllGenerics" },
  });
  if (response.status == 200) {
    displayGenericsTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayGenericsTable = (generics) => {
  const showInactive = document.getElementById("show-inactive").checked;
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>GENERIC NAME</th>
      <th>DESCRIPTION</th>
      <th># MEDICINES</th>
      <th>STATUS</th>
      <th>ACTION</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  generics
    .filter((generic) => showInactive || generic.Status === "Active")
    .forEach((generic) => {
      const isActive = generic.Status === "Active";
      let row = document.createElement("tr");
      if (!isActive) row.classList.add("table-secondary");

      row.innerHTML = `
        <td>${generic.GenericName}</td>
        <td>${generic.Description ?? ""}</td>
        <td>${generic.MedicineCount}</td>
        <td>
          <span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${generic.Status}</span>
        </td>
        <td>
          <button type="button" class="btn btn-primary btn-sm btn-view">View</button>
          <button type="button" class="btn btn-success btn-sm btn-update">Update</button>
          ${
            isActive
              ? `<button type="button" class="btn btn-danger btn-sm btn-delete">Deactivate</button>`
              : `<button type="button" class="btn btn-warning btn-sm btn-restore">Restore</button>`
          }
        </td>
      `;
      tbody.appendChild(row);

      row.querySelector(".btn-view").addEventListener("click", () => {
        viewModal(generic.GenericID);
      });

      row.querySelector(".btn-update").addEventListener("click", () => {
        updateModal(generic.GenericID, displayGenerics);
      });

      const deleteBtn = row.querySelector(".btn-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteModal(generic.GenericID, displayGenerics);
        });
      }

      const restoreBtn = row.querySelector(".btn-restore");
      if (restoreBtn) {
        restoreBtn.addEventListener("click", () => {
          restoreGeneric(generic.GenericID);
        });
      }
    });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertGeneric = async () => {
  const jsonData = {
    genericName: document.getElementById("generic-name").value,
    description: document.getElementById("description").value,
  };

  if (!jsonData.genericName) {
    alert("Please fill in the Generic Name.");
    return;
  }

  const formData = new FormData();
  formData.append("operation", "insertGeneric");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${baseApiUrl}/generics.php`,
    method: "POST",
    data: formData,
  });

  if (response.data == 1) {
    clearForm();
    displayGenerics();
    alert("Generic successfully saved!");
  } else {
    alert("ERROR");
  }
};

const restoreGeneric = async (genericId) => {
  const params = {
    operation: "restoreGeneric",
    json: JSON.stringify({ genericId: genericId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/generics.php`, {
    params: params,
  });
  if (response.data == 1) {
    displayGenerics();
    alert("Generic restored!");
  } else {
    alert("ERROR");
  }
};

const clearForm = () => {
  document.getElementById("generic-name").value = "";
  document.getElementById("description").value = "";
};
