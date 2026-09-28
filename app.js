const CLIENTS_KEY = 'alwaystap-clients-v2';
const SETTINGS_KEY = 'alwaystap-settings-v2';
const DEFAULT_PUBLIC_ORIGIN = 'https://alwaystap.vercel.app';
const DEFAULT_SUGGESTIONS = {
  1: ['Wait time', 'Service', 'Product quality', 'Value'],
  2: ['Wait time', 'Service', 'Product quality', 'Value'],
  3: ['Overall experience', 'Service', 'Product quality', 'Value'],
  4: ['Friendly service', 'Product quality', 'Atmosphere', 'Value'],
  5: ['Friendly service', 'Great quality', 'Atmosphere', 'Value']
};

let clients = loadJson(CLIENTS_KEY, []);
let settings = loadJson(SETTINGS_KEY, {});
let currentClient = null;
let selectedRating = 0;
let selectedSuggestions = new Set();

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveClients() { localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46).replace(/-$/g, '') || 'business';
}

function nextSlug(name) {
  const stem = slugify(name);
  const expression = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  const highest = clients.reduce((max, client) => {
    const match = String(client.slug || '').match(expression);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${stem}-${String(highest + 1).padStart(2, '0')}`;
}

function encodeConfig(client) {
  const bytes = new TextEncoder().encode(JSON.stringify({
    n: client.name,
    g: client.googleUrl,
    t: client.tagline,
    a: client.accent,
    l: client.logo || '',
    s: client.suggestions
  }));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeConfig(token) {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function publicOrigin() {
  if (settings.publicOrigin) return settings.publicOrigin;
  return location.protocol === 'https:' ? location.origin : DEFAULT_PUBLIC_ORIGIN;
}

function publicUrl(client) {
  const url = new URL(`/r/${encodeURIComponent(client.slug)}`, publicOrigin());
  url.searchParams.set('c', encodeConfig(client));
  return url.href;
}

function normalizeConfig(config, slug) {
  if (!config || typeof config !== 'object') return null;
  const name = String(config.n || '').trim().slice(0, 70);
  const googleUrl = safeUrl(String(config.g || ''));
  if (!name || !googleUrl) return null;
  const suggestions = {};
  for (let rating = 1; rating <= 5; rating += 1) {
    const source = Array.isArray(config.s?.[rating]) ? config.s[rating] : [];
    suggestions[rating] = source.map(item => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 10);
  }
  const logo = safeUrl(String(config.l || ''));
  return {
    slug,
    name,
    googleUrl,
    tagline: String(config.t || 'Thanks for visiting us today').trim().slice(0, 100),
    accent: /^#[0-9a-f]{6}$/i.test(config.a) ? config.a : '#1677ff',
    logo,
    suggestions
  };
}

function isReviewPath() { return /^\/r\/[^/]+\/?$/.test(location.pathname); }

function render() {
  if (isReviewPath()) {
    const slug = decodeURIComponent(location.pathname.split('/')[2] || '');
    const token = new URLSearchParams(location.search).get('c');
    try { currentClient = token ? normalizeConfig(decodeConfig(token), slug) : null; }
    catch { currentClient = null; }
    currentClient ? renderReview() : renderReviewError();
    return;
  }
  renderAdmin();
}

function renderAdmin() {
  document.title = 'AlwaysTap — Client studio';
  document.body.style.setProperty('--green', '#1677ff');
  const origin = publicOrigin();
  document.getElementById('app').innerHTML = `
    <main class="shell">
      <header class="topbar"><div class="brand"><img class="studio-logo" src="/logo.jpg" alt="AlwaysTap"></div>
        <div class="top-actions"><span class="top-label">Client studio</span><span class="avatar">AT</span></div>
      </header>
      <section class="intro"><div><div class="eyebrow">Your review experience</div><h1>Create a review link.</h1>
        <p>Set up a business page, copy its link, and add it to a card with your NFC tool.</p></div>
        <button class="button" onclick="openEditor()"><span>＋</span> Add a client</button>
      </section>
      <div class="notice">Each link contains that business’s review-page settings, so it works on any phone without a client database. Your client list is saved only in this browser.</div>
      <section class="content-grid">
        <div class="panel"><div class="panel-head"><div><h2>Your clients</h2><div class="muted" style="font-size:12px">Use the same link for every card assigned to a client.</div></div>
          <span class="eyebrow">${clients.length} total</span></div>
          <div class="client-list">${clients.length ? clients.map(clientRow).join('') : `<div class="empty"><div style="font-size:28px">✳</div><strong>Your first client starts here</strong>Create a profile to generate its review link.</div>`}</div>
        </div>
        <aside class="quick-column"><div class="quick-card"><div class="eyebrow">Ready for your NFC tool</div><h3>Copy and write</h3>
          <p>Copy a client’s permanent review link, then write it to an NFC card using the NFC tool you already use.</p>
          <p>When someone opens the link, they can choose a star rating, tap suggestions, and continue to that business’s Google Reviews page.</p>
        </div><div class="panel"><div class="eyebrow">Simple by design</div><ul class="steps">
          <li><span class="step-num">1</span><span>Create one review link for each client.</span></li>
          <li><span class="step-num">2</span><span>Copy the link into your NFC writing tool.</span></li>
          <li><span class="step-num">3</span><span>The customer can continue to Google Reviews.</span></li>
        </ul></div></aside>
      </section><div class="mobile-nav">AlwaysTap · Client studio</div>
    </main>`;
}

function clientRow(client) {
  const url = publicUrl(client);
  return `<article class="client-row"><div class="client-logo">${client.logo ? `<img src="${escapeHtml(client.logo)}" alt="">` : escapeHtml(client.name.slice(0, 1).toUpperCase())}</div>
    <div><div class="client-name">${escapeHtml(client.name)}</div><div class="client-sub">${escapeHtml(client.slug)} · ${escapeHtml(url)}</div></div>
    <div class="row-actions"><button class="button small secondary" onclick="copyClientLink('${escapeHtml(client.id)}')">Copy link</button>
      <button class="icon-button" title="Edit client" onclick="openEditor('${escapeHtml(client.id)}')">✎</button></div></article>`;
}

function openEditor(id = '') {
  const client = clients.find(item => item.id === id);
  const fields = Array.from({ length: 5 }, (_, index) => {
    const rating = index + 1;
    const values = client?.suggestions?.[rating] || DEFAULT_SUGGESTIONS[rating];
    return `<div class="star-group"><label>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</label>
      <textarea name="stars${rating}" maxlength="700" placeholder="One suggestion per line">${escapeHtml(values.join('\n'))}</textarea></div>`;
  }).join('');
  document.getElementById('app').insertAdjacentHTML('beforeend', `
    <div class="modal-wrap" id="editor-wrap" onclick="if(event.target===this)this.remove()"><div class="modal">
      <div class="modal-head"><div><div class="eyebrow">${client ? 'Client settings' : 'New client'}</div><h2>${client ? 'Edit client' : 'Create a client'}</h2></div>
        <button class="icon-button" onclick="document.getElementById('editor-wrap').remove()">×</button></div>
      <form id="client-form" onsubmit="saveClient(event,'${escapeHtml(id)}')"><div class="form-grid">
        <div class="field"><label>Business name</label><input name="name" required maxlength="70" placeholder="e.g. Kanti Sweets" value="${escapeHtml(client?.name || '')}"></div>
        <div class="field"><label>Google Review URL</label><input name="googleUrl" type="url" required placeholder="https://g.page/r/..." value="${escapeHtml(client?.googleUrl || '')}"></div>
        <div class="field"><label>Logo image URL (optional)</label><input name="logo" type="url" placeholder="https://..." value="${escapeHtml(client?.logo || '')}"></div>
        <div class="field"><label>Brand color</label><input name="accent" type="color" value="${escapeHtml(client?.accent || '#1677ff')}" style="height:42px;padding:4px"></div>
        <div class="field full"><label>Short welcome message</label><input name="tagline" maxlength="100" value="${escapeHtml(client?.tagline || 'Thanks for visiting us today')}"></div>
        <div class="field full"><label>Suggestions shown for each star rating <span class="muted">(one per line)</span></label><div class="stars-editor">${fields}</div></div>
      </div><div class="modal-footer"><button type="button" class="button secondary" onclick="document.getElementById('editor-wrap').remove()">Cancel</button>
        <button type="submit" class="button">${client ? 'Save changes' : 'Create review link'}</button></div></form>
    </div></div>`);
}

function saveClient(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const name = String(values.get('name') || '').trim();
  const googleUrl = safeUrl(String(values.get('googleUrl') || '').trim());
  const logo = safeUrl(String(values.get('logo') || '').trim());
  if (!name || !googleUrl) { toast('Enter a business name and a valid Google Review URL.'); return; }
  if (values.get('logo') && !logo) { toast('The logo must be a public HTTP or HTTPS image URL.'); return; }
  const existing = clients.find(item => item.id === id);
  const suggestions = {};
  for (let rating = 1; rating <= 5; rating += 1) {
    suggestions[rating] = String(values.get(`stars${rating}`) || '').split('\n')
      .map(item => item.trim().slice(0, 80)).filter(Boolean).slice(0, 10);
  }
  const client = {
    id: existing?.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    slug: existing?.slug || nextSlug(name), name, googleUrl, logo,
    accent: String(values.get('accent') || '#1677ff'),
    tagline: String(values.get('tagline') || '').trim().slice(0, 100), suggestions
  };
  const url = publicUrl(client);
  if (url.length > 7500) { toast('This link is too long. Shorten the suggestions and try again.'); return; }
  if (existing) clients = clients.map(item => item.id === id ? client : item);
  else clients.unshift(client);
  saveClients();
  document.getElementById('editor-wrap')?.remove();
  renderAdmin();
  showCreatedLink(client, url);
}

function showCreatedLink(client, url) {
  document.getElementById('app').insertAdjacentHTML('beforeend', `
    <div class="modal-wrap" id="link-wrap" onclick="if(event.target===this)this.remove()"><div class="modal">
      <div class="modal-head"><div><div class="eyebrow">Link ready</div><h2>${escapeHtml(client.name)}</h2></div>
        <button class="icon-button" onclick="document.getElementById('link-wrap').remove()">×</button></div>
      <p class="muted">This link includes the client’s page settings and works on other phones. Copy it into your NFC writing tool.</p>
      <div class="linkbox"><input id="created-url" readonly value="${escapeHtml(url)}"><button class="button small" onclick="copyCreatedLink()">Copy link</button></div>
      <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Preview review page ↗</a>
    </div></div>`);
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); toast('Link copied.'); }
  catch {
    const input = document.createElement('textarea');
    input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.appendChild(input); input.select();
    const copied = document.execCommand('copy'); input.remove();
    toast(copied ? 'Link copied.' : 'Copy failed. Select and copy the link manually.');
  }
}

function copyCreatedLink() { copyText(document.getElementById('created-url').value); }
function copyClientLink(id) { const client = clients.find(item => item.id === id); if (client) copyText(publicUrl(client)); }

function renderReviewError() {
  document.title = 'Review link unavailable — AlwaysTap';
  document.getElementById('app').innerHTML = `<main class="review-page"><section class="review-wrap"><div class="review-brand"><img class="studio-logo" src="/logo.jpg" alt="AlwaysTap"></div>
    <div class="review-card success-card"><h2>This review link is incomplete</h2><p class="muted">Ask the business for a fresh link.</p></div></section></main>`;
}

function renderReview() {
  document.title = `${currentClient.name} — AlwaysTap`;
  document.body.style.setProperty('--green', currentClient.accent);
  document.getElementById('app').innerHTML = `<main class="review-page"><section class="review-wrap">
    <div class="review-brand"><img class="studio-logo" src="/logo.jpg" alt="AlwaysTap"></div>
    <div class="review-card" id="review-form"><div class="review-client">
      <div class="review-logo">${currentClient.logo ? `<img src="${escapeHtml(currentClient.logo)}" alt="${escapeHtml(currentClient.name)} logo">` : escapeHtml(currentClient.name.slice(0, 1).toUpperCase())}</div>
      <h1>${escapeHtml(currentClient.name)}</h1><p>${escapeHtml(currentClient.tagline || 'Thanks for visiting us today')}</p></div>
      <h2>How was your experience?</h2><div class="star-picker" role="radiogroup" aria-label="Choose a rating">
        ${[1, 2, 3, 4, 5].map(rating => `<button type="button" aria-label="${rating} stars" onclick="setRating(${rating})">★</button>`).join('')}
      </div><p class="star-hint" id="star-hint">Tap a star to get started</p><div id="suggestion-area"></div>
      <button class="button" onclick="continueToGoogle()">Continue to Google <span>↗</span></button>
      <p class="review-foot">Your Google review is optional and posted directly through Google.</p>
    </div><p class="footnote">Powered by AlwaysTap</p></section></main>`;
}

function setRating(rating) {
  selectedRating = rating;
  selectedSuggestions.clear();
  document.querySelectorAll('.star-picker button').forEach((button, index) => button.classList.toggle('on', index < rating));
  const hints = { 1: 'We’re sorry. What could have been better?', 2: 'Thanks for letting us know. What stood out?',
    3: 'What was okay, and what could improve?', 4: 'What did you enjoy most?', 5: 'Wonderful! What made it special?' };
  document.getElementById('star-hint').textContent = hints[rating];
  const suggestions = currentClient.suggestions[rating] || [];
  document.getElementById('suggestion-area').innerHTML = suggestions.length
    ? `<div class="eyebrow" style="margin-bottom:8px">Pick anything that stood out</div><div class="chip-grid">${suggestions.map((item, index) => `<button class="chip" type="button" onclick="toggleSuggestion(this,${index})">${escapeHtml(item)}</button>`).join('')}</div>`
    : '';
}

function toggleSuggestion(button, index) {
  if (selectedSuggestions.has(index)) { selectedSuggestions.delete(index); button.classList.remove('selected'); }
  else { selectedSuggestions.add(index); button.classList.add('selected'); }
}

function continueToGoogle() {
  if (!selectedRating) { toast('Choose a star rating first.'); return; }
  window.location.assign(currentClient.googleUrl);
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="toast">${escapeHtml(message)}</div>`);
  setTimeout(() => document.querySelector('.toast')?.remove(), 2600);
}

render();
