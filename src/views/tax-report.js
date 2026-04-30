/**
 * GnuCash Web — Tax Report View (T2125 / TP-80)
 * Generates a structured fiscal report mapped to CRA T2125 lines.
 * Supports adjustable deduction rates with localStorage persistence.
 */

import { getAccountBalancesDelta, getDatabaseInfo } from '../db.js';
import { formatCAD, escapeHtml } from '../utils.js';
import {
  t2125Lines,
  specialRules,
  resolveT2125Line,
  getLinesBySection,
  getEffectiveRate,
  saveRateOverride,
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
      .tax-table th.col-amount { text-align: right; }
      .tax-table td { padding: 7px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.9rem; }
      .tax-table .col-amount { text-align: right; font-family: var(--font-mono); font-size: 0.85rem; min-width: 110px; }
      .tax-table .col-rate { text-align: center; width: 90px; }
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

      /* Adjustable rate input */
      .tax-rate-wrap {
        display: inline-flex; align-items: center; justify-content: center; gap: 2px;
      }
      .tax-rate-input {
        width: 50px; padding: 3px 4px; text-align: center;
        border: 1px solid var(--border-card); border-radius: 4px;
        font-size: 0.82rem; font-family: var(--font-mono);
        background: var(--bg-body); color: var(--text-primary);
        transition: border-color 0.2s;
        -moz-appearance: textfield;
      }
      .tax-rate-input::-webkit-inner-spin-button,
      .tax-rate-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .tax-rate-input:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 2px rgba(44, 160, 28, 0.15); }
      .tax-rate-input:hover { border-color: var(--text-muted); }
      .tax-rate-suffix { font-size: 0.8rem; color: var(--text-muted); }

      /* Gross amount (dimmed when rate < 100%) */
      .tax-gross-dimmed { color: var(--text-muted); }

      /* Subtotal / Total */
      .tax-subtotal td { font-weight: 600; border-top: 1px dashed var(--border-card); background: var(--bg-card-hover); }
      .tax-total td { font-weight: 700; border-top: 2px solid var(--border-card); background: var(--bg-body); font-size: 1rem; }

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
        .tax-rate-input { border: none; background: transparent; width: auto; }
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

  // Build aggregated data: T2125 line → { grossTotal, accounts[] }
  // grossTotal = raw amounts BEFORE any deduction rate
  const lineData = {};   // lineNumber → { grossTotal, accounts: [{ name, code, amount }] }
  const unmapped = [];   // accounts without a mapping

  deltas.forEach(acct => {
    const code = acct.code || '';
    const type = acct.account_type;

    // Skip non income/expense
    if (!['INCOME', 'EXPENSE'].includes(type)) return;

    // Determine raw amount
    let amount = acct.balance;
    if (type === 'INCOME') amount = -amount; // Income is credit (negative) → show positive

    if (Math.abs(amount) < 0.01) return; // Skip zero balances

    // Resolve T2125 line
    const t2125Line = resolveT2125Line(code);

    if (t2125Line !== null) {
      if (!lineData[t2125Line]) {
        lineData[t2125Line] = { grossTotal: 0, accounts: [] };
      }
      lineData[t2125Line].grossTotal += amount;
      lineData[t2125Line].accounts.push({
        name: acct.name,
        code: code,
        amount: amount, // Always the raw/gross amount
      });
    } else {
      // Only flag as unmapped if it's a leaf account
      if (code && !code.endsWith('000') && !code.endsWith('00')) {
        unmapped.push({ name: acct.name, code: code, type: type, amount: amount });
      }
    }
  });

  // Determine which sections have adjustable lines
  const hasAdjustable = Object.keys(lineData).some(line => t2125Lines[line]?.adjustable);

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
          <td colspan="2"></td>
          <td class="col-amount">${formatCAD(totalRevenue)}</td>
        </tr>
        <tr>
          <td>Moins : Dépenses d'exploitation</td>
          <td colspan="2"></td>
          <td class="col-amount" style="color: var(--color-negative);">(${formatCAD(totalExpenses)})</td>
        </tr>
        ${totalCCA > 0 ? `
        <tr>
          <td>Moins : Déduction pour amortissement (DPA)</td>
          <td colspan="2"></td>
          <td class="col-amount" style="color: var(--color-negative);">(${formatCAD(totalCCA)})</td>
        </tr>
        ` : ''}
        <tr class="tax-total">
          <td>REVENU NET D'ENTREPRISE (PERTE)</td>
          <td colspan="2"></td>
          <td class="col-amount" style="color: ${netIncome >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">
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
          <tr><th>Compte</th><th>Code</th><th>Type</th><th class="col-amount">Montant</th></tr>
        </thead>
        <tbody>
          ${unmapped.map(u => `
            <tr class="tax-unmapped">
              <td>${escapeHtml(u.name)}</td>
              <td><code>${u.code}</code></td>
              <td>${u.type}</td>
              <td class="col-amount">${formatCAD(u.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = html;

  // ── Attach rate input events (after DOM injection) ──
  container.querySelectorAll('.tax-rate-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const lineNum = parseInt(e.target.dataset.line);
      const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
      e.target.value = pct; // Clamp displayed value
      saveRateOverride(lineNum, pct / 100);
      renderReport(); // Re-render with new rate
    });
  });
}


/* ================================================================
   SECTION RENDERER
   ================================================================ */

function renderSection(title, partNum, sectionKey, lineData, totalLabel, totalLineNum) {
  const lines = getLinesBySection(sectionKey);

  // Check if this section has any adjustable lines with data
  const sectionHasAdjustable = lines.some(l => l.adjustable && lineData[l.line]);

  let sectionTotal = 0;
  let sectionGrossTotal = 0;
  let rowsHtml = '';

  lines.forEach(lineDef => {
    const data = lineData[lineDef.line];
    if (!data || Math.abs(data.grossTotal) < 0.01) return;

    const rate = getEffectiveRate(lineDef.line);
    const grossAmount = data.grossTotal;
    const deductibleAmount = grossAmount * rate;
    sectionGrossTotal += grossAmount;
    sectionTotal += deductibleAmount;

    const isAdjusted = lineDef.adjustable && rate < 1.0;
    const isAdjustable = lineDef.adjustable;

    // Line row
    rowsHtml += `
      <tr class="tax-line-row">
        <td>
          <span class="tax-line-num">${lineDef.line}</span>
          ${escapeHtml(lineDef.label)}
        </td>
        ${sectionHasAdjustable ? `
          <td class="col-amount ${isAdjusted ? 'tax-gross-dimmed' : ''}">${isAdjustable ? formatCAD(grossAmount) : ''}</td>
          <td class="col-rate">
            ${isAdjustable ? `
              <span class="tax-rate-wrap">
                <input type="number" class="tax-rate-input" data-line="${lineDef.line}"
                       value="${Math.round(rate * 100)}" min="0" max="100" step="1">
                <span class="tax-rate-suffix">%</span>
              </span>
            ` : ''}
          </td>
        ` : ''}
        <td class="col-amount">${formatCAD(deductibleAmount)}</td>
      </tr>
    `;

    // Detail rows (individual accounts under this line)
    if (data.accounts.length > 1) {
      data.accounts
        .sort((a, b) => b.amount - a.amount)
        .forEach(acct => {
          const acctDeductible = acct.amount * rate;
          rowsHtml += `
            <tr class="tax-detail-row">
              <td>${escapeHtml(acct.name)} <span style="color: var(--text-muted); font-size: 0.75rem;">(${acct.code})</span></td>
              ${sectionHasAdjustable ? `
                <td class="col-amount ${isAdjusted ? 'tax-gross-dimmed' : ''}">${isAdjustable ? formatCAD(acct.amount) : ''}</td>
                <td class="col-rate"></td>
              ` : ''}
              <td class="col-amount">${formatCAD(acctDeductible)}</td>
            </tr>
          `;
        });
    }
  });

  if (!rowsHtml) {
    const colSpan = sectionHasAdjustable ? 4 : 2;
    rowsHtml = `<tr><td colspan="${colSpan}" style="color: var(--text-muted); padding: 1rem;">Aucune donnée pour cette section.</td></tr>`;
  }

  // Build header
  const headerCols = sectionHasAdjustable
    ? `<tr><th>Description</th><th class="col-amount">Brut</th><th class="col-rate">Taux</th><th class="col-amount">Déductible</th></tr>`
    : `<tr><th>Description</th><th class="col-amount">Montant</th></tr>`;

  // Build subtotal row
  const subtotalCols = sectionHasAdjustable
    ? `<td>${escapeHtml(totalLabel)}${totalLineNum ? ` <span class="tax-line-num">${totalLineNum}</span>` : ''}</td>
       <td class="col-amount tax-gross-dimmed">${sectionGrossTotal !== sectionTotal ? formatCAD(sectionGrossTotal) : ''}</td>
       <td class="col-rate"></td>
       <td class="col-amount">${formatCAD(sectionTotal)}</td>`
    : `<td>${escapeHtml(totalLabel)}${totalLineNum ? ` <span class="tax-line-num">${totalLineNum}</span>` : ''}</td>
       <td class="col-amount">${formatCAD(sectionTotal)}</td>`;

  return `
    <div class="tax-section-header">
      ${escapeHtml(title)}
      <span class="tax-section-badge">Partie ${partNum}</span>
    </div>
    <table class="tax-table">
      <thead>
        ${headerCols}
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="tax-subtotal">
          ${subtotalCols}
        </tr>
      </tbody>
    </table>
  `;
}


/* ================================================================
   HELPERS
   ================================================================ */

function computeSectionTotal(sectionKey, lineData) {
  const lines = getLinesBySection(sectionKey);
  return lines.reduce((sum, lineDef) => {
    const data = lineData[lineDef.line];
    if (!data) return sum;
    const rate = getEffectiveRate(lineDef.line);
    return sum + (data.grossTotal * rate);
  }, 0);
}
