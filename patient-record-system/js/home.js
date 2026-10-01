const baseApiUrl = "http://localhost/patient-record-system/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

// Which module cards each role can see on the home page.
// Must stay in sync with ROLE_PERMISSIONS.allowed in auth-guard.js.
const ROLE_MODULES = {
  Admin:  ["appointments", "consultations", "index", "doctors", "medicines",
           "specializations", "generics", "laboratory-tests", "roles", "users", "billing"],
  Doctor: ["appointments", "consultations", "index", "diagnoses", "laboratory-tests"],
  Staff:  ["appointments", "consultations", "index", "billing"],
};

const ROLE_SUBTEXTS = {
  Admin:  "You're signed in as Admin. Manage master files, lookup tables, billing and fees, and system configuration.",
  Doctor: "You're signed in as Doctor. View your appointments, record consultations, manage diagnoses (ICD-10) and laboratory tests.",
  Staff:  "You're signed in as Staff. Manage patient appointments, records and billing.",
};

document.addEventListener("DOMContentLoaded", () => {
  const raw = sessionStorage.getItem("currentUser");
  if (!raw) return;
  const user = JSON.parse(raw);

  // Set welcome text
  document.getElementById("welcome-heading").textContent = `Welcome, ${user.FirstName}!`;
  document.getElementById("welcome-subtext").textContent =
    ROLE_SUBTEXTS[user.RoleName] ?? `You're signed in as ${user.RoleName}. Pick a module below.`;

  // Hide module cards the role can't see
  const allowed = ROLE_MODULES[user.RoleName] ?? [];
  document.querySelectorAll("#modules-grid [data-module]").forEach((card) => {
    if (!allowed.includes(card.getAttribute("data-module"))) {
      card.style.display = "none";
    }
  });
});
