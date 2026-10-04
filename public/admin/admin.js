(function () {
  const $ = (id) => document.getElementById(id);
  const SECTION_KEYS = ['hero', 'about', 'expertise', 'journey', 'experience', 'assessments', 'skills', 'projects', 'testimonials', 'education', 'certifications', 'interests', 'connect'];
  const SECTION_NAMES = {
    hero: 'Hero (top)', about: 'About card', expertise: 'Areas of Expertise', journey: 'Career Journey',
    experience: 'Experience', assessments: 'Gov. & Assessment Projects', skills: 'Skills', projects: 'Projects',
    testimonials: 'Testimonials', education: 'Education', certifications: 'Certifications', interests: 'Interests', connect: 'Contact',
  };

  let content = null;
  let current = SCHEMA[0].key;
  let dirty = false;
  let adminEmail = '';
  const openItems = {}; // section key -> Set of open item indexes

  // ---------- tiny DOM helper ----------
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const ico = (name) => h('i', { 'data-lucide': name });
  const refreshIcons = () => window.lucide && window.lucide.createIcons();

  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show${isErr ? ' err' : ''}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.className = 'toast'), 2600);
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/login' && url !== '/api/credentials') {
      showLogin();
      throw new Error('Session expired — please log in again');
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  const jsonOpts = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  function setDirty(v) {
    dirty = v;
    $('saveBtn').disabled = !v;
    $('status').textContent = v ? 'Unsaved changes' : '';
    $('status').className = `status${v ? ' dirty' : ''}`;
  }
  const changed = () => setDirty(true);

  // ---------- normalise data ----------
  function normalise(data) {
    const d = data && typeof data === 'object' ? data : {};
    d.settings = d.settings || {};
    d.profile = d.profile || {};
    for (const s of SCHEMA) {
      if (s.type === 'list' && !Array.isArray(d[s.key])) d[s.key] = [];
      if (s.type === 'object' && (!d[s.key] || typeof d[s.key] !== 'object')) d[s.key] = {};
    }
    if (!Array.isArray(d.sections)) d.sections = [];
    for (const key of SECTION_KEYS) {
      if (!d.sections.some((s) => s.key === key)) {
        const sec = { key, eyebrow: '', title: key[0].toUpperCase() + key.slice(1), subtitle: '', enabled: true };
        const connectAt = d.sections.findIndex((s) => s.key === 'connect');
        if (key === 'hero') d.sections.unshift(sec);
        else if (connectAt >= 0) d.sections.splice(connectAt, 0, sec);
        else d.sections.push(sec);
      }
    }
    return d;
  }

  // ---------- field renderers ----------
  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const { url } = await api('/api/upload', { method: 'POST', body: fd });
    return url;
  }

  function renderField(obj, f, onChange) {
    const set = (v) => {
      obj[f.name] = v;
      changed();
      onChange && onChange();
    };
    const val = obj[f.name];
    let control;

    switch (f.type) {
      case 'textarea':
        control = h('textarea', { rows: f.rows || 4, value: val ?? '', placeholder: f.placeholder || '', oninput: (e) => set(e.target.value) });
        break;

      case 'select':
        control = h('select', { onchange: (e) => set(e.target.value) },
          f.options.map(([v, label]) => h('option', { value: v, selected: (val ?? f.options[0][0]) === v }, label)));
        break;

      case 'checkbox':
        return h('div', { class: 'field' },
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: f.default === false ? !!val : val !== false, onchange: (e) => set(e.target.checked) }), f.label));

      case 'color': {
        const text = h('input', { type: 'text', value: val || '#f26b6b', oninput: (e) => { picker.value = e.target.value; set(e.target.value); } });
        const picker = h('input', { type: 'color', value: val || '#f26b6b', oninput: (e) => { text.value = e.target.value; set(e.target.value); } });
        control = h('div', { class: 'inline' }, picker, text);
        break;
      }

      case 'color-tag': {
        const wrap = h('div', { class: 'swatches' });
        const draw = () => {
          wrap.replaceChildren(...COLORS.map((c) =>
            h('button', { type: 'button', class: `swatch c-${c}${obj[f.name] === c ? ' on' : ''}`, onclick: () => { set(c); draw(); } }, c)));
        };
        draw();
        control = wrap;
        break;
      }

      case 'range': {
        const out = h('span', { class: 'range-val' }, String(val ?? 0));
        control = h('div', { class: 'inline' },
          h('input', { type: 'range', min: 0, max: 100, step: 5, value: val ?? 0, oninput: (e) => { out.textContent = e.target.value; set(Number(e.target.value)); } }),
          out);
        break;
      }

      case 'icon': {
        const preview = h('span', { class: 'icon-preview' });
        const ALIASES = { whatsapp: 'phone', x: 'twitter', 'x-twitter': 'twitter', telegram: 'send', email: 'mail', website: 'globe', portfolio: 'globe' };
        const pascal = (n) => n.split('-').map((s) => (s ? s[0].toUpperCase() + s.slice(1) : '')).join('');
        const draw = (name) => {
          let n = String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
          n = ALIASES[n] || n;
          const known = n && (!window.lucide?.icons || window.lucide.icons[pascal(n)]);
          preview.replaceChildren(ico(known ? n : 'help-circle'));
          preview.title = known ? '' : 'Unknown icon name, a link icon will be shown on the site';
          refreshIcons();
        };
        control = h('div', { class: 'inline' },
          preview,
          h('input', { type: 'text', value: val ?? '', placeholder: 'e.g. star', oninput: (e) => { set(e.target.value.trim()); draw(e.target.value.trim()); } }),
          h('a', { href: 'https://lucide.dev/icons/', target: '_blank', rel: 'noopener', class: 'btn small' }, 'Browse'));
        setTimeout(() => draw(val), 0);
        break;
      }

      case 'image':
      case 'file': {
        const isImg = f.type === 'image';
        const fallback = f.name === 'avatar' ? '/img/default-avatar.svg' : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        const img = isImg ? h('img', { src: val || fallback, alt: '' }) : null;
        const text = h('input', { type: 'text', value: val ?? '', placeholder: isImg ? 'Upload or paste an image URL' : 'Upload or paste a file URL', oninput: (e) => { set(e.target.value); if (img) img.src = e.target.value || fallback; } });
        const input = h('input', {
          type: 'file', hidden: true, accept: isImg ? 'image/png,image/jpeg,image/webp,image/gif' : 'application/pdf,image/*',
          onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const url = await uploadFile(file);
              text.value = url;
              if (img) img.src = url;
              set(url);
              toast('Uploaded — remember to save');
            } catch (err) { toast(err.message, true); }
            e.target.value = '';
          },
        });
        const buttons = h('div', { class: 'inline' },
          h('button', { type: 'button', class: 'btn small', onclick: () => input.click() }, ico('upload'), 'Upload'),
          val && !isImg ? h('a', { class: 'btn small', href: val, target: '_blank', rel: 'noopener' }, 'Open') : null,
          h('button', { type: 'button', class: 'btn small danger', onclick: () => { text.value = ''; if (img) img.src = fallback; set(''); } }, 'Remove'),
          input);
        control = h('div', { class: 'media' }, img, h('div', { class: 'stack' }, text, buttons));
        break;
      }

      default:
        control = h('input', { type: 'text', value: val ?? '', placeholder: f.placeholder || '', oninput: (e) => set(e.target.value) });
    }

    return h('div', { class: `field${f.half ? ' half' : ''}` },
      h('label', {}, f.label), control, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
  }

  // ---------- section editors ----------
  function objectEditor(section) {
    const obj = content[section.key];
    return h('div', { class: 'panel' }, h('div', { class: 'fields' }, section.fields.map((f) => renderField(obj, f))));
  }

  function listEditor(section) {
    const list = content[section.key];
    const open = (openItems[section.key] ||= new Set());

    const move = (from, to) => {
      [list[from], list[to]] = [list[to], list[from]];
      const a = open.has(from), b = open.has(to);
      open.delete(from); open.delete(to);
      if (a) open.add(to);
      if (b) open.add(from);
      changed();
      render();
    };

    const items = list.map((item, i) => {
      const titleEl = h('span', { class: 't' }, section.itemTitle(item));
      const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
      const hiddenBadge = h('span', { class: 'hidden-badge' }, 'Hidden on site');
      const eyeBtn = h('button', {
        class: 'icon-btn', title: item.hidden ? 'Show on site' : 'Hide on site (keeps it saved here)',
        onclick: stop(() => { item.hidden = !item.hidden; if (!item.hidden) delete item.hidden; changed(); render(); }),
      }, ico(item.hidden ? 'eye-off' : 'eye'));
      const details = h('details', { class: `item${item.hidden ? ' is-hidden' : ''}`, open: open.has(i), ontoggle: (e) => (e.target.open ? open.add(i) : open.delete(i)) },
        h('summary', {},
          h('span', { class: 'chev' }, ico('chevron-right')),
          titleEl,
          item.hidden ? hiddenBadge : null,
          eyeBtn,
          h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: stop(() => move(i, i - 1)) }, ico('arrow-up')),
          h('button', { class: 'icon-btn', title: 'Move down', disabled: i === list.length - 1, onclick: stop(() => move(i, i + 1)) }, ico('arrow-down')),
          h('button', { class: 'icon-btn', title: 'Duplicate', onclick: stop(() => { list.splice(i + 1, 0, structuredClone(item)); changed(); render(); }) }, ico('copy')),
          h('button', {
            class: 'icon-btn danger', title: 'Delete',
            onclick: stop(() => {
              if (!confirm(`Delete "${section.itemTitle(item)}"?`)) return;
              list.splice(i, 1);
              openItems[section.key] = new Set();
              changed();
              render();
            }),
          }, ico('trash-2'))),
        h('div', { class: 'fields' }, section.fields.map((f) => renderField(item, f, () => (titleEl.textContent = section.itemTitle(item))))));
      return details;
    });

    const add = h('div', { class: 'add-row' },
      h('button', {
        class: 'btn', onclick: () => {
          list.push(structuredClone(section.blank || {}));
          open.add(list.length - 1);
          changed();
          render();
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        },
      }, ico('plus'), `Add ${section.title.toLowerCase().replace(/s$/, '')}`));

    return [...(items.length ? items : [h('div', { class: 'empty' }, 'Nothing here yet.')]), add];
  }

  function sectionsEditor() {
    const list = content.sections;
    const swap = (a, b) => { [list[a], list[b]] = [list[b], list[a]]; changed(); render(); };
    const textField = (s, name, label, placeholder) =>
      h('div', { class: 'field half' }, h('label', {}, label),
        h('input', { type: 'text', value: s[name] || '', placeholder, oninput: (e) => { s[name] = e.target.value; changed(); } }));

    return [
      h('p', { class: 'muted', style: 'margin:0' }, 'Turn sections on or off, change their order, and edit their headings. Sections with no items are hidden automatically.'),
      ...list.map((s, i) =>
        h('div', { class: `sec-card${s.enabled === false ? ' off' : ''}` },
          h('div', { class: 'sec-row' },
            h('label', { class: 'check', title: 'Show on site' },
              h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: (e) => { s.enabled = e.target.checked; changed(); render(); } }),
              SECTION_NAMES[s.key] || s.key),
            h('span', { class: 'spacer' }),
            s.key === 'hero' ? null : h('label', { class: 'check menu-check', title: 'Show a link to this section in the top menu and footer' },
              h('input', { type: 'checkbox', checked: s.nav !== false, onchange: (e) => { s.nav = e.target.checked; changed(); } }), 'In menu'),
            h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: () => swap(i, i - 1) }, ico('arrow-up')),
            h('button', { class: 'icon-btn', title: 'Move down', disabled: i === list.length - 1, onclick: () => swap(i, i + 1) }, ico('arrow-down'))),
          s.key === 'hero'
            ? h('div', { class: 'hint', style: 'padding:0 16px 14px' }, 'The hero uses your Profile, Stats, Highlight Tags and Quick Info. Keep it first for the best result.')
            : h('div', { class: 'fields sec-fields' },
                textField(s, 'eyebrow', 'Small label', 'e.g. Expertise'),
                textField(s, 'title', 'Heading', 'e.g. Skills & Tools'),
                textField(s, 'navLabel', 'Menu label (top menu & footer)', SECTION_NAMES[s.key] || ''),
                s.key === 'about' ? null : h('div', { class: 'field' }, h('label', {}, 'Subtitle (optional)'),
                  h('input', { type: 'text', value: s.subtitle || '', oninput: (e) => { s.subtitle = e.target.value; changed(); } })),
                s.key === 'about' ? null : graphicPicker(s)))),
    ];
  }

  // Illustration choice for a section, with a live preview
  function graphicPicker(s) {
    const preview = h('div', { class: 'gprev' });
    const settings = content.settings || {};
    preview.style.setProperty('--accent', settings.accentColor || '#ff6b6b');
    preview.style.setProperty('--accent-2', settings.accentColor2 || '#7c5cff');
    const draw = () => {
      if (s.graphic === 'none') { preview.innerHTML = '<span class="muted">No illustration</span>'; return; }
      if (s.graphicImage) { preview.innerHTML = ''; preview.append(h('img', { src: s.graphicImage, alt: '' })); return; }
      const preset = s.graphic && s.graphic !== 'auto' ? s.graphic : s.key;
      const fn = window.SECTION_GRAPHICS && window.SECTION_GRAPHICS[preset];
      preview.innerHTML = fn ? fn() : '<span class="muted">No matching illustration</span>';
      preview.classList.toggle('dark', preset === 'connect');
    };
    draw();
    return h('div', { class: 'field graphic-field' },
      h('div', { class: 'graphic-controls' },
        renderField(s, { name: 'graphic', label: 'Illustration', type: 'select', options: GRAPHIC_OPTIONS }, draw),
        renderField(s, { name: 'graphicImage', label: 'Or upload your own image (optional)', type: 'image', hint: 'Overrides the illustration. A PNG or WebP with a transparent background looks best.' }, draw)),
      preview);
  }

  function securityEditor() {
    const email = h('input', { type: 'email', autocomplete: 'username', value: adminEmail || '', required: true });
    const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const next = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Leave empty to keep current' });
    const confirmPw = h('input', { type: 'password', autocomplete: 'new-password' });
    const submit = async (e) => {
      e.preventDefault();
      if (next.value !== confirmPw.value) return toast('New passwords do not match', true);
      try {
        const res = await api('/api/credentials', jsonOpts('POST', { current: cur.value, email: email.value, next: next.value || undefined }));
        adminEmail = res.email;
        cur.value = next.value = confirmPw.value = '';
        toast('Login details updated. Other devices have been signed out.');
      } catch (err) { toast(err.message, true); }
    };
    return h('form', { class: 'panel', onsubmit: submit },
      h('p', { class: 'muted', style: 'margin-top:0' }, 'You sign in with this email and password. Use a long, unique password (10+ characters); a password manager helps.'),
      h('div', { class: 'fields' },
        h('div', { class: 'field' }, h('label', {}, 'Login email'), email),
        h('div', { class: 'field half' }, h('label', {}, 'New password'), next),
        h('div', { class: 'field half' }, h('label', {}, 'Confirm new password'), confirmPw),
        h('div', { class: 'field' }, h('label', {}, 'Current password (required to save)'), cur),
        h('div', { class: 'field' }, h('div', {}, h('button', { class: 'btn primary', type: 'submit' }, ico('key-round'), 'Update login details')))));
  }

  function backupEditor() {
    const fileInput = h('input', {
      type: 'file', accept: 'application/json', hidden: true,
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (!data.profile || !Array.isArray(data.sections)) throw new Error('That file is not a portfolio backup');
          content = normalise(data);
          changed();
          toast('Backup loaded — click Save to publish it');
        } catch (err) { toast(err.message, true); }
        e.target.value = '';
      },
    });
    const download = () => {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return h('div', { class: 'panel' },
      h('p', { style: 'margin-top:0' }, 'Download all your content as a JSON file, or restore from one. Every save also keeps an automatic backup of the previous version on the server.'),
      h('div', { class: 'inline' },
        h('button', { class: 'btn', onclick: download }, ico('download'), 'Download backup'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, ico('upload'), 'Restore from file'),
        fileInput));
  }

  // ---------- render ----------
  function renderNav() {
    $('nav').replaceChildren(...SCHEMA.map((s) =>
      h('button', { class: s.key === current ? 'active' : '', onclick: () => { current = s.key; render(); window.scrollTo(0, 0); } },
        ico(s.icon), s.title,
        s.type === 'list' ? h('span', { class: 'count', title: 'shown / total' }, (() => {
          const total = content[s.key].length;
          const shown = content[s.key].filter((x) => !x.hidden).length;
          return shown === total ? String(total) : `${shown}/${total}`;
        })()) : null)));
  }

  function render() {
    const section = SCHEMA.find((s) => s.key === current);
    $('sectionTitle').textContent = section.title;
    $('sectionHelp').textContent = section.help || '';
    const views = {
      object: objectEditor, list: listEditor, sections: sectionsEditor, security: securityEditor, backup: backupEditor,
    };
    $('editor').replaceChildren(...[].concat(views[section.type](section)));
    $('saveBtn').hidden = section.type === 'security';
    renderNav();
    refreshIcons();
  }

  async function save() {
    $('saveBtn').disabled = true;
    try {
      await api('/api/content', jsonOpts('PUT', content));
      setDirty(false);
      toast('Saved! Your site is updated.');
    } catch (err) {
      $('saveBtn').disabled = false;
      toast(err.message, true);
    }
  }

  // ---------- auth flow ----------
  function showLogin() {
    $('shell').hidden = true;
    $('loginScreen').hidden = false;
    ($('email').value ? $('password') : $('email')).focus();
  }

  async function showDashboard() {
    const me = await api('/api/me');
    adminEmail = me.email || '';
    content = normalise(await api('/api/content'));
    $('loginScreen').hidden = true;
    $('shell').hidden = false;
    setDirty(false);
    render();
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
      await api('/api/login', jsonOpts('POST', { email: $('email').value, password: $('password').value }));
      $('password').value = '';
      await showDashboard();
    } catch (err) {
      $('loginError').textContent = err.message;
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    if (dirty && !confirm('You have unsaved changes. Log out anyway?')) return;
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    setDirty(false);
    showLogin();
  });

  $('saveBtn').addEventListener('click', save);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (dirty) save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });

  api('/api/me')
    .then((r) => (r.authed ? showDashboard() : showLogin()))
    .catch(showLogin);
})();
