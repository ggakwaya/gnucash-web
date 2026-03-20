/**
 * GnuCash Web — Simple hash-based router
 */

const routes = {};
let currentView = null;

/**
 * Register a view with a route name.
 */
export function registerRoute(name, renderFn) {
  routes[name] = renderFn;
}

/**
 * Initialize the router. Listens for hashchange.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  // Initial route
  handleRoute();
}

/**
 * Handle route change.
 */
async function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const container = document.getElementById('view-container');

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === hash);
  });

  if (routes[hash]) {
    currentView = hash;
    container.innerHTML = '';
    container.style.display = 'block';

    // Reset animation
    container.style.animation = 'none';
    container.offsetHeight; // force reflow
    container.style.animation = '';

    await routes[hash](container);
  }
}

/**
 * Navigate to a specific view programmatically.
 */
export function navigateTo(viewName, params = {}) {
  // Store params for the target view to pick up
  window.__navParams = params;
  window.location.hash = viewName;
}
