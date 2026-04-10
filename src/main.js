/**
 * GnuCash Web — Application Entry Point
 * Initializes sql.js, registers routes, starts the router.
 * Supports drag-and-drop to load any .gnucash file.
 */

import './styles/index.css';
import { initDatabase, loadDatabaseFromBuffer, getDatabaseInfo } from './db.js';
import { registerRoute, initRouter } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderAccounts } from './views/accounts.js';
import { renderLedger } from './views/ledger.js';
import { renderReport2025 } from './views/report2025.js';

let routerStarted = false;

async function bootstrap() {
  try {
    // Initialize the database from public/
    await initDatabase();
    onDatabaseReady();
  } catch (error) {
    console.error("Erreur d'initialisation :", error);
    showDropZone('Aucune base de données par défaut. Glissez-déposez un fichier .gnucash pour commencer.');
  }
}

/**
 * Called whenever a database is (re)loaded.
 */
function onDatabaseReady(fileName) {
  // Update DB info in sidebar
  const dbInfo = getDatabaseInfo();
  const dbInfoEl = document.getElementById('db-info');
  const label = fileName
    ? `${fileName} · ${dbInfo.transactionCount} tx`
    : `${dbInfo.transactionCount} tx · ${dbInfo.accountCount} comptes · ${dbInfo.minDate.substring(0, 4)}`;
  dbInfoEl.innerHTML = `
    <span class="db-icon">💾</span>
    <span class="db-label">${label}</span>
  `;

  // Register views (idempotent)
  registerRoute('dashboard', renderDashboard);
  registerRoute('accounts', renderAccounts);
  registerRoute('ledger', renderLedger);
  registerRoute('report-2025', renderReport2025);

  // Hide loading, show content
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('view-container').style.display = 'block';

  if (!routerStarted) {
    initRouter();
    routerStarted = true;
  } else {
    // Re-render current view by re-triggering hashchange
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

/**
 * Show the drop zone overlay (when no DB or for drag-and-drop hint).
 */
function showDropZone(message) {
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('loading-screen').innerHTML = `
    <div class="loader-container">
      <div class="drop-zone-icon">📂</div>
      <p class="loader-text">${message || 'Glissez-déposez un fichier .gnucash'}</p>
      <button id="drop-zone-upload" class="sidebar-btn" style="width: auto; margin-top: 1rem;">
        Choisir un fichier…
      </button>
      <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">
        Format SQLite uniquement
      </p>
    </div>
  `;
  document.getElementById('view-container').style.display = 'none';

  // Add listener for the button in the drop zone
  document.getElementById('drop-zone-upload').addEventListener('click', () => {
    document.getElementById('file-picker').click();
  });
}

/* ============================================================
   File Picker Setup
   ============================================================ */

function setupFilePicker() {
  const picker = document.getElementById('file-picker');
  const btn = document.getElementById('import-btn');

  btn.addEventListener('click', () => {
    picker.click();
  });

  picker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.gnucash')) {
        alert('Veuillez choisir un fichier .gnucash');
        return;
      }
      loadFile(file);
      // Reset picker so the same file can be picked again if needed
      picker.value = '';
    }
  });
}

/* ============================================================
   Drag-and-Drop Setup
   ============================================================ */

function setupDragAndDrop() {
  const overlay = document.getElementById('drop-overlay');
  let dragCounter = 0;

  // Prevent browser default file open behavior
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) {
      overlay.classList.add('visible');
    }
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      overlay.classList.remove('visible');
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    overlay.classList.remove('visible');

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.gnucash')) {
      alert('Veuillez déposer un fichier .gnucash');
      return;
    }

    await loadFile(file);
  });
}

/**
 * Load a .gnucash file from a File object.
 */
async function loadFile(file) {
  // Show loading state
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('loading-screen').innerHTML = `
    <div class="loader-container">
      <div class="loader-spinner"></div>
      <p class="loader-text">Chargement de ${file.name}…</p>
    </div>
  `;
  document.getElementById('view-container').style.display = 'none';

  try {
    const arrayBuffer = await file.arrayBuffer();
    await loadDatabaseFromBuffer(arrayBuffer);
    onDatabaseReady(file.name);
  } catch (error) {
    console.error('Erreur de chargement :', error);
    document.getElementById('loading-screen').innerHTML = `
      <div class="loader-container">
        <p class="loader-text" style="color: var(--color-negative);">
          ❌ Erreur : ${error.message}
        </p>
      </div>
    `;
  }
}

// Boot
setupDragAndDrop();
setupFilePicker();
bootstrap();
