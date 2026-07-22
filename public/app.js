// ===== CONFIG =====
const API = 'https://constructionhub-production.up.railway.app';

// ===== HELPERS =====
function getToken() { return localStorage.getItem('ch_token'); }
function saveToken(t) { localStorage.setItem('ch_token', t); }
function clearToken() { localStorage.removeItem('ch_token'); }
let currentUserEmail = '';
let currentUserRole = '';
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('openModal: no element with id "' + id + '"'); return; }
  el.classList.add('active');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('closeModal: no element with id "' + id + '"'); return; }
  el.classList.remove('active');
}
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
function activateDashboard(name, role, initials, email) {
  currentUserEmail = email || '';
  currentUserRole = role || '';
  document.getElementById('main-site').classList.add('hidden');
  document.getElementById('dashboard').classList.add('active');
  ['dash-name', 'sidebar-name', 'welcome-name'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = name;
  });
  ['dash-avatar', 'sidebar-avatar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = initials;
  });
  document.getElementById('sidebar-role').textContent = role;
  const eqActions = document.getElementById('equipment-owner-actions');
  if (eqActions) eqActions.style.display = (role === 'Equipment Owner') ? 'block' : 'none';
  const dashMain = document.querySelector('.dash-main');
  if (dashMain) { setTimeout(() => dashMain.scrollIntoView({ behavior: 'auto', block: 'start' }), 30); }
  else { window.scrollTo(0, 0); }
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
    if (typeof closeAuthModal === 'function') closeAuthModal(); else closeModal('authModal');
    activateDashboard(data.user.name, data.user.accountType, data.user.initials, data.user.email);
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
    if (typeof closeAuthModal === 'function') closeAuthModal(); else closeModal('authModal');
    activateDashboard(data.user.name, data.user.accountType, data.user.initials, data.user.email);
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
            <div class="req-title">${escapeHtml(p.title)}</div>
            <div class="req-detail"><strong>${escapeHtml(p.category)}</strong> · ${escapeHtml(p.location)}</div>
          </div>
          <span class="badge badge-green">${escapeHtml(p.status)}</span>
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

// ===== BROWSE OPEN PROJECTS (any account type can bid on anyone else's project) =====
async function loadBrowseProjects() {
  const container = document.getElementById('browse-projects-list');
  if (!container) return;
  try {
    const projects = await apiFetch('/api/projects');
    const others = projects.filter(p => !p.postedBy || p.postedBy.email !== currentUserEmail);
    if (others.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);">No open projects from other users yet.</p>';
      return;
    }
    container.innerHTML = others.map(p => {
      const posterName = p.postedBy ? escapeHtml(p.postedBy.firstName + ' ' + p.postedBy.lastName) : 'Unknown';
      const posterType = p.postedBy ? escapeHtml(p.postedBy.accountType) : '';
      return `
      <div class="request-card" style="margin-bottom:12px;">
        <div class="req-header">
          <div class="req-icon blue"><i class="fas fa-hard-hat"></i></div>
          <div style="flex:1;">
            <div class="req-title">${escapeHtml(p.title)}</div>
            <div class="req-detail"><strong>${escapeHtml(p.category)}</strong> · ${escapeHtml(p.location)} · Posted by ${posterName} (${posterType})</div>
          </div>
          <span class="badge badge-orange">${escapeHtml(p.status)}</span>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:8px 0;">${escapeHtml(p.description)}</p>
        <div class="req-footer" style="gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:700;color:var(--orange);">Budget: KES ${Number(p.budget).toLocaleString()}</span>
          <span class="req-bids">${p.bids} bids so far</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <input type="number" id="bid-amount-${p._id}" placeholder="Your bid (KES)" style="flex:1;min-width:120px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;">
          <input type="text" id="bid-msg-${p._id}" placeholder="Optional message" style="flex:2;min-width:140px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;">
          <button class="btn btn-orange btn-sm" onclick="placeBid('${p._id}')">Place Bid</button>
        </div>
      </div>
    `; }).join('');
  } catch (err) {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Could not load open projects.</p>';
  }
}

async function placeBid(projectId) {
  const amountEl = document.getElementById('bid-amount-' + projectId);
  const msgEl = document.getElementById('bid-msg-' + projectId);
  const amount = amountEl ? amountEl.value.trim() : '';
  const message = msgEl ? msgEl.value.trim() : '';
  if (!amount) { showToast('Please enter a bid amount.'); return; }
  try {
    await apiFetch('/api/projects/' + projectId + '/bids', {
      method: 'POST',
      body: JSON.stringify({ amount: Number(amount), message })
    });
    showToast('Bid placed successfully!');
    loadBrowseProjects();
    loadMyBidsPlaced();
  } catch (err) {
    showToast(err.message);
  }
}

// ===== BIDS RECEIVED ON MY PROJECTS (project owner reviews and accepts/rejects) =====
async function loadBidsReceived() {
  const container = document.getElementById('bids-received-list');
  if (!container || !getToken()) return;
  try {
    const myProjects = await apiFetch('/api/projects/mine');
    if (myProjects.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);">You have not posted any projects yet.</p>';
      return;
    }
    const bidLists = await Promise.all(myProjects.map(p =>
      apiFetch('/api/projects/' + p._id + '/bids').then(bids => ({ project: p, bids }))
    ));
    const rows = [];
    bidLists.forEach(({ project, bids }) => {
      bids.forEach(b => {
        const bidderName = b.bidder ? escapeHtml(b.bidder.firstName + ' ' + b.bidder.lastName) : 'Unknown';
        const bidderType = b.bidder ? escapeHtml(b.bidder.accountType) : '';
        const badgeClass = b.status === 'Accepted' ? 'badge-green' : b.status === 'Rejected' ? 'badge-gray' : 'badge-orange';
        const actions = b.status === 'Pending'
          ? `<button class="btn btn-green btn-sm" onclick="respondToBid('${b._id}','Accepted')">Accept</button>
             <button class="btn btn-sm" style="background:var(--light);border:1px solid var(--border);" onclick="respondToBid('${b._id}','Rejected')">Reject</button>`
          : `<span class="badge ${badgeClass}">${escapeHtml(b.status)}</span>`;
        rows.push(`<tr>
          <td>${bidderName} <small style="color:var(--muted);">(${bidderType})</small></td>
          <td>${escapeHtml(project.title)}</td>
          <td>KES ${Number(b.amount).toLocaleString()}</td>
          <td>${escapeHtml(b.message || '—')}</td>
          <td>${actions}</td>
        </tr>`);
      });
    });
    if (rows.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);">No bids received yet.</p>';
      return;
    }
    container.innerHTML = `<div class="dash-card"><table>
      <tr><th>Bidder</th><th>Project</th><th>Amount</th><th>Message</th><th>Action</th></tr>
      ${rows.join('')}
    </table></div>`;
  } catch {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Could not load bids.</p>';
  }
}

async function respondToBid(bidId, status) {
  try {
    await apiFetch('/api/bids/' + bidId + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast('Bid ' + status.toLowerCase() + '.');
    loadBidsReceived();
    loadMyProjects();
  } catch (err) {
    showToast(err.message);
  }
}

// ===== BIDS I HAVE PLACED ON OTHERS' PROJECTS =====
async function loadMyBidsPlaced() {
  const container = document.getElementById('my-bids-list');
  if (!container || !getToken()) return;
  try {
    const bids = await apiFetch('/api/bids/mine');
    if (bids.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);">You have not placed any bids yet.</p>';
      return;
    }
    const rows = bids.map(b => {
      const badgeClass = b.status === 'Accepted' ? 'badge-green' : b.status === 'Rejected' ? 'badge-gray' : 'badge-orange';
      return `<tr>
        <td>${b.project ? escapeHtml(b.project.title) : 'Project removed'}</td>
        <td>KES ${Number(b.amount).toLocaleString()}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(b.status)}</span></td>
        <td>${new Date(b.createdAt).toLocaleDateString()}</td>
      </tr>`;
    }).join('');
    container.innerHTML = `<div class="dash-card"><table>
      <tr><th>Project</th><th>Your Bid</th><th>Status</th><th>Placed</th></tr>
      ${rows}
    </table></div>`;
  } catch {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Could not load your bids.</p>';
  }
}


// ===== AUTO LOGIN IF TOKEN EXISTS =====
window.addEventListener('DOMContentLoaded', async () => {
  if (getToken()) {
    try {
      const data = await apiFetch('/api/me');
      const name = `${data.firstName} ${data.lastName}`;
      const initials = (data.firstName[0] + data.lastName[0]).toUpperCase();
      activateDashboard(name, data.accountType, initials, data.email);
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
  if (panel) {
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
  if (name === 'bids') {
    loadBrowseProjects();
    loadBidsReceived();
    loadMyBidsPlaced();
  }
  if (name === 'contractors') loadContractors();
  if (name === 'consultants') loadConsultants();
  if (name === 'equipment') loadEquipment();
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

// ===== CONTRACTORS / CONSULTANTS DIRECTORY (real registered users) =====
function initials(u) { return ((u.firstName || '?')[0] + (u.lastName || '?')[0]).toUpperCase(); }
function ratingLine(u) {
  return u.rating ? `⭐ ${u.rating} (${u.reviewCount || 0} reviews)` : 'No reviews yet';
}

async function loadDirectory(accountType, containerId, layout) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const users = await apiFetch('/api/users?type=' + encodeURIComponent(accountType));
    if (users.length === 0) {
      container.innerHTML = `<p style="font-size:13px;color:var(--muted);grid-column:1/-1;">No ${escapeHtml(accountType)} accounts registered yet.</p>`;
      return;
    }
    if (layout === 'wide') {
      container.innerHTML = users.map(u => `
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;">
          <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,var(--orange),#dc2626);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;">${initials(u)}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;"><h4 style="font-size:15px;">${escapeHtml(u.firstName + ' ' + u.lastName)}</h4></div>
            <div style="font-size:12px;color:var(--muted);">${escapeHtml(u.specialty || u.accountType)} · ${u.experienceYears || 0} Yrs Exp. · ${escapeHtml(u.location)}</div>
            <div style="font-size:12px;margin:5px 0;">${ratingLine(u)}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-orange btn-sm" onclick="showToast('Hire request sent to ${escapeHtml(u.firstName)}...')">Hire</button>
              <button class="btn btn-sm" style="background:var(--light);border:1px solid var(--border);" onclick="showToast('${escapeHtml(u.bio || 'No bio added yet.')}')">View Profile</button>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = users.map(u => `
        <div class="card" style="text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--orange);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;margin:0 auto 10px;">${initials(u)}</div>
          <h4 style="font-size:15px;">${escapeHtml(u.firstName + ' ' + u.lastName)}</h4>
          <p style="font-size:12px;color:var(--muted);">${escapeHtml(u.specialty || u.accountType)} · ${escapeHtml(u.location)}</p>
          <div style="font-size:12px;margin:6px 0;">${ratingLine(u)}</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-orange btn-sm" onclick="showToast('Hire request sent to ${escapeHtml(u.firstName)}...')">Hire</button>
            <button class="btn btn-sm" style="background:var(--light);border:1px solid var(--border);" onclick="showToast('${escapeHtml(u.bio || 'No bio added yet.')}')">Profile</button>
          </div>
        </div>
      `).join('');
    }
  } catch {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Could not load listings.</p>';
  }
}
function loadContractors() { loadDirectory('Contractor / Worker', 'contractors-live-list', 'compact'); }
function loadConsultants() { loadDirectory('Consultant / Professional', 'consultants-live-list', 'wide'); }

// ===== EQUIPMENT LISTINGS (real, posted by Equipment Owner accounts) =====
async function loadEquipment() {
  const container = document.getElementById('equipment-live-list');
  if (!container) return;
  try {
    const items = await apiFetch('/api/equipment');
    if (items.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--muted);grid-column:1/-1;">No equipment listed yet.</p>';
      return;
    }
    container.innerHTML = items.map(e => `
      <div class="card" style="text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🚜</div>
        <h4 style="font-size:15px;">${escapeHtml(e.title)}</h4>
        <div style="color:var(--orange);font-weight:700;font-size:14px;margin:6px 0;">KES ${Number(e.dailyRate).toLocaleString()}/day</div>
        <div style="font-size:12px;color:var(--muted);">📍 ${escapeHtml(e.location)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">Listed by ${e.owner ? escapeHtml(e.owner.firstName + ' ' + e.owner.lastName) : 'Unknown'}</div>
        <div style="margin:6px 0;"><span class="avail">${e.available ? 'Available' : 'Unavailable'}</span></div>
        <button class="btn btn-orange btn-sm" style="width:100%;margin-top:8px;" onclick="showToast('Booking ${escapeHtml(e.title)}...')">Rent Now</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Could not load equipment.</p>';
  }
}

async function listEquipment() {
  const title = document.getElementById('eq-title').value.trim();
  const category = document.getElementById('eq-category').value.trim();
  const dailyRate = document.getElementById('eq-rate').value.trim();
  const location = document.getElementById('eq-location').value.trim();
  if (!title || !dailyRate || !location) { showToast('Please fill in title, rate, and location.'); return; }
  try {
    await apiFetch('/api/equipment', {
      method: 'POST',
      body: JSON.stringify({ title, category, dailyRate: Number(dailyRate), location })
    });
    showToast('Equipment listed successfully!');
    document.getElementById('eq-title').value = '';
    document.getElementById('eq-category').value = '';
    document.getElementById('eq-rate').value = '';
    document.getElementById('eq-location').value = '';
    document.getElementById('list-equipment-form').style.display = 'none';
    loadEquipment();
  } catch (err) {
    showToast(err.message);
  }
}

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
