/**
 * Main Tasks & Projects Management Logic
 * with Firebase Firestore
 */

// Import Firebase Modular SDK via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBVq7w5Tk64dHmQkNzq97Mw87gQ0F0LOSU",
  authDomain: "to-do-app-3b7ff.firebaseapp.com",
  projectId: "to-do-app-3b7ff",
  storageBucket: "to-do-app-3b7ff.firebasestorage.app",
  messagingSenderId: "733628658918",
  appId: "1:733628658918:web:02cb97a1176113c1cb3727",
  measurementId: "G-G2CDH735EJ",
};

// Initialize Firebase & Firestore (safe – won't crash if config is empty)
let app = null;
let db = null;
let firebaseReady = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    firebaseReady = true;
  } else {
    console.warn(
      "Firebase config is empty. Fill firebaseConfig in script.js to enable cloud sync.",
    );
  }
} catch (err) {
  console.error("Firebase init failed:", err);
}

// Application State
let projects = [];
let tasks = [];
let activeProject = "";
let activeStatusFilter = "all";
let searchQuery = "";

// DOM Elements
const tasksContainer = document.getElementById("tasksContainer");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const backupBtn = document.getElementById("backupBtn");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");

/* ==========================================================================
   Initialize
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  setupEventListeners();
  if (firebaseReady) {
    await fetchAllDataFromFirestore();
  } else {
    // Fallback defaults so UI still works until config is filled
    projects = ["פרויקט כללי"];
    activeProject = projects[0];
    tasks = [];
    renderProjectsUI();
    renderTasks();
    updateStats();
  }
});

/* ==========================================================================
   Firestore Operations
   ========================================================================== */
async function fetchAllDataFromFirestore() {
  if (!firebaseReady) return;
  try {
    // Load Projects
    const projectsSnapshot = await getDocs(collection(db, "projects"));
    projects = projectsSnapshot.docs.map((d) => d.data().name);

    if (projects.length === 0) {
      const defaultProject = "פרויקט כללי";
      projects = [defaultProject];
      await setDoc(doc(db, "projects", defaultProject), {
        name: defaultProject,
      });
    }

    activeProject = projects[0];

    // Load Tasks – normalize id to string for reliable drag/drop matching
    const tasksSnapshot = await getDocs(collection(db, "tasks"));
    tasks = tasksSnapshot.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: String(data.id ?? d.id),
        order: data.order != null ? Number(data.order) : undefined,
      };
    });

    renderProjectsUI();
    renderTasks();
    updateStats();
  } catch (error) {
    console.error("Error fetching data from Firestore:", error);
    alert(
      "שגיאה בטעינת הנתונים מ-Firebase. בדוק את הקונפיגורציה ואת חוקי האבטחה.",
    );
    // Fallback so UI is usable
    if (projects.length === 0) {
      projects = ["פרויקט כללי"];
      activeProject = projects[0];
    }
    renderProjectsUI();
    renderTasks();
    updateStats();
  }
}

async function saveTaskToFirestore(task) {
  if (!firebaseReady) return;
  try {
    await setDoc(doc(db, "tasks", String(task.id)), task);
  } catch (error) {
    console.error("Error saving task to Firestore:", error);
  }
}

async function deleteTaskFromFirestore(taskId) {
  if (!firebaseReady) return;
  try {
    await deleteDoc(doc(db, "tasks", String(taskId)));
  } catch (error) {
    console.error("Error deleting task from Firestore:", error);
  }
}

async function saveProjectToFirestore(projectName) {
  if (!firebaseReady) return;
  try {
    await setDoc(doc(db, "projects", projectName), { name: projectName });
  } catch (error) {
    console.error("Error saving project to Firestore:", error);
  }
}

async function deleteProjectFromFirestore(projectName) {
  if (!firebaseReady) return;
  try {
    await deleteDoc(doc(db, "projects", projectName));
  } catch (error) {
    console.error("Error deleting project from Firestore:", error);
  }
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
function setupEventListeners() {
  // Status Filters
  document.getElementById("statusFilters").addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-chip")) {
      document
        .querySelectorAll(".filter-chip")
        .forEach((chip) => chip.classList.remove("active"));
      e.target.classList.add("active");
      activeStatusFilter = e.target.dataset.status;
      renderTasks();
    }
  });

  // Dark Mode Toggle
  themeToggleBtn.addEventListener("click", toggleTheme);

  // Backup Dialog Opener
  backupBtn.addEventListener("click", () => openModal("backupModal"));
}

/* ==========================================================================
   Projects UI
   ========================================================================== */
function renderProjectsUI() {
  const activeProjectSelect = document.getElementById("activeProjectSelect");
  const taskProjectSelect = document.getElementById("taskProject");
  const editTaskProjectSelect = document.getElementById("editTaskProject");

  const projectOptionsHtml = projects
    .map(
      (proj) => `
        <option value="${escapeHtml(proj)}" ${proj === activeProject ? "selected" : ""}>${escapeHtml(proj)}</option>
    `,
    )
    .join("");

  activeProjectSelect.innerHTML = projectOptionsHtml;
  taskProjectSelect.innerHTML = projectOptionsHtml;
  editTaskProjectSelect.innerHTML = projectOptionsHtml;

  document.getElementById("activeProjectTitleDisplay").innerText =
    activeProject;
}

function switchProject(projectName) {
  activeProject = projectName;
  renderProjectsUI();
  renderTasks();
}

/* Project Creation */
function openAddProjectModal() {
  document.getElementById("newProjectName").value = "";
  openModal("addProjectModal");
}

async function handleCreateProject(e) {
  e.preventDefault();
  const newName = document.getElementById("newProjectName").value.trim();

  if (!newName) return;

  if (projects.includes(newName)) {
    alert("פרויקט בשם זה כבר קיים.");
    return;
  }

  projects.push(newName);
  await saveProjectToFirestore(newName);

  closeModal("addProjectModal");
  switchProject(newName);
}

/* Project Rename */
function openEditProjectModal() {
  document.getElementById("editProjectNameInput").value = activeProject;
  openModal("editProjectModal");
}

async function handleSaveEditedProject(e) {
  e.preventDefault();
  const newName = document.getElementById("editProjectNameInput").value.trim();

  if (!newName) return;
  if (newName === activeProject) {
    closeModal("editProjectModal");
    return;
  }

  if (projects.includes(newName)) {
    alert("פרויקט בשם זה כבר קיים.");
    return;
  }

  const oldName = activeProject;

  // Update in local array
  const index = projects.indexOf(oldName);
  if (index !== -1) {
    projects[index] = newName;
  }

  // Update all tasks that belong to this project
  const tasksToUpdate = tasks.filter((t) => t.project === oldName);
  for (const task of tasksToUpdate) {
    task.project = newName;
    await saveTaskToFirestore(task);
  }

  // Save new project doc, delete old one
  await saveProjectToFirestore(newName);
  await deleteProjectFromFirestore(oldName);

  closeModal("editProjectModal");
  switchProject(newName);
}

/* Project Deletion */
async function deleteCurrentProject() {
  if (projects.length <= 1) {
    alert("יש להשאיר לפחות פרויקט אחד קיים במערכת.");
    return;
  }

  if (
    !confirm(
      `האם למחוק את הפרויקט "${activeProject}"? כל המשימות השייכות לפרויקט זה יימחקו.`,
    )
  ) {
    return;
  }

  const projectToDelete = activeProject;

  // Delete associated tasks from Firestore
  const tasksToDelete = tasks.filter((t) => t.project === projectToDelete);
  for (const task of tasksToDelete) {
    await deleteTaskFromFirestore(task.id);
  }
  tasks = tasks.filter((t) => t.project !== projectToDelete);

  // Delete project from Firestore
  await deleteProjectFromFirestore(projectToDelete);
  projects = projects.filter((p) => p !== projectToDelete);

  switchProject(projects[0]);
  updateStats();
}

/* ==========================================================================
   Tasks
   ========================================================================== */
async function handleAddTask(e) {
  e.preventDefault();
  const titleInput = document.getElementById("taskTitle");
  const noteInput = document.getElementById("taskNote");
  const projectInput = document.getElementById("taskProject");
  const priorityInput = document.getElementById("taskPriority");
  const dueDateInput = document.getElementById("taskDueDate");

  const projectTasks = tasks.filter((t) => t.project === projectInput.value);
  const maxOrder = projectTasks.reduce(
    (max, t) => Math.max(max, t.order ?? 0),
    0,
  );

  const newTask = {
    id: Date.now().toString(),
    title: titleInput.value.trim(),
    note: noteInput.value.trim() || null,
    project: projectInput.value,
    priority: priorityInput.value,
    status: "todo",
    createdAt: new Date().toISOString().split("T")[0],
    dueDate: dueDateInput.value || null,
    order: maxOrder + 1,
  };

  tasks.unshift(newTask);
  await saveTaskToFirestore(newTask);

  titleInput.value = "";
  noteInput.value = "";
  dueDateInput.value = "";

  switchProject(newTask.project);
  updateStats();
}

function renderTasks() {
  let filteredTasks = tasks.filter((task) => task.project === activeProject);

  if (activeStatusFilter !== "all") {
    filteredTasks = filteredTasks.filter(
      (task) => task.status === activeStatusFilter,
    );
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        (task.note && task.note.toLowerCase().includes(q)),
    );
  }

  // Sort by custom order (drag-drop), then by priority as fallback
  filteredTasks.sort(compareTasksOrder);

  tasksContainer.innerHTML = "";

  if (filteredTasks.length === 0) {
    tasksContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>אין משימות להצגה בפרויקט זה.</p>
            </div>
        `;
    return;
  }

  filteredTasks.forEach((task) => {
    const taskCard = document.createElement("div");
    taskCard.className = "task-card";
    taskCard.dataset.taskId = String(task.id);

    const priorityLabels = { high: "עליונה", medium: "רגילה", low: "נמוכה" };

    const noteHtml = task.note
      ? `
                <div class="task-note">
                    <div class="task-note-content">
                        <i class="fa-regular fa-note-sticky note-icon"></i>
                        <div class="clamp-block" data-clamp="note">
                            <span class="task-note-text clamp-text">${escapeHtml(task.note)}</span>
                            <button type="button" class="clamp-toggle" hidden onclick="toggleClamp(this)">
                                <span class="clamp-more">הצג עוד</span>
                                <span class="clamp-less">הצג פחות</span>
                            </button>
                        </div>
                    </div>
                    <div class="task-note-actions">
                        <button class="icon-action-btn" onclick="openEditNoteModal('${task.id}')" title="ערוך הערה">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="icon-action-btn delete-btn" onclick="deleteNote('${task.id}')" title="מחק הערה">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`
      : `
                <button class="btn-add-note" onclick="openEditNoteModal('${task.id}')" title="הוסף הערה">
                    <i class="fa-regular fa-note-sticky"></i> הוסף הערה
                </button>`;

    taskCard.innerHTML = `
            <div class="drag-handle" title="גרור לשינוי סדר">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>
            <div class="task-main-content">
                <div class="clamp-block" data-clamp="title">
                    <span class="task-title-text clamp-text ${task.status === "completed" ? "completed-text" : ""}">${escapeHtml(task.title)}</span>
                    <button type="button" class="clamp-toggle" hidden onclick="toggleClamp(this)">
                        <span class="clamp-more">הצג עוד</span>
                        <span class="clamp-less">הצג פחות</span>
                    </button>
                </div>
                ${noteHtml}
                <div class="task-priority-actions">
                    <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
                    <div class="task-icon-actions">
                        <button class="icon-action-btn" onclick="openEditTaskModal('${task.id}')" title="ערוך משימה">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="icon-action-btn delete-btn" onclick="deleteTask('${task.id}')" title="מחק משימה">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="task-meta">
                    <span><i class="fa-regular fa-calendar-plus"></i> נוצר: ${task.createdAt}</span>
                    ${task.dueDate ? `<span><i class="fa-regular fa-calendar-check"></i> יעד: ${task.dueDate}</span>` : ""}
                </div>
            </div>

            <div class="task-actions">
                <div class="status-btn-group">
                    <button class="status-btn ${task.status === "todo" ? "selected" : ""}" 
                        onclick="updateTaskStatus('${task.id}', 'todo')">לביצוע</button>
                    <button class="status-btn ${task.status === "in-progress" ? "selected" : ""}" 
                        onclick="updateTaskStatus('${task.id}', 'in-progress')">בטיפול</button>
                    <button class="status-btn ${task.status === "completed" ? "selected" : ""}" 
                        onclick="updateTaskStatus('${task.id}', 'completed')">הושלם</button>
                </div>
            </div>
        `;

    tasksContainer.appendChild(taskCard);
  });

  // Show "הצג עוד" only when text overflows 2 lines
  requestAnimationFrame(() => initClampToggles());
  setupPointerSort();
}

function initClampToggles() {
  document.querySelectorAll(".clamp-block").forEach((block) => {
    const text = block.querySelector(".clamp-text");
    const btn = block.querySelector(".clamp-toggle");
    if (!text || !btn) return;

    // Measure while clamped
    block.classList.remove("is-expanded");
    const overflows = text.scrollHeight > text.clientHeight + 1;
    btn.hidden = !overflows;
  });
}

function toggleClamp(btn) {
  const block = btn.closest(".clamp-block");
  if (!block) return;
  block.classList.toggle("is-expanded");
}

/* ==========================================================================
   Pointer-based Sort (desktop + tablet + mobile)
   ========================================================================== */
let sortPointerId = null;
let sortActiveCard = null;
let sortStartY = 0;
let sortMoved = false;
let sortInitialized = false;
let sortLastClientX = 0;
let sortLastClientY = 0;
let sortAutoScrollRAF = null;

function compareTasksOrder(a, b) {
  const priorityMap = { high: 1, medium: 2, low: 3 };
  const orderA = a.order != null ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const orderB = b.order != null ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return (priorityMap[a.priority] || 9) - (priorityMap[b.priority] || 9);
}

function setupPointerSort() {
  if (sortInitialized || !tasksContainer) return;
  sortInitialized = true;

  tasksContainer.addEventListener("pointerdown", onSortPointerDown);
  document.addEventListener("pointermove", onSortPointerMove);
  document.addEventListener("pointerup", onSortPointerUp);
  document.addEventListener("pointercancel", onSortPointerUp);
}

function onSortPointerDown(e) {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;

  const card = handle.closest(".task-card");
  if (!card || !tasksContainer.contains(card)) return;

  if (e.pointerType === "mouse" && e.button !== 0) return;

  sortPointerId = e.pointerId;
  sortActiveCard = card;
  sortStartY = e.clientY;
  sortLastClientX = e.clientX;
  sortLastClientY = e.clientY;
  sortMoved = false;

  card.classList.add("dragging");
  document.body.classList.add("is-sorting");
  handle.setPointerCapture?.(e.pointerId);

  e.preventDefault();
  startAutoScrollLoop();
}

function onSortPointerMove(e) {
  if (sortPointerId === null || e.pointerId !== sortPointerId) return;
  if (!sortActiveCard) return;

  e.preventDefault();
  sortLastClientX = e.clientX;
  sortLastClientY = e.clientY;

  if (Math.abs(e.clientY - sortStartY) > 4) {
    sortMoved = true;
  }

  updateCardUnderPointer(sortLastClientX, sortLastClientY);
}

function updateCardUnderPointer(clientX, clientY) {
  if (!sortActiveCard) return;

  sortActiveCard.style.pointerEvents = "none";
  const el = document.elementFromPoint(clientX, clientY);
  sortActiveCard.style.pointerEvents = "";

  const overCard = el?.closest?.(".task-card");

  tasksContainer
    .querySelectorAll(".task-card.drag-over")
    .forEach((c) => c.classList.remove("drag-over"));

  if (
    overCard &&
    overCard !== sortActiveCard &&
    tasksContainer.contains(overCard)
  ) {
    overCard.classList.add("drag-over");
    const rect = overCard.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    if (before) {
      tasksContainer.insertBefore(sortActiveCard, overCard);
    } else {
      tasksContainer.insertBefore(sortActiveCard, overCard.nextSibling);
    }
  }
}

/* Auto-scroll the page while dragging near top/bottom edges */
function startAutoScrollLoop() {
  stopAutoScrollLoop();

  const EDGE = 70; // px from viewport edge to trigger scroll
  const MAX_SPEED = 18; // px per frame

  const tick = () => {
    if (!sortActiveCard) {
      sortAutoScrollRAF = null;
      return;
    }

    const y = sortLastClientY;
    const vh = window.innerHeight;
    let dy = 0;

    if (y < EDGE) {
      // Closer to edge = faster scroll
      dy = -MAX_SPEED * (1 - y / EDGE);
    } else if (y > vh - EDGE) {
      dy = MAX_SPEED * (1 - (vh - y) / EDGE);
    }

    if (dy !== 0) {
      window.scrollBy(0, dy);
      // After scroll, re-evaluate which card is under the pointer
      updateCardUnderPointer(sortLastClientX, sortLastClientY);
    }

    sortAutoScrollRAF = requestAnimationFrame(tick);
  };

  sortAutoScrollRAF = requestAnimationFrame(tick);
}

function stopAutoScrollLoop() {
  if (sortAutoScrollRAF != null) {
    cancelAnimationFrame(sortAutoScrollRAF);
    sortAutoScrollRAF = null;
  }
}

function onSortPointerUp(e) {
  if (sortPointerId === null || e.pointerId !== sortPointerId) return;

  stopAutoScrollLoop();

  if (sortActiveCard) {
    sortActiveCard.classList.remove("dragging");
    sortActiveCard.style.pointerEvents = "";
  }
  tasksContainer
    .querySelectorAll(".task-card.drag-over")
    .forEach((c) => c.classList.remove("drag-over"));
  document.body.classList.remove("is-sorting");

  const didMove = sortMoved;
  sortPointerId = null;
  sortActiveCard = null;
  sortMoved = false;

  if (didMove) {
    persistDomOrder();
  }
}

function persistDomOrder() {
  const cards = [...tasksContainer.querySelectorAll(".task-card")];
  if (cards.length === 0) return;

  const orderedIds = cards.map((c) => String(c.dataset.taskId));
  const orderMap = new Map();
  orderedIds.forEach((id, i) => orderMap.set(id, i + 1));

  // Tasks filtered out of the current view stay after the visible ones
  const hidden = tasks
    .filter((t) => t.project === activeProject && !orderMap.has(String(t.id)))
    .sort(compareTasksOrder);
  let next = orderedIds.length + 1;
  for (const t of hidden) {
    orderMap.set(String(t.id), next++);
  }

  for (const t of tasks) {
    if (t.project === activeProject && orderMap.has(String(t.id))) {
      t.order = orderMap.get(String(t.id));
    }
  }

  // Always re-render so sort order is applied cleanly
  renderTasks();

  const toSave = tasks.filter(
    (t) => t.project === activeProject && orderMap.has(String(t.id)),
  );
  Promise.all(toSave.map((t) => saveTaskToFirestore(t))).catch((err) =>
    console.error("Failed saving task order:", err),
  );
}

async function updateTaskStatus(taskId, newStatus) {
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = newStatus;
    await saveTaskToFirestore(task);
    renderTasks();
    updateStats();
  }
}

async function deleteTask(taskId) {
  if (!confirm("האם אתה בטוח שברצונך למחוק משימה זו?")) return;

  tasks = tasks.filter((t) => t.id !== taskId);
  await deleteTaskFromFirestore(taskId);
  renderTasks();
  updateStats();
}

function openEditTaskModal(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  document.getElementById("editTaskId").value = task.id;
  document.getElementById("editTaskTitle").value = task.title;
  document.getElementById("editTaskNote").value = task.note || "";
  document.getElementById("editTaskProject").value = task.project;
  document.getElementById("editTaskPriority").value = task.priority;
  document.getElementById("editTaskDueDate").value = task.dueDate || "";

  openModal("editTaskModal");
}

async function saveEditedTask(e) {
  e.preventDefault();
  const id = document.getElementById("editTaskId").value;
  const task = tasks.find((t) => t.id === id);

  if (task) {
    task.title = document.getElementById("editTaskTitle").value.trim();
    task.note = document.getElementById("editTaskNote").value.trim() || null;
    task.project = document.getElementById("editTaskProject").value;
    task.priority = document.getElementById("editTaskPriority").value;
    task.dueDate = document.getElementById("editTaskDueDate").value || null;

    await saveTaskToFirestore(task);
    closeModal("editTaskModal");
    switchProject(task.project);
    updateStats();
  }
}

/* Note edit / delete */
function openEditNoteModal(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  document.getElementById("editNoteTaskId").value = task.id;
  document.getElementById("editNoteText").value = task.note || "";
  openModal("editNoteModal");
}

async function saveNote(e) {
  e.preventDefault();
  const id = document.getElementById("editNoteTaskId").value;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.note = document.getElementById("editNoteText").value.trim() || null;
  await saveTaskToFirestore(task);
  closeModal("editNoteModal");
  renderTasks();
}

async function deleteNote(taskId) {
  if (!confirm("האם למחוק את ההערה?")) return;

  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.note = null;
  await saveTaskToFirestore(task);
  renderTasks();
}

/* ==========================================================================
   Search & Stats
   ========================================================================== */
function handleSearch() {
  searchQuery = searchInput.value;
  clearSearchBtn.style.display = searchQuery.length > 0 ? "block" : "none";
  renderTasks();
}

function clearSearch() {
  searchInput.value = "";
  searchQuery = "";
  clearSearchBtn.style.display = "none";
  searchInput.focus();
  renderTasks();
}

function updateStats() {
  document.getElementById("statTotal").innerText = tasks.length;
  document.getElementById("statCompleted").innerText = tasks.filter(
    (t) => t.status === "completed",
  ).length;
  document.getElementById("statInProgress").innerText = tasks.filter(
    (t) => t.status === "in-progress",
  ).length;
  document.getElementById("statUrgent").innerText = tasks.filter(
    (t) => t.priority === "high" && t.status !== "completed",
  ).length;
}

/* ==========================================================================
   Theme
   ========================================================================== */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("tasks_app_theme", newTheme);

  themeToggleBtn.querySelector(".btn-text").innerText =
    newTheme === "dark" ? "מצב בהיר" : "מצב כהה";
  themeToggleBtn.querySelector("i").className =
    newTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function initTheme() {
  const savedTheme = localStorage.getItem("tasks_app_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggleBtn.querySelector(".btn-text").innerText =
    savedTheme === "dark" ? "מצב בהיר" : "מצב כהה";
  themeToggleBtn.querySelector("i").className =
    savedTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

/* ==========================================================================
   Backup / Restore (JSON export-import, then sync to Firestore)
   ========================================================================== */
function exportData() {
  const backupData = {
    projects: projects,
    tasks: tasks,
  };
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `tasks_backup_${new Date().toISOString().split("T")[0]}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

async function importData(event) {
  const fileReader = new FileReader();
  fileReader.onload = async function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (importedData.tasks && importedData.projects) {
        tasks = importedData.tasks;
        projects = importedData.projects;
      } else if (Array.isArray(importedData)) {
        tasks = importedData;
      }

      // Sync everything to Firestore
      for (const proj of projects) {
        await saveProjectToFirestore(proj);
      }
      for (const task of tasks) {
        await saveTaskToFirestore(task);
      }

      switchProject(projects[0] || "פרויקט כללי");
      updateStats();
      closeModal("backupModal");
      alert("הנתונים שוחזרו בהצלחה!");
    } catch (err) {
      alert("שגיאה בקריאת הקובץ. אנא ודא שהקובץ בפורמט JSON תקין.");
    }
  };
  if (event.target.files[0]) {
    fileReader.readAsText(event.target.files[0]);
  }
}

/* ==========================================================================
   Modal Helpers
   ========================================================================== */
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

/* ==========================================================================
   Security
   ========================================================================== */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m];
  });
}

// Expose functions used by inline onclick handlers (needed because of type="module")
window.switchProject = switchProject;
window.openAddProjectModal = openAddProjectModal;
window.handleCreateProject = handleCreateProject;
window.openEditProjectModal = openEditProjectModal;
window.handleSaveEditedProject = handleSaveEditedProject;
window.deleteCurrentProject = deleteCurrentProject;
window.handleAddTask = handleAddTask;
window.updateTaskStatus = updateTaskStatus;
window.deleteTask = deleteTask;
window.openEditTaskModal = openEditTaskModal;
window.saveEditedTask = saveEditedTask;
window.openEditNoteModal = openEditNoteModal;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.toggleClamp = toggleClamp;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.openModal = openModal;
window.closeModal = closeModal;
window.exportData = exportData;
window.importData = importData;
