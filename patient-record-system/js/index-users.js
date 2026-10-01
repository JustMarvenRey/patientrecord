import { viewModal } from "./modules-users/view.js";
import { updateModal } from "./modules-users/update.js";
import { deleteModal } from "./modules-users/delete.js";
import { actingUserId, checkResult, esc, getAssignableRoles, isValidPhone } from "./modules-users/common.js";

const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  loadRoles();
  loadSpecializations();
  displayUsers();

  document.getElementById("role").addEventListener("change", toggleDoctorFields);
  document.getElementById("btn-submit").addEventListener("click", insertUser);
  document.getElementById("show-inactive").addEventListener("change", displayUsers);
});

const loadRoles = async () => {
  const roles = await getAssignableRoles();
  const select = document.getElementById("role");
  roles.forEach((r) => {
    const option = document.createElement("option");
    option.value = r.RoleID;
    option.textContent = r.RoleName;
    select.appendChild(option);
  });
};

// Specializations only apply to doctors, so that field only shows up when the
// selected role is "Doctor".
const isDoctorRoleSelected = () => {
  const select = document.getElementById("role");
  return select.selectedOptions[0]?.textContent === "Doctor";
};

const toggleDoctorFields = () => {
  document.getElementById("doctor-fields").style.display = isDoctorRoleSelected() ? "flex" : "none";
};

// Renders the specializations lookup as a list of checkboxes.
const loadSpecializations = async () => {
  const container = document.getElementById("specializations");
  try {
    const response = await axios.get(`${baseApiUrl}/specializations.php`, {
      params: { operation: "getSpecializations" },
    });
    container.innerHTML = "";
    response.data.forEach((spec) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("form-check");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.classList.add("form-check-input");
      checkbox.value = spec.SpecializationID;
      checkbox.id = `spec-${spec.SpecializationID}`;

      const label = document.createElement("label");
      label.classList.add("form-check-label");
      label.htmlFor = checkbox.id;
      label.textContent = spec.SpecializationName;

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  } catch (err) {
    container.innerHTML = `<span class="text-danger small">Could not load specializations.</span>`;
  }
};

const getSelectedSpecializationIds = () =>
  [...document.querySelectorAll("#specializations input[type='checkbox']:checked")].map((c) => c.value);

const displayUsers = async () => {
  const response = await axios.get(`${baseApiUrl}/users.php`, {
    params: {
      operation: "getAllUsers",
      json: JSON.stringify({ actingUserId: actingUserId() }),
    },
  });
  if (response.status == 200 && Array.isArray(response.data)) {
    displayUsersTable(response.data);
  } else {
    alert("Error loading accounts. Only administrators can view this page.");
  }
};

const displayUsersTable = (users) => {
  const showInactive = document.getElementById("show-inactive").checked;
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");
  table.innerHTML = `
    <thead>
      <tr><th>NAME</th><th>USERNAME</th><th>PHONE</th><th>ROLE</th><th>SPECIALIZATIONS</th><th>STATUS</th><th>ACTION</th></tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  const me = Number(actingUserId());

  users
    .filter((u) => showInactive || u.Status === "Active")
    .forEach((u) => {
      const isActive = u.Status === "Active";
      const isSelf = Number(u.UserID) === me;
      const row = document.createElement("tr");
      if (!isActive) row.classList.add("table-secondary");

      row.innerHTML = `
        <td>${esc(u.FirstName)} ${esc(u.LastName)}${isSelf ? ' <span class="badge bg-info text-dark">You</span>' : ""}</td>
        <td>${esc(u.Username)}</td>
        <td>${esc(u.Phone)}</td>
        <td>${esc(u.RoleName)}</td>
        <td>${esc(u.Specializations)}</td>
        <td><span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${esc(u.Status)}</span></td>
        <td>
          <button type="button" class="btn btn-primary btn-sm btn-view">View</button>
          <button type="button" class="btn btn-success btn-sm btn-update">Update</button>
          ${
            isActive
              ? (isSelf ? "" : `<button type="button" class="btn btn-danger btn-sm btn-delete">Deactivate</button>`)
              : `<button type="button" class="btn btn-warning btn-sm btn-restore">Restore</button>`
          }
        </td>
      `;
      tbody.appendChild(row);

      row.querySelector(".btn-view").addEventListener("click", () => viewModal(u.UserID));
      row.querySelector(".btn-update").addEventListener("click", () => updateModal(u.UserID, displayUsers));
      row.querySelector(".btn-delete")?.addEventListener("click", () => deleteModal(u.UserID, displayUsers));
      row.querySelector(".btn-restore")?.addEventListener("click", () => restoreUser(u.UserID));
    });

  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertUser = async () => {
  const jsonData = {
    actingUserId: actingUserId(),
    firstName: document.getElementById("first-name").value,
    lastName: document.getElementById("last-name").value,
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    roleId: document.getElementById("role").value,
    phone: document.getElementById("phone").value,
  };

  if (!isValidPhone(jsonData.phone)) {
    alert("Phone must contain digits only (7-15 digits), with no negative sign or letters.");
    return;
  }
  if (isDoctorRoleSelected()) {
    jsonData.specializationIds = getSelectedSpecializationIds();
  }

  const formData = new FormData();
  formData.append("operation", "insertUser");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({ url: `${baseApiUrl}/users.php`, method: "POST", data: formData });

  if (checkResult(response.data, "Account successfully created!")) {
    clearForm();
    displayUsers();
  }
};

const restoreUser = async (userId) => {
  const response = await axios.get(`${baseApiUrl}/users.php`, {
    params: {
      operation: "restoreUser",
      json: JSON.stringify({ userId, actingUserId: actingUserId() }),
    },
  });
  if (checkResult(response.data, "Account restored!")) displayUsers();
};

const clearForm = () => {
  ["first-name", "last-name", "username", "password"].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("role").value = "";
  document.getElementById("phone").value = "";
  document
    .querySelectorAll("#specializations input[type='checkbox']")
    .forEach((checkbox) => (checkbox.checked = false));
  toggleDoctorFields();
};
