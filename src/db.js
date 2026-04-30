/**
 * GnuCash Web — Database access layer
 * Loads the .gnucash SQLite file via sql.js (WASM) and provides query functions.
 */

import initSqlJs from 'sql.js';

let db = null;
let SQL = null;
let currentDbName = null;

/**
 * Initialize sql.js WASM engine (call once).
 */
async function ensureSqlReady() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });
  }
  return SQL;
}

/**
 * Initialize sql.js and open the default GnuCash database from public/.
 * The filename is resolved from /db.config.json so it never needs to be
 * hardcoded in source — just update db.config.json when the file changes.
 */
export async function initDatabase() {
  await ensureSqlReady();

  // Resolve the default DB filename from config (avoids hardcoding)
  const configResponse = await fetch('/db.config.json');
  if (!configResponse.ok) {
    throw new Error('db.config.json introuvable — impossible de charger la base par défaut.');
  }
  const config = await configResponse.json();
  const fileName = config.defaultDb;
  if (!fileName) {
    throw new Error('db.config.json ne contient pas de clé "defaultDb".');
  }

  const response = await fetch(`/${fileName}`);
  if (!response.ok) {
    throw new Error(`Fichier introuvable : ${fileName}`);
  }
  const buffer = await response.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  currentDbName = fileName;

  return db;
}

/**
 * Load a database from an ArrayBuffer (drag-and-drop / file picker).
 * Closes the previous database if any.
 */
export async function loadDatabaseFromBuffer(arrayBuffer, fileName = null) {
  await ensureSqlReady();

  if (db) {
    db.close();
    db = null;
  }

  db = new SQL.Database(new Uint8Array(arrayBuffer));
  currentDbName = fileName || null;
  return db;
}

/**
 * Get the name of the currently loaded database file.
 */
export function getCurrentDbName() {
  return currentDbName;
}

/**
 * Check if a database is currently loaded.
 */
export function isDatabaseLoaded() {
  return db !== null;
}

/**
 * Validate that the loaded database has the expected GnuCash schema.
 * Throws if required tables are missing.
 */
export function validateSchema() {
  if (!db) throw new Error('Aucune base de données chargée.');
  const required = ['accounts', 'transactions', 'splits', 'commodities'];
  const missing = required.filter(table => {
    try {
      const result = db.exec(`SELECT 1 FROM ${table} LIMIT 1`);
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    throw new Error(`Schéma invalide — tables manquantes : ${missing.join(', ')}. Ce fichier n'est pas une base GnuCash valide.`);
  }
}

/**
 * Run a SQL query and return rows as an array of objects.
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/* ================== ACCOUNTS ================== */

/**
 * Get all accounts as a flat list.
 */
export function getAccounts() {
  return query(`
    SELECT
      a.guid, a.name, a.account_type, a.description,
      a.parent_guid, a.hidden, a.placeholder,
      c.mnemonic as currency
    FROM accounts a
    LEFT JOIN commodities c ON a.commodity_guid = c.guid
    ORDER BY a.name
  `);
}

/**
 * Get the balance for a specific account (sum of all splits).
 */
export function getAccountBalance(guid) {
  const result = query(`
    SELECT COALESCE(SUM(CAST(value_num AS REAL) / value_denom), 0) as balance
    FROM splits
    WHERE account_guid = ?
  `, [guid]);
  return result[0]?.balance || 0;
}

/**
 * Get all accounts with their computed balances.
 */
export function getAccountsWithBalances() {
  return query(`
    SELECT
      a.guid, a.name, a.account_type, a.description,
      a.parent_guid, a.hidden, a.placeholder,
      c.mnemonic as currency,
      COALESCE(SUM(CAST(s.value_num AS REAL) / s.value_denom), 0) as balance
    FROM accounts a
    LEFT JOIN commodities c ON a.commodity_guid = c.guid
    LEFT JOIN splits s ON s.account_guid = a.guid
    GROUP BY a.guid
    ORDER BY a.name
  `);
}

/* ================== KPI / DASHBOARD ================== */

/**
 * Get KPIs: total revenue, total expenses, net profit, transaction count.
 */
export function getKPIs() {
  const revenue = query(`
    SELECT COALESCE(SUM(CAST(s.value_num AS REAL) / s.value_denom), 0) as total
    FROM splits s
    JOIN accounts a ON a.guid = s.account_guid
    WHERE a.account_type = 'INCOME'
  `);

  const expenses = query(`
    SELECT COALESCE(SUM(CAST(s.value_num AS REAL) / s.value_denom), 0) as total
    FROM splits s
    JOIN accounts a ON a.guid = s.account_guid
    WHERE a.account_type = 'EXPENSE'
  `);

  const txCount = query(`SELECT COUNT(*) as count FROM transactions`);

  return {
    revenue: Math.abs(revenue[0]?.total || 0),
    expenses: expenses[0]?.total || 0,
    profit: Math.abs(revenue[0]?.total || 0) - (expenses[0]?.total || 0),
    transactionCount: txCount[0]?.count || 0,
  };
}

/**
 * Get monthly revenue and expenses for the bar chart.
 */
export function getMonthlyRevenueExpenses() {
  const data = query(`
    SELECT
      strftime('%Y-%m', t.post_date) as month,
      a.account_type,
      SUM(CAST(s.value_num AS REAL) / s.value_denom) as total
    FROM splits s
    JOIN transactions t ON t.guid = s.tx_guid
    JOIN accounts a ON a.guid = s.account_guid
    WHERE a.account_type IN ('INCOME', 'EXPENSE')
    GROUP BY month, a.account_type
    ORDER BY month
  `);

  const months = [...new Set(data.map(r => r.month))];
  const revenue = months.map(m => {
    const row = data.find(r => r.month === m && r.account_type === 'INCOME');
    return Math.abs(row?.total || 0);
  });
  const expenses = months.map(m => {
    const row = data.find(r => r.month === m && r.account_type === 'EXPENSE');
    return row?.total || 0;
  });

  return { months, revenue, expenses };
}

/**
 * Get expense breakdown by category (top-level expense accounts).
 */
export function getExpenseBreakdown() {
  return query(`
    SELECT
      a.name,
      SUM(CAST(s.value_num AS REAL) / s.value_denom) as total
    FROM splits s
    JOIN accounts a ON a.guid = s.account_guid
    WHERE a.account_type = 'EXPENSE'
      AND a.parent_guid IN (
        SELECT guid FROM accounts WHERE account_type = 'EXPENSE' AND parent_guid IN (
          SELECT guid FROM accounts WHERE account_type = 'ROOT'
            UNION SELECT guid FROM accounts WHERE name = 'Charges'
        )
      )
    GROUP BY a.guid
    HAVING total > 0
    ORDER BY total DESC
    LIMIT 10
  `);
}

/**
 * Get revenue by activity (Consultation vs SplitboardQC).
 */
export function getRevenueByActivity() {
  return query(`
    SELECT
      a.name,
      ABS(SUM(CAST(s.value_num AS REAL) / s.value_denom)) as total
    FROM splits s
    JOIN accounts a ON a.guid = s.account_guid
    WHERE a.account_type = 'INCOME'
    GROUP BY a.guid
    HAVING total > 0
    ORDER BY total DESC
  `);
}

/* ================== 2025 REPORTING ================== */

/**
 * Get all filtered splits for the 2025 exercise.
 */
export function getSplits2025() {
  return query(`
    SELECT
      a.name as account_name,
      a.account_type,
      a.code,
      a.guid as account_guid,
      a.parent_guid,
      CAST(s.value_num AS REAL) / s.value_denom as amount,
      t.post_date,
      t.description
    FROM splits s
    JOIN transactions t ON s.tx_guid = t.guid
    JOIN accounts a ON s.account_guid = a.guid
    WHERE t.post_date >= '2025-01-01' AND t.post_date <= '2025-12-31 23:59:59'
  `);
}

/**
 * Get current balance for all accounts at end of 2025
 */
export function getBalancesEnd2025() {
  return query(`
    SELECT
      a.name as account_name,
      a.account_type,
      a.code,
      a.guid as account_guid,
      SUM(CAST(s.value_num AS REAL) / s.value_denom) as balance
    FROM splits s
    JOIN transactions t ON s.tx_guid = t.guid
    JOIN accounts a ON s.account_guid = a.guid
    WHERE t.post_date <= '2025-12-31 23:59:59'
    GROUP BY a.guid
  `);
}

/* ================== GENERAL LEDGER ================== */

/**
 * Get transactions for the ledger, with filtering support.
 */
export function getTransactions({ startDate, endDate, accountGuid, search } = {}) {
  // Build a query that separates debit accounts from credit accounts
  let sql = `
    SELECT
      t.guid as tx_guid,
      t.post_date,
      t.description,
      t.num,
      GROUP_CONCAT(DISTINCT CASE WHEN s.value_num > 0 THEN a.name END) as debit_accounts,
      GROUP_CONCAT(DISTINCT CASE WHEN s.value_num < 0 THEN a.name END) as credit_accounts,
      SUM(CASE WHEN s.value_num > 0 THEN CAST(s.value_num AS REAL) / s.value_denom ELSE 0 END) as debit,
      SUM(CASE WHEN s.value_num < 0 THEN ABS(CAST(s.value_num AS REAL) / s.value_denom) ELSE 0 END) as credit
    FROM transactions t
    JOIN splits s ON s.tx_guid = t.guid
    JOIN accounts a ON a.guid = s.account_guid
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ` AND t.post_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND t.post_date <= ?`;
    params.push(endDate + ' 23:59:59');
  }
  if (accountGuid) {
    sql += ` AND t.guid IN (SELECT tx_guid FROM splits WHERE account_guid = ?)`;
    params.push(accountGuid);
  }
  if (search) {
    sql += ` AND t.description LIKE ?`;
    params.push(`%${search}%`);
  }

  sql += ` GROUP BY t.guid ORDER BY t.post_date DESC`;

  return query(sql, params);
}

/**
 * Get all splits for a specific transaction.
 */
export function getTransactionSplits(txGuid) {
  return query(`
    SELECT
      s.guid,
      a.name as account_name,
      a.account_type,
      s.memo,
      s.reconcile_state,
      CAST(s.value_num AS REAL) / s.value_denom as amount
    FROM splits s
    JOIN accounts a ON a.guid = s.account_guid
    WHERE s.tx_guid = ?
    ORDER BY s.value_num DESC
  `, [txGuid]);
}

/* ================== GENERIC FINANCIAL REPORTS ================== */

/**
 * Get aggregated balances for all accounts as of a specific date.
 */
export function getAccountBalancesAsOf(date) {
  return query(`
    SELECT
      a.guid, a.account_type, a.name, a.code, a.parent_guid,
      COALESCE(SUM(CAST(s.value_num AS REAL) / s.value_denom), 0) as balance
    FROM accounts a
    LEFT JOIN splits s ON s.account_guid = a.guid
    LEFT JOIN transactions t ON s.tx_guid = t.guid
    WHERE (t.post_date <= ?) OR s.guid IS NULL
    GROUP BY a.guid
  `, [date + ' 23:59:59']);
}

/**
 * Get balance deltas (sums of splits) for a specific date range.
 * Useful for P&L and Cash Flow.
 */
export function getAccountBalancesDelta(startDate, endDate) {
  return query(`
    SELECT
      a.guid, a.account_type, a.name, a.code, a.parent_guid,
      COALESCE(SUM(CAST(s.value_num AS REAL) / s.value_denom), 0) as balance
    FROM accounts a
    LEFT JOIN splits s ON s.account_guid = a.guid
    LEFT JOIN transactions t ON s.tx_guid = t.guid
    WHERE (t.post_date >= ? AND t.post_date <= ?) OR s.guid IS NULL
    GROUP BY a.guid
  `, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
}

/**
 * Get all distinct account names for the filter dropdown.
 */
export function getAccountList() {
  return query(`
    SELECT guid, name, account_type
    FROM accounts
    WHERE account_type NOT IN ('ROOT')
    ORDER BY name
  `);
}

/**
 * Get database metadata (date range, counts).
 */
export function getDatabaseInfo() {
  const dateRange = query(`SELECT MIN(post_date) as min_date, MAX(post_date) as max_date FROM transactions`);
  const txCount = query(`SELECT COUNT(*) as count FROM transactions`);
  const acctCount = query(`SELECT COUNT(*) as count FROM accounts WHERE account_type != 'ROOT'`);

  return {
    minDate: dateRange[0]?.min_date?.substring(0, 10) || '',
    maxDate: dateRange[0]?.max_date?.substring(0, 10) || '',
    transactionCount: txCount[0]?.count || 0,
    accountCount: acctCount[0]?.count || 0,
  };
}
