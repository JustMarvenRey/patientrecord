import { viewModal } from "./modules-roles/view.js";
import { updateModal } from "./modules-roles/update.js";
import { deleteModal } from "./modules-roles/delete.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  displayRoles();

  document.getElementById("btn-submit").addEventListener("click", () => {
    insertRole();
  });

  document.getElementById("show-inactive").addEventListener("change", () => {
    displayRoles();
  });
});

const displayRoles = async () => {
  const response = await axios.get(`${baseApiUrl}/roles.php`, {
    params: { operation: "getAllRoles" },
  });
  if (response.status == 200) {
    displayRolesTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayRolesTable = (roles) => {
  const showInactive = document.getElementById("show-inactive").checked;
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>ROLE NAME</th>
      <th>DESCRIPTION</th>
      <th># USERS</th>
      <th>STATUS</th>
      <th>ACTION</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  roles
    .filter((role) => showInactive || role.Status === "Active")
    .forEach((role) => {
      const isActive = role.Status === "Active";
      let row = document.createElement("tr");
      if (!isActive) row.classList.add("table-secondary");

      row.innerHTML = `
        <td>${role.RoleName}</td>
        <td>${role.Description ?? ""}</td>
        <td>${role.UserCount}</td>
        <td>
          <span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${role.Status}</span>
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
        viewModal(role.RoleID);
      });

      row.querySelector(".btn-update").addEventListener("click", () => {
        updateModal(role.RoleID, displayRoles);
      });

      const deleteBtn = row.querySelector(".btn-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteModal(role.RoleID, displayRoles);
        });
      }

      const restoreBtn = row.querySelector(".btn-restore");
      if (restoreBtn) {
        restoreBtn.addEventListener("click", () => {
          restoreRole(role.RoleID);
        });
      }
    });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertRole = async () => {
  const jsonData = {
    roleName: document.getElementById("role-name").value,
    description: document.getElementById("description").value,
  };

  if (!jsonData.roleName) {
    alert("Please fill in the Role Name.");
    return;
  }

  const formData = new FormData();
  formData.append("operation", "insertRole");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${baseApiUrl}/roles.php`,
    method: "POST",
    data: formData,
  });

  if (response.data == 1) {
    clearForm();
    displayRoles();
    alert("Role successfully saved!");
  } else {
    alert("ERROR");
  }
};

const restoreRole = async (roleId) => {
  const params = {
    operation: "restoreRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/roles.php`, {
    params: params,
  });
  if (response.data == 1) {
    displayRoles();
    alert("Role restored!");
  } else {
    alert("ERROR");
  }
};

const clearForm = () => {
  document.getElementById("role-name").value = "";
  document.getElementById("description").value = "";
};
