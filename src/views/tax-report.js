/**
 * GnuCash Web — Tax Report View (T2125 / TP-80)
 * Generates a structured fiscal report mapped to CRA T2125 lines.
 */

import { getAccountBalancesDelta, getDatabaseInfo } from '../db.js';
import { formatCAD } from '../utils.js';
import {
  t2125Lines,
  accountMap,
  specialRules,
  resolveT2125Line,
  getLinesBySection,
} from '../tax-mapping.js';

let selectedYear = new Date().getFullYear();

export async function renderTaxReport(container) {
  // Detect available years from DB
  const dbInfo = getDatabaseInfo();
  const minYear = parseInt(dbInfo.minDate?.substring(0, 4)) || selectedYear;
  const maxYear = parseInt(dbInfo.maxDate?.substring(0, 4)) || selectedYear;
  if (selectedYear > maxYear) selectedYear = maxYear;

  container.innerHTML = buildLayout(minYear, maxYear);
  attachEvents();
  renderReport();
}

/* ================================================================
   LAYOUT
   ================================================================ */

function buildLayout(minYear, maxYear) {
  let yearOptions = '';
  for (let y = maxYear; y >= minYear; y--) {
    yearOptions += `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`;
  }

  return `
    <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 class="view-title">Rapport fiscal — T2125</h2>
        <p class="view-subtitle">État des résultats d'une entreprise · Formulaire T2125 / TP-80</p>
      </div>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <div class="filter-group">
          <label class="filter-label">Année fiscale</label>
          <select id="tax-year-select" class="filter-select" style="min-width: 100px;">
            ${yearOptions}
          </select>
        </div>
        <button id="tax-btn-print" class="sidebar-btn" style="margin-top: 18px; width: auto; background: var(--accent-primary); color: white; border: none;">
          📄 Imprimer / PDF
        </button>
      </div>
    </div>

    <div class="glass-card" id="tax-report-container" style="padding: var(--space-xl);">
      <!-- Report injected here -->
    </div>

    <style>
      /* ── Tax report table styles ── */
      .tax-table { width: 100%; border-collapse: collapse; font-family: var(--font-sans); margin-bottom: 0.5rem; }
      .tax-table th {
        text-align: left; padding: 8px 12px; font-size: 0.72rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary);
        border-bottom: 2px solid var(--border-card);
      }
      .tax-table th:last-child { text-align: right; }
      .tax-table td { padding: 7px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.9rem; }
      .tax-table td:last-child { text-align: right; font-family: var(--font-mono); font-size: 0.85rem; min-width: 120px; }
      .tax-table tr:hover { background: rgba(44, 160, 28, 0.03); }

      /* Line row (T2125 line) */
      .tax-line-row td { font-weight: 600; }
      .tax-line-row .tax-line-num {
        display: inline-block; background: rgba(44, 160, 28, 0.1); color: var(--accent-primary);
        font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
        margin-right: 6px; font-family: var(--font-mono);
      }
      /* Detail row (GnuCash account under a line) */
      .tax-detail-row td { padding-left: 2.5rem; color: var(--text-secondary); font-size: 0.85rem; font-weight: 400; }
      .tax-detail-row td:last-child { color: var(--text-secondary); }

      /* Subtotal / Total */
      .tax-subtotal td { font-weight: 600; border-top: 1px dashed var(--border-card); background: #f9fafb; }
      .tax-total td { font-weight: 700; border-top: 2px solid var(--border-card); background: #f4f5f8; font-size: 1rem; }
      .tax-total td:last-child { font-size: 1rem; }

      /* Section headers */
      .tax-section-header {
        font-size: 1.1rem; font-weight: 700; color: var(--text-primary);
        margin: 2rem 0 0.75rem 0; padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--border-card);
        display: flex; align-items: center; gap: 0.5rem;
      }
      .tax-section-header:first-child { margin-top: 0; }
      .tax-section-badge {
        font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 999px;
        text-transform: uppercase; letter-spacing: 0.5px;
        background: rgba(44, 160, 28, 0.1); color: var(--accent-primary);
      }

      /* Unmapped warning */
      .tax-unmapped { background: rgba(245, 158, 11, 0.06); }
      .tax-unmapped td { color: var(--color-warning); }

      /* Print styles */
      @media print {
        .sidebar { display: none !important; }
        .view-header .filter-group, #tax-btn-print, #tax-year-select { display: none !important; }
        .glass-card { box-shadow: none; border: none; }
        body { background: white; }
        #app { display: block; overflow: visible; height: auto; }
        .main-content { overflow: visible; height: auto; }
        .tax-section-header { break-before: auto; }
        .view-title::after { content: " — ${selectedYear}"; }
      }
    </style>
  `;
}

/* ================================================================
   EVENTS
   ================================================================ */

function attachEvents() {
  document.getElementById('tax-year-select').addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    renderReport();
  });

  document.getElementById('tax-btn-print').addEventListener('click', () => {
    window.print();
  });
}

/* ================================================================
   REPORT RENDERING
   ================================================================ */

function renderReport() {
  const container = document.getElementById('tax-report-container');
  if (!container) return;

  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  // Get all account balances for the period
  const deltas = getAccountBalancesDelta(startDate, endDate);

  // Build aggregated data: T2125 line → { total, accounts[] }
  const lineData = {};   // lineNumber → { total, accounts: [{ name, code, amount }] }
  const unmapped = [];   // accounts without a mapping

  deltas.forEach(acct => {
    const code = acct.code || '';
    const type = acct.account_type;

    // Skip non income/expense, skip parent accounts with code ending in 00 that are just grouping
    if (!['INCOME', 'EXPENSE'].includes(type)) return;

    // Determine raw amount
    let amount = acct.balance;
    if (type === 'INCOME') amount = -amount; // Income is credit (negative) → show positive
    // Expense is already positive (debit)

    if (Math.abs(amount) < 0.01) return; // Skip zero balances

    // Resolve T2125 line
    const t2125Line = resolveT2125Line(code);

    if (t2125Line !== null) {
      if (!lineData[t2125Line]) {
        lineData[t2125Line] = { total: 0, accounts: [] };
      }
      lineData[t2125Line].total += amount;
      lineData[t2125Line].accounts.push({
        name: acct.name,
        code: code,
        amount: amount,
      });
    } else {
      // Only flag as unmapped if it's a leaf account (has a code and it's not a parent grouping)
      if (code && !code.endsWith('000') && !code.endsWith('00')) {
        unmapped.push({ name: acct.name, code: code, type: type, amount: amount });
      }
    }
  });

  // Apply special rules
  applySpecialRules(lineData);

  // Render HTML
  let html = '';

  // ── Identification ──
  html += `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-body); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
      <div style="display: flex; gap: 2rem; flex-wrap: wrap; font-size: 0.85rem; color: var(--text-secondary);">
        <div><strong>Exercice :</strong> ${selectedYear}-01-01 au ${selectedYear}-12-31</div>
        <div><strong>Code NAICS :</strong> ${specialRules.naicsCode}</div>
        <div><strong>Formulaire :</strong> T2125 (fédéral) / TP-80 (Québec)</div>
      </div>
    </div>
  `;

  // ── Section: Revenue (Part 3) ──
  html += renderSection(
    'Partie 3 — Revenus',
    '3',
    'revenue',
    lineData,
    'Revenu brut total',
    8299
  );

  // ── Section: Expenses (Part 4) ──
  html += renderSection(
    'Partie 4 — Dépenses d\'exploitation',
    '4',
    'expense',
    lineData,
    'Total des dépenses',
    null
  );

  // ── Section: CCA (Part 6) ──
  const ccaLines = getLinesBySection('cca');
  const hasCCA = ccaLines.some(l => lineData[l.line]);
  if (hasCCA) {
    html += renderSection(
      'Partie 6 — Déduction pour amortissement',
      '6',
      'cca',
      lineData,
      'Total DPA',
      null
    );
  }

  // ── Net Income ──
  const totalRevenue = computeSectionTotal('revenue', lineData);
  const totalExpenses = computeSectionTotal('expense', lineData);
  const totalCCA = computeSectionTotal('cca', lineData);
  const netIncome = totalRevenue - totalExpenses - totalCCA;

  html += `
    <div class="tax-section-header" style="margin-top: 2.5rem;">
      Partie 5 — Résultat net
      <span class="tax-section-badge">Ligne 9369</span>
    </div>
    <table class="tax-table">
      <tbody>
        <tr>
          <td>Revenu brut total (ligne 8299)</td>
          <td>${formatCAD(totalRevenue)}</td>
        </tr>
        <tr>
          <td>Moins : Dépenses d'exploitation</td>
          <td style="color: var(--color-negative);">(${formatCAD(totalExpenses)})</td>
        </tr>
        ${totalCCA > 0 ? `
        <tr>
          <td>Moins : Déduction pour amortissement (DPA)</td>
          <td style="color: var(--color-negative);">(${formatCAD(totalCCA)})</td>
        </tr>
        ` : ''}
        <tr class="tax-total">
          <td>REVENU NET D'ENTREPRISE (PERTE)</td>
          <td style="color: ${netIncome >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">
            ${formatCAD(netIncome)}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  // ── Unmapped accounts ──
  if (unmapped.length > 0) {
    html += `
      <div class="tax-section-header" style="color: var(--color-warning);">
        ⚠️ Comptes non classés
        <span class="tax-section-badge" style="background: rgba(245, 158, 11, 0.15); color: var(--color-warning);">
          ${unmapped.length} compte${unmapped.length > 1 ? 's' : ''}
        </span>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        Ces comptes n'ont pas de mapping vers une ligne T2125. Ajoutez-les dans <code>tax-mapping.js</code>.
      </p>
      <table class="tax-table">
        <thead>
          <tr><th>Compte</th><th>Code</th><th>Type</th><th>Montant</th></tr>
        </thead>
        <tbody>
          ${unmapped.map(u => `
            <tr class="tax-unmapped">
              <td>${escapeHtml(u.name)}</td>
              <td><code>${u.code}</code></td>
              <td>${u.type}</td>
              <td>${formatCAD(u.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = html;
}


/* ================================================================
   SECTION RENDERER
   ================================================================ */

function renderSection(title, partNum, sectionKey, lineData, totalLabel, totalLineNum) {
  const lines = getLinesBySection(sectionKey);
  let sectionTotal = 0;
  let rowsHtml = '';

  lines.forEach(lineDef => {
    const data = lineData[lineDef.line];
    if (!data || Math.abs(data.total) < 0.01) return; // Skip empty lines

    const effectiveTotal = data.total;
    sectionTotal += effectiveTotal;

    // Line row
    rowsHtml += `
      <tr class="tax-line-row">
        <td>
          <span class="tax-line-num">${lineDef.line}</span>
          ${escapeHtml(lineDef.label)}
          ${lineDef.deductionRate ? `<span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 400;"> (${lineDef.deductionRate * 100}% déductible)</span>` : ''}
        </td>
        <td>${formatCAD(effectiveTotal)}</td>
      </tr>
    `;

    // Detail rows (individual accounts under this line)
    if (data.accounts.length > 1) {
      data.accounts
        .sort((a, b) => b.amount - a.amount)
        .forEach(acct => {
          rowsHtml += `
            <tr class="tax-detail-row">
              <td>${escapeHtml(acct.name)} <span style="color: var(--text-muted); font-size: 0.75rem;">(${acct.code})</span></td>
              <td>${formatCAD(acct.amount)}</td>
            </tr>
          `;
        });
    }
  });

  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="2" style="color: var(--text-muted); padding: 1rem;">Aucune donnée pour cette section.</td></tr>`;
  }

  return `
    <div class="tax-section-header">
      ${escapeHtml(title)}
      <span class="tax-section-badge">Partie ${partNum}</span>
    </div>
    <table class="tax-table">
      <thead>
        <tr><th>Description</th><th>Montant</th></tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="tax-subtotal">
          <td>${escapeHtml(totalLabel)}${totalLineNum ? ` <span class="tax-line-num">${totalLineNum}</span>` : ''}</td>
          <td>${formatCAD(sectionTotal)}</td>
        </tr>
      </tbody>
    </table>
  `;
}


/* ================================================================
   SPECIAL RULES
   ================================================================ */

function applySpecialRules(lineData) {
  // Apply 50% meal deduction (line 8523)
  if (lineData[8523]) {
    const rate = specialRules.mealDeductionRate;
    lineData[8523].total *= rate;
    lineData[8523].accounts.forEach(a => { a.amount *= rate; });
  }

  // Apply vehicle business use percentage (line 9281)
  if (lineData[9281] && specialRules.vehicleBusinessPercent < 1.0) {
    const pct = specialRules.vehicleBusinessPercent;
    lineData[9281].total *= pct;
    lineData[9281].accounts.forEach(a => { a.amount *= pct; });
  }
}


/* ================================================================
   HELPERS
   ================================================================ */

function computeSectionTotal(sectionKey, lineData) {
  const lines = getLinesBySection(sectionKey);
  return lines.reduce((sum, lineDef) => {
    return sum + (lineData[lineDef.line]?.total || 0);
  }, 0);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
