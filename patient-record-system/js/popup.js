/* ============================================================
   Modal pop-ups — replaces the browser's native alert()/confirm().

   - window.alert(message)            -> modal with an OK button (non-blocking, queued)
   - window.showAlert(message, opts)  -> same, returns a Promise
   - window.showConfirm(message, opts)-> modal with Cancel / Confirm, resolves true/false
   opts: { title, type: "success"|"error"|"warning"|"info"|"danger",
           confirmText, cancelText }

   Rendered with Bootstrap modal markup but managed here so it can safely
   sit on top of any Bootstrap modal that is already open.
   ============================================================ */
(function () {
  const ICONS = {
    success: { icon: "✓", title: "Success" },
    error:   { icon: "!", title: "Error" },
    warning: { icon: "!", title: "Please check" },
    info:    { icon: "i", title: "Notice" },
    danger:  { icon: "?", title: "Please confirm" },
    confirm: { icon: "?", title: "Please confirm" },
  };

  const guessType = (msg) => {
    const m = String(msg).toLowerCase();
    if (/(^error|error|can't|cannot|already|forbidden|not allowed|isn't allowed|no longer|invalid|taken)/.test(m)) return "error";
    if (/(required|please|must|select)/.test(m)) return "warning";
    if (/(success|saved|updated|restored|deactivated|deleted|cancelled|booked|removed|created|added)/.test(m)) return "success";
    return "info";
  };

  const queue = [];
  let active = false;

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const next = () => {
    if (active || !queue.length) return;
    active = true;
    const { message, opts, isConfirm, resolve } = queue.shift();

    const type = opts.type || (isConfirm ? "confirm" : guessType(message));
    const meta = ICONS[type] || ICONS.info;
    const title = opts.title || meta.title;
    const isDanger = type === "danger";

    const previouslyFocused = document.activeElement;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show prs-popup-backdrop";

    const wrap = document.createElement("div");
    wrap.className = "modal fade show d-block prs-popup";
    wrap.tabIndex = -1;
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-dialog modal-dialog-centered prs-popup-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title d-flex align-items-center gap-2">
              <span class="prs-popup-icon prs-popup-${type}">${meta.icon}</span>
              <span>${escapeHtml(title)}</span>
            </h5>
          </div>
          <div class="modal-body prs-popup-message">${escapeHtml(message)}</div>
          <div class="modal-footer">
            ${isConfirm ? `<button type="button" class="btn btn-secondary btn-sm prs-popup-cancel">${escapeHtml(opts.cancelText || "Cancel")}</button>` : ""}
            <button type="button" class="btn btn-sm ${isDanger ? "btn-danger" : "btn-success"} prs-popup-ok">${escapeHtml(opts.confirmText || (isConfirm ? "Confirm" : "OK"))}</button>
          </div>
        </div>
      </div>`;

    // Keep Bootstrap's focus trap (from any modal underneath) from stealing focus.
    wrap.addEventListener("focusin", (e) => e.stopPropagation());

    let closed = false;
    const close = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      backdrop.remove();
      if (previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) {
        try { previouslyFocused.focus({ preventScroll: true }); } catch (_) {}
      }
      active = false;
      resolve(result);
      next();
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        close(false);
      } else if (e.key === "Tab") {
        const btns = [...wrap.querySelectorAll("button")];
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      } else if (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") {
        e.preventDefault(); e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("keydown", onKey, true);

    wrap.querySelector(".prs-popup-ok").addEventListener("click", () => close(true));
    wrap.querySelector(".prs-popup-cancel")?.addEventListener("click", () => close(false));
    // Clicking the dim area behaves like Cancel for confirms, OK for alerts.
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(!isConfirm); });

    document.body.appendChild(backdrop);
    document.body.appendChild(wrap);
    (wrap.querySelector(".prs-popup-ok")).focus();
  };

  const enqueue = (message, opts, isConfirm) =>
    new Promise((resolve) => {
      queue.push({ message: message == null ? "" : message, opts: opts || {}, isConfirm, resolve });
      if (document.body) next();
      else document.addEventListener("DOMContentLoaded", next, { once: true });
    });

  window.showAlert = (message, opts) => enqueue(message, opts, false);
  window.showConfirm = (message, opts) => enqueue(message, opts, true);
  window.alert = (message) => { enqueue(message, {}, false); };
})();
