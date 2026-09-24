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

    // Load Tasks
    const tasksSnapshot = await getDocs(collection(db, "tasks"));
    tasks = tasksSnapshot.docs.map((d) => d.data());

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
  const projectInput = document.getElementById("taskProject");
  const priorityInput = document.getElementById("taskPriority");
  const dueDateInput = document.getElementById("taskDueDate");

  const newTask = {
    id: Date.now().toString(),
    title: titleInput.value.trim(),
    project: projectInput.value,
    priority: priorityInput.value,
    status: "todo",
    createdAt: new Date().toISOString().split("T")[0],
    dueDate: dueDateInput.value || null,
  };

  tasks.unshift(newTask);
  await saveTaskToFirestore(newTask);

  titleInput.value = "";
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
    filteredTasks = filteredTasks.filter((task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }

  const priorityMap = { high: 1, medium: 2, low: 3 };
  filteredTasks.sort(
    (a, b) => priorityMap[a.priority] - priorityMap[b.priority],
  );

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

    const priorityLabels = { high: "עליונה", medium: "רגילה", low: "נמוכה" };

    taskCard.innerHTML = `
            <div class="task-main-content">
                <span class="task-title-text ${task.status === "completed" ? "completed-text" : ""}">${escapeHtml(task.title)}</span>
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
    task.project = document.getElementById("editTaskProject").value;
    task.priority = document.getElementById("editTaskPriority").value;
    task.dueDate = document.getElementById("editTaskDueDate").value || null;

    await saveTaskToFirestore(task);
    closeModal("editTaskModal");
    switchProject(task.project);
    updateStats();
  }
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
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.openModal = openModal;
window.closeModal = closeModal;
window.exportData = exportData;
window.importData = importData;
