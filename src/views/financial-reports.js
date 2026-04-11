import { getAccountBalancesAsOf, getAccountBalancesDelta } from '../db.js';
import { formatCAD } from '../utils.js';

let currentDateStart = '2025-01-01';
let currentDateEnd = '2025-12-31';
let activeTab = 'tab-pl';
let isolateSbqc = false;

export async function renderFinancialReports(container) {
  renderLayout(container);
  attachEvents(container);
  renderActiveTab();
}

function renderLayout(container) {
  container.innerHTML = `
    <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <h2 class="view-title">États Financiers</h2>
        <p class="view-subtitle">Rapports comptables traditionnels basés sur la période sélectionnée</p>
      </div>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        <div class="filter-group">
          <label class="filter-label" style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Du</label>
          <input type="date" id="fr-start-date" class="filter-input" value="${currentDateStart}" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-card);">
        </div>
        <div class="filter-group">
          <label class="filter-label" style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Au</label>
          <input type="date" id="fr-end-date" class="filter-input" value="${currentDateEnd}" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-card);">
        </div>
        <button id="fr-btn-print" class="sidebar-btn" style="margin-top: 18px; width: auto; background: var(--accent-primary); color: white; border: none;">
          📄 Imprimer / PDF
        </button>
      </div>
    </div>
    
    <div class="glass-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
      <!-- TABS HEADER -->
      <div style="display: flex; border-bottom: 1px solid var(--border-card); background: var(--bg-body);">
        <button class="fr-tab ${activeTab === 'tab-pl' ? 'active' : ''}" data-target="tab-pl">État des Résultats</button>
        <button class="fr-tab ${activeTab === 'tab-bs' ? 'active' : ''}" data-target="tab-bs">Bilan</button>
        <button class="fr-tab ${activeTab === 'tab-eq' ? 'active' : ''}" data-target="tab-eq">Capitaux Propres</button>
        <button class="fr-tab ${activeTab === 'tab-cf' ? 'active' : ''}" data-target="tab-cf">Flux de Trésorerie</button>
      </div>
      
      <!-- TABS CONTENT -->
      <div id="fr-tab-content" style="padding: var(--space-xl); background: var(--bg-card); min-height: 50vh;">
        <!-- Dynamically injected -->
      </div>
    </div>
    
    <style>
      .fr-tab {
        flex: 1;
        padding: 1rem;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .fr-tab:hover {
        background: rgba(44, 160, 28, 0.05);
        color: var(--text-primary);
      }
      .fr-tab.active {
        color: var(--accent-primary);
        border-bottom-color: var(--accent-primary);
        background: var(--bg-card);
      }
      .fr-section-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--border-card);
      }
      .fr-table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-family: var(--font-sans); }
      .fr-table td { padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); }
      .fr-table .fr-indent { padding-left: 2rem; color: var(--text-secondary); font-size: 0.9rem; }
      .fr-table .fr-subtotal td { font-weight: 600; border-top: 1px dashed var(--border-card); background: #f9fafb; font-size: 0.95rem; }
      .fr-table .fr-total td { font-weight: 700; border-top: 2px solid var(--border-card); background: #f4f5f8; font-size: 1.05rem; }
      
      @media print {
        .sidebar { display: none !important; }
        .view-header .filter-group { display: none !important; }
        #fr-btn-print { display: none !important; }
        .fr-tab:not(.active) { display: none !important; }
        .fr-tab.active { border: none; font-size: 1.5rem; color: #000; padding: 0; margin-bottom: 2rem; background: transparent; }
        .glass-card { box-shadow: none; border: none; }
        #fr-tab-content { padding: 0; }
        body { background: white; }
        #app { display: block; overflow: visible; height: auto; }
        .main-content { overflow: visible; height: auto; }
      }
    </style>
  `;
}

function attachEvents(container) {
  const tabs = container.querySelectorAll('.fr-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeTab = e.target.getAttribute('data-target');
      renderActiveTab();
    });
  });

  const startDateInput = document.getElementById('fr-start-date');
  const endDateInput = document.getElementById('fr-end-date');

  startDateInput.addEventListener('change', (e) => {
    currentDateStart = e.target.value;
    renderActiveTab();
  });

  endDateInput.addEventListener('change', (e) => {
    currentDateEnd = e.target.value;
    renderActiveTab();
  });

  document.getElementById('fr-btn-print').addEventListener('click', () => {
    window.print();
  });
}

function renderActiveTab() {
  const content = document.getElementById('fr-tab-content');
  if (!content) return;
  
  if (activeTab === 'tab-pl') renderPL(content);
  if (activeTab === 'tab-bs') renderBalanceSheet(content);
  if (activeTab === 'tab-eq') renderEquity(content);
  if (activeTab === 'tab-cf') renderCashFlow(content);
}

// ======================== TAB RENDERS ========================

function renderPL(container) {
  const deltas = getAccountBalancesDelta(currentDateStart, currentDateEnd);
  
  let incomeHTML = '';
  let expenseHTML = '';
  let totalIncome = 0;
  let totalExpense = 0;

  // Render toggle for SBQC filter
  let toggleHTML = `
    <div style="margin-bottom: 1.5rem; display: flex; justify-content: flex-end;">
      <label class="toggle-switch">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Isoler SplitboardQC (Vente & Location)</span>
        <input type="checkbox" id="fr-toggle-sbqc" ${isolateSbqc ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;

  // Sort and filter logically
  const incomeAccounts = deltas.filter(a => a.account_type === 'INCOME' && Math.abs(a.balance) > 0).sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance));
  const expenseAccounts = deltas.filter(a => a.account_type === 'EXPENSE' && Math.abs(a.balance) > 0).sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance));

  incomeAccounts.forEach(a => {
    const isSbqc = a.code?.startsWith('42') || /sbqc|splitboard/i.test(a.name);
    if(isolateSbqc && !isSbqc) return;
    
    let val = Math.abs(a.balance);
    totalIncome += val;
    incomeHTML += `<tr><td class="fr-indent">${a.name} ${a.code ? '('+a.code+')' : ''}</td><td style="text-align: right;">${formatCAD(val)}</td></tr>`;
  });

  expenseAccounts.forEach(a => {
    const isSbqc = a.code?.startsWith('52') || /sbqc|splitboard|équipement|atelier/i.test(a.name);
    const isCommon = a.code?.startsWith('50') || /commune|general|bancaire/i.test(a.name);
    
    let val = Math.abs(a.balance);
    if(isolateSbqc) {
      if(!isSbqc && !isCommon) return;
      if(isCommon) val = val / 2; // 50% split assumption
    }
    
    totalExpense += val;
    expenseHTML += `<tr><td class="fr-indent">${a.name} ${a.code ? '('+a.code+')' : ''}</td><td style="text-align: right;">${formatCAD(val)}</td></tr>`;
  });

  const netIncome = totalIncome - totalExpense;

  container.innerHTML = `
    ${toggleHTML}
    <h3 class="fr-section-title">Revenus</h3>
    <table class="fr-table">
      ${incomeHTML || '<tr><td colspan="2" class="fr-indent">Aucun revenu pour cette période.</td></tr>'}
      <tr class="fr-subtotal"><td>Total (Revenus)</td><td style="text-align: right;">${formatCAD(totalIncome)}</td></tr>
    </table>
    
    <h3 class="fr-section-title">Dépenses</h3>
    <table class="fr-table">
      ${expenseHTML || '<tr><td colspan="2" class="fr-indent">Aucune dépense pour cette période.</td></tr>'}
      <tr class="fr-subtotal"><td>Total (Dépenses)</td><td style="text-align: right;">${formatCAD(totalExpense)}</td></tr>
    </table>
    
    <table class="fr-table" style="margin-top: 2rem;">
      <tr class="fr-total">
        <td>BÉNÉFICE NET (PERTE)</td>
        <td style="text-align: right; color: ${netIncome >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">${formatCAD(netIncome)}</td>
      </tr>
    </table>
  `;

  document.getElementById('fr-toggle-sbqc').addEventListener('change', (e) => {
    isolateSbqc = e.target.checked;
    renderActiveTab();
  });
}

function renderBalanceSheet(container) {
  // Balance sheet is AS OF the end date.
  const balances = getAccountBalancesAsOf(currentDateEnd);
  
  let assetsHtml = '';
  let liabHtml = '';
  let equityHtml = '';

  let totalAssets = 0;
  let totalLiab = 0;
  let totalEquity = 0;

  // Groupings based on GnuCash mapping (GnuCash Assets are usually positive (debit), Liab/Equity are negative (credit))
  balances.forEach(a => {
    let type = a.account_type;
    let bal = a.balance; // Asset > 0 is debit
    if(Math.abs(bal) < 0.01) return;

    if (['ASSET', 'BANK', 'CASH', 'RECEIVABLE', 'MUTUAL'].includes(type)) {
      totalAssets += bal;
      assetsHtml += `<tr><td class="fr-indent">${a.name}</td><td style="text-align: right;">${formatCAD(bal)}</td></tr>`;
    } 
    else if (['LIABILITY', 'CREDIT', 'PAYABLE'].includes(type)) {
      let dispBal = -bal; // Credit is negative in DB, display positive for Liab
      totalLiab += dispBal;
      liabHtml += `<tr><td class="fr-indent">${a.name}</td><td style="text-align: right;">${formatCAD(dispBal)}</td></tr>`;
    }
    else if (['EQUITY'].includes(type)) {
      let dispBal = -bal; // Credit is negative
      totalEquity += dispBal;
      equityHtml += `<tr><td class="fr-indent">${a.name}</td><td style="text-align: right;">${formatCAD(dispBal)}</td></tr>`;
    }
  });

  // Calculate Retained Earnings (Net Income of all time)
  // Which is Income - Expenses of all time up to currentDateEnd
  const incomeBalances = balances.filter(a => a.account_type === 'INCOME').reduce((s, a) => s + Math.abs(a.balance), 0);
  const expenseBalances = balances.filter(a => a.account_type === 'EXPENSE').reduce((s, a) => s + Math.abs(a.balance), 0);
  const retainedEarnings = incomeBalances - expenseBalances;
  
  totalEquity += retainedEarnings;
  equityHtml += `<tr><td class="fr-indent"><strong>Bénéfice Net (et reporté)</strong></td><td style="text-align: right;"><strong>${formatCAD(retainedEarnings)}</strong></td></tr>`;

  container.innerHTML = `
    <h3 class="fr-section-title">Actif</h3>
    <table class="fr-table">
      ${assetsHtml || '<tr><td colspan="2" class="fr-indent">Aucun actif.</td></tr>'}
      <tr class="fr-total"><td>Total de l'Actif</td><td style="text-align: right;">${formatCAD(totalAssets)}</td></tr>
    </table>
    
    <h3 class="fr-section-title">Passif</h3>
    <table class="fr-table">
      ${liabHtml || '<tr><td colspan="2" class="fr-indent">Aucun passif.</td></tr>'}
      <tr class="fr-subtotal"><td>Total du Passif</td><td style="text-align: right;">${formatCAD(totalLiab)}</td></tr>
    </table>
    
    <h3 class="fr-section-title">Capitaux Propres</h3>
    <table class="fr-table">
      ${equityHtml || '<tr><td colspan="2" class="fr-indent">Aucune équité.</td></tr>'}
      <tr class="fr-subtotal"><td>Total des Capitaux Propres</td><td style="text-align: right;">${formatCAD(totalEquity)}</td></tr>
    </table>
    
    <table class="fr-table" style="margin-top: 2rem;">
      <tr class="fr-total">
        <td>TOTAL PASSIF ET CAPITAUX PROPRES</td>
        <td style="text-align: right;">${formatCAD(totalLiab + totalEquity)}</td>
      </tr>
    </table>
  `;
}

function renderEquity(container) {
  const deltas = getAccountBalancesDelta(currentDateStart, currentDateEnd);
  // Opening equity = As of (startDate - 1 day)
  const prevDate = new Date(currentDateStart);
  prevDate.setDate(prevDate.getDate() - 1);
  const openingBalances = getAccountBalancesAsOf(prevDate.toISOString().split('T')[0]);
  
  let openingNetIncome = openingBalances.filter(a => a.account_type === 'INCOME').reduce((s, a) => s + Math.abs(a.balance), 0) - openingBalances.filter(a => a.account_type === 'EXPENSE').reduce((s, a) => s + Math.abs(a.balance), 0);
  let openingEquityRaw = openingBalances.filter(a => a.account_type === 'EQUITY').reduce((s, a) => s + (-a.balance), 0);
  let openingEquityTotal = openingEquityRaw + openingNetIncome;

  let periodNetIncome = deltas.filter(a => a.account_type === 'INCOME').reduce((s, a) => s + Math.abs(a.balance), 0) - deltas.filter(a => a.account_type === 'EXPENSE').reduce((s, a) => s + Math.abs(a.balance), 0);
  
  let equityHTML = '';
  let periodEquityDeltas = 0;

  deltas.filter(a => a.account_type === 'EQUITY' && Math.abs(a.balance) > 0).forEach(a => {
    let dispBal = -a.balance; // Credit is positive for equity
    periodEquityDeltas += dispBal;
    equityHTML += `<tr><td class="fr-indent">${dispBal >= 0 ? 'Apport' : 'Retrait'} : ${a.name}</td><td style="text-align: right;">${formatCAD(dispBal)}</td></tr>`;
  });

  const closingEquity = openingEquityTotal + periodNetIncome + periodEquityDeltas;

  container.innerHTML = `
    <h3 class="fr-section-title">État des Capitaux Propres</h3>
    <table class="fr-table">
      <tr>
        <td><strong>Solde d'ouverture (${currentDateStart})</strong></td>
        <td style="text-align: right;"><strong>${formatCAD(openingEquityTotal)}</strong></td>
      </tr>
      <tr>
        <td class="fr-indent" style="padding-top: 1rem;">Bénéfice Net de la période</td>
        <td style="text-align: right; padding-top: 1rem;">${formatCAD(periodNetIncome)}</td>
      </tr>
      ${equityHTML}
      <tr class="fr-total" style="margin-top: 2rem;">
        <td>SOLDE DE CLÔTURE (${currentDateEnd})</td>
        <td style="text-align: right;">${formatCAD(closingEquity)}</td>
      </tr>
    </table>
  `;
}

function renderCashFlow(container) {
  // Opening Cash
  const prevDate = new Date(currentDateStart);
  prevDate.setDate(prevDate.getDate() - 1);
  const openingBalances = getAccountBalancesAsOf(prevDate.toISOString().split('T')[0]);
  let openingCash = openingBalances.filter(a => ['BANK', 'CASH'].includes(a.account_type)).reduce((s, a) => s + a.balance, 0);

  // Closing Cash
  const closingBalances = getAccountBalancesAsOf(currentDateEnd);
  let closingCash = closingBalances.filter(a => ['BANK', 'CASH'].includes(a.account_type)).reduce((s, a) => s + a.balance, 0);

  // Detail variants inside the period
  const deltas = getAccountBalancesDelta(currentDateStart, currentDateEnd);
  let cashAccountsHTML = '';
  
  deltas.filter(a => ['BANK', 'CASH'].includes(a.account_type) && Math.abs(a.balance) > 0).forEach(a => {
    cashAccountsHTML += `<tr><td class="fr-indent">${a.name}</td><td style="text-align: right;">${formatCAD(a.balance)}</td></tr>`;
  });

  container.innerHTML = `
    <h3 class="fr-section-title">Flux de Trésorerie (Simplifié)</h3>
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
      Les flux de trésorerie présentent l'évolution absolue des liquidités et comptes bancaires pour la période.
    </p>
    
    <table class="fr-table">
      <tr>
        <td><strong>Encaisse au début (${currentDateStart})</strong></td>
        <td style="text-align: right;"><strong>${formatCAD(openingCash)}</strong></td>
      </tr>
      
      <tr><td colspan="2" style="padding-top: 1.5rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 0.8rem;">Variations des comptes bancaires</td></tr>
      ${cashAccountsHTML || '<tr><td colspan="2" class="fr-indent">Aucun mouvement net identifié.</td></tr>'}
      
      <tr class="fr-subtotal">
        <td>Variation Nette</td>
        <td style="text-align: right;">${formatCAD(closingCash - openingCash)}</td>
      </tr>
      
      <tr class="fr-total">
        <td>ENCAISSE À LA FIN (${currentDateEnd})</td>
        <td style="text-align: right;">${formatCAD(closingCash)}</td>
      </tr>
    </table>
  `;
}
