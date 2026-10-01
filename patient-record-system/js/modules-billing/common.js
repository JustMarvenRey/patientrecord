// Shared helpers for the Billing module (billing.html + consultation-detail.html).
//
//   Admin : manages bills AND professional fees
//   Staff : handles the bills (create / edit / record payment), fees are read-only
//   Others: read-only

const currentUser = () => {
  const raw = sessionStorage.getItem("currentUser");
  return raw ? JSON.parse(raw) : null;
};

export const actingUserId = () => currentUser()?.UserID ?? null;

export const canManageBills = () => ["Admin", "Staff"].includes(currentUser()?.RoleName);
export const canManageFees = () => currentUser()?.RoleName === "Admin";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const peso = (v) =>
  `₱ ${(parseFloat(v) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const statusBadge = (status) => {
  switch (status) {
    case "Paid":      return "bg-success";
    case "Pending":   return "bg-warning text-dark";
    case "Cancelled": return "bg-danger";
    default:          return "bg-secondary";
  }
};

export const BILLING_ERRORS = {
  forbidden: "Your role isn't allowed to do that.",
  missing_fields: "Please fill in every required field.",
  invalid_date: "Please enter a valid date.",
  invalid_amount: "Amount must be a valid number (fees must be greater than 0, totals can't be negative).",
  invalid_status: "Please choose a valid status.",
  already_billed: "A bill already exists for this consultation.",
  consultation_not_found: "That consultation no longer exists.",
  not_found: "That record no longer exists.",
};

// POSTs a billing operation. Always sends who is acting so the API can check the role.
export const postBilling = async (baseApiUrl, operation, data) => {
  const fd = new FormData();
  fd.append("operation", operation);
  fd.append("json", JSON.stringify({ ...data, actingUserId: actingUserId() }));
  const res = await axios({ url: `${baseApiUrl}/billing.php`, method: "POST", data: fd });
  return res.data;
};

// GET with the acting user attached.
export const getBilling = async (baseApiUrl, operation, data = {}) => {
  const res = await axios.get(`${baseApiUrl}/billing.php`, {
    params: { operation, json: JSON.stringify({ ...data, actingUserId: actingUserId() }) },
  });
  return res.data;
};

// true when the API result is a success (1 or {billId}); otherwise alerts the reason and returns false.
export const checkBillingResult = (data, successMessage) => {
  if (data == 1 || data?.billId) {
    if (successMessage) alert(successMessage);
    return true;
  }
  alert(BILLING_ERRORS[data?.error] || "ERROR");
  return false;
};
