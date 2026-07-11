// ===== CONFIG =====
const API = 'https://constructionhub-production.up.railway.app';

// ===== HELPERS =====
function getToken() { return localStorage.getItem('ch_token'); }
function saveToken(t) { localStorage.setItem('ch_token', t); }
function clearToken() { localStorage.removeItem('ch_token'); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ===== MODAL FUNCTIONS =====
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function switchModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
});

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.style.display = 'flex';
  setTimeout(() => t.style.display = 'none', 3500);
}

// ===== ACTIVATE DASHBOARD =====
function activateDashboard(name, role, initials) {
  document.getElementById('main-site').classList.add('hidden');
  document.getElementById('dashboard').classList.add('active');
  ['dash-name', 'sidebar-name', 'welcome-name'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = name;
  });
  ['dash-avatar', 'sidebar-avatar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = initials;
  });
  document.getElementById('sidebar-role').textContent = role;
  window.scrollTo(0, 0);
  loadMyProjects();
}

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value.trim();
  if (!email || !pass) { showToast('Please fill in all fields.'); return; }
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    saveToken(data.token);
    closeModal('loginModal');
    activateDashboard(data.user.name, data.user.accountType, data.user.initials);
    showToast('Welcome back, ' + data.user.name.split(' ')[0] + '!');
  } catch (err) {
    showToast(err.message);
  }
}

// ===== REGISTER =====
async function doRegister() {
  const fname = document.getElementById('reg-fname').value.trim();
  const lname = document.getElementById('reg-lname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const type  = document.getElementById('reg-type').value;
  const pass  = document.getElementById('reg-pass').value.trim();
  if (!fname || !lname || !email || !pass || !type) { showToast('Please fill in all required fields.'); return; }
  try {
    const data = await apiFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ firstName: fname, lastName: lname, email, phone, password: pass, accountType: type })
    });
    saveToken(data.token);
    closeModal('registerModal');
    activateDashboard(data.user.name, data.user.accountType, data.user.initials);
    showToast('Welcome to ConstructionHub Kenya, ' + fname + '!');
  } catch (err) {
    showToast(err.message);
  }
}

// ===== LOGOUT =====
function logout() {
  clearToken();
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('main-site').classList.remove('hidden');
  showToast('Logged out successfully.');
  window.scrollTo(0, 0);
}

// ===== POST PROJECT =====
async function postProject() {
  const title       = document.querySelector('#postJobModal input[placeholder="e.g. 3-Bedroom House Construction"]').value.trim();
  const category    = document.querySelector('#postJobModal select').value;
  const location    = document.querySelector('#postJobModal input[placeholder="Nairobi, Kenya"]').value.trim();
  const budget      = document.querySelector('#postJobModal input[type="number"]').value.trim();
  const description = document.querySelector('#postJobModal textarea').value.trim();
  if (!title || !category || !location || !budget || !description) {
    showToast('Please fill in all project fields.'); return;
  }
  try {
    await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title, category, location, budget: Number(budget), description })
    });
    closeModal('postJobModal');
    showToast('Project posted! You will receive bids shortly.');
    loadMyProjects();
  } catch (err) {
    showToast(err.message);
  }
}

// ===== LOAD MY PROJECTS INTO DASHBOARD =====
async function loadMyProjects() {
  if (!getToken()) return;
  try {
    const projects = await apiFetch('/api/projects/mine');
    const container = document.getElementById('my-projects-list');
    if (!container) return;
    if (projects.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);">No projects posted yet.</p>';
      return;
    }
    container.innerHTML = projects.map(p => `
      <div class="request-card">
        <div class="req-header">
          <div class="req-icon blue"><i class="fas fa-hard-hat"></i></div>
          <div style="flex:1;">
            <div class="req-title">${p.title}</div>
            <div class="req-detail"><strong>${p.category}</strong> · ${p.location}</div>
          </div>
          <span class="badge badge-green">${p.status}</span>
        </div>
        <div class="req-footer">
          <span class="req-bids">${p.bids} bids</span>
          <span style="font-size:12px;font-weight:700;color:var(--orange);">KES ${Number(p.budget).toLocaleString()}</span>
          <span class="req-time">${new Date(p.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } catch {
    // silently fail
  }
}

// ===== AUTO LOGIN IF TOKEN EXISTS =====
window.addEventListener('DOMContentLoaded', async () => {
  if (getToken()) {
    try {
      const data = await apiFetch('/api/me');
      const name = `${data.firstName} ${data.lastName}`;
      const initials = (data.firstName[0] + data.lastName[0]).toUpperCase();
      activateDashboard(name, data.accountType, initials);
    } catch {
      clearToken(); // token expired or invalid
    }
  }
});

// ===== DASHBOARD PANELS =====
function showPanel(name, el) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  if (el) { el.classList.add('active'); el.blur(); }
  return false;
}

// ===== SMOOTH SCROLL =====
function smoothScroll(id) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

// ===== SEARCH =====
function doSearch() {
  const q = document.getElementById('main-search').value.trim();
  if (!q) { showToast('Please enter something to search for.'); return; }
  const cat = document.querySelector('.search-cat.selected');
  const catName = cat ? cat.textContent.trim() : 'All Categories';
  showToast('Searching for "' + q + '" in ' + catName + '...');
  const catMap = { 'Workers': 'sec-workers', 'Equipment': 'sec-equipment', 'Consultants': 'sec-consultants' };
  if (cat) {
    const key = Object.keys(catMap).find(k => cat.textContent.includes(k));
    if (key) smoothScroll(catMap[key]);
  }
}

// ===== FILTER CAT =====
function filterCat(section, el) {
  document.querySelectorAll('.search-cat').forEach(c => {
    c.classList.remove('selected'); c.style.borderColor = ''; c.style.color = '';
  });
  el.classList.add('selected');
  el.style.borderColor = 'var(--orange)'; el.style.color = 'var(--orange)';
  smoothScroll('sec-' + section);
}

// ===== DROPDOWN TOGGLE =====
function toggleDrop(id) {
  const drop = document.getElementById(id);
  const isActive = drop.classList.contains('active');
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
  if (!isActive) drop.classList.add('active');
}
document.addEventListener('click', function (e) {
  if (!e.target.closest('.icon-wrap')) document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
});

// ===== SEARCH CAT CLICK =====
document.querySelectorAll('.search-cat').forEach(c => {
  c.addEventListener('click', function () {
    document.querySelectorAll('.search-cat').forEach(x => x.style.borderColor = '');
    this.style.borderColor = 'var(--orange)'; this.style.color = 'var(--orange)';
  });
});

// ===== CHAT =====
function sendMsg() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  const body = document.getElementById('chat-body');
  const div = document.createElement('div');
  div.style.cssText = 'background:var(--orange);padding:10px 14px;border-radius:10px;max-width:75%;margin-left:auto;margin-bottom:8px;font-size:13px;color:#fff;';
  div.textContent = msg;
  body.appendChild(div);
  input.value = '';
  body.scrollTop = body.scrollHeight;
}
