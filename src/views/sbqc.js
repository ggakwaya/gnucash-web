import ApexCharts from 'apexcharts';
import { getSplits2025 } from '../db.js';
import { formatCAD } from '../utils.js';

let charts = [];

// Valuation variables
let valFlotte = 7121.49; // Default based on 2025 purchases
let valSiteWeb = 2500;
let valGoodwill = 5000; 

function destroyCharts() {
  charts.forEach(c => {
    if(c && typeof c.destroy === 'function') c.destroy()
  });
  charts = [];
}

export async function renderSbqcValuation(container) {
  // Extract Data
  const splits = getSplits2025();
  let revSbqc = 0;
  let expSbqc = 0;
  let expCommon = 0;

  splits.forEach(s => {
    const code = s.code || '';
    const name = s.account_name || '';
    const val = Math.abs(s.amount);

    if (s.account_type === 'INCOME') {
      if (code.startsWith('42') || name.toLowerCase().includes('sbqc') || name.toLowerCase().includes('splitboard')) {
        revSbqc += val;
      }
    }
    if (s.account_type === 'EXPENSE') {
      if (code.startsWith('50') || /commune|general|bancaire/i.test(name) && !/stripe/i.test(name)) {
        expCommon += val;
      } else if (code.startsWith('52') || /splitboard|équipement|atelier|sherbrooke/i.test(name)) {
        expSbqc += val;
      } else if (/stripe/i.test(name) && name.toLowerCase().includes('sbqc')) {
        expSbqc += val;
      }
    }
  });

  const commonSbqc = expCommon / 2;
  const netSbqc = revSbqc - expSbqc - commonSbqc;

  // Set default Goodwill to 1x Net Profit if it hasn't been modified yet
  // but let's just keep the static default for now unless dynamically requested
  // valGoodwill = Math.max(0, Math.round(netSbqc));

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Valorisation SplitboardQC</h2>
      <p class="view-subtitle">Calcul du prix de transfert pour la corporation (INC)</p>
    </div>
    
    <div class="grid-2-col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1rem;">
      
      <!-- P&L ISOLÉ -->
      <div class="report-section">
        <h3 class="section-title">Performances 2025 (P&L Isolé)</h3>
        <div class="glass-card">
          <table class="report-table">
            <tbody>
              <tr>
                <td>Revenus d'exploitation</td>
                <td style="text-align: right; color: var(--color-positive); font-weight: 500;">${formatCAD(revSbqc)}</td>
              </tr>
              <tr>
                <td>Charges directes</td>
                <td style="text-align: right; color: var(--color-negative);">(${formatCAD(expSbqc)})</td>
              </tr>
              <tr class="subtotal">
                <td>Marge brute</td>
                <td style="text-align: right;">${formatCAD(revSbqc - expSbqc)}</td>
              </tr>
              <tr>
                <td>Frais généraux (Quote-part 50%)</td>
                <td style="text-align: right; color: var(--color-negative);">(${formatCAD(commonSbqc)})</td>
              </tr>
              <tr class="total">
                <td>Bénéfice Net (EBITDA estimé)</td>
                <td style="text-align: right;" class="${netSbqc >= 0 ? 'positive' : 'negative'}">${formatCAD(netSbqc)}</td>
              </tr>
            </tbody>
          </table>
          <div style="font-size: 0.8em; color: var(--text-muted); margin-top: 1rem; line-height: 1.4;">
            * Ce bénéfice net sert souvent de base de référence pour le "Goodwill", validant la rentabilité récurrente.
          </div>
        </div>
      </div>
      
      <!-- CALCULATEUR -->
      <div class="report-section">
        <h3 class="section-title">Calculateur de Prix de Transfert</h3>
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <div class="input-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="color: var(--text-secondary); font-size: 0.9em; display: flex; justify-content: space-between;">
              <span>Valeur marchande de la flotte (Inventaire)</span>
              <span id="flotte-val" style="color: var(--text-primary); font-family: var(--font-mono); font-weight: 600;">${formatCAD(valFlotte)}</span>
            </label>
            <input type="range" id="slider-flotte" min="0" max="15000" step="100" value="${valFlotte}" style="width: 100%; accent-color: #6c8cff;">
          </div>
          
          <div class="input-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="color: var(--text-secondary); font-size: 0.9em; display: flex; justify-content: space-between;">
              <span>Valeur du site web / domaine</span>
              <span id="web-val" style="color: var(--text-primary); font-family: var(--font-mono); font-weight: 600;">${formatCAD(valSiteWeb)}</span>
            </label>
            <input type="range" id="slider-web" min="0" max="10000" step="100" value="${valSiteWeb}" style="width: 100%; accent-color: #34d399;">
          </div>
          
          <div class="input-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="color: var(--text-secondary); font-size: 0.9em; display: flex; justify-content: space-between;">
              <span>Goodwill (Marque, Clientèle, Récurrence)</span>
              <span id="goodwill-val" style="color: var(--text-primary); font-family: var(--font-mono); font-weight: 600;">${formatCAD(valGoodwill)}</span>
            </label>
            <input type="range" id="slider-goodwill" min="0" max="20000" step="250" value="${valGoodwill}" style="width: 100%; accent-color: #a78bfa;">
          </div>
          
          <div style="margin-top: 1rem; padding-top: 1.5rem; border-top: 2px dashed rgba(108, 140, 255, 0.2); text-align: center;">
            <div style="color: var(--text-secondary); font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Prix de Transfert Suggéré</div>
            <div id="transfer-price" style="font-size: 2.5em; font-weight: 700; color: #22d3ee; font-family: var(--font-mono);">
              ${formatCAD(valFlotte + valSiteWeb + valGoodwill)}
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
    
    <!-- GRAPH RANGE -->
    <div class="report-section" style="margin-top: 2rem;">
      <h3 class="section-title">Composition du Transfert</h3>
      <div class="glass-card chart-card">
        <div id="chart-valuation" class="chart-wrapper"></div>
      </div>
    </div>
  `;

  // Attach Events
  const sliderFlotte = document.getElementById('slider-flotte');
  const sliderWeb = document.getElementById('slider-web');
  const sliderGw = document.getElementById('slider-goodwill');
  
  const valF = document.getElementById('flotte-val');
  const valW = document.getElementById('web-val');
  const valG = document.getElementById('goodwill-val');
  const valTotal = document.getElementById('transfer-price');

  function updateCalculations() {
    valFlotte = parseFloat(sliderFlotte.value);
    valSiteWeb = parseFloat(sliderWeb.value);
    valGoodwill = parseFloat(sliderGw.value);
    
    valF.textContent = formatCAD(valFlotte);
    valW.textContent = formatCAD(valSiteWeb);
    valG.textContent = formatCAD(valGoodwill);
    valTotal.textContent = formatCAD(valFlotte + valSiteWeb + valGoodwill);
    
    renderChart();
  }

  sliderFlotte.addEventListener('input', updateCalculations);
  sliderWeb.addEventListener('input', updateCalculations);
  sliderGw.addEventListener('input', updateCalculations);

  renderChart();
}

function renderChart() {
  destroyCharts();
  
  const options = {
    series: [valFlotte, valSiteWeb, valGoodwill],
    labels: ['Flotte & Inventaire', 'Site Web & Domaine', 'Goodwill'],
    chart: { type: 'donut', height: 350, background: 'transparent', fontFamily: 'Inter, sans-serif' },
    colors: ['#6c8cff', '#34d399', '#a78bfa'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { color: '#6b6c72', fontSize: '14px' },
            value: { color: '#393a3d', fontSize: '24px', fontWeight: 600, formatter: v => formatCAD(v, false) },
            total: { show: true, color: '#22d3ee', label: 'Prix Cible', fontSize: '16px', formatter: w => formatCAD(w.globals.seriesTotals.reduce((a, b) => a + b, 0), false) }
          }
        }
      }
    },
    stroke: { width: 0 },
    legend: { position: 'bottom', labels: { colors: '#6b6c72' } },
    tooltip: { theme: 'light', y: { formatter: (v) => formatCAD(v) } },
    dataLabels: { enabled: false },
    animations: { enabled: false } // Disabled for smooth slider experience
  };

  const chart = new ApexCharts(document.getElementById('chart-valuation'), options);
  chart.render();
  charts.push(chart);
}
