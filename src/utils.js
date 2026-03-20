/**
 * GnuCash Web — Utility functions
 */

const CAD = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CAD_NO_CENTS = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format amount as Canadian dollars.
 */
export function formatCAD(amount, showCents = true) {
  return showCents ? CAD.format(amount) : CAD_NO_CENTS.format(amount);
}

/**
 * Format a GnuCash date string (YYYY-MM-DD HH:MM:SS) to locale date.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format month key (YYYY-MM) to readable month name.
 */
export function formatMonth(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('fr-CA', { month: 'short', year: '2-digit' });
}

/**
 * Build account tree from flat list.
 */
export function buildAccountTree(accounts) {
  const map = {};
  const roots = [];

  // Index by guid
  accounts.forEach(a => {
    map[a.guid] = { ...a, children: [] };
  });

  // Build parent-child links
  accounts.forEach(a => {
    const node = map[a.guid];
    if (a.parent_guid && map[a.parent_guid]) {
      map[a.parent_guid].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Get emoji icon for account type.
 */
export function getAccountIcon(type) {
  const icons = {
    ROOT: '📁',
    BANK: '🏦',
    CASH: '💵',
    ASSET: '📦',
    LIABILITY: '📋',
    INCOME: '💰',
    EXPENSE: '📊',
    EQUITY: '🏛️',
  };
  return icons[type] || '📄';
}

/**
 * Compute the recursive balance for a tree node.
 * For parent accounts, sum the children's balances.
 */
export function computeTreeBalances(node) {
  if (node.children && node.children.length > 0) {
    let childSum = 0;
    node.children.forEach(child => {
      computeTreeBalances(child);
      childSum += child.treeBalance || 0;
    });
    // If the node has its own balance from splits, add it
    node.treeBalance = (node.balance || 0) + childSum;
  } else {
    node.treeBalance = node.balance || 0;
  }
}

/**
 * Determine the display balance (handle sign conventions).
 * Income and Liability accounts are naturally negative in double-entry.
 */
export function displayBalance(amount, accountType) {
  if (['INCOME', 'LIABILITY', 'EQUITY'].includes(accountType)) {
    return -amount; // Flip sign for display
  }
  return amount;
}
