/**
 * GnuCash Web — Chart of Accounts (Plan comptable) View
 * Interactive tree/accordion with balances.
 */

import { getAccountsWithBalances } from '../db.js';
import { buildAccountTree, computeTreeBalances, getAccountIcon, formatCAD, displayBalance, escapeHtml } from '../utils.js';
import { navigateTo } from '../router.js';

/**
 * Render the accounts view.
 */
export async function renderAccounts(container) {
  const accounts = getAccountsWithBalances();
  const tree = buildAccountTree(accounts);

  // Compute recursive balances
  tree.forEach(root => computeTreeBalances(root));

  // Find the main root (non-Template)
  const mainRoots = tree.filter(r => r.name !== 'Template Root');

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Plan comptable</h2>
      <p class="view-subtitle">${accounts.length} comptes — Hiérarchie et soldes courants</p>
    </div>
    <div class="glass-card" id="accounts-tree-container" style="padding: 0; overflow: hidden;">
      <div style="padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: var(--space-md);">
        <input type="text" id="account-search" class="filter-input" placeholder="Rechercher un compte…" style="flex: 1;" />
      </div>
      <div style="padding: var(--space-sm) 0; max-height: calc(100vh - 240px); overflow-y: auto;">
        <ul class="account-tree" id="account-tree-root"></ul>
      </div>
    </div>
  `;

  const treeRoot = document.getElementById('account-tree-root');
  mainRoots.forEach(root => {
    if (root.children && root.children.length > 0) {
      root.children.forEach(child => {
        treeRoot.appendChild(renderAccountNode(child, true));
      });
    }
  });

  // Search filter
  const searchInput = document.getElementById('account-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterAccountTree(treeRoot, query);
  });
}

/**
 * Render a single account node recursively.
 */
function renderAccountNode(node, expanded = false) {
  const li = document.createElement('li');
  li.className = 'account-item';
  li.dataset.name = node.name.toLowerCase();
  li.dataset.guid = node.guid;

  const hasChildren = node.children && node.children.length > 0;
  const balance = displayBalance(node.treeBalance || 0, node.account_type);
  const isLeaf = !hasChildren;

  const row = document.createElement('div');
  row.className = 'account-row';
  row.innerHTML = `
    <span class="account-toggle ${hasChildren ? (expanded ? 'expanded' : '') : 'leaf'}">▶</span>
    <span class="account-type-icon">${getAccountIcon(node.account_type)}</span>
    <span class="account-name ${hasChildren ? 'parent-account' : ''}">${escapeHtml(node.name)}</span>
    ${node.description ? `<span class="account-description" title="${escapeHtml(node.description)}">${escapeHtml(node.description)}</span>` : ''}
    <span class="account-type-badge ${node.account_type}">${node.account_type}</span>
    <span class="account-balance ${balance >= 0 ? 'positive' : 'negative'}">${formatCAD(Math.abs(balance))}</span>
  `;

  li.appendChild(row);

  if (hasChildren) {
    const childrenUl = document.createElement('ul');
    childrenUl.className = `account-tree account-children ${expanded ? 'expanded' : ''}`;

    node.children
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-CA'))
      .forEach(child => {
        childrenUl.appendChild(renderAccountNode(child, false));
      });

    li.appendChild(childrenUl);

    // Toggle expand/collapse
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const toggle = row.querySelector('.account-toggle');
      const children = li.querySelector('.account-children');
      if (children) {
        children.classList.toggle('expanded');
        toggle.classList.toggle('expanded');
      }
    });
  } else {
    // Leaf node — navigate to ledger filtered by this account
    row.addEventListener('click', () => {
      navigateTo('ledger', { accountGuid: node.guid, accountName: node.name });
    });
    row.style.cursor = 'pointer';
    row.title = 'Voir les transactions de ce compte';
  }

  return li;
}

/**
 * Filter the account tree by search query.
 */
function filterAccountTree(rootUl, query) {
  const items = rootUl.querySelectorAll('.account-item');

  if (!query) {
    items.forEach(item => {
      item.style.display = '';
    });
    return;
  }

  items.forEach(item => {
    const name = item.dataset.name || '';
    const matches = name.includes(query);
    item.style.display = matches ? '' : 'none';

    // If matches, expand all parent containers
    if (matches) {
      let parent = item.parentElement;
      while (parent) {
        if (parent.classList?.contains('account-children')) {
          parent.classList.add('expanded');
          const toggle = parent.previousElementSibling?.querySelector('.account-toggle');
          if (toggle) toggle.classList.add('expanded');
        }
        if (parent.classList?.contains('account-item')) {
          parent.style.display = '';
        }
        parent = parent.parentElement;
      }
    }
  });
}
