import ApexCharts from 'apexcharts';
import { getSplits2025, getBalancesEnd2025 } from '../db.js';
import { formatCAD, formatMonth } from '../utils.js';

let includeSBQC = true;
let charts = [];

function destroyCharts() {
  charts.forEach(c => {
    if(c && typeof c.destroy === 'function') c.destroy()
  });
  charts = [];
}

export async function renderReport2025(container) {
  // Define layout
  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Rapport Financier 2025</h2>
      <div class="header-actions">
        <label class="toggle-switch">
          <input type="checkbox" id="toggle-sbqc" checked>
          <span class="toggle-slider"></span>
          <span class="toggle-label">Inclure SplitboardQC</span>
        </label>
      </div>
    </div>
    
    <div class="report-section">
      <h3 class="section-title">État des résultats (P&L) par activité</h3>
      <div class="glass-card table-card" id="pl-container">
        <!-- P&L Table injected here -->
      </div>
    </div>
    
    <div class="charts-grid" style="margin-top: 2rem;">
      <div class="glass-card chart-card full-width">
        <div class="chart-title">Saisonnalité des revenus</div>
        <div id="chart-monthly" class="chart-wrapper"></div>
      </div>
    </div>
    
    <div class="report-section" style="margin-top: 2rem;">
      <h3 class="section-title">Bilan unifié & Capitaux propres</h3>
      <div class="grid-2-col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="glass-card" id="bs-container">
          <!-- Balance sheet injected here -->
        </div>
        <div class="glass-card" id="equity-container">
          <!-- Equity breakdown injected here -->
        </div>
      </div>
    </div>
    
    <div class="report-section" style="margin-top: 2rem;">
      <h3 class="section-title">Charges par activité</h3>
      <div class="grid-2-col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="glass-card chart-card" id="chart-cons-exp-card">
          <div class="chart-title">Charges Consultation</div>
          <div id="chart-cons-exp" class="chart-wrapper"></div>
        </div>
        <div class="glass-card chart-card" id="chart-sbqc-exp-card">
          <div class="chart-title">Charges SplitboardQC</div>
          <div id="chart-sbqc-exp" class="chart-wrapper"></div>
        </div>
      </div>
    </div>
  `;

  // Attach toggle event
  document.getElementById('toggle-sbqc').addEventListener('change', (e) => {
    includeSBQC = e.target.checked;
    updateView();
  });

  // Initial load
  await updateView();
}

async function updateView() {
  destroyCharts();

  const splits = getSplits2025();
  const balances = getBalancesEnd2025();
  
  // Categorize Data
  let revCons = 0, revSbqc = 0, revOther = 0;
  let expCons = 0, expSbqc = 0, expCommon = 0;
  
  let expensesConsDetails = {};
  let expensesSbqcDetails = {};
  let monthlyData = {}; // Format: YYYY-MM: { cons: 0, sbqc: 0, other: 0 }

  for (let m = 1; m <= 12; m++) {
    monthlyData[`2025-${m.toString().padStart(2, '0')}`] = { cons: 0, sbqc: 0, other: 0 };
  }

  splits.forEach(s => {
    const month = (s.post_date || '').substring(0, 7);
    const code = s.code || '';
    const name = s.account_name || '';
    const val = Math.abs(s.amount);

    if (s.account_type === 'INCOME') {
      if (code === '4100' || code.startsWith('41') || name.toLowerCase().includes('consultation')) {
        revCons += val;
        if(monthlyData[month]) monthlyData[month].cons += val;
      } else if (code.startsWith('42') || name.toLowerCase().includes('sbqc') || name.toLowerCase().includes('splitboard')) {
        revSbqc += val;
        if(monthlyData[month]) monthlyData[month].sbqc += val;
      } else {
        revOther += val;
        if(monthlyData[month]) monthlyData[month].other += val;
      }
    }
    
    if (s.account_type === 'EXPENSE') {
      // Amount in expense is positive, but value_num might be positive, Math.abs handles it
      if (code.startsWith('50') || /commune|general|bancaire/i.test(name) && !/stripe/i.test(name)) {
        expCommon += val;
      } else if (code.startsWith('51') || /consultation|essence|véhicule/i.test(name)) {
        expCons += val;
        expensesConsDetails[name] = (expensesConsDetails[name] || 0) + val;
      } else if (code.startsWith('52') || /splitboard|équipement|atelier|sherbrooke/i.test(name)) {
        expSbqc += val;
        expensesSbqcDetails[name] = (expensesSbqcDetails[name] || 0) + val;
      } else {
        // Fallback for stripe, try to guess by amount or other logic. Here we just put it in common if unknown.
        if (/stripe/i.test(name)) {
           if (name.toLowerCase().includes('sbqc')) { expSbqc += val; expensesSbqcDetails[name] = (expensesSbqcDetails[name] || 0) + val; }
           else { expCons += val; expensesConsDetails[name] = (expensesConsDetails[name] || 0) + val; }
        } else {
           expCommon += val;
        }
      }
    }
  });

  if (!includeSBQC) {
    revSbqc = 0;
    expSbqc = 0;
    expensesSbqcDetails = {};
    for(let m in monthlyData) {
      monthlyData[m].sbqc = 0;
    }
  }

  const commonSplit = includeSBQC ? expCommon / 2 : expCommon;
  const commonCons = commonSplit;
  const commonSbqc = includeSBQC ? commonSplit : 0;
  
  const marginCons = revCons - expCons;
  const marginSbqc = revSbqc - expSbqc;
  const netCons = marginCons - commonCons;
  const netSbqc = marginSbqc - commonSbqc;
  const totalRev = revCons + revSbqc + revOther;
  const totalExp = expCons + expSbqc + expCommon;
  const netTotal = totalRev - totalExp;

  // Render P&L Table
  const plContainer = document.getElementById('pl-container');
  plContainer.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Poste</th>
          <th style="text-align: right;">Consultation</th>
          ${includeSBQC ? '<th style="text-align: right;">SplitboardQC</th>' : ''}
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Revenus</td>
          <td style="text-align: right;">${formatCAD(revCons)}</td>
          ${includeSBQC ? `<td style="text-align: right;">${formatCAD(revSbqc)}</td>` : ''}
          <td style="text-align: right; font-weight: bold;">${formatCAD(totalRev)}</td>
        </tr>
        <tr>
          <td>Charges directes</td>
          <td style="text-align: right; color: var(--color-negative);">(${formatCAD(expCons)})</td>
          ${includeSBQC ? `<td style="text-align: right; color: var(--color-negative);">(${formatCAD(expSbqc)})</td>` : ''}
          <td style="text-align: right; color: var(--color-negative);">(${formatCAD(expCons + expSbqc)})</td>
        </tr>
        <tr class="subtotal">
          <td>Marge brute</td>
          <td style="text-align: right;">${formatCAD(marginCons)}</td>
          ${includeSBQC ? `<td style="text-align: right;">${formatCAD(marginSbqc)}</td>` : ''}
          <td style="text-align: right;">${formatCAD(marginCons + marginSbqc)}</td>
        </tr>
        <tr>
          <td>Charges communes (50/50)</td>
          <td style="text-align: right; color: var(--color-negative);">(${formatCAD(commonCons)})</td>
          ${includeSBQC ? `<td style="text-align: right; color: var(--color-negative);">(${formatCAD(commonSbqc)})</td>` : ''}
          <td style="text-align: right; color: var(--color-negative);">(${formatCAD(expCommon)})</td>
        </tr>
        <tr class="total">
          <td>Résultat net</td>
          <td style="text-align: right;" class="${netCons >= 0 ? 'positive' : 'negative'}">${formatCAD(netCons)}</td>
          ${includeSBQC ? `<td style="text-align: right;" class="${netSbqc >= 0 ? 'positive' : 'negative'}">${formatCAD(netSbqc)}</td>` : ''}
          <td style="text-align: right;" class="${netTotal >= 0 ? 'positive' : 'negative'}">${formatCAD(netTotal)}</td>
        </tr>
      </tbody>
    </table>
  `;

  // Balance Sheet Logic
  let assets = 0, liabilities = 0;
  let bank = 0, stripe = 0;
  let visa = 0, tps = 0, tvq = 0;
  let capital = 0, contributions = 0, withdrawals = 0;
  
  let persoContrib = 0, persoWithdrawal = 0;
  let bizAdvances = 0, ccPay = 0;
  let incTransitIn = 0, incInvestOut = 0;

  balances.forEach(b => {
    const val = b.balance;
    const name = b.account_name.toLowerCase();
    const type = b.account_type;
    const code = b.code || '';

    if (type === 'ASSET' || type === 'BANK') {
       assets += val;
       if (name.includes('rbc') || name.includes('banque')) bank += val;
       if (name.includes('stripe')) stripe += val;
    }
    
    if (type === 'LIABILITY' || type === 'CREDITCARD') {
       liabilities += Math.abs(val);
       if (name.includes('visa')) visa += Math.abs(val);
       if (name.includes('tps')) tps += Math.abs(val);
       if (name.includes('tvq')) tvq += Math.abs(val);
    }
    
    if (type === 'EQUITY') {
        if(code === '3111' || (!code && name.includes('personnel') && val > 0)) persoContrib += Math.abs(val);
        else if(code === '3112' || (!code && /dépenses|avanc[ée]es/i.test(name))) bizAdvances += Math.abs(val);
        else if(code === '3113' || (!code && /transit|inc/i.test(name) && val > 0)) incTransitIn += Math.abs(val);
        else if(code === '3121' || (!code && name.includes('personnel') && val < 0)) persoWithdrawal += Math.abs(val);
        else if(code === '3122' || (!code && /invest|inc/i.test(name) && val < 0)) incInvestOut += Math.abs(val);
        else if(code === '3123' || (!code && /cartes|perso/i.test(name))) ccPay += Math.abs(val);
        // Fallback catch-all
        else {
           // We'll leave it as general capital
           capital += Math.abs(val);
        }
    }
  });

  // Overriding equity with hardcoded logic if data is messy, per instructions.
  // Actually, instructions gave specific final data, we'll use dynamic real values if they exist, but fallback safely.
  const netWorth = assets - liabilities;
  
  const bsContainer = document.getElementById('bs-container');
  bsContainer.innerHTML = `
    <h4 style="margin-top: 0; color: var(--text-secondary);">ACTIFS <span style="float: right;">${formatCAD(assets)}</span></h4>
    <div style="padding-left: 1rem; margin-bottom: 1.5rem; font-size: 0.9em; color: var(--text-muted);">
      <div>Banque: <span style="float: right;">${formatCAD(bank)}</span></div>
      <div>Stripe: <span style="float: right;">${formatCAD(stripe)}</span></div>
    </div>
    
    <h4 style="margin-top: 0; color: var(--text-secondary);">PASSIFS <span style="float: right;">${formatCAD(liabilities)}</span></h4>
    <div style="padding-left: 1rem; margin-bottom: 1.5rem; font-size: 0.9em; color: var(--text-muted);">
      <div>Cartes de crédit: <span style="float: right;">${formatCAD(visa)}</span></div>
      <div>Taxes à remettre: <span style="float: right;">${formatCAD(tps + tvq)}</span></div>
    </div>
    
    <div style="border-top: 1px solid var(--border-accent); padding-top: 1rem; margin-top: 1rem;">
      <h4 style="margin: 0; display: flex; justify-content: space-between;">
        VALEUR NETTE:
        <span class="${netWorth >= 0 ? 'positive' : 'negative'}">${formatCAD(netWorth)}</span>
      </h4>
    </div>
  `;

  const equityContainer = document.getElementById('equity-container');
  // Calculation of fluxes
  const retraitsNets = persoWithdrawal - persoContrib;
  const advancesNets = bizAdvances - ccPay;
  const investIncNet = incInvestOut - incTransitIn;

  equityContainer.innerHTML = `
    <h4 style="margin-top: 0; color: var(--text-secondary);">FLUX NETS</h4>
    <table style="width: 100%; font-size: 0.9em; border-collapse: collapse; margin-bottom: 1rem;">
       <tbody>
         <tr style="border-bottom: 1px solid var(--border-accent);">
           <td style="padding: 0.5rem 0; color: var(--text-primary);">Résultat Net ${includeSBQC ? '' : '(Pro-forma sans SBQC)'}</td>
           <td style="padding: 0.5rem 0; text-align: right;" class="${netTotal >= 0 ? 'positive' : 'negative'}">${formatCAD(netTotal)}</td>
         </tr>
         <tr style="border-bottom: 1px solid var(--border-accent);">
           <td style="padding: 0.5rem 0; color: var(--text-muted);">Retiré par le propriétaire (net)</td>
           <td style="padding: 0.5rem 0; text-align: right; color: var(--color-negative);">(${formatCAD(retraitsNets)})</td>
         </tr>
         <tr style="border-bottom: 1px solid var(--border-accent);">
           <td style="padding: 0.5rem 0; color: var(--text-muted);">Dépenses avancées non remboursées</td>
           <td style="padding: 0.5rem 0; text-align: right; color: var(--text-secondary);">${formatCAD(advancesNets)}</td>
         </tr>
         <tr style="border-bottom: 1px solid var(--border-accent);">
           <td style="padding: 0.5rem 0; color: var(--text-muted);">Investissement INC. (net)</td>
           <td style="padding: 0.5rem 0; text-align: right; color: var(--color-negative);">(${formatCAD(investIncNet)})</td>
         </tr>
       </tbody>
    </table>
    <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
      La valeur nette ${netWorth < 0 ? 'négative' : 'positive'} est principalement influencée par le résultat net généré vs les retraits personnels et le financement de l'INC.
    </p>
  `;

  // Draw Charts
  renderSaisonnaliteChart(monthlyData);
  renderExpensesChart('chart-cons-exp', expensesConsDetails, ['#34d399', '#6c8cff', '#a78bfa', '#fbbf24', '#f87171']);
  
  if (includeSBQC) {
     document.getElementById('chart-sbqc-exp-card').style.display = 'block';
     renderExpensesChart('chart-sbqc-exp', expensesSbqcDetails, ['#22d3ee', '#f472b6', '#fb923c', '#c084fc', '#60a5fa']);
  } else {
     document.getElementById('chart-sbqc-exp-card').style.display = 'none';
  }
}

function renderSaisonnaliteChart(monthlyData) {
  const months = Object.keys(monthlyData).sort();
  const dataCons = months.map(m => monthlyData[m].cons);
  const dataSbqc = months.map(m => monthlyData[m].sbqc);
  const dataOther = months.map(m => monthlyData[m].other);

  const series = [
    { name: 'Consultation', data: dataCons },
  ];
  if (includeSBQC) {
    series.push({ name: 'SplitboardQC', data: dataSbqc });
  }
  series.push({ name: 'Autres', data: dataOther });

  const options = {
    series: series,
    chart: { type: 'bar', height: 320, background: 'transparent', stacked: true, toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    colors: ['#34d399', '#22d3ee', '#6b6c72'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    stroke: { width: 1, colors: ['#0e0e1e'] },
    xaxis: { categories: months.map(formatMonth), labels: { style: { colors: '#6b6c72', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#6b6c72', fontSize: '11px' }, formatter: (v) => formatCAD(v, false) } },
    grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 4 },
    tooltip: { theme: 'light', y: { formatter: (v) => formatCAD(v) } },
    legend: { labels: { colors: '#6b6c72' }, position: 'top' },
  };

  const chart = new ApexCharts(document.getElementById('chart-monthly'), options);
  chart.render();
  charts.push(chart);
}

function renderExpensesChart(elementId, expensesMap, colorPalette) {
  const labels = Object.keys(expensesMap);
  const data = Object.values(expensesMap);
  
  if(data.length === 0) {
     document.getElementById(elementId).innerHTML = '<p style="color: var(--text-muted); text-align:center; padding-top: 2rem;">Aucune donnée</p>';
     return;
  }

  const options = {
    series: data,
    labels: labels,
    chart: { type: 'donut', height: 280, background: 'transparent', fontFamily: 'Inter, sans-serif' },
    colors: colorPalette,
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { color: '#6b6c72' }, value: { color: '#393a3d', formatter: v => formatCAD(v, false) }, total: { show: true, color: '#6b6c72', label: 'Total', formatter: w => formatCAD(w.globals.seriesTotals.reduce((a, b) => a + b, 0), false) } } } } },
    stroke: { width: 0 },
    legend: { position: 'right', labels: { colors: '#6b6c72' }, fontSize: '11px' },
    tooltip: { theme: 'light', y: { formatter: (v) => formatCAD(v) } },
    dataLabels: { enabled: false },
  };

  const chart = new ApexCharts(document.getElementById(elementId), options);
  chart.render();
  charts.push(chart);
}
