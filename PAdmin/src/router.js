import { renderDashboard, renderBuildingPage } from './ui.js';
import { checkSession, logout, getCurrentPAdmin, updateProfile, changePassword } from './auth.js';

const root = document.getElementById('app-root');
const sidebar = document.getElementById('sidebar');
const mobileHeader = document.getElementById('mobile-header');
const breadcrumbs = document.getElementById('breadcrumbs');
const footer = document.getElementById('footer');

export async function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  
  // Also hook up navbar actions
  document.getElementById('btn-nav-logout').addEventListener('click', logout);
  document.getElementById('btn-nav-change-pwd').addEventListener('click', () => {
    document.getElementById('modal-change-password').showModal();
  });

  // Handle change password form
  document.getElementById('form-change-pwd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const curr = document.getElementById('cpwd-current').value;
    const ne = document.getElementById('cpwd-new').value;
    const confirm = document.getElementById('cpwd-confirm').value;
    const errEl = document.getElementById('cpwd-error');

    if (ne !== confirm) {
      errEl.textContent = 'New passwords do not match';
      errEl.classList.remove('hidden');
      return;
    }

    const success = await changePassword(curr, ne);
    if (success) {
      document.getElementById('modal-change-password').close();
      document.getElementById('form-change-pwd').reset();
      errEl.classList.add('hidden');
      alert('Password changed successfully');
    } else {
      errEl.textContent = 'Incorrect Current Password';
      errEl.classList.remove('hidden');
    }
  });

  // Check session on load
  const hasSession = await checkSession();
  if (!hasSession && !window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login';
  } else {
    handleRoute();
  }
}

async function handleRoute() {
  const hash = window.location.hash || '#/dashboard';
  
  // Protected routes check
  if (hash !== '#/login') {
    if (!getCurrentPAdmin()) {
      const hasSession = await checkSession();
      if (!hasSession) {
        window.location.hash = '#/login';
        return;
      }
    }
    // Show nav & footer
    if (sidebar) sidebar.classList.remove('hidden');
    if (mobileHeader) mobileHeader.classList.remove('hidden');
    if (footer) footer.classList.remove('hidden');
  } else {
    if (sidebar) sidebar.classList.add('hidden');
    if (mobileHeader) mobileHeader.classList.add('hidden');
    if (breadcrumbs) breadcrumbs.classList.add('hidden');
    if (footer) footer.classList.add('hidden');
  }

  // Hide mobile menu on navigation
  if (sidebar) sidebar.classList.remove('sidebar-open');
  
  // Clear root
  root.innerHTML = '';

  if (hash === '#/login') {
    renderTemplate('tpl-login');
  } else if (hash === '#/dashboard') {
    updateBreadcrumbs([{ label: 'Dashboard', hash: '#/dashboard' }]);
    renderTemplate('tpl-dashboard');
    renderDashboard();
    
    // Attach event for add building button
    import('./modals.js').then(m => {
      document.getElementById('btn-add-building').onclick = m.openNewBuildingModal;
    });

  } else if (hash.startsWith('#/building/')) {
    const bldgId = hash.replace('#/building/', '');
    updateBreadcrumbs([
      { label: 'Dashboard', hash: '#/dashboard' },
      { label: 'Building Details', hash: hash }
    ]);
    renderTemplate('tpl-building');
    renderBuildingPage(bldgId);

  } else if (hash === '#/profile') {
    updateBreadcrumbs([
      { label: 'Dashboard', hash: '#/dashboard' },
      { label: 'My Profile', hash: '#/profile' }
    ]);
    renderTemplate('tpl-profile');
    
    const admin = getCurrentPAdmin();
    document.getElementById('prof-email').value = admin.Email || '';
    document.getElementById('prof-name').value = admin.Name || '';
    document.getElementById('prof-phone').value = admin.PhoneNumber || '';
    document.getElementById('prof-acc-num').value = admin.AccountNumber || '';
    document.getElementById('prof-bank-name').value = admin.BankName || '';
    document.getElementById('prof-acc-name').value = admin.AccountName || '';

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const success = await updateProfile({
        Name: document.getElementById('prof-name').value,
        PhoneNumber: document.getElementById('prof-phone').value,
        AccountNumber: document.getElementById('prof-acc-num').value,
        BankName: document.getElementById('prof-bank-name').value,
        AccountName: document.getElementById('prof-acc-name').value,
      });
      if (success) alert('Profile updated successfully');
      else alert('Failed to update profile');
    });

  } else {
    // 404 fallback
    window.location.hash = '#/dashboard';
  }
}

function renderTemplate(tplId) {
  const tpl = document.getElementById(tplId);
  const clone = tpl.content.cloneNode(true);
  root.appendChild(clone);
}

function updateBreadcrumbs(crumbs) {
  breadcrumbs.classList.remove('hidden');
  breadcrumbs.innerHTML = crumbs.map((c, i) => {
    return i < crumbs.length - 1 ? `<a href="${c.hash}">${c.label}</a>` : `<span class="active-crumb">${c.label}</span>`;
  }).join('<span class="crumb-separator">/</span>');
}
