/**
 * Main Tasks & Projects Management Logic
 */

// Application State Initializer
let projects = JSON.parse(localStorage.getItem("tasks_app_projects")) || [
  "חילוץ והקראת טקסט",
  "פרויקט 2",
  "פרויקט 3",
];

let tasks = JSON.parse(localStorage.getItem("tasks_app_data")) || [
  {
    id: "1",
    title:
      "לוודא בכמה שפות יש תמיכה בהקשר של חילוץ והקראת טקסט ולבדוק כל אחת מהאופציות עם טקסט והקראתו בכל אחת מהשפות",
    project: "חילוץ והקראת טקסט",
    priority: "medium",
    status: "todo",
    createdAt: "2026-09-24",
    dueDate: "2026-09-24",
  },
];

let activeProject = projects[0] || "פרויקט כללי";
let activeStatusFilter = "all";
let searchQuery = "";

// DOM Elements Reference Variables
const tasksContainer = document.getElementById("tasksContainer");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const backupBtn = document.getElementById("backupBtn");
const installAppBtn = document.getElementById("installAppBtn");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");

// Primary Application Load Handler
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();
  renderProjectsUI();
  renderTasks();
  updateStats();
});

/* Event Listeners Initialization */
function setupEventListeners() {
  // Project Tab Buttons Switcher
  document.getElementById("projectTabs").addEventListener("click", (e) => {
    if (e.target.classList.contains("tab-btn")) {
      switchProject(e.target.dataset.project);
    }
  });

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

  // PWA Install Event Handler
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installAppBtn.style.display = "inline-flex";
  });

  installAppBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        installAppBtn.style.display = "none";
      }
      deferredPrompt = null;
    } else {
      alert(
        'כדי להוסיף למסך הבית בדפדפן זה, יש ללחוץ על תפריט האפשרויות ולבחור "הוסף למסך הבית".',
      );
    }
  });
}

/* Dynamic Projects Rendering Logic */
function renderProjectsUI() {
  const projectTabsContainer = document.getElementById("projectTabs");
  const taskProjectSelect = document.getElementById("taskProject");
  const editTaskProjectSelect = document.getElementById("editTaskProject");

  // 1. Render Project Tabs
  projectTabsContainer.innerHTML = projects
    .map(
      (proj) => `
        <button class="tab-btn ${proj === activeProject ? "active" : ""}" data-project="${escapeHtml(proj)}">
            ${escapeHtml(proj)}
        </button>
    `,
    )
    .join("");

  // 2. Render Project Select Dropdowns (Form Selects)
  const projectOptionsHtml = projects
    .map(
      (proj) => `
        <option value="${escapeHtml(proj)}">${escapeHtml(proj)}</option>
    `,
    )
    .join("");

  taskProjectSelect.innerHTML = projectOptionsHtml;
  editTaskProjectSelect.innerHTML = projectOptionsHtml;

  // 3. Sync Header Text displaying the active project
  document.getElementById("activeProjectTitleDisplay").innerText =
    activeProject;
}

/* Switch Active Project View */
function switchProject(projectName) {
  activeProject = projectName;
  renderProjectsUI();
  renderTasks();
}

/* Project Creation Logic */
function openAddProjectModal() {
  document.getElementById("newProjectName").value = "";
  openModal("addProjectModal");
}

function handleCreateProject(e) {
  e.preventDefault();
  const newName = document.getElementById("newProjectName").value.trim();

  if (!newName) return;

  if (projects.includes(newName)) {
    alert("פרויקט בשם זה כבר קיים.");
    return;
  }

  projects.push(newName);
  saveProjectsToLocalStorage();

  closeModal("addProjectModal");
  switchProject(newName);
}

/* Project Name Edit Logic */
function openEditProjectModal() {
  document.getElementById("editProjectNameInput").value = activeProject;
  openModal("editProjectModal");
}

function handleSaveEditedProject(e) {
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

  // Update Project name in array
  const index = projects.indexOf(activeProject);
  if (index !== -1) {
    projects[index] = newName;
  }

  // Cascade Update: Update project reference in all associated tasks
  tasks.forEach((task) => {
    if (task.project === activeProject) {
      task.project = newName;
    }
  });

  saveProjectsToLocalStorage();
  saveDataToLocalStorage();

  closeModal("editProjectModal");
  switchProject(newName);
}

/* Project Deletion Logic */
function deleteCurrentProject() {
  if (projects.length <= 1) {
    alert("יש להשאיר לפחות פרויקט אחד קיים במערכת.");
    return;
  }

  if (
    confirm(
      `האם למחוק את הפרויקט "${activeProject}"? כל המשימות השייכות לפרויקט זה יימחקו.`,
    )
  ) {
    // Remove associated tasks
    tasks = tasks.filter((task) => task.project !== activeProject);

    // Remove project from list
    projects = projects.filter((proj) => proj !== activeProject);

    saveProjectsToLocalStorage();
    saveDataToLocalStorage();

    // Switch active view to first remaining project
    switchProject(projects[0]);
    updateStats();
  }
}

/* Task Addition Functionality */
function handleAddTask(e) {
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
  saveDataToLocalStorage();

  // Reset input fields
  titleInput.value = "";
  dueDateInput.value = "";

  // Switch view to created task's project
  switchProject(newTask.project);
  updateStats();
}

/* Main Render Engine Functions */
function renderTasks() {
  let filteredTasks = tasks.filter((task) => task.project === activeProject);

  // Filter by status chip
  if (activeStatusFilter !== "all") {
    filteredTasks = filteredTasks.filter(
      (task) => task.status === activeStatusFilter,
    );
  }

  // Filter by Search Query
  if (searchQuery) {
    filteredTasks = filteredTasks.filter((task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }

  // Sort by priority logic (High > Medium > Low)
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
                <div class="task-header-info">
                    <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
                    <span class="task-title-text ${task.status === "completed" ? "completed-text" : ""}">${escapeHtml(task.title)}</span>
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
                <button class="icon-action-btn" onclick="openEditTaskModal('${task.id}')" title="ערוך משימה">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="icon-action-btn delete-btn" onclick="deleteTask('${task.id}')" title="מחק משימה">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

    tasksContainer.appendChild(taskCard);
  });
}

/* Real-time Status Updaters */
function updateTaskStatus(taskId, newStatus) {
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = newStatus;
    saveDataToLocalStorage();
    renderTasks();
    updateStats();
  }
}

/* Task Deletion Handler */
function deleteTask(taskId) {
  if (confirm("האם אתה בטוח שברצונך למחוק משימה זו?")) {
    tasks = tasks.filter((t) => t.id !== taskId);
    saveDataToLocalStorage();
    renderTasks();
    updateStats();
  }
}

/* Task Editing Modals logic */
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

function saveEditedTask(e) {
  e.preventDefault();
  const id = document.getElementById("editTaskId").value;
  const task = tasks.find((t) => t.id === id);

  if (task) {
    task.title = document.getElementById("editTaskTitle").value.trim();
    task.project = document.getElementById("editTaskProject").value;
    task.priority = document.getElementById("editTaskPriority").value;
    task.dueDate = document.getElementById("editTaskDueDate").value || null;

    saveDataToLocalStorage();
    closeModal("editTaskModal");

    switchProject(task.project);
    updateStats();
  }
}

/* Search Input Controls */
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

/* Statistics Dynamic Aggregator */
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

/* Theme Switching Functions */
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

/* Local Data Backup Export & JSON Import */
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

function importData(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (importedData.tasks && importedData.projects) {
        tasks = importedData.tasks;
        projects = importedData.projects;
      } else if (Array.isArray(importedData)) {
        tasks = importedData;
      }
      saveProjectsToLocalStorage();
      saveDataToLocalStorage();
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

/* Modal Helpers */
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

/* Local Storage Interface Utility */
function saveDataToLocalStorage() {
  localStorage.setItem("tasks_app_data", JSON.stringify(tasks));
}

function saveProjectsToLocalStorage() {
  localStorage.setItem("tasks_app_projects", JSON.stringify(projects));
}

/* Security String Escaper */
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
