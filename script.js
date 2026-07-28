(function () {
  "use strict";

  /* ═══════════════════════════════════════════
       Five Fields — local-first task board
       All data in localStorage. Single HTML file.
       ═══════════════════════════════════════════ */

  const COLS = ["dates", "now", "later", "relax", "backlog"];
  const SK = "fivefields_v1";
  const BGK = "fivefields_bg_v1";
  const NOTIF_KEY = "fivefields_notif_enabled";
  const LAST_NOTIF_KEY = "fivefields_last_notif";

  // ─── State ────────────────────────────────
  let state = { dates: [], now: [], later: [], relax: [], backlog: [] };

  // ─── Drag state ───────────────────────────
  let dragId = null;
  let dragCol = null;
  let ghost = null; // clone shown while dragging
  let ph = null; // drop placeholder element

  // ─── Utilities ────────────────────────────
  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function todayISO() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function fmtTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    let datePart = iso;
    let timePart = "";
    if (iso.includes("T")) {
      [datePart, timePart] = iso.split("T");
    }
    const [y, m, d] = datePart.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.round((dt - now) / 86400000);
    const MON = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let dateLabel = MON[m - 1] + " " + d;
    if (diff === 0) dateLabel = "Today";
    else if (diff === 1) dateLabel = "Tomorrow";
    else if (diff === -1) dateLabel = "Yesterday";
    else if (diff > 1 && diff < 7)
      dateLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];

    if (timePart) {
      return dateLabel + " at " + fmtTime(timePart);
    }
    return dateLabel;
  }

  function dateCls(iso) {
    if (!iso) return "";
    if (iso.includes("T")) {
      const targetDate = new Date(iso);
      const now = new Date();
      if (targetDate < now) return "overdue";
      const dtZero = new Date(targetDate); dtZero.setHours(0,0,0,0);
      const nowZero = new Date(now); nowZero.setHours(0,0,0,0);
      return dtZero.getTime() === nowZero.getTime() ? "today" : "";
    } else {
      const [y, m, d] = iso.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diff = Math.round((dt - now) / 86400000);
      return diff < 0 ? "overdue" : diff === 0 ? "today" : "";
    }
  }

  // ─── Persist ──────────────────────────────
  function save() {
    try {
      localStorage.setItem(SK, JSON.stringify(state));
    } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SK);
      if (raw) {
        const p = JSON.parse(raw);
        COLS.forEach((c) => {
          if (Array.isArray(p[c])) state[c] = p[c];
        });
      }
    } catch (e) {}
  }

  // ─── Background ───────────────────────────
  function loadBg() {
    try {
      const s = localStorage.getItem(BGK);
      if (s) applyBg(s);
    } catch (e) {}
  }
  function applyBg(url) {
    document.getElementById("bg-layer").style.backgroundImage =
      "url(" + url + ")";
    const prev = document.getElementById("bg-preview");
    prev.style.backgroundImage = "url(" + url + ")";
    prev.classList.add("has-img");
  }
  function clearBg() {
    document.getElementById("bg-layer").style.backgroundImage = "";
    const prev = document.getElementById("bg-preview");
    prev.style.backgroundImage = "";
    prev.classList.remove("has-img");
    try {
      localStorage.removeItem(BGK);
    } catch (e) {}
  }

  // ─── Date display ─────────────────────────
  function setDateDisplay() {
    const n = new Date();
    const DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const MONS = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    document.getElementById("date-display").textContent =
      DAYS[n.getDay()] + ", " + MONS[n.getMonth()] + " " + n.getDate();
  }

  // ─── Render ───────────────────────────────
  function render() {
    COLS.forEach(renderCol);
  }

  function renderCol(col) {
    const list = document.getElementById("list-" + col);
    const count = document.getElementById("count-" + col);
    const tasks = state[col];
    const active = tasks.filter((t) => !t.done).length;
    count.textContent = active || "";
    list.innerHTML = "";

    if (tasks.length === 0) {
      list.appendChild(emptyEl(col));
      return;
    }

    if (col === "dates") {
      renderDatesCol(list, tasks);
      return;
    }

    tasks.forEach((t, i) => list.appendChild(makeCard(t, col)));
  }

  const EMPTY = {
    dates: "No dated tasks yet.",
    now: "Nothing in progress.\nAdd something to focus on.",
    later: "Your future self will thank you.",
    relax: "A quiet space.\nJot an idea or a book to read.",
    backlog: "Clean slate — dump anything here.",
  };
  function emptyEl(col) {
    const d = document.createElement("div");
    d.className = "empty-state";
    d.innerHTML = "<p>" + EMPTY[col].replace("\n", "<br/>") + "</p>";
    return d;
  }

  function renderDatesCol(list, tasks) {
    const t = todayISO();
    function getDateOnly(iso) {
      return iso ? iso.split('T')[0] : '';
    }

    const overdue = tasks.filter((tk) => tk.dueDate && getDateOnly(tk.dueDate) < t);
    const todayT = tasks.filter((tk) => tk.dueDate && getDateOnly(tk.dueDate) === t);
    const future = tasks.filter((tk) => !tk.dueDate || getDateOnly(tk.dueDate) > t);

    const sortByDate = (a, b) => (a.dueDate || '').localeCompare(b.dueDate || '');
    overdue.sort(sortByDate);
    todayT.sort(sortByDate);
    future.sort(sortByDate);

    function group(label, items, cls) {
      if (!items.length) return;
      const g = document.createElement("div");
      g.className = "date-group";
      const lbl = document.createElement("div");
      lbl.className = "dg-label " + cls;
      lbl.textContent = label;
      g.appendChild(lbl);
      items.forEach((task) => g.appendChild(makeCard(task, "dates")));
      list.appendChild(g);
    }

    group("Overdue", overdue, "lbl-overdue");
    group("Today", todayT, "lbl-today");
    group("Upcoming", future, "");

    if (!overdue.length && !todayT.length && !future.length)
      list.appendChild(emptyEl("dates"));
  }

  function makeCard(task, col) {
    const card = document.createElement("div");
    card.className = "task-card" + (task.done ? " done-card" : "");
    card.dataset.id = task.id;
    card.dataset.col = col;
    card.draggable = true;

    // check
    const ck = document.createElement("div");
    ck.className = "task-check" + (task.done ? " done" : "");
    ck.title = task.done ? "Mark undone" : "Mark done";
    ck.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDone(task.id, col);
    });

    // body
    const body = document.createElement("div");
    body.className = "task-body";

    const txt = document.createElement("div");
    txt.className = "task-text";
    txt.textContent = task.text;
    txt.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startEdit(txt, task, col);
    });
    body.appendChild(txt);

    if (col === "dates" && task.dueDate) {
      const de = document.createElement("div");
      de.className = "task-date " + dateCls(task.dueDate);
      de.textContent = fmtDate(task.dueDate);
      body.appendChild(de);
    }

    // delete
    const del = document.createElement("button");
    del.className = "task-del";
    del.title = "Remove";
    del.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTask(task.id, col);
    });

    card.appendChild(ck);
    card.appendChild(body);
    card.appendChild(del);

    card.addEventListener("dragstart", (e) =>
      onDragStart(e, task.id, col, card),
    );
    card.addEventListener("dragend", (e) => onDragEnd(e, card));

    return card;
  }

  // ─── Inline edit ──────────────────────────
  function startEdit(el, task, col) {
    el.contentEditable = "true";
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);

    function finish() {
      el.contentEditable = "false";
      const v = el.textContent.trim();
      if (v && v !== task.text) {
        task.text = v;
        save();
      } else el.textContent = task.text;
    }
    el.addEventListener("blur", finish, { once: true });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
      if (e.key === "Escape") {
        el.textContent = task.text;
        el.blur();
      }
    });
  }

  // ─── CRUD ─────────────────────────────────
  function addTask(col, text, dueDate) {
    if (!text.trim()) return;
    const t = { id: uid(), text: text.trim(), done: false };
    if (dueDate) t.dueDate = dueDate;
    state[col].push(t);
    save();
    renderCol(col);
  }

  function removeTask(id, col) {
    state[col] = state[col].filter((t) => t.id !== id);
    save();
    renderCol(col);
  }

  function toggleDone(id, col) {
    const t = state[col].find((t) => t.id === id);
    if (t) {
      t.done = !t.done;
      save();
      renderCol(col);
    }
  }

  // ─── Drag & drop ──────────────────────────
  function onDragStart(e, id, col, card) {
    dragId = id;
    dragCol = col;
    card.classList.add("dragging-src");

    // custom ghost clone
    ghost = card.cloneNode(true);
    ghost.style.cssText =
      "position:fixed;top:-300px;left:-300px;width:" +
      card.offsetWidth +
      "px;opacity:.88;transform:rotate(2deg) scale(1.02);pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.4);border-radius:8px;z-index:9999";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, e.offsetX + 10, e.offsetY + 10);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragEnd(e, card) {
    card.classList.remove("dragging-src");
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    if (ph) {
      ph.remove();
      ph = null;
    }
    document
      .querySelectorAll(".column.drag-over")
      .forEach((c) => c.classList.remove("drag-over"));
    dragId = null;
    dragCol = null;
  }

  COLS.forEach((col) => {
    const sec = document.getElementById("col-" + col);
    const list = document.getElementById("list-" + col);

    sec.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      sec.classList.add("drag-over");

      // placeholder
      if (ph) ph.remove();
      ph = document.createElement("div");
      ph.className = "drop-ph";

      const cards = [...list.querySelectorAll(".task-card:not(.dragging-src)")];
      let placed = false;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          list.insertBefore(ph, c);
          placed = true;
          break;
        }
      }
      if (!placed) list.appendChild(ph);
    });

    sec.addEventListener("dragleave", (e) => {
      if (!sec.contains(e.relatedTarget)) {
        sec.classList.remove("drag-over");
        if (ph) {
          ph.remove();
          ph = null;
        }
      }
    });

    sec.addEventListener("drop", (e) => {
      e.preventDefault();
      sec.classList.remove("drag-over");
      if (ph) {
        ph.remove();
        ph = null;
      }
      if (!dragId || !dragCol) return;

      // find insert index in dest
      const visCards = [
        ...list.querySelectorAll(".task-card:not(.dragging-src)"),
      ];
      let insertIdx = visCards.length;
      for (let i = 0; i < visCards.length; i++) {
        const r = visCards[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          insertIdx = i;
          break;
        }
      }

      const src = state[dragCol];
      const taskIdx = src.findIndex((t) => t.id === dragId);
      if (taskIdx === -1) return;
      const [task] = src.splice(taskIdx, 1);

      // assign today's date when dropped into Dates and task has no date
      if (col === "dates" && !task.dueDate) task.dueDate = todayISO();

      const dst = state[col];
      // if same column, adjust for removal
      let finalIdx = insertIdx;
      if (dragCol === col && taskIdx < insertIdx) finalIdx--;
      dst.splice(Math.max(0, finalIdx), 0, task);

      save();
      const prev = dragCol;
      dragId = null;
      dragCol = null;
      if (prev !== col) renderCol(prev);
      renderCol(col);
    });
  });

  // ─── Input handlers ───────────────────────
  function setupInputs() {
    COLS.forEach((col) => {
      const inp = document.getElementById("input-" + col);
      const btn = document.getElementById("addbtn-" + col);
      function go() {
        const due =
          col === "dates"
            ? document.getElementById("date-picker").value || null
            : null;
        addTask(col, inp.value, due);
        inp.value = "";
        if (col === "dates") document.getElementById("date-picker").value = "";
      }
      btn.addEventListener("click", go);
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          go();
        }
      });
    });
  }

  // ─── Background modal ─────────────────────
  function setupBgModal() {
    const modal = document.getElementById("bg-modal");
    const fi = document.getElementById("bg-file-input");
    const zone = document.getElementById("upload-zone");

    document
      .getElementById("bg-open-btn")
      .addEventListener("click", () => modal.classList.add("open"));
    document
      .getElementById("bg-close-btn")
      .addEventListener("click", () => modal.classList.remove("open"));
    document.getElementById("bg-remove-btn").addEventListener("click", () => {
      clearBg();
      modal.classList.remove("open");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });

    zone.addEventListener("click", () => fi.click());
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") fi.click();
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-hi");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-hi"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-hi");
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) readImg(f);
    });

    fi.addEventListener("change", () => {
      if (fi.files[0]) readImg(fi.files[0]);
      fi.value = "";
    });
  }

  function readImg(file) {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        localStorage.setItem(BGK, e.target.result);
      } catch (ex) {
        alert(
          "Image too large for browser storage. Try a smaller file (under 4 MB).",
        );
        return;
      }
      applyBg(e.target.result);
      document.getElementById("bg-modal").classList.remove("open");
    };
    r.readAsDataURL(file);
  }

  // ─── Notifications ─────────────────────────
  function setupNotifications() {
    const btn = document.getElementById("notif-btn");
    const label = document.getElementById("notif-btn-label");
    if (!btn) return;

    if (!("Notification" in window)) {
      btn.style.display = "none";
      return;
    }

    function updateBtnState() {
      const enabled = localStorage.getItem(NOTIF_KEY) === "true";
      const hasPerm = Notification.permission === "granted";

      if (enabled && hasPerm) {
        btn.classList.add("active");
        label.textContent = "Reminders On";
      } else {
        btn.classList.remove("active");
        label.textContent = "Reminders";
      }
    }

    btn.addEventListener("click", () => {
      if (Notification.permission === "granted") {
        const current = localStorage.getItem(NOTIF_KEY) === "true";
        localStorage.setItem(NOTIF_KEY, !current ? "true" : "false");
        updateBtnState();
        if (!current) checkReminders(true);
      } else if (Notification.permission === "denied") {
        alert("Notification permissions are blocked in your browser settings. Please allow notifications for this site to enable reminders.");
      } else {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            localStorage.setItem(NOTIF_KEY, "true");
            updateBtnState();
            checkReminders(true);
          }
        });
      }
    });

    updateBtnState();
    checkReminders(false);
    setInterval(() => checkReminders(false), 60 * 1000);
  }

  function checkReminders(force = false) {
    const enabled = localStorage.getItem(NOTIF_KEY) === "true";
    if (!enabled || Notification.permission !== "granted") return;

    const now = new Date();
    const todayStr = todayISO();

    const dueTasks = state.dates.filter((t) => {
      if (t.done || !t.dueDate) return false;
      if (t.dueDate.includes("T")) {
        return new Date(t.dueDate) <= now;
      }
      return t.dueDate <= todayStr;
    });

    if (dueTasks.length === 0) return;

    const taskIds = dueTasks.map((t) => t.id).sort().join(",");
    const notifSig = todayStr + ":" + now.getHours() + ":" + now.getMinutes() + ":" + taskIds;

    const lastSig = localStorage.getItem(LAST_NOTIF_KEY);
    if (!force && lastSig === notifSig) return;

    let bodyMsg = "";
    if (dueTasks.length === 1) {
      bodyMsg = `"${dueTasks[0].text}" is scheduled for now or overdue.`;
    } else {
      bodyMsg = `You have ${dueTasks.length} tasks scheduled for now or overdue.`;
    }

    try {
      new Notification("Five Fields Reminders", {
        body: bodyMsg,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236c8e7e'><path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/></svg>",
      });
      localStorage.setItem(LAST_NOTIF_KEY, notifSig);
    } catch (e) {}
  }

  // ─── Init ─────────────────────────────────
  function init() {
    load();
    loadBg();
    setDateDisplay();
    setupInputs();
    setupBgModal();
    setupNotifications();
    render();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    // refresh date at midnight
    const now = new Date();
    const ms =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) -
      now;
    setTimeout(() => {
      setDateDisplay();
      setInterval(setDateDisplay, 86400000);
    }, ms);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
