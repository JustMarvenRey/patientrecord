// Shared helpers for the User Accounts module.

export const actingUserId = () => {
  const raw = sessionStorage.getItem("currentUser");
  return raw ? JSON.parse(raw).UserID : null;
};

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const ERROR_MESSAGES = {
  forbidden: "Only an active administrator can do that.",
  missing_fields: "Please fill in every required field.",
  invalid_username: "Username must be 3-50 characters: letters, numbers, and underscore only.",
  weak_password: "Password must be at least 6 characters.",
  invalid_role: "Please select a valid, active role.",
  invalid_phone: "Phone must contain digits only (7-15 digits), with no negative sign or letters.",
  username_taken: "That username is already taken.",
  not_found: "That account no longer exists.",
  cannot_change_own_role: "You can't change your own role.",
  cannot_deactivate_self: "You can't deactivate your own account.",
};

// Returns true when the API result is a success (1); otherwise alerts and returns false.
export const checkResult = (data, successMessage) => {
  if (data == 1) {
    if (successMessage) alert(successMessage);
    return true;
  }
  alert(ERROR_MESSAGES[data?.error] || "ERROR");
  return false;
};

export const getUserDetails = async (userId) => {
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/users.php`, {
    params: {
      operation: "getUser",
      json: JSON.stringify({ userId, actingUserId: actingUserId() }),
    },
  });
  return response.data;
};

export const getAssignableRoles = async () => {
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/users.php`, {
    params: {
      operation: "getAssignableRoles",
      json: JSON.stringify({ actingUserId: actingUserId() }),
    },
  });
  return Array.isArray(response.data) ? response.data : [];
};

// All specializations (lookup table) for the Doctor checkboxes.
export const getSpecializations = async () => {
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/specializations.php`, {
    params: { operation: "getSpecializations" },
  });
  return Array.isArray(response.data) ? response.data : [];
};

// Phone is optional, but if typed in it must be 7-15 digits only.
export const isValidPhone = (phone) => phone.trim() === "" || /^[0-9]{7,15}$/.test(phone.trim());
