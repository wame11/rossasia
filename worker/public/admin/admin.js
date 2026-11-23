// Webstitch admin: a small single-page app. No framework, no build step.
// All data is escaped with esc() before it goes into the page: enquiry text comes from the public.
(function () {
  'use strict';
  const { TEMPLATES, templateValues, fillTemplate, buildSiteJson, buildPrompt, slugify } = window.WS;

  const view = document.getElementById('view');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const state = {
    me: null, leads: [], outreach: [], invoices: [], subs: [], payments: [], business: {}, templates: {}, bank: null,
    filters: { q: '', status: '', type: '', town: '', maxScore: '' }, outreachDueOnly: false,
  };

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
  };
  const gbp = (pence) => '£' + ((pence || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pounds = (pence) => ((pence || 0) / 100).toFixed(2);
  const toPence = (value) => {
    const n = Math.round(parseFloat(String(value).replace(/[£,\s]/g, '')) * 100);
    if (!Number.isFinite(n)) throw new Error(`"${value}" is not a valid amount.`);
    return n;
  };
  const leadById = (id) => state.leads.find((l) => l.id === Number(id));
  const leadName = (id) => (leadById(id) || {}).business_name || `Lead ${id}`;
  const safeUrl = (url) => { const u = String(url || '').trim(); return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, ''); };
  const option = (value, label, selected) => `<option value="${esc(value)}"${String(selected ?? '') === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
  const leadOptions = (selected) => '<option value="">Choose a business…</option>' + [...state.leads].sort((a, b) => a.business_name.localeCompare(b.business_name)).map((l) => option(l.id, l.business_name + (l.town ? ` (${l.town})` : ''), selected)).join('');
  const statusTag = (s) => `<span class="tag ${{ New: 'blue', Contacted: 'grey', Interested: 'amber', Paid: 'green', Building: 'green', Live: 'green', Lost: 'red' }[s] || 'grey'}">${esc(s)}</span>`;
  const scoreDot = (n) => (n ? `<span class="score ${n <= 3 ? 'low' : n <= 6 ? 'mid' : 'high'}" title="Current website score: ${n}/10">${n}</span>` : '<span class="muted">–</span>');

  async function api(path, { method = 'GET', body } = {}) {
    const opts = { method, headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/admin/api/' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  let toastTimer;
  function toast(message, isError) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, isError ? 6000 : 2600);
  }
  function openModal(html) { modalBody.innerHTML = html; if (!modal.open) modal.showModal(); }
  function closeModal() { if (modal.open) modal.close(); }
  function download(filename, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); } catch { toast('Could not copy. Select the text and copy it manually.', true); }
  }

  // Reads a form into an object. Field names can be dotted ("hours.mon"); checkboxes become true/false.
  function readForm(form) {
    const out = {};
    form.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'file' || el.closest('[data-skip]')) return;
      const value = el.type === 'checkbox' ? el.checked : el.value.trim();
      const parts = el.name.split('.');
      let target = out;
      while (parts.length > 1) { const p = parts.shift(); target = target[p] = target[p] || {}; }
      target[parts[0]] = value;
    });
    return out;
  }

  async function reload(...names) {
    const paths = { leads: 'leads', outreach: 'outreach', invoices: 'invoices', subs: 'subscriptions', payments: 'payments' };
    await Promise.all(names.map(async (n) => { state[n] = await api(paths[n]); }));
  }

  /* ---------- derived data ---------- */
  // A follow-up is due when a lead's most recent outreach entry has a follow-up date of today or earlier.
  function dueFollowups() {
    const seen = new Set();
    return state.outreach.filter((o) => { if (seen.has(o.lead_id)) return false; seen.add(o.lead_id); return o.follow_up_date && o.follow_up_date <= today(); })
      .filter((o) => { const l = leadById(o.lead_id); return l && l.status !== 'Lost'; });
  }

  /* ---------- views ---------- */
  const views = {};

  views.dashboard = () => {
    const counts = Object.fromEntries(state.me.statuses.map((s) => [s, 0]));
    state.leads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    const total = state.leads.length;
    const won = counts.Paid + counts.Building + counts.Live;
    const revenue = state.payments.reduce((sum, p) => sum + p.amount_pence, 0);
    const month = today().slice(0, 7);
    const monthRevenue = state.payments.filter((p) => p.date.startsWith(month)).reduce((sum, p) => sum + p.amount_pence, 0);
    const active = state.subs.filter((s) => s.status === 'Active');
    const mrr = active.reduce((sum, s) => sum + s.monthly_pence, 0);
    const overdue = active.filter((s) => s.overdue);
    const followups = dueFollowups();
    const enquiries = state.leads.filter((l) => l.source === 'enquiry' && l.status === 'New');
    const unpaid = state.invoices.filter((i) => i.status === 'Sent');

    view.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1><p class="muted">${esc(fmtDate(today()))}</p></div></div>
      <div class="stats">
        <div class="stat"><b>${total}</b><span>Total leads</span></div>
        <div class="stat"><b>${won}</b><span>Clients won</span></div>
        <div class="stat"><b>${total ? ((won / total) * 100).toFixed(1) : '0.0'}%</b><span>Conversion rate</span></div>
        <div class="stat"><b>${gbp(revenue)}</b><span>Revenue received</span></div>
        <div class="stat"><b>${gbp(monthRevenue)}</b><span>Received this month</span></div>
        <div class="stat"><b>${gbp(mrr)}</b><span>Monthly recurring revenue (${active.length} active plan${active.length === 1 ? '' : 's'})</span></div>
      </div>
      <div class="card"><h2>Pipeline</h2><div class="pipeline">
        ${state.me.statuses.map((s) => `<a href="#/leads" data-action="pipeline" data-status="${esc(s)}"><b>${counts[s]}</b>${esc(s)}</a>`).join('')}
      </div></div>
      <div class="grid cols-2">
        <div class="card"><h2>New website enquiries (${enquiries.length})</h2>
          ${enquiries.length ? enquiries.map((l) => `<div class="log-item"><a href="#/lead/${l.id}"><b>${esc(l.business_name)}</b></a> <span class="muted">${esc(l.business_type)} · ${esc(fmtDate(l.created_at))}</span></div>`).join('') : '<p class="muted">Nothing waiting. New enquiries from the website appear here.</p>'}
        </div>
        <div class="card"><h2>Follow-ups due (${followups.length})</h2>
          ${followups.length ? followups.map((o) => `<div class="log-item"><a href="#/lead/${o.lead_id}"><b>${esc(leadName(o.lead_id))}</b></a> <span class="muted">due ${esc(fmtDate(o.follow_up_date))} · last: ${esc(o.channel)}${o.outcome ? ', ' + esc(o.outcome) : ''}</span></div>`).join('') : '<p class="muted">You are up to date.</p>'}
        </div>
        <div class="card"><h2>Overdue monthly payments (${overdue.length})</h2>
          ${overdue.length ? overdue.map((s) => `<div class="log-item"><a href="#/lead/${s.lead_id}"><b>${esc(leadName(s.lead_id))}</b></a> <span class="tag red">Overdue</span> <span class="muted">was due ${esc(fmtDate(s.next_due))}</span></div>`).join('') : '<p class="muted">No overdue plans.</p>'}
        </div>
        <div class="card"><h2>Invoices awaiting payment (${unpaid.length})</h2>
          ${unpaid.length ? unpaid.map((i) => `<div class="log-item"><a href="#/invoices"><b>${esc(i.number)}</b></a> ${esc(leadName(i.lead_id))} <span class="muted">${gbp(i.total_pence)} · due ${esc(fmtDate(i.due_date))}</span>${i.due_date < today() ? ' <span class="tag red">Late</span>' : ''}</div>`).join('') : '<p class="muted">Nothing outstanding.</p>'}
        </div>
      </div>`;
  };

  /* ----- leads ----- */
  views.leads = () => {
    const f = state.filters;
    const types = [...new Set(state.leads.map((l) => l.business_type).filter(Boolean))].sort();
    view.innerHTML = `
      <div class="page-head"><div><h1>Leads</h1><p class="muted">Score is the quality of their current website: 1 is dreadful (a great prospect), 10 is excellent.</p></div>
        <div class="toolbar"><button class="primary" data-action="lead-new">Add lead</button><button data-action="import-open">Import CSV</button><a class="btn" href="/admin/api/export/leads">Export CSV</a></div></div>
      <div class="toolbar" style="margin-bottom:1rem">
        <input type="search" placeholder="Search name, town, notes…" data-filter="q" value="${esc(f.q)}" aria-label="Search leads">
        <select data-filter="status" aria-label="Status"><option value="">All statuses</option>${state.me.statuses.map((s) => option(s, s, f.status)).join('')}</select>
        <select data-filter="type" aria-label="Business type"><option value="">All types</option>${types.map((t) => option(t, t, f.type)).join('')}</select>
        <input placeholder="Town" data-filter="town" value="${esc(f.town)}" aria-label="Town" size="12">
        <select data-filter="maxScore" aria-label="Website score"><option value="">Any score</option>${[3, 5, 7].map((n) => option(n, `Score ${n} or lower`, f.maxScore)).join('')}</select>
        <button class="link" data-action="filters-clear">Clear</button>
        <span class="muted" id="lead-count"></span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Business</th><th>Type</th><th>Town</th><th>Phone</th><th>Email</th><th>Current site</th><th>Score</th><th>Status</th><th>Notes</th></tr></thead><tbody id="lead-rows"></tbody></table></div>`;
    renderLeadRows();
  };

  function renderLeadRows() {
    const f = state.filters;
    const q = f.q.toLowerCase();
    const rows = state.leads.filter((l) =>
      (!q || [l.business_name, l.town, l.notes, l.contact_name, l.email, l.phone].join(' ').toLowerCase().includes(q))
      && (!f.status || l.status === f.status) && (!f.type || l.business_type === f.type)
      && (!f.town || l.town.toLowerCase().includes(f.town.toLowerCase()))
      && (!f.maxScore || (l.score && l.score <= Number(f.maxScore))));
    document.getElementById('lead-count').textContent = `${rows.length} of ${state.leads.length}`;
    document.getElementById('lead-rows').innerHTML = rows.length ? rows.map((l) => `<tr>
      <td><a href="#/lead/${l.id}"><b>${esc(l.business_name)}</b></a>${l.do_not_contact ? ' <span class="tag red">Do not contact</span>' : ''}${l.source === 'enquiry' ? ' <span class="tag blue">Enquiry</span>' : ''}${l.contact_name ? `<br><span class="muted small">${esc(l.contact_name)}</span>` : ''}</td>
      <td>${esc(l.business_type)}</td><td>${esc(l.town)}</td>
      <td>${l.phone ? `<a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a>` : ''}</td>
      <td>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ''}</td>
      <td>${l.website_url ? `<a href="${esc(safeUrl(l.website_url))}" target="_blank" rel="noopener noreferrer">${esc(l.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '<span class="muted">None</span>'}</td>
      <td>${scoreDot(l.score)}</td>
      <td><select data-change="lead-status" data-id="${l.id}" aria-label="Status for ${esc(l.business_name)}">${state.me.statuses.map((s) => option(s, s, l.status)).join('')}</select></td>
      <td><div class="clip" title="${esc(l.notes)}">${esc(l.notes)}</div></td></tr>`).join('')
      : '<tr><td colspan="9" class="empty">No leads match. Add one, or import a CSV.</td></tr>';
  }

  function leadFields(l) {
    return `<div class="form-grid">
      <label>Business name<input name="business_name" required maxlength="160" value="${esc(l.business_name)}"></label>
      <label>Business type<input name="business_type" list="types" maxlength="80" value="${esc(l.business_type)}"><datalist id="types">${['Barber', 'Hairdresser', 'Beauty salon', 'Café', 'Restaurant', 'Takeaway', 'Trades', 'Gym', 'Church', 'Charity', 'Shop'].map((t) => `<option value="${t}">`).join('')}</datalist></label>
      <label>Town<input name="town" maxlength="80" value="${esc(l.town)}"></label>
      <label>Contact name<input name="contact_name" maxlength="120" value="${esc(l.contact_name)}"></label>
      <label>Phone<input name="phone" maxlength="40" value="${esc(l.phone)}"></label>
      <label>Email<input name="email" type="email" maxlength="200" value="${esc(l.email)}"></label>
      <label>Current site URL<input name="website_url" maxlength="300" value="${esc(l.website_url)}"></label>
      <label>Website score (1 = dreadful, 10 = excellent)<input name="score" type="number" min="1" max="10" value="${esc(l.score ?? '')}"></label>
      <label>Status<select name="status">${state.me.statuses.map((s) => option(s, s, l.status || 'New')).join('')}</select></label>
      <label class="check" style="align-self:end"><input type="checkbox" name="do_not_contact"${l.do_not_contact ? ' checked' : ''}> Do not contact (opted out)</label>
      <label class="wide">Notes<textarea name="notes" rows="4" maxlength="6000">${esc(l.notes)}</textarea></label>
    </div>`;
  }

  views.lead = async (id) => {
    const l = leadById(id);
    if (!l) { view.innerHTML = '<p>That lead no longer exists. <a href="#/leads">Back to leads</a></p>'; return; }
    const log = state.outreach.filter((o) => o.lead_id === l.id);
    const invoices = state.invoices.filter((i) => i.lead_id === l.id);
    const sub = state.subs.find((s) => s.lead_id === l.id);
    view.innerHTML = `
      <p><a href="#/leads">← All leads</a></p>
      <div class="page-head"><div><h1>${esc(l.business_name)}</h1><p class="muted">${statusTag(l.status)} ${esc([l.business_type, l.town].filter(Boolean).join(' · '))} · added ${esc(fmtDate(l.created_at))} via ${esc(l.source)}</p></div>
        <div class="toolbar"><a class="btn primary" href="#/brief/${l.id}">Client brief</a><a class="btn" href="#/templates/${l.id}">Email templates</a>
          <button data-action="invoice-new" data-id="${l.id}">New invoice</button>${sub ? '' : `<button data-action="sub-new" data-id="${l.id}">Start monthly plan</button>`}</div></div>
      ${l.do_not_contact ? '<div class="notice red"><b>Do not contact.</b> This business has opted out of marketing. Only get in touch about work they have already asked for.</div>' : ''}
      <div class="grid cols-2">
        <form class="card" data-form="lead-save" data-id="${l.id}"><h2>Details</h2>${leadFields(l)}
          <div class="form-actions"><button class="primary">Save changes</button><button type="button" class="danger" data-action="lead-delete" data-id="${l.id}">Delete lead</button></div></form>
        <div>
          <form class="card" data-form="outreach-add"><h2>Log a call or email</h2><input type="hidden" name="lead_id" value="${l.id}">
            <div class="form-grid">
              <label>Date<input type="date" name="date" value="${today()}" required></label>
              <label>Type<select name="channel">${state.me.channels.map((c) => option(c, c)).join('')}</select></label>
              <label>Outcome<input name="outcome" list="outcomes" maxlength="200" placeholder="e.g. No answer, Interested"><datalist id="outcomes">${['No answer', 'Left voicemail', 'Spoke to owner', 'Interested', 'Call back later', 'Sent email', 'Not interested', 'Asked not to be contacted'].map((o) => `<option value="${o}">`).join('')}</datalist></label>
              <label>Follow up on<input type="date" name="follow_up_date"></label>
              <label class="wide">Notes<textarea name="notes" rows="2" maxlength="4000"></textarea></label>
            </div><div class="form-actions"><button class="primary">Add to log</button></div></form>
          <div class="card"><h2>Outreach log (${log.length})</h2>
            ${log.length ? log.map((o) => `<div class="log-item"><b>${esc(fmtDate(o.date))}</b> · ${esc(o.channel)}${o.outcome ? ` · ${esc(o.outcome)}` : ''} <button class="link small" data-action="outreach-delete" data-id="${o.id}">remove</button>
              ${o.notes ? `<br>${esc(o.notes)}` : ''}${o.follow_up_date ? `<br><span class="muted small">Follow up: ${esc(fmtDate(o.follow_up_date))}</span>` : ''}</div>`).join('') : '<p class="muted">No contact logged yet.</p>'}
          </div>
          <div class="card"><h2>Money</h2>
            ${invoices.length ? invoices.map((i) => `<div class="log-item"><b>${esc(i.number)}</b> ${gbp(i.total_pence)} <span class="tag ${i.status === 'Paid' ? 'green' : i.status === 'Void' ? 'grey' : 'amber'}">${esc(i.status)}</span> <a href="/admin/api/invoices/${i.id}/pdf">PDF</a></div>`).join('') : '<p class="muted">No invoices yet.</p>'}
            ${sub ? `<p style="margin-top:.8rem">Monthly plan: <b>${gbp(sub.monthly_pence)}</b> ${sub.overdue ? '<span class="tag red">Overdue</span>' : `<span class="tag ${sub.status === 'Active' ? 'green' : 'grey'}">${esc(sub.status)}</span>`} · last paid ${sub.last_payment_date ? esc(fmtDate(sub.last_payment_date)) : 'never'}</p>` : ''}
          </div>
        </div>
      </div>`;
  };

  /* ----- client brief ----- */
  const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
  const SOCIALS = ['facebook', 'instagram', 'tiktok', 'x', 'youtube', 'linkedin', 'whatsapp', 'tripadvisor'];
  const pageRow = (p) => `<div class="row page-row" data-page><input data-page-title placeholder="Page name, e.g. About" value="${esc(p.title || '')}" aria-label="Page name"><textarea data-page-content rows="3" placeholder="Copy or notes for this page" aria-label="Page copy">${esc(p.content || '')}</textarea><button type="button" data-action="row-remove" aria-label="Remove page">✕</button></div>`;

  views.brief = async (id) => {
    const l = leadById(id);
    if (!l) { view.innerHTML = '<p>That lead no longer exists. <a href="#/leads">Back to leads</a></p>'; return; }
    view.innerHTML = '<p class="loading">Loading brief…</p>';
    const [{ data: b }, files] = await Promise.all([api(`briefs/${l.id}`), api(`leads/${l.id}/files`)]);
    state.currentBrief = { lead: l, files };
    const v = (key) => esc(b[key] || '');
    const x = b.extras || {};
    const pages = (b.pages && b.pages.length ? b.pages : ['Home', 'About', 'Services', 'Contact'].map((title) => ({ title })));
    view.innerHTML = `
      <p><a href="#/lead/${l.id}">← ${esc(l.business_name)}</a></p>
      <div class="page-head"><div><h1>Client brief: ${esc(l.business_name)}</h1><p class="muted">Drop in everything the client wants. Save, then generate the build prompt.</p></div>
        <div class="toolbar"><button class="primary" data-action="brief-save">Save brief</button><button data-action="brief-prompt">Generate build prompt</button></div></div>
      ${b.enquiry_received ? `<div class="notice">Started from a website enquiry on ${esc(fmtDate(b.enquiry_received))}. Their answers are in "What they want" and "Colours".</div>` : ''}
      <form id="brief-form" data-form="brief-save" data-id="${l.id}">
        <fieldset><legend>Business details</legend><div class="form-grid">
          <label>Tagline<input name="tagline" value="${v('tagline')}" placeholder="One line that sums them up"></label>
          <label>Main call to action<input name="cta" value="${v('cta')}" placeholder="e.g. Call to book, Order now"></label>
          <label class="wide">About the business<textarea name="description" rows="3">${v('description')}</textarea></label>
          <label>Address line 1<input name="address_line1" value="${v('address_line1')}"></label>
          <label>Address line 2<input name="address_line2" value="${v('address_line2')}"></label>
          <label>Town<input name="town" value="${esc(b.town || l.town)}"></label>
          <label>Postcode<input name="postcode" value="${v('postcode')}"></label>
          <label>Public phone <span class="hint">shown on the site</span><input name="public_phone" value="${esc(b.public_phone || l.phone)}"></label>
          <label>Public email <span class="hint">shown on the site</span><input name="public_email" value="${esc(b.public_email || l.email)}"></label>
        </div></fieldset>

        <fieldset><legend>What they want</legend><div class="form-grid">
          <label class="wide">Goals for the website<textarea name="goals" rows="4">${v('goals')}</textarea></label>
          <label>Domain<input name="domain" value="${v('domain')}" placeholder="theirbusiness.co.uk"></label>
          <label>Domain status<select name="domain_status">${['', 'Client already owns it', 'We need to buy it', 'Not decided yet'].map((s) => option(s, s || 'Choose…', b.domain_status)).join('')}</select></label>
          <label>Contact form delivers to<input name="form_email" type="email" value="${v('form_email')}"></label>
          <label>SEO search phrases<input name="seo_keywords" value="${v('seo_keywords')}" placeholder="barber in Northbridge, skin fade"></label>
        </div></fieldset>

        <fieldset><legend>Pages and copy</legend>
          <p class="hint">Up to 5 pages are included. The first page is the home page.</p>
          <div class="rows" id="page-rows">${pages.map(pageRow).join('')}</div>
          <div class="form-actions"><button type="button" data-action="page-add">Add a page</button></div>
        </fieldset>

        <fieldset><legend>Look and feel</legend><div class="form-grid">
          <label>Colours <span class="hint">include hex codes if you have them, e.g. #1f3a5f</span><input name="colours" value="${v('colours')}"></label>
          <label>Fonts<input name="fonts" value="${v('fonts')}" placeholder="e.g. clean sans-serif, or match their logo"></label>
          <label>Style notes<textarea name="style_notes" rows="2">${v('style_notes')}</textarea></label>
          <label>Websites they like<textarea name="inspiration" rows="2">${v('inspiration')}</textarea></label>
        </div></fieldset>

        <fieldset><legend>Opening hours</legend><div class="grid cols-4">
          ${DAYS.map(([key, label]) => `<label>${label}<input name="hours.${key}" value="${esc((b.hours || {})[key] || '')}" placeholder="09:00-17:30 or closed"></label>`).join('')}
          <label>Note<input name="hours_note" value="${v('hours_note')}" placeholder="e.g. Late night Thursday"></label>
        </div></fieldset>

        <fieldset><legend>Services and prices</legend>
          <label>One per line: <span class="hint">Name | price | description. Start a line with # for a group heading.</span>
          <textarea name="services" rows="7" class="mono" placeholder="# Hair&#10;Classic cut | £15 | Scissor or clipper cut&#10;Skin fade | £18">${v('services')}</textarea></label>
          <label style="margin-top:.8rem">Testimonials <span class="hint">real ones only, with the customer's name</span><textarea name="testimonials" rows="3">${v('testimonials')}</textarea></label>
        </fieldset>

        <fieldset><legend>Social links</legend><div class="form-grid">
          ${SOCIALS.map((s) => `<label>${s[0].toUpperCase() + s.slice(1)}<input name="social.${s}" value="${esc((b.social || {})[s] || '')}" placeholder="https://"></label>`).join('')}
        </div></fieldset>

        <fieldset><legend>Price</legend><div class="form-grid">
          <label>Monthly fee (£) <span class="hint">covers their domain and hosting. Used as the default on their invoices and monthly plan</span><input name="monthly_fee" inputmode="decimal" value="${esc(b.monthly_fee ?? pounds(state.business.monthlyPence))}"></label>
        </div></fieldset>

        <fieldset><legend>Optional extras</legend><div class="form-grid">
          <label>Extra pages (beyond 5)<input type="number" min="0" max="20" name="extras.extra_pages" value="${esc(x.extra_pages || 0)}"></label>
          <label>Booking link <span class="hint">Fresha, Booksy, Calendly…</span><input name="extras.booking_url" value="${esc(x.booking_url || '')}"></label>
          <label class="check"><input type="checkbox" name="extras.booking"${x.booking ? ' checked' : ''}> Online booking widget</label>
          <label class="check"><input type="checkbox" name="extras.menu"${x.menu ? ' checked' : ''}> Online menu</label>
          <label class="check"><input type="checkbox" name="extras.gallery"${x.gallery ? ' checked' : ''}> Photo gallery</label>
          <label class="check"><input type="checkbox" name="extras.domain_purchase"${x.domain_purchase ? ' checked' : ''}> We register a new domain (included)</label>
        </div></fieldset>

        <fieldset><legend>Internal notes</legend><label>Anything else the builder should know<textarea name="notes" rows="3">${v('notes')}</textarea></label></fieldset>
        <input type="hidden" name="enquiry_received" value="${v('enquiry_received')}">
        <div class="form-actions"><button class="primary">Save brief</button><button type="button" data-action="brief-prompt">Generate build prompt</button></div>
      </form>

      <fieldset style="margin-top:1.2rem"><legend>Logo and photos (${files.length})</legend>
        ${state.me.filesEnabled ? `<form data-form="files-upload" data-id="${l.id}" class="toolbar" style="margin-bottom:1rem"><input type="file" name="files" multiple required accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf" aria-label="Choose files"><button>Upload</button><span class="hint">JPG, PNG, WebP, GIF, SVG or PDF, up to 8 MB each</span></form>` : '<div class="notice">File storage (R2) is not set up, so uploads are switched off. See the README.</div>'}
        <div class="files">${files.map((f) => `<div class="file">${/^image\/(jpeg|png|webp|gif)$/.test(f.content_type) ? `<img src="/admin/api/files/${f.id}" alt="" loading="lazy">` : ''}<span class="name" title="${esc(f.filename)}">${esc(f.filename)}</span>
          <a href="/admin/api/files/${f.id}?download">Download</a> · <button class="link" data-action="file-delete" data-id="${f.id}">Delete</button></div>`).join('') || '<p class="muted">No files yet.</p>'}</div>
      </fieldset>`;
  };

  function collectBrief() {
    const form = document.getElementById('brief-form');
    const data = readForm(form);
    data.pages = [...form.querySelectorAll('[data-page]')].map((row) => ({ title: row.querySelector('[data-page-title]').value.trim(), content: row.querySelector('[data-page-content]').value.trim() })).filter((p) => p.title);
    data.extras.extra_pages = Number(data.extras.extra_pages) || 0;
    return data;
  }
  async function saveBrief() {
    const { lead } = state.currentBrief;
    const data = collectBrief();
    await api(`briefs/${lead.id}`, { method: 'PUT', body: { data } });
    toast('Brief saved');
    return data;
  }

  /* ----- invoices ----- */
  views.invoices = () => {
    const outstanding = state.invoices.filter((i) => i.status === 'Sent').reduce((sum, i) => sum + i.total_pence, 0);
    view.innerHTML = `
      <div class="page-head"><div><h1>Invoices</h1><p class="muted">${gbp(outstanding)} awaiting payment. Bank details are added to each PDF from the Worker's secrets.</p></div>
        <div class="toolbar"><button class="primary" data-action="invoice-new">New invoice</button><a class="btn" href="/admin/api/export/invoices">Export CSV</a></div></div>
      ${state.me.bankConfigured ? '' : '<div class="notice red"><b>Bank details are not set.</b> Invoices will show "Not set" until you add the BANK_ACCOUNT_NAME, BANK_SORT_CODE and BANK_ACCOUNT_NUMBER secrets to the Worker.</div>'}
      <div class="table-wrap"><table><thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th class="num">Total</th><th>Reference</th><th>Status</th><th></th></tr></thead><tbody>
      ${state.invoices.length ? state.invoices.map((i) => `<tr><td><b>${esc(i.number)}</b></td><td><a href="#/lead/${i.lead_id}">${esc(leadName(i.lead_id))}</a></td><td>${esc(fmtDate(i.issue_date))}</td><td>${esc(fmtDate(i.due_date))}</td>
        <td class="num">${gbp(i.total_pence)}</td><td class="mono">${esc(i.reference)}</td>
        <td><span class="tag ${i.status === 'Paid' ? 'green' : i.status === 'Void' ? 'grey' : i.due_date < today() ? 'red' : 'amber'}">${esc(i.status === 'Sent' && i.due_date < today() ? 'Late' : i.status)}</span>${i.paid_date ? `<br><span class="muted small">${esc(fmtDate(i.paid_date))}</span>` : ''}</td>
        <td class="actions"><a class="btn" href="/admin/api/invoices/${i.id}/pdf">PDF</a> ${i.status === 'Sent' || i.status === 'Draft' ? `<button data-action="invoice-paid" data-id="${i.id}">Mark paid</button> <button data-action="invoice-void" data-id="${i.id}">Void</button>` : ''} <button class="danger" data-action="invoice-delete" data-id="${i.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">No invoices yet.</td></tr>'}
      </tbody></table></div>`;
  };

  const invoiceLine = (description, pence) => `<div class="row" data-line><input data-line-desc value="${esc(description)}" placeholder="Description" aria-label="Line description" required><input data-line-amount value="${esc(pence === '' ? '' : pounds(pence))}" placeholder="£" inputmode="decimal" aria-label="Amount in pounds" required><button type="button" data-action="row-remove" aria-label="Remove line">✕</button></div>`;
  // A client's monthly fee: from their brief if set, otherwise the default in Settings.
  async function leadMonthlyPence(leadId) {
    if (!leadId) return state.business.monthlyPence;
    const { data } = await api(`briefs/${leadId}`);
    return data.monthly_fee !== undefined && data.monthly_fee !== '' ? toPence(data.monthly_fee) : state.business.monthlyPence;
  }

  async function invoiceModal(leadId) {
    const b = state.business;
    const monthly = await leadMonthlyPence(leadId);
    openModal(`<h2>New invoice</h2><form data-form="invoice-create">
      <div class="form-grid">
        <label class="wide">Client<select name="lead_id" required>${leadOptions(leadId)}</select></label>
        <label>Invoice date<input type="date" name="issue_date" value="${today()}" required></label>
        <label>Payment due<input type="date" name="due_date" value="${addDays(today(), Number(b.invoiceDueDays) || 7)}" required></label>
      </div>
      <h2 style="margin-top:1rem">Lines</h2>
      <div class="rows" id="invoice-lines" data-skip>${invoiceLine('Website design and build (up to 5 pages)', b.buildPricePence)}</div>
      <div class="form-actions"><button type="button" data-action="line-add" data-desc="" data-pence="">Add a line</button>
        ${(b.extras || []).map((e) => `<button type="button" data-action="line-add" data-desc="${esc(e.name)}" data-pence="${esc(e.pricePence)}">+ ${esc(e.name)}</button>`).join('')}</div>
      <div class="form-grid" style="margin-top:1rem">
        <label>Monthly fee line (£ per month, 0 to hide)<input name="monthly" value="${pounds(monthly)}" inputmode="decimal"></label>
        <label>Payment reference <span class="hint">blank = business name, max 18 characters</span><input name="reference" maxlength="18"></label>
        <label class="wide">Note on the invoice (optional)<textarea name="notes" rows="2" maxlength="1000"></textarea></label>
      </div>
      <div class="form-actions"><button class="primary">Create invoice</button><button type="button" data-action="modal-close">Cancel</button></div></form>`);
  }

  /* ----- subscriptions ----- */
  views.subscriptions = () => {
    const active = state.subs.filter((s) => s.status === 'Active');
    const overdue = active.filter((s) => s.overdue);
    view.innerHTML = `
      <div class="page-head"><div><h1>Subscriptions</h1><p class="muted">Who pays the monthly plan. A plan is flagged overdue a week after its payment was due.</p></div>
        <div class="toolbar"><button class="primary" data-action="sub-new">Add monthly plan</button><button data-action="payment-new">Record other payment</button><a class="btn" href="/admin/api/export/subscriptions">Export CSV</a></div></div>
      <div class="stats">
        <div class="stat"><b>${gbp(active.reduce((sum, s) => sum + s.monthly_pence, 0))}</b><span>Monthly revenue (MRR)</span></div>
        <div class="stat"><b>${active.length}</b><span>Active plans</span></div>
        <div class="stat"><b>${overdue.length}</b><span>Overdue</span></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Client</th><th class="num">Monthly</th><th>Started</th><th>Last payment</th><th>Next due</th><th>Status</th><th></th></tr></thead><tbody>
      ${state.subs.length ? state.subs.map((s) => `<tr><td><a href="#/lead/${s.lead_id}"><b>${esc(leadName(s.lead_id))}</b></a>${s.notes ? `<br><span class="muted small">${esc(s.notes)}</span>` : ''}</td><td class="num">${gbp(s.monthly_pence)}</td><td>${esc(fmtDate(s.start_date))}</td>
        <td>${s.last_payment_date ? esc(fmtDate(s.last_payment_date)) : '<span class="muted">None yet</span>'}</td><td>${s.status === 'Active' ? esc(fmtDate(s.next_due)) : ''}</td>
        <td>${s.overdue ? '<span class="tag red">Overdue</span>' : `<span class="tag ${s.status === 'Active' ? 'green' : 'grey'}">${esc(s.status)}</span>`}</td>
        <td class="actions"><button class="primary" data-action="sub-pay" data-id="${s.id}">Record payment</button>
          <select data-change="sub-status" data-id="${s.id}" aria-label="Plan status">${['Active', 'Paused', 'Cancelled'].map((x) => option(x, x, s.status)).join('')}</select>
          <button class="danger" data-action="sub-delete" data-id="${s.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">No monthly plans yet. Add one when a client\'s site goes live.</td></tr>'}
      </tbody></table></div>
      <h2 style="margin-top:1.6rem">Payments received <a class="small" href="/admin/api/export/payments">Export CSV</a></h2>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Note</th><th class="num">Amount</th><th></th></tr></thead><tbody>
      ${state.payments.length ? state.payments.map((p) => `<tr><td>${esc(fmtDate(p.date))}</td><td>${esc(leadName(p.lead_id))}</td><td>${esc(p.kind)}</td><td>${esc(p.note)}</td><td class="num">${gbp(p.amount_pence)}</td><td class="actions"><button class="danger" data-action="payment-delete" data-id="${p.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>'}
      </tbody></table></div>`;
  };

  /* ----- outreach ----- */
  views.outreach = () => {
    const due = dueFollowups();
    const dueIds = new Set(due.map((o) => o.id));
    const rows = state.outreachDueOnly ? due : state.outreach;
    view.innerHTML = `
      <div class="page-head"><div><h1>Outreach log</h1><p class="muted">Every call and email. ${due.length} follow-up${due.length === 1 ? '' : 's'} due.</p></div>
        <div class="toolbar"><button class="primary" data-action="outreach-new">Log outreach</button><a class="btn" href="#/templates">Email templates</a><a class="btn" href="/admin/api/export/outreach">Export CSV</a></div></div>
      <div class="notice small"><b>Before you contact anyone:</b> only email businesses at a business address, always say who you are, and stop for good if they ask. Sole traders and partnerships count as individuals under UK marketing rules (PECR), so email them only if they have asked to hear from you. Check numbers against the TPS before cold calling. Tick "Do not contact" on the lead when someone opts out.</div>
      <label class="check" style="margin-bottom:1rem"><input type="checkbox" data-change="outreach-due"${state.outreachDueOnly ? ' checked' : ''}> Show only follow-ups that are due</label>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Business</th><th>Type</th><th>Outcome</th><th>Notes</th><th>Follow up</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((o) => `<tr><td>${esc(fmtDate(o.date))}</td><td><a href="#/lead/${o.lead_id}"><b>${esc(leadName(o.lead_id))}</b></a></td><td>${esc(o.channel)}</td><td>${esc(o.outcome)}</td><td>${esc(o.notes)}</td>
        <td>${o.follow_up_date ? esc(fmtDate(o.follow_up_date)) : ''}${dueIds.has(o.id) ? ' <span class="tag red">Due</span>' : ''}</td>
        <td class="actions"><button class="danger" data-action="outreach-delete" data-id="${o.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">Nothing here yet.</td></tr>'}
      </tbody></table></div>`;
  };

  function outreachModal(leadId, preset = {}) {
    openModal(`<h2>Log outreach</h2><form data-form="outreach-add"><div class="form-grid">
      <label class="wide">Business<select name="lead_id" required>${leadOptions(leadId)}</select></label>
      <label>Date<input type="date" name="date" value="${today()}" required></label>
      <label>Type<select name="channel">${state.me.channels.map((c) => option(c, c, preset.channel)).join('')}</select></label>
      <label>Outcome<input name="outcome" maxlength="200" value="${esc(preset.outcome || '')}"></label>
      <label>Follow up on<input type="date" name="follow_up_date" value="${esc(preset.follow_up_date || '')}"></label>
      <label class="wide">Notes<textarea name="notes" rows="3" maxlength="4000"></textarea></label>
      </div><div class="form-actions"><button class="primary">Add to log</button><button type="button" data-action="modal-close">Cancel</button></div></form>`);
  }

  /* ----- email templates ----- */
  const getTemplate = (key) => ({ ...TEMPLATES[key], ...(state.templates[key] || {}) });
  views.templates = async (leadId) => {
    state.tpl = state.tpl || { key: 'pitch' };
    if (leadId) state.tpl.leadId = Number(leadId);
    const lead = leadById(state.tpl.leadId);
    const key = state.tpl.key;
    const tpl = getTemplate(key);
    let subject = tpl.subject;
    let body = tpl.body;
    let invoice = null;
    if (lead) {
      if (key === 'payment' && !state.bank) state.bank = await api('bank');
      const mine = state.invoices.filter((i) => i.lead_id === lead.id && i.status !== 'Void');
      invoice = mine.find((i) => i.status !== 'Paid') || mine[0] || null;
      const values = templateValues({ lead, business: state.business, bank: state.bank, invoice, siteUrl: state.me.siteUrl });
      subject = fillTemplate(subject, values);
      body = fillTemplate(body, values);
    }
    const blocked = lead && lead.do_not_contact && (key === 'pitch' || key === 'followup');
    view.innerHTML = `
      <div class="page-head"><div><h1>Email templates</h1><p class="muted">Pick a business and a template, tweak the wording, then copy it or open it in your email app.</p></div></div>
      <div class="toolbar" style="margin-bottom:1rem">
        <select data-change="tpl-lead" aria-label="Business">${leadOptions(state.tpl.leadId)}</select>
        <select data-change="tpl-key" aria-label="Template">${Object.entries(TEMPLATES).map(([k, t]) => option(k, t.name, key)).join('')}</select>
        <button data-action="tpl-edit">Edit this template</button>
      </div>
      ${!lead ? '<div class="notice">Choose a business to fill in the {{placeholders}}.</div>' : ''}
      ${blocked ? '<div class="notice red"><b>Do not send.</b> This business has opted out of marketing.</div>' : ''}
      ${lead && !lead.email ? '<div class="notice">This lead has no email address yet.</div>' : ''}
      ${lead && key === 'payment' && !invoice ? '<div class="notice">Create an invoice for this client first so the invoice number, amount and reference can be filled in.</div>' : ''}
      ${lead && key === 'payment' && !state.me.bankConfigured ? '<div class="notice red">Bank details are not set on the Worker yet.</div>' : ''}
      <div class="card">
        <label>Subject<input id="tpl-subject" value="${esc(subject)}"></label>
        <label style="margin-top:.8rem">Message<textarea id="tpl-body" rows="22">${esc(body)}</textarea></label>
        <div class="form-actions">
          <button class="primary" data-action="tpl-copy"${blocked ? ' disabled' : ''}>Copy email</button>
          <button data-action="tpl-mailto"${!lead || !lead.email || blocked ? ' disabled' : ''}>Open in email app</button>
          <button data-action="tpl-log"${!lead || blocked ? ' disabled' : ''}>Log as sent</button>
          ${key === 'payment' && invoice ? `<a class="btn" href="/admin/api/invoices/${invoice.id}/pdf">Download invoice PDF to attach</a>` : ''}
        </div>
      </div>`;
  };

  /* ----- settings ----- */
  views.settings = () => {
    const b = state.business;
    const v = (key) => esc(b[key] ?? '');
    const flag = (ok, yes, no) => `<span class="tag ${ok ? 'green' : 'amber'}">${ok ? yes : no}</span>`;
    view.innerHTML = `
      <div class="page-head"><div><h1>Settings and export</h1></div></div>
      <form data-form="settings-save"><fieldset><legend>Business details (shown on invoices and in emails)</legend><div class="form-grid">
        <label>Trading name<input name="tradingName" value="${v('tradingName')}"></label>
        <label>Legal name<input name="legalName" value="${v('legalName')}"></label>
        <label>Your first name for emails<input name="senderName" value="${v('senderName')}" placeholder="Ethan"></label>
        <label>Email<input name="email" type="email" value="${v('email')}"></label>
        <label>Phone<input name="phone" value="${v('phone')}"></label>
        <label>Website<input name="website" value="${v('website')}"></label>
        <label class="wide">Business address <span class="hint">UK law expects a contact address on invoices when you trade under a business name</span><textarea name="address" rows="2">${v('address')}</textarea></label>
        <label>Invoice payment terms (days)<input type="number" min="0" max="90" name="invoiceDueDays" value="${v('invoiceDueDays')}"></label>
        <label>Note on every invoice<input name="invoiceNote" value="${v('invoiceNote')}" placeholder="e.g. Not VAT registered"></label>
      </div></fieldset>
      <fieldset><legend>Prices</legend><div class="form-grid">
        <label>Build fee (£)<input name="buildPrice" value="${pounds(b.buildPricePence)}" inputmode="decimal"></label>
        <label>Default monthly fee (£) <span class="hint">domain and hosting</span><input name="monthly" value="${pounds(b.monthlyPence)}" inputmode="decimal"></label>
        <label class="wide">Optional extras, one per line: <span class="hint">Name | price in pounds</span>
          <textarea name="extras" rows="6" class="mono">${esc((b.extras || []).map((e) => `${e.name} | ${pounds(e.pricePence)}`).join('\n'))}</textarea></label>
      </div><div class="form-actions"><button class="primary">Save settings</button></div></fieldset></form>
      <div class="card"><h2>System status</h2>
        <p>Signed in as <b>${esc(state.me.email)}</b></p>
        <p>${flag(state.me.bankConfigured, 'Bank details set', 'Bank details missing')} ${flag(state.me.filesEnabled, 'File uploads on', 'File uploads off (no R2 bucket)')} ${state.me.botEnabled ? `<span class="tag blue">Bot API on (${esc(state.me.botAccess)} access)</span>` : '<span class="tag grey">Bot API off</span>'}</p>
        <p class="muted small">Bank details and keys live in Worker secrets, never in this database or the code. Change them with <span class="mono">npx wrangler secret put NAME</span>.</p>
      </div>
      <div class="card"><h2>Export everything to CSV</h2>
        <div class="toolbar">${['leads', 'briefs', 'outreach', 'invoices', 'subscriptions', 'payments'].map((n) => `<a class="btn" href="/admin/api/export/${n}">${n[0].toUpperCase() + n.slice(1)}</a>`).join('')}
        <button class="primary" data-action="export-all">Download all six</button></div>
      </div>`;
  };

  /* ---------- CSV import ---------- */
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const src = text.replace(/^﻿/, '');
    const endRow = () => { row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; };
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quoted) {
        if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; endRow(); }
      else cell += c;
    }
    endRow();
    return rows;
  }
  const ALIASES = {
    business_name: ['business_name', 'business name', 'business', 'name', 'company'], business_type: ['business_type', 'business type', 'type', 'category'],
    town: ['town', 'city', 'location', 'area'], contact_name: ['contact_name', 'contact name', 'contact', 'owner'], phone: ['phone', 'telephone', 'tel', 'phone number', 'mobile'],
    email: ['email', 'e-mail', 'email address'], website_url: ['website_url', 'website', 'url', 'site', 'current site', 'current site url', 'current website'],
    score: ['score', 'website score', 'site score', 'rating'], notes: ['notes', 'note', 'comments'], status: ['status', 'stage'],
  };
  function csvToLeads(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('The file needs a header row and at least one lead.');
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const map = {};
    Object.entries(ALIASES).forEach(([field, names]) => { const i = header.findIndex((h) => names.includes(h)); if (i >= 0) map[field] = i; });
    if (map.business_name === undefined) throw new Error('No "business_name" (or "name") column found in the header row.');
    return rows.slice(1).map((r) => Object.fromEntries(Object.entries(map).map(([field, i]) => [field, (r[i] || '').trim().replace(/^'(?=[=+\-@])/, '')]))).filter((r) => r.business_name);
  }

  /* ---------- actions (clicks) ---------- */
  const actions = {
    'modal-close': closeModal,
    'row-remove': (el) => el.closest('.row').remove(),
    pipeline: (el) => { state.filters = { q: '', status: el.dataset.status, type: '', town: '', maxScore: '' }; },
    'filters-clear': () => { state.filters = { q: '', status: '', type: '', town: '', maxScore: '' }; views.leads(); },

    'lead-new': () => openModal(`<h2>Add lead</h2><form data-form="lead-create">${leadFields({ status: 'New' })}<div class="form-actions"><button class="primary">Add lead</button><button type="button" data-action="modal-close">Cancel</button></div></form>`),
    'lead-delete': async (el) => {
      const l = leadById(el.dataset.id);
      if (!confirm(`Delete ${l.business_name} and everything attached to it (brief, files, outreach, invoices, payments)? This cannot be undone.`)) return;
      await api(`leads/${l.id}`, { method: 'DELETE' });
      await reload('leads', 'outreach', 'invoices', 'subs', 'payments');
      toast('Lead deleted'); location.hash = '#/leads';
    },
    'import-open': () => openModal(`<h2>Import leads from CSV</h2>
      <p class="muted">The first row must be headings. Recognised columns: business_name (required), business_type, town, contact_name, phone, email, website_url, score, notes, status. Leads that already exist with the same name and town are skipped.</p>
      <form data-form="import-run"><input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file">
      <div class="form-actions"><button class="primary">Import</button><button type="button" data-action="modal-close">Cancel</button></div></form><div id="import-result"></div>`),

    'page-add': () => {
      const rows = document.getElementById('page-rows');
      rows.insertAdjacentHTML('beforeend', pageRow({}));
      rows.lastElementChild.querySelector('input').focus();
    },
    'brief-save': saveBrief,
    'brief-prompt': async () => {
      const { lead, files } = state.currentBrief;
      const brief = await saveBrief();
      const prompt = buildPrompt({ lead, brief, files, business: state.business });
      state.currentBrief.prompt = prompt;
      state.currentBrief.siteJson = JSON.stringify(buildSiteJson(lead, brief), null, 2) + '\n';
      openModal(`<h2>Build prompt for ${esc(lead.business_name)}</h2>
        <p class="muted">Paste this into your AI coding assistant, in a copy of the client template. It contains the brief, the copy, the design direction, a starter site.json and the deploy steps.</p>
        <textarea class="mono" rows="18" readonly id="prompt-text">${esc(prompt)}</textarea>
        <div class="form-actions"><button class="primary" data-action="prompt-copy">Copy to clipboard</button><button data-action="prompt-download">Download .md</button><button data-action="sitejson-download">Download site.json</button><button data-action="modal-close">Close</button></div>`);
    },
    'prompt-copy': () => copy(state.currentBrief.prompt),
    'prompt-download': () => download(`${slugify(state.currentBrief.lead.business_name)}-build-prompt.md`, state.currentBrief.prompt, 'text/markdown'),
    'sitejson-download': () => download('site.json', state.currentBrief.siteJson, 'application/json'),
    'file-delete': async (el) => {
      if (!confirm('Delete this file?')) return;
      await api(`files/${el.dataset.id}`, { method: 'DELETE' });
      toast('File deleted'); route();
    },

    'invoice-new': (el) => invoiceModal(el.dataset.id),
    'line-add': (el) => document.getElementById('invoice-lines').insertAdjacentHTML('beforeend', invoiceLine(el.dataset.desc, el.dataset.pence === '' ? '' : Number(el.dataset.pence))),
    'invoice-paid': async (el) => {
      const date = prompt('Date the payment arrived (YYYY-MM-DD):', today());
      if (!date) return;
      await api(`invoices/${el.dataset.id}/paid`, { method: 'POST', body: { date } });
      await reload('invoices', 'payments', 'leads');
      toast('Invoice marked as paid'); route();
    },
    'invoice-void': async (el) => {
      if (!confirm('Void this invoice? It stays on record but is no longer owed.')) return;
      await api(`invoices/${el.dataset.id}`, { method: 'PUT', body: { status: 'Void' } });
      await reload('invoices'); route();
    },
    'invoice-delete': async (el) => {
      if (!confirm('Delete this invoice permanently? For your records it is usually better to void it instead.')) return;
      await api(`invoices/${el.dataset.id}`, { method: 'DELETE' });
      await reload('invoices'); toast('Invoice deleted'); route();
    },

    'sub-new': async (el) => openModal(`<h2>Add monthly plan</h2><form data-form="sub-create"><div class="form-grid">
      <label class="wide">Client<select name="lead_id" required>${leadOptions(el.dataset.id)}</select></label>
      <label>Start date (go-live day)<input type="date" name="start_date" value="${today()}" required></label>
      <label>Monthly fee (£)<input name="monthly" value="${pounds(await leadMonthlyPence(el.dataset.id))}" inputmode="decimal" required></label>
      <label class="wide">Notes<input name="notes" maxlength="2000"></label>
      </div><p class="hint">If the client is at Paid or Building, they will be moved to Live.</p>
      <div class="form-actions"><button class="primary">Add plan</button><button type="button" data-action="modal-close">Cancel</button></div></form>`),
    'sub-pay': async (el) => {
      const date = prompt('Date the payment arrived (YYYY-MM-DD):', today());
      if (!date) return;
      await api(`subscriptions/${el.dataset.id}/payment`, { method: 'POST', body: { date } });
      await reload('subs', 'payments'); toast('Payment recorded'); route();
    },
    'sub-delete': async (el) => {
      if (!confirm('Delete this monthly plan? Payments already recorded are kept. To stop a plan, set it to Cancelled instead.')) return;
      await api(`subscriptions/${el.dataset.id}`, { method: 'DELETE' });
      await reload('subs'); route();
    },
    'payment-new': () => openModal(`<h2>Record a payment</h2><form data-form="payment-create"><div class="form-grid">
      <label class="wide">Client<select name="lead_id" required>${leadOptions()}</select></label>
      <label>Date<input type="date" name="date" value="${today()}" required></label>
      <label>Amount (£)<input name="amount" inputmode="decimal" required></label>
      <label>Type<select name="kind">${['Extra', 'Build', 'Monthly', 'Other'].map((k) => option(k, k)).join('')}</select></label>
      <label>Note<input name="note" maxlength="500"></label>
      </div><div class="form-actions"><button class="primary">Record payment</button><button type="button" data-action="modal-close">Cancel</button></div></form>`),
    'payment-delete': async (el) => {
      if (!confirm('Delete this payment record? Revenue totals will go down.')) return;
      await api(`payments/${el.dataset.id}`, { method: 'DELETE' });
      await reload('payments'); route();
    },

    'outreach-new': () => outreachModal(),
    'outreach-delete': async (el) => {
      if (!confirm('Remove this entry from the log?')) return;
      await api(`outreach/${el.dataset.id}`, { method: 'DELETE' });
      await reload('outreach'); route();
    },

    'tpl-copy': () => copy(`Subject: ${document.getElementById('tpl-subject').value}\n\n${document.getElementById('tpl-body').value}`),
    'tpl-mailto': () => {
      const lead = leadById(state.tpl.leadId);
      location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(document.getElementById('tpl-subject').value)}&body=${encodeURIComponent(document.getElementById('tpl-body').value)}`;
    },
    'tpl-log': () => outreachModal(state.tpl.leadId, { channel: 'Email', outcome: `Sent: ${TEMPLATES[state.tpl.key].name}`, follow_up_date: state.tpl.key === 'payment' ? '' : addDays(today(), 5) }),
    'tpl-edit': () => {
      const key = state.tpl.key;
      const tpl = getTemplate(key);
      openModal(`<h2>Edit template: ${esc(TEMPLATES[key].name)}</h2>
        <p class="hint">Placeholders: {{greeting_name}} {{business_name}} {{business_type}} {{town}} {{website_url}} {{site_observation}} {{my_name}} {{my_email}} {{my_phone}} {{site_url}} {{build_price}} {{monthly_price}} {{invoice_number}} {{invoice_total}} {{payment_reference}} {{bank_account_name}} {{bank_sort_code}} {{bank_account_number}}. Keep the opt-out line at the end.</p>
        <form data-form="tpl-save"><label>Subject<input name="subject" value="${esc(tpl.subject)}" required></label>
        <label style="margin-top:.8rem">Message<textarea name="body" rows="16" required>${esc(tpl.body)}</textarea></label>
        <div class="form-actions"><button class="primary">Save template</button><button type="button" data-action="tpl-reset">Reset to original</button><button type="button" data-action="modal-close">Cancel</button></div></form>`);
    },
    'tpl-reset': async () => {
      delete state.templates[state.tpl.key];
      await api('settings', { method: 'PUT', body: { templates: state.templates } });
      closeModal(); toast('Template reset'); route();
    },

    'export-all': async () => {
      for (const name of ['leads', 'briefs', 'outreach', 'invoices', 'subscriptions', 'payments']) {
        const a = document.createElement('a');
        a.href = `/admin/api/export/${name}`; a.download = '';
        document.body.appendChild(a); a.click(); a.remove();
        await new Promise((r) => setTimeout(r, 600));
      }
    },
  };

  /* ---------- form submissions ---------- */
  const leadPayload = (form) => { const d = readForm(form); d.score = d.score === '' ? null : Number(d.score); return d; };
  const forms = {
    'lead-create': async (form) => {
      const lead = await api('leads', { method: 'POST', body: leadPayload(form) });
      await reload('leads'); closeModal(); toast('Lead added'); location.hash = `#/lead/${lead.id}`;
    },
    'lead-save': async (form) => {
      await api(`leads/${form.dataset.id}`, { method: 'PUT', body: leadPayload(form) });
      await reload('leads'); toast('Saved'); route();
    },
    'import-run': async (form) => {
      const file = form.querySelector('input[type="file"]').files[0];
      const rows = csvToLeads(await file.text());
      const result = await api('leads/import', { method: 'POST', body: { rows } });
      await reload('leads');
      document.getElementById('import-result').innerHTML = `<div class="notice" style="margin-top:1rem"><b>${result.imported} imported</b>, ${result.skipped} skipped as duplicates${result.errors.length ? `, ${result.errors.length} with problems:<br>${result.errors.map(esc).join('<br>')}` : '.'}</div>`;
      if (location.hash.startsWith('#/leads')) views.leads();
    },
    'brief-save': saveBrief,
    'files-upload': async (form) => {
      await api(`leads/${form.dataset.id}/files`, { method: 'POST', body: new FormData(form) });
      toast('Uploaded'); route();
    },
    'invoice-create': async (form) => {
      const d = readForm(form);
      const items = [...form.querySelectorAll('[data-line]')].map((row) => ({ description: row.querySelector('[data-line-desc]').value.trim(), amount_pence: toPence(row.querySelector('[data-line-amount]').value) }));
      const invoice = await api('invoices', { method: 'POST', body: { lead_id: Number(d.lead_id), issue_date: d.issue_date, due_date: d.due_date, items, monthly_pence: toPence(d.monthly || '0'), reference: d.reference, notes: d.notes } });
      await reload('invoices'); closeModal(); toast(`Invoice ${invoice.number} created`);
      if (location.hash === '#/invoices') route(); else location.hash = '#/invoices';
    },
    'sub-create': async (form) => {
      const d = readForm(form);
      await api('subscriptions', { method: 'POST', body: { lead_id: Number(d.lead_id), start_date: d.start_date, monthly_pence: toPence(d.monthly), status: 'Active', notes: d.notes } });
      const lead = leadById(d.lead_id);
      if (lead && ['Paid', 'Building'].includes(lead.status)) await api(`leads/${lead.id}`, { method: 'PUT', body: { status: 'Live' } });
      await reload('subs', 'leads'); closeModal(); toast('Monthly plan added'); route();
    },
    'payment-create': async (form) => {
      const d = readForm(form);
      await api('payments', { method: 'POST', body: { lead_id: Number(d.lead_id), date: d.date, amount_pence: toPence(d.amount), kind: d.kind, note: d.note } });
      await reload('payments'); closeModal(); toast('Payment recorded'); route();
    },
    'outreach-add': async (form) => {
      const d = readForm(form);
      d.lead_id = Number(d.lead_id);
      await api('outreach', { method: 'POST', body: d });
      // Logging any contact moves a brand-new lead to Contacted.
      const lead = leadById(d.lead_id);
      if (lead && lead.status === 'New') await api(`leads/${lead.id}`, { method: 'PUT', body: { status: 'Contacted' } });
      if (/not to be contacted|opt.?out|unsubscribe/i.test(d.outcome) && lead) await api(`leads/${lead.id}`, { method: 'PUT', body: { do_not_contact: true } });
      await reload('outreach', 'leads'); closeModal(); toast('Logged'); route();
    },
    'tpl-save': async (form) => {
      state.templates[state.tpl.key] = readForm(form);
      await api('settings', { method: 'PUT', body: { templates: state.templates } });
      closeModal(); toast('Template saved'); route();
    },
    'settings-save': async (form) => {
      const d = readForm(form);
      const extras = d.extras.split('\n').map((line) => line.split('|').map((s) => s.trim())).filter(([name]) => name).map(([name, price]) => ({ name, pricePence: toPence(price || '0') }));
      const business = { ...state.business, ...d, extras, buildPricePence: toPence(d.buildPrice), monthlyPence: toPence(d.monthly), invoiceDueDays: Number(d.invoiceDueDays) || 7 };
      delete business.buildPrice; delete business.monthly;
      await api('settings', { method: 'PUT', body: { business } });
      state.business = business; toast('Settings saved'); route();
    },
  };

  /* ---------- select / checkbox changes ---------- */
  const changes = {
    'lead-status': async (el) => {
      await api(`leads/${el.dataset.id}`, { method: 'PUT', body: { status: el.value } });
      leadById(el.dataset.id).status = el.value; toast('Status updated');
    },
    'sub-status': async (el) => {
      await api(`subscriptions/${el.dataset.id}`, { method: 'PUT', body: { status: el.value } });
      await reload('subs'); route();
    },
    'outreach-due': (el) => { state.outreachDueOnly = el.checked; views.outreach(); },
    'tpl-lead': (el) => { state.tpl.leadId = Number(el.value) || null; views.templates(); },
    'tpl-key': (el) => { state.tpl.key = el.value; views.templates(); },
  };

  /* ---------- wiring ---------- */
  const guard = (fn) => async (...args) => { try { await fn(...args); } catch (err) { console.error(err); toast(err.message || 'Something went wrong', true); } };

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    if (el.tagName === 'BUTTON') event.preventDefault();
    guard(actions[el.dataset.action])(el);
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button:not([type="button"])');
    if (button) button.disabled = true;
    guard(forms[form.dataset.form])(form).then(() => { if (button) button.disabled = false; });
  });
  document.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (el) guard(changes[el.dataset.change])(el);
  });
  document.addEventListener('input', (event) => {
    const el = event.target.closest('[data-filter]');
    if (!el) return;
    state.filters[el.dataset.filter] = el.value;
    renderLeadRows();
  });
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

  function route() {
    const [, name = 'dashboard', arg] = location.hash.split('/');
    const fn = views[name] || views.dashboard;
    document.querySelectorAll('#nav a').forEach((a) => {
      const target = a.getAttribute('href').slice(2);
      a.classList.toggle('active', target === name || (target === 'leads' && (name === 'lead' || name === 'brief')));
    });
    guard(fn)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  (async function start() {
    try {
      const [me, settings] = await Promise.all([api('me'), api('settings')]);
      state.me = me;
      state.business = settings.business;
      state.templates = settings.templates || {};
      await reload('leads', 'outreach', 'invoices', 'subs', 'payments');
      document.getElementById('whoami').textContent = me.email;
      route();
    } catch (err) {
      view.innerHTML = `<div class="notice red"><b>Could not load the admin.</b> ${esc(err.message)}</div>`;
    }
  })();
})();
