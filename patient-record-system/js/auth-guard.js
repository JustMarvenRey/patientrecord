// auth-guard.js — runs on every protected page
// Responsibilities:
//   1. Redirect to login if no session
//   2. Render "Signed in as ..." + Logout in the navbar
//   3. Enforce role-based access per the permission map below:
//        Admin  → Master files full CRUD
//                 + Patients / Appointments / Consultations / Billing: can UPDATE and
//                   DEACTIVATE (or restore) records, but does not ADD new ones
//                   (except bills + professional fees, which Admin fully controls)
//        Doctor → Own Appointments + Consultations (full CRUD) + Patients (view-only)
//                 + Diagnoses / ICD-10 master file (full CRUD)
//                 + Laboratory Tests master file (full CRUD) + consultation-detail
//        Staff  → Appointments + Patients (full CRUD) + Consultations (view-only)
//                 + Billing: handles patient bills (create/edit/record payment), fees read-only

// ── Session ────────────────────────────────────────────────────────────────
const getCurrentUser = () => {
  const raw = sessionStorage.getItem("currentUser");
  return raw ? JSON.parse(raw) : null;
};

const currentUser = getCurrentUser();

if (!currentUser) {
  window.location.href = "login.html";
}

// ── Role permission map ─────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  Admin: {
    allowed: [
      "home", "index", "appointments", "consultations", "consultation-detail",
      "doctors", "medicines", "specializations", "generics",
      "roles", "users", "laboratory-tests", "billing", "medical-history",
    ],
    viewOnly: [],
    // Pages where the Admin does NOT get the "add new record" form (the
    // Update / Deactivate / Restore buttons stay available on these pages).
    hideAddForm: ["index", "appointments", "consultations"],
    // Admin can view consultation-detail to manage Billing + Professional Fees
  },
  Doctor: {
    allowed: [
      "home",
      "index",                  // Patients — view only
      "appointments",           // own appointments
      "consultations",          // own consultations
      "consultation-detail",    // full detail page: vitals + diagnoses + (later) labs, prescriptions
      "diagnoses",              // ICD-10 master file — full CRUD (moved from Admin)
      "laboratory-tests",       // Laboratory Tests master file — full CRUD
      "medical-history",        // opened from Patients > View > View Medical History
    ],
    viewOnly: ["index"],
  },
  Staff: {
    allowed: [
      "home",
      "index",            // Patients — full CRUD
      "appointments",     // full CRUD
      "billing",          // creates/edits patient bills + records payment; fees are Admin-only
      "medical-history",     // opened from Patients > View > View Medical History
    ],
    viewOnly: [],
  },
};

// ── Current page ────────────────────────────────────────────────────────────
const getPageName = () => {
  const file = window.location.pathname.split("/").pop().replace(".html", "") || "home";
  return file;
};

const pageName = getPageName();

// ── Access check — redirect if this role can't be here ──────────────────────
const enforcePageAccess = () => {
  if (!currentUser) return;
  const perms = ROLE_PERMISSIONS[currentUser.RoleName];
  if (!perms) return; // unknown role — let it through, Admin controls roles

  if (!perms.allowed.includes(pageName)) {
    // Redirect to home with a message in sessionStorage
    sessionStorage.setItem(
      "accessDeniedMsg",
      `Your role (${currentUser.RoleName}) does not have access to that page.`
    );
    window.location.href = "home.html";
  }
};

enforcePageAccess();

// ── Navbar: sign-in info + logout ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (!currentUser) return;

  // 0. Fix navbar brand — remove the hardcoded "- Admin" suffix
  const brand = document.querySelector(".navbar-brand");
  if (brand) brand.textContent = "Patient Record System";

  // 1. Render user info + logout in topbar
  const slot = document.getElementById("nav-user-info");
  if (slot) {
    const initials = (currentUser.FirstName[0] + currentUser.LastName[0]).toUpperCase();
    slot.innerHTML = `
      <div class="user-chip">
        <div class="user-avatar">${initials}</div>
        <div class="d-none d-md-block">
          <div style="font-weight:600;line-height:1.1;">${currentUser.FirstName} ${currentUser.LastName}</div>
          <div style="font-size:.72rem;opacity:.8;">${currentUser.RoleName}</div>
        </div>
      </div>
      <button class="btn-logout" id="btn-logout">Sign Out</button>
    `;
    document.getElementById("btn-logout").addEventListener("click", () => {
      sessionStorage.removeItem("currentUser");
      window.location.href = "login.html";
    });
  }

  // 2. Hide sidebar nav links the role can't access
  const perms = ROLE_PERMISSIONS[currentUser.RoleName];
  if (perms) {
    // Sidebar links (a.nav-link with data-module)
    document.querySelectorAll(".prs-sidebar a.nav-link").forEach((link) => {
      const mod = link.getAttribute("data-module") || link.getAttribute("href")?.replace(".html","") || "";
      if (!perms.allowed.includes(mod)) link.style.display = "none";
    });
    // Hide section labels (Main / Master Files / System) with no visible link under them
    const sidebarEl = document.querySelector(".prs-sidebar");
    if (sidebarEl) {
      let label = null;
      let hasVisibleLink = false;
      const flush = () => { if (label) label.style.display = hasVisibleLink ? "" : "none"; };
      [...sidebarEl.children].forEach((el) => {
        if (el.classList.contains("nav-section-label")) {
          flush();
          label = el;
          hasVisibleLink = false;
        } else if (el.matches("a.nav-link") && el.style.display !== "none") {
          hasVisibleLink = true;
        }
      });
      flush();
    }
    // Old navbar nav-items (for pages not yet migrated to sidebar)
    document.querySelectorAll(".navbar-nav .nav-item").forEach((item) => {
      const link = item.querySelector("a.nav-link");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const linkPage = href.replace(".html", "") || "home";
      if (!perms.allowed.includes(linkPage)) item.style.display = "none";
    });
  }

  // 3. Show access-denied flash if redirected here
  if (pageName === "home") {
    const msg = sessionStorage.getItem("accessDeniedMsg");
    if (msg) {
      sessionStorage.removeItem("accessDeniedMsg");
      const banner = document.createElement("div");
      banner.className = "alert alert-warning alert-dismissible fade show mx-3 mt-3";
      banner.innerHTML = `${msg} <button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
      document.querySelector(".container")?.prepend(banner);
    }
  }

  // 3b. Hide the "add new record" form only (keeps Update / Deactivate / Restore).
  //     Anything marked #add-form-fields or .add-only is hidden; if a page has
  //     neither, the whole #main-div card is hidden.
  if (perms && (perms.hideAddForm || []).includes(pageName)) {
    const addOnly = document.querySelectorAll("#add-form-fields, .add-only");
    if (addOnly.length) {
      addOnly.forEach((el) => (el.style.display = "none"));
    } else {
      const mainDiv = document.getElementById("main-div");
      if (mainDiv) mainDiv.style.display = "none";
    }
  }

  // 4. View-only: hide Add form + strip Update/Delete/Restore buttons
  if (perms && perms.viewOnly.includes(pageName)) {
    // Hide the add/edit form card
    const mainDiv = document.getElementById("main-div");
    if (mainDiv) mainDiv.style.display = "none";

    // Strip action buttons from the table every time it re-renders
    const tableDiv = document.getElementById("table-div");
    if (tableDiv) {
      const strip = () => {
        tableDiv.querySelectorAll(".btn-update, .btn-delete, .btn-restore").forEach((btn) => btn.remove());
      };
      strip();
      new MutationObserver(strip).observe(tableDiv, { childList: true, subtree: true });
    }
  }
});
