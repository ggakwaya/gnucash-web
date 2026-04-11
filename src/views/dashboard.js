/**
 * GnuCash Web — Dashboard View
 * KPI cards, revenue/expense charts, profit trend, expense breakdown.
 */

import ApexCharts from 'apexcharts';
import { getKPIs, getMonthlyRevenueExpenses, getExpenseBreakdown, getRevenueByActivity } from '../db.js';
import { formatCAD, formatMonth } from '../utils.js';

// Store chart instances for cleanup
let charts = [];

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

/**
 * Render the dashboard view.
 */
export async function renderDashboard(container) {
  destroyCharts();

  const kpis = getKPIs();
  const monthly = getMonthlyRevenueExpenses();
  const expBreakdown = getExpenseBreakdown();
  const revByActivity = getRevenueByActivity();

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Tableau de bord</h2>
      <p class="view-subtitle">Exercice 2025 — Vue d'ensemble financière</p>
    </div>

    <div class="kpi-grid">
      <div class="glass-card kpi-card revenue animate-in animate-in-delay-1" id="kpi-revenue">
        <div class="kpi-label">Revenus totaux</div>
        <div class="kpi-value positive">${formatCAD(kpis.revenue)}</div>
        <div class="kpi-detail">
          <span>📈</span>
          <span>Exercice complet 2025</span>
        </div>
      </div>
      <div class="glass-card kpi-card expense animate-in animate-in-delay-2" id="kpi-expenses">
        <div class="kpi-label">Dépenses totales</div>
        <div class="kpi-value negative">${formatCAD(kpis.expenses)}</div>
        <div class="kpi-detail">
          <span>📉</span>
          <span>${expBreakdown.length} catégories</span>
        </div>
      </div>
      <div class="glass-card kpi-card profit animate-in animate-in-delay-3" id="kpi-profit">
        <div class="kpi-label">Bénéfice net</div>
        <div class="kpi-value ${kpis.profit >= 0 ? 'positive' : 'negative'}">${formatCAD(kpis.profit)}</div>
        <div class="kpi-detail">
          <span>${kpis.profit >= 0 ? '✅' : '⚠️'}</span>
          <span>Marge : ${((kpis.profit / kpis.revenue) * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="glass-card kpi-card count animate-in animate-in-delay-4" id="kpi-count">
        <div class="kpi-label">Transactions</div>
        <div class="kpi-value">${kpis.transactionCount.toLocaleString('fr-CA')}</div>
        <div class="kpi-detail">
          <span>📒</span>
          <span>Écritures comptables</span>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="glass-card chart-card full-width animate-in" id="chart-monthly-card">
        <div class="chart-title">Revenus vs Dépenses par mois</div>
        <div id="chart-monthly" class="chart-wrapper"></div>
      </div>
      <div class="glass-card chart-card animate-in" id="chart-profit-card">
        <div class="chart-title">Bénéfice net cumulatif</div>
        <div id="chart-profit" class="chart-wrapper"></div>
      </div>
      <div class="glass-card chart-card animate-in" id="chart-expenses-card">
        <div class="chart-title">Répartition des dépenses</div>
        <div id="chart-expenses" class="chart-wrapper"></div>
      </div>
      <div class="glass-card chart-card full-width animate-in" id="chart-activity-card">
        <div class="chart-title">Revenus par activité</div>
        <div id="chart-activity" class="chart-wrapper"></div>
      </div>
    </div>
  `;

  // Small delay to let DOM render before charts
  await new Promise(r => setTimeout(r, 50));

  renderMonthlyChart(monthly);
  renderProfitChart(monthly);
  renderExpenseDonut(expBreakdown);
  renderActivityChart(revByActivity);
}

/* ---------- Monthly Revenue vs Expenses Bar Chart ---------- */

function renderMonthlyChart({ months, revenue, expenses }) {
  const options = {
    series: [
      { name: 'Revenus', data: revenue.map(v => Math.round(v)) },
      { name: 'Dépenses', data: expenses.map(v => Math.round(v)) },
    ],
    chart: {
      type: 'bar',
      height: 320,
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
    },
    colors: ['#34d399', '#f87171'],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '55%',
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: months.map(formatMonth),
      labels: { style: { colors: '#6b6c72', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6b6c72', fontSize: '11px' },
        formatter: (v) => formatCAD(v, false),
      },
    },
    grid: {
      borderColor: 'rgba(255,255,255,0.04)',
      strokeDashArray: 4,
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (v) => formatCAD(v) },
    },
    legend: {
      labels: { colors: '#6b6c72' },
      position: 'top',
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        opacityFrom: 0.9,
        opacityTo: 0.6,
      },
    },
  };

  const chart = new ApexCharts(document.getElementById('chart-monthly'), options);
  chart.render();
  charts.push(chart);
}

/* ---------- Cumulative Net Profit Area Chart ---------- */

function renderProfitChart({ months, revenue, expenses }) {
  const cumulative = [];
  let running = 0;
  for (let i = 0; i < months.length; i++) {
    running += revenue[i] - expenses[i];
    cumulative.push(Math.round(running));
  }

  const options = {
    series: [{ name: 'Bénéfice cumulatif', data: cumulative }],
    chart: {
      type: 'area',
      height: 300,
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
      sparkline: { enabled: false },
      animations: { enabled: true, easing: 'easeinout', speed: 1000 },
    },
    colors: ['#22d3ee'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#22d3ee', opacity: 0.3 },
          { offset: 100, color: '#6c8cff', opacity: 0.02 },
        ],
      },
    },
    xaxis: {
      categories: months.map(formatMonth),
      labels: { style: { colors: '#6b6c72', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6b6c72', fontSize: '11px' },
        formatter: (v) => formatCAD(v, false),
      },
    },
    grid: {
      borderColor: 'rgba(255,255,255,0.04)',
      strokeDashArray: 4,
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (v) => formatCAD(v) },
    },
    markers: {
      size: 4,
      colors: ['#22d3ee'],
      strokeColors: '#0e0e1e',
      strokeWidth: 2,
      hover: { size: 6 },
    },
  };

  const chart = new ApexCharts(document.getElementById('chart-profit'), options);
  chart.render();
  charts.push(chart);
}

/* ---------- Expense Breakdown Donut Chart ---------- */

function renderExpenseDonut(data) {
  const colors = [
    '#6c8cff', '#a78bfa', '#f472b6', '#fb923c', '#fbbf24',
    '#34d399', '#22d3ee', '#60a5fa', '#c084fc', '#f87171',
  ];

  const options = {
    series: data.map(d => Math.round(d.total)),
    labels: data.map(d => d.name),
    chart: {
      type: 'donut',
      height: 300,
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    colors: colors.slice(0, data.length),
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, color: '#6b6c72', fontSize: '12px' },
            value: {
              show: true,
              color: '#393a3d',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              formatter: (v) => formatCAD(parseInt(v)),
            },
            total: {
              show: true,
              label: 'Total',
              color: '#6b6c72',
              fontSize: '12px',
              formatter: (w) => formatCAD(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
            },
          },
        },
      },
    },
    stroke: { width: 0 },
    legend: {
      position: 'bottom',
      labels: { colors: '#6b6c72' },
      fontSize: '11px',
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (v) => formatCAD(v) },
    },
    dataLabels: { enabled: false },
  };

  const chart = new ApexCharts(document.getElementById('chart-expenses'), options);
  chart.render();
  charts.push(chart);
}

/* ---------- Revenue by Activity Horizontal Bar Chart ---------- */

function renderActivityChart(data) {
  const options = {
    series: [{
      name: 'Revenus',
      data: data.map(d => Math.round(d.total)),
    }],
    chart: {
      type: 'bar',
      height: Math.max(200, data.length * 50),
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    colors: ['#6c8cff'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '50%',
        distributed: true,
        dataLabels: { position: 'bottom' },
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'horizontal',
        gradientToColors: ['#22d3ee'],
        opacityFrom: 1,
        opacityTo: 0.8,
      },
    },
    colors: ['#6c8cff', '#a78bfa', '#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#fb923c'],
    dataLabels: {
      enabled: true,
      formatter: (v) => formatCAD(v),
      style: {
        colors: ['#393a3d'],
        fontSize: '12px',
        fontFamily: 'JetBrains Mono',
        fontWeight: 500,
      },
      offsetX: 8,
    },
    xaxis: {
      labels: {
        style: { colors: '#6b6c72', fontSize: '11px' },
        formatter: (v) => formatCAD(v, false),
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#393a3d', fontSize: '12px', fontWeight: 500 },
      },
    },
    categories: data.map(d => d.name),
    grid: {
      borderColor: 'rgba(255,255,255,0.04)',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (v) => formatCAD(v) },
    },
    legend: { show: false },
  };

  // Fix: set categories in xaxis for horizontal bar
  options.xaxis.categories = data.map(d => d.name);
  delete options.categories;

  const chart = new ApexCharts(document.getElementById('chart-activity'), options);
  chart.render();
  charts.push(chart);
}
