import { viewModal } from "./modules-doctors/view.js";
import { updateModal } from "./modules-doctors/update.js";
import { deleteModal } from "./modules-doctors/delete.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  displayDoctors();

  document.getElementById("show-inactive").addEventListener("change", () => {
    displayDoctors();
  });
});

const displayDoctors = async () => {
  const response = await axios.get(`${baseApiUrl}/doctors.php`, {
    params: { operation: "getAllDoctors" },
  });
  if (response.status == 200) {
    displayDoctorsTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayDoctorsTable = (doctors) => {
  const showInactive = document.getElementById("show-inactive").checked;
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>LAST NAME</th>
      <th>FIRST NAME</th>
      <th>USERNAME</th>
      <th>PHONE</th>
      <th>SPECIALIZATIONS</th>
      <th>STATUS</th>
      <th>ACTION</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  doctors
    .filter((doctor) => showInactive || doctor.Status === "Active")
    .forEach((doctor) => {
      const isActive = doctor.Status === "Active";
      let row = document.createElement("tr");
      if (!isActive) row.classList.add("table-secondary");

      row.innerHTML = `
        <td>${doctor.LastName}</td>
        <td>${doctor.FirstName}</td>
        <td>${doctor.Username}</td>
        <td>${doctor.Phone ?? ""}</td>
        <td>${doctor.Specializations ?? ""}</td>
        <td>
          <span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${doctor.Status}</span>
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
        viewModal(doctor.UserID);
      });

      row.querySelector(".btn-update").addEventListener("click", () => {
        updateModal(doctor.UserID, displayDoctors);
      });

      const deleteBtn = row.querySelector(".btn-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteModal(doctor.UserID, displayDoctors);
        });
      }

      const restoreBtn = row.querySelector(".btn-restore");
      if (restoreBtn) {
        restoreBtn.addEventListener("click", () => {
          restoreDoctor(doctor.UserID);
        });
      }
    });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const restoreDoctor = async (userId) => {
  const params = {
    operation: "restoreDoctor",
    json: JSON.stringify({ userId: userId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/doctors.php`, {
    params: params,
  });
  if (response.data == 1) {
    displayDoctors();
    alert("Doctor restored!");
  } else {
    alert("ERROR");
  }
};
