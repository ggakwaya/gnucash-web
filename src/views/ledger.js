/**
 * GnuCash Web — General Ledger / Journal View
 * AG Grid Community with filtering, pagination, and transaction details.
 */

import { createGrid } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { getTransactions, getAccountList, getTransactionSplits } from '../db.js';
import { formatCAD, formatDate } from '../utils.js';

ModuleRegistry.registerModules([AllCommunityModule]);

let gridApi = null;

const myDarkTheme = themeQuartz.withParams({
  accentColor: '#6c8cff',
  backgroundColor: '#0e0e1e',
  borderColor: 'rgba(255, 255, 255, 0.06)',
  browserColorScheme: 'dark',
  chromeBackgroundColor: 'rgba(18, 18, 42, 0.8)',
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  foregroundColor: '#e8eaf0',
  headerBackgroundColor: 'rgba(18, 18, 42, 0.8)',
  headerFontWeight: 600,
  headerTextColor: '#8b8fa8',
  oddRowBackgroundColor: 'rgba(14, 14, 30, 0.5)',
  rowHoverColor: 'rgba(108, 140, 255, 0.06)',
  selectedRowBackgroundColor: 'rgba(108, 140, 255, 0.1)',
  spacing: 6,
});

/**
 * Render the ledger view.
 */
export async function renderLedger(container) {
  // Clean up previous grid
  if (gridApi) {
    gridApi.destroy();
    gridApi = null;
  }

  const accounts = getAccountList();

  // Check for navigation params (from account tree click)
  const navParams = window.__navParams || {};
  window.__navParams = {};

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Grand livre / Journal</h2>
      <p class="view-subtitle">Toutes les transactions — Filtrable et triable</p>
    </div>

    <div class="glass-card" style="padding: var(--space-md) var(--space-lg); margin-bottom: var(--space-lg);">
      <div class="ledger-filters">
        <div class="filter-group">
          <label class="filter-label" for="filter-start-date">Date début</label>
          <input type="date" id="filter-start-date" class="filter-input" value="2025-01-01" />
        </div>
        <div class="filter-group">
          <label class="filter-label" for="filter-end-date">Date fin</label>
          <input type="date" id="filter-end-date" class="filter-input" value="2025-12-31" />
        </div>
        <div class="filter-group">
          <label class="filter-label" for="filter-account">Compte</label>
          <select id="filter-account" class="filter-select">
            <option value="">Tous les comptes</option>
            ${accounts.map(a => `<option value="${a.guid}" ${a.guid === navParams.accountGuid ? 'selected' : ''}>${a.name} (${a.account_type})</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="filter-search">Recherche</label>
          <input type="text" id="filter-search" class="filter-input" placeholder="Description…" />
        </div>
      </div>
    </div>

    <div class="ledger-grid-container">
      <div id="ledger-grid" style="height: calc(100vh - 370px); width: 100%;"></div>
    </div>

    <div class="ledger-stats" id="ledger-stats"></div>
  `;

  // Load data
  const filters = {
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    accountGuid: navParams.accountGuid || '',
    search: '',
  };

  const transactions = getTransactions(filters);
  initGrid(transactions);
  updateStats(transactions);

  // Filter event listeners
  const startDate = document.getElementById('filter-start-date');
  const endDate = document.getElementById('filter-end-date');
  const accountSelect = document.getElementById('filter-account');
  const searchInput = document.getElementById('filter-search');

  let searchTimeout;
  const applyFilters = () => {
    const f = {
      startDate: startDate.value,
      endDate: endDate.value,
      accountGuid: accountSelect.value,
      search: searchInput.value,
    };
    const data = getTransactions(f);
    gridApi.setGridOption('rowData', data);
    updateStats(data);
  };

  startDate.addEventListener('change', applyFilters);
  endDate.addEventListener('change', applyFilters);
  accountSelect.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
  });
}

/**
 * Initialize AG Grid with transaction data.
 */
function initGrid(data) {
  const gridDiv = document.getElementById('ledger-grid');

  const columnDefs = [
    {
      headerName: 'Date',
      field: 'post_date',
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
      sort: 'desc',
      filter: false,
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 2,
      minWidth: 220,
      filter: false,
    },
    {
      headerName: 'Compte Dt',
      field: 'debit_accounts',
      flex: 1,
      minWidth: 150,
      filter: false,
      cellStyle: { color: '#8b8fa8', fontSize: '12px' },
      valueFormatter: (p) => p.value || '—',
    },
    {
      headerName: 'Compte Ct',
      field: 'credit_accounts',
      flex: 1,
      minWidth: 150,
      filter: false,
      cellStyle: { color: '#8b8fa8', fontSize: '12px' },
      valueFormatter: (p) => p.value || '—',
    },
    {
      headerName: 'Débit',
      field: 'debit',
      width: 120,
      type: 'rightAligned',
      valueFormatter: (p) => p.value > 0 ? formatCAD(p.value) : '',
      cellClass: 'amount-positive',
      filter: false,
    },
    {
      headerName: 'Crédit',
      field: 'credit',
      width: 120,
      type: 'rightAligned',
      valueFormatter: (p) => p.value > 0 ? formatCAD(p.value) : '',
      cellClass: 'amount-negative',
      filter: false,
    },
  ];

  const gridOptions = {
    theme: myDarkTheme,
    columnDefs,
    rowData: data,
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100, 200],
    animateRows: true,
    rowSelection: { mode: 'singleRow', enableClickSelection: true },
    defaultColDef: {
      sortable: true,
      resizable: true,
    },
    getRowId: (params) => params.data.tx_guid,
    suppressCellFocus: true,
  };

  gridApi = createGrid(gridDiv, gridOptions);
}

/**
 * Update the stats bar below the grid.
 */
function updateStats(data) {
  const statsEl = document.getElementById('ledger-stats');
  const totalDebit = data.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = data.reduce((sum, t) => sum + (t.credit || 0), 0);

  statsEl.innerHTML = `
    <span><span class="stat-value">${data.length}</span> transactions</span>
    <span>Total débits : <span class="stat-value amount-positive">${formatCAD(totalDebit)}</span></span>
    <span>Total crédits : <span class="stat-value amount-negative">${formatCAD(totalCredit)}</span></span>
  `;
}
