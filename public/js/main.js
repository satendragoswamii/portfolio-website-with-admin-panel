(function () {
  const COLORS = ['red', 'blue', 'green', 'purple', 'yellow', 'orange', 'pink', 'teal', 'gray'];
  const NAV_LABELS = {
    about: 'About', expertise: 'Expertise', journey: 'Journey', skills: 'Skills', experience: 'Experience',
    assessments: 'Assessments', projects: 'Projects', education: 'Education', certifications: 'Certifications',
    interests: 'Interests', testimonials: 'Testimonials', connect: 'Contact',
  };
  // Every fixed word on the site. Overridden by content.labels (Admin → Buttons & Labels).
  const LABEL_DEFAULTS = {
    navCta: "Let's talk",
    heroPrimary: "Let's talk",
    heroWork: 'View my work',
    heroAbout: 'More about me',
    greetingEmoji: '👋',
    findMeOn: 'Find me on',
    resume: 'Resume',
    downloadResume: 'Download Resume',
    featuredProject: 'Featured project',
    liveDemo: 'Live demo',
    source: 'Source',
    viewCredential: 'View credential',
    viewDetails: 'View responsibilities ({n})',
    hideDetails: 'Hide responsibilities',
    roleMore: 'Show role details ({n})',
    roleLess: 'Hide role details',
    dotNavTop: 'Top',
    testimonialSource: 'View original',
    skillsCount: '{n} skills',
    educationHeading: 'Education',
    sendEmail: 'Send an email',
    copyEmail: 'Copy email',
    emailCopied: 'Email copied to clipboard',
    loadError: 'Could not load content. Please refresh.',
  };
  let labels = {};
  // Empty = default text; whitespace only (e.g. a single space) = hide that label
  const t = (key, vars = {}) => {
    const own = labels[key];
    const text = typeof own === 'string' && own.length ? own.trim() : LABEL_DEFAULTS[key] || '';
    return text.replace(/\{(\w+)\}/g, (_, v) => (vars[v] ?? ''));
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  // ---------- helpers ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeUrl = (u) => {
    const s = String(u ?? '').trim();
    return /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(s) ? s : '';
  };
  // Friendly names for brands Lucide doesn't ship
  const ICON_ALIASES = {
    whatsapp: 'message-circle', x: 'twitter', 'x-twitter': 'twitter', telegram: 'send', email: 'mail',
    website: 'globe', portfolio: 'globe', blog: 'pen-line', medium: 'book-open', hashnode: 'pen-line',
    devto: 'code', leetcode: 'code', hackerrank: 'code', stackoverflow: 'layers', behance: 'pen-tool', skype: 'video',
  };
  const toPascal = (n) => n.split('-').map((s) => (s ? s[0].toUpperCase() + s.slice(1) : '')).join('');
  const iconName = (n) => {
    let name = String(n ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    name = ICON_ALIASES[name] || name;
    if (name && window.lucide?.icons && !window.lucide.icons[toPascal(name)]) return 'link';
    return name;
  };
  // Brand marks not in Lucide (stroke style to match)
  const BRAND_SVGS = {
    whatsapp: '<svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>',
  };
  const icon = (n) => {
    const raw = String(n ?? '').toLowerCase();
    if (BRAND_SVGS[raw]) return BRAND_SVGS[raw];
    return iconName(n) ? `<i data-lucide="${iconName(n)}"></i>` : '';
  };
  const isKnownIcon = (n) => {
    const raw = String(n ?? '').toLowerCase();
    return !!BRAND_SVGS[raw] || !!ICON_ALIASES[raw] || !window.lucide?.icons || !!window.lucide.icons[toPascal(raw)];
  };
  // Pick the best icon for a social link: saved icon, else platform name, else the URL's domain
  function socialIcon(x) {
    if (x.icon && isKnownIcon(x.icon)) return x.icon;
    const hay = `${x.platform || ''} ${x.url || ''}`.toLowerCase();
    if (/whatsapp|wa\.me/.test(hay)) return 'whatsapp';
    const guess = ['linkedin', 'github', 'twitter', 'instagram', 'facebook', 'youtube', 'gitlab', 'twitch', 'dribbble', 'figma', 'telegram', 'medium']
      .find((b) => hay.includes(b));
    return guess || (/x\.com/.test(hay) ? 'twitter' : x.icon || 'link');
  }
  const colorClass = (c) => (COLORS.includes(c) ? `c-${c}` : 'c-gray');
  const has = (arr) => Array.isArray(arr) && arr.length > 0;
  const secId = (key) => `sec-${String(key).replace(/[^a-z0-9-]/gi, '')}`;
  const ext = (url) => (/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : '');
  const delay = (i, step = 0.08) => `style="--d:${(i * step).toFixed(2)}s"`;

  // Blank line = new block. Lines starting with "- " become bullets, "### " a sub-heading.
  // A block that starts with a sub-heading is wrapped as a group (laid out in columns on wide screens).
  const BULLET = /^\s*[-•*]\s+/;
  const HEADING = /^\s*#{1,6}\s+/;
  function richText(text) {
    return String(text ?? '')
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((block) => {
        const out = [];
        let list = null;
        let para = null;
        const flushList = () => { if (list) out.push(`<ul>${list.join('')}</ul>`); list = null; };
        const flushPara = () => { if (para) out.push(`<p>${para.join('<br>')}</p>`); para = null; };
        for (const line of block.split('\n')) {
          if (HEADING.test(line)) { flushList(); flushPara(); out.push(`<h4>${esc(line.replace(HEADING, ''))}</h4>`); }
          else if (BULLET.test(line)) { flushPara(); (list ||= []).push(`<li>${esc(line.replace(BULLET, ''))}</li>`); }
          else { flushList(); (para ||= []).push(esc(line)); }
        }
        flushList();
        flushPara();
        return HEADING.test(block) ? `<div class="rt-group">${out.join('')}</div>` : out.join('');
      })
      .join('');
  }
  const proseClass = (text) => (/^\s*#{1,6}\s+/m.test(String(text ?? '')) ? 'prose grouped' : 'prose');

  function categoryIcon(name) {
    const n = String(name).toLowerCase();
    const map = [
      [/deploy|hosting/, 'rocket'], [/web dev|frontend|front-end/, 'code-2'],
      [/operating|cloud|\bos\b/, 'monitor'], [/\bai\b|productiv|research/, 'sparkles'], [/device|security/, 'shield-check'],
      [/system|server|infra|network/, 'server'], [/data|analytic|database|sql/, 'database'],
      [/support|help/, 'headphones'], [/application|platform|tool|software/, 'app-window'],
      [/dev|code|program|web|automat/, 'code-2'], [/professional|soft|people|communicat|lead/, 'users'],
      [/design|ui|ux/, 'palette'], [/cloud|devops/, 'cloud'], [/other|misc/, 'cpu'],
      [/core|main|primary/, 'star'], [/lang/, 'languages'],
    ];
    return (map.find(([re]) => re.test(n)) || [, 'sparkles'])[1];
  }

  const GRADIENTS = [['#ff6b6b', '#7c5cff'], ['#06b6d4', '#3b82f6'], ['#f59e0b', '#ef4444'], ['#10b981', '#0ea5e9'], ['#8b5cf6', '#ec4899'], ['#f97316', '#eab308']];
  const gradientFor = (s) => GRADIENTS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

  function socialLinks(d, cls) {
    const links = (d.socials || [])
      .filter((x) => safeUrl(x.url))
      .map((x) => `<a class="${cls}" href="${esc(safeUrl(x.url))}"${ext(x.url)} aria-label="${esc(x.platform)}" title="${esc(x.platform)}">${icon(socialIcon(x))}</a>`);
    if (d.profile?.email) links.unshift(`<a class="${cls}" href="mailto:${esc(d.profile.email)}" aria-label="Email" title="Email">${icon('mail')}</a>`);
    return links.join('');
  }

  // Section illustration: uploaded image > chosen preset > automatic (matches the section) — or none
  let showGraphics = true;
  function graphicFor(s) {
    if (!showGraphics || s.graphic === 'none') return '';
    if (safeUrl(s.graphicImage)) return `<img src="${esc(safeUrl(s.graphicImage))}" alt="" loading="lazy" />`;
    const preset = s.graphic && s.graphic !== 'auto' ? s.graphic : s.key;
    const draw = window.SECTION_GRAPHICS && window.SECTION_GRAPHICS[preset];
    return draw ? draw() : '';
  }

  const sectionHead = (s, n, center) => {
    const head = `
    <div class="sec-head reveal${center ? ' center' : ''}">
      <span class="eyebrow"><span class="num">${String(n).padStart(2, '0')}</span>${esc(s.eyebrow || NAV_LABELS[s.key] || '')}</span>
      <h2 class="sec-title">${esc(s.title)}</h2>
      ${s.subtitle ? `<p class="sec-sub">${esc(s.subtitle)}</p>` : ''}
    </div>`;
    const art = graphicFor(s);
    return art ? `<div class="sec-head-row">${head}<div class="sec-graphic reveal" style="--d:.15s" aria-hidden="true">${art}</div></div>` : head;
  };

  // ---------- section renderers ----------
  const renderers = {
    hero(s, d, ctx) {
      const p = d.profile || {};
      const [first, ...rest] = String(p.name || '').trim().split(/\s+/);
      const avatar = safeUrl(p.avatar) || '/img/default-avatar.svg';

      const ctas = [];
      if (ctx.has('connect')) ctas.push(`<a class="btn btn-primary" href="#sec-connect">${icon('send')}${esc(t('heroPrimary'))}</a>`);
      else if (p.email) ctas.push(`<a class="btn btn-primary" href="mailto:${esc(p.email)}">${icon('send')}${esc(t('heroPrimary'))}</a>`);
      if (ctx.has('projects')) ctas.push(`<a class="btn" href="#sec-projects">${esc(t('heroWork'))}${icon('arrow-right')}</a>`);
      else if (ctx.has('about')) ctas.push(`<a class="btn" href="#sec-about">${esc(t('heroAbout'))}${icon('arrow-right')}</a>`);
      if (safeUrl(p.resume)) ctas.push(`<a class="btn btn-ghost" href="${esc(safeUrl(p.resume))}" target="_blank" rel="noopener">${icon('file-down')}${esc(t('resume'))}</a>`);

      const floats = (d.info || []).slice(0, 3).map(
        (i, n) => `<div class="float-card fc-${n} ${colorClass(i.color)}">
          <span class="fi">${icon(i.icon)}</span>
          <div><div class="fl">${esc(i.label)}</div><div class="fv">${esc(i.value)}</div></div>
        </div>`
      ).join('');

      const stats = (d.stats || []).filter((x) => x.value || x.label).map(
        (x, i) => `<div class="stat reveal" ${delay(i)}>
          <span class="si">${icon(x.icon || 'sparkles')}</span>
          <div><div class="sv" data-count="${esc(x.value)}">${esc(x.value)}</div><div class="sl">${esc(x.label)}</div></div>
        </div>`
      ).join('');

      const socials = socialLinks(d, 'social-btn');
      const marqueeWords = d.settings?.showMarquee === false ? []
        : (has(d.skills) ? d.skills.map((x) => x.name) : (d.highlights || []).map((x) => x.label)).filter(Boolean);
      const marqueeRow = marqueeWords.map((w) => `<span class="marquee-item">${icon('sparkle')}${esc(w)}</span>`).join('');

      return `<section class="hero" id="${secId('hero')}">
          <div class="hero-bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="grid-pattern"></div></div>
          <div class="container">
            <div class="hero-inner">
              <div class="hero-copy">
                ${p.availability ? `<span class="badge reveal"><span class="dot"></span>${esc(p.availability)}</span>` : ''}
                <p class="hero-greet reveal" ${delay(1)}>${esc(p.greeting || "Hi, I'm")}${t('greetingEmoji') ? ` <span class="wave">${esc(t('greetingEmoji'))}</span>` : ''}</p>
                <h1 class="hero-title reveal" ${delay(2)}>${esc(first || '')}${rest.length ? ` <span class="grad-text">${esc(rest.join(' '))}</span>` : ''}</h1>
                ${p.headline ? `<p class="hero-headline reveal" ${delay(3)}>${esc(p.headline)}</p>` : ''}
                ${has(d.highlights) ? `<p class="hero-typed reveal" ${delay(4)}>${esc(p.typedPrefix || 'I specialise in')} <span class="typed" id="typed"></span><span class="caret"></span></p>` : ''}
                ${p.intro ? `<p class="hero-intro reveal" ${delay(5)}>${esc(p.intro)}</p>` : ''}
                ${ctas.length ? `<div class="hero-ctas reveal" ${delay(6)}>${ctas.join('')}</div>` : ''}
                ${socials ? `<div class="hero-socials reveal" ${delay(7)}>${t('findMeOn') ? `<span class="label">${esc(t('findMeOn'))}</span>` : ''}${socials}</div>` : ''}
              </div>
              <div class="hero-visual reveal" ${delay(3)}>
                <div class="orbit"></div>
                <div class="avatar-ring"><img src="${esc(avatar)}" alt="${esc(p.name || 'Profile photo')}" /></div>
                ${floats}
              </div>
            </div>
            ${stats ? `<div class="stats">${stats}</div>` : ''}
          </div>
        </section>
        ${marqueeRow ? `<div class="marquee" aria-hidden="true"><div class="marquee-track" style="animation-duration:${Math.max(30, marqueeWords.length * 3.2)}s">${marqueeRow}${marqueeRow}</div></div>` : ''}`;
    },

    about(s, d) {
      const p = d.profile || {};
      const avatar = safeUrl(p.avatar) || '/img/default-avatar.svg';
      const info = (d.info || []).map(
        (i) => `<li class="info-item ${colorClass(i.color)}"><span class="ii">${icon(i.icon)}</span>
          <div><div class="info-label">${esc(i.label)}</div><div class="info-value">${esc(i.value)}</div></div></li>`
      ).join('');
      const pills = (d.highlights || []).map((h) => `<span class="pill ${colorClass(h.color)}">${icon(h.icon)}${esc(h.label)}</span>`).join('');

      const actions = [];
      if (safeUrl(p.resume)) actions.push(`<a class="btn btn-primary btn-sm" href="${esc(safeUrl(p.resume))}" target="_blank" rel="noopener">${icon('download')}${esc(t('downloadResume'))}</a>`);
      if (p.email) actions.push(`<button class="btn btn-sm" data-copy="${esc(p.email)}">${icon('copy')}${esc(p.email)}</button>`);
      if (p.phone) actions.push(`<a class="btn btn-sm" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(p.phone)}</a>`);

      return `<section class="section" id="${secId(s.key)}"><div class="container">
        <article class="card about-card reveal">
          <header class="about-band"><h2>${esc(d.settings?.headerTitle || 'ABOUT ME')}</h2></header>
          <div class="about-grid">
            <aside class="about-side">
              <div class="side-block about-avatar">
                <div class="ring"><img src="${esc(avatar)}" alt="${esc(p.name || '')}" loading="lazy" /></div>
                ${p.caption ? `<p>${esc(p.caption)}</p>` : ''}
              </div>
              ${info ? `<div class="side-block"><ul class="info-list">${info}</ul></div>` : ''}
              ${pills ? `<div class="side-block"><div class="pills">${pills}</div></div>` : ''}
            </aside>
            <div class="about-content">
              <h3>${esc(s.title)}</h3>
              <div class="prose">${richText(p.about)}</div>
              ${actions.length ? `<div class="about-actions">${actions.join('')}</div>` : ''}
            </div>
          </div>
        </article>
      </div></section>`;
    },

    expertise(s, d, ctx) {
      if (!has(d.expertise)) return '';
      return ctx.wrap(s, `<div class="expertise-grid">${d.expertise.map((x, i) => `
        <div class="card spot lift expertise ${colorClass(x.color)} reveal" ${delay(i)}>
          <span class="ex-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="ex-icon">${icon(x.icon || 'sparkles')}</span>
          <h3>${esc(x.title)}</h3>
          <p>${esc(x.description)}</p>
        </div>`).join('')}</div>`);
    },

    journey(s, d, ctx) {
      if (!has(d.timeline)) return '';
      const items = d.timeline.map((t, i) => {
        const current = /present|now|current/i.test(t.year || '');
        return `<li class="jr-item${current ? ' current' : ''} reveal" ${delay(i, 0.07)}>
          <span class="jr-dot"></span>
          <div class="jr-card">
            <span class="jr-year">${esc(t.year)}</span>
            <strong>${esc(t.title)}</strong>
            ${t.subtitle ? `<span class="jr-sub">${esc(t.subtitle)}</span>` : ''}
          </div>
        </li>`;
      }).join('');
      return ctx.wrap(s, `<ol class="journey" style="--n:${d.timeline.length}">${items}</ol>`);
    },

    assessments(s, d, ctx) {
      if (!has(d.assessments)) return '';
      return ctx.wrap(s, `<div class="assess-grid">${d.assessments.map((a, i) => {
        const bullets = String(a.description || '').split('\n').filter((l) => BULLET.test(l)).length;
        return `<article class="card spot lift assess reveal" ${delay(i)}>
          <div class="as-top">
            <span class="as-icon">${icon(a.icon || 'clipboard-check')}</span>
            ${a.year ? `<span class="as-year">${esc(a.year)}</span>` : ''}
          </div>
          <h3>${esc(a.name)}</h3>
          ${a.role ? `<span class="as-role">${esc(a.role)}</span>` : ''}
          <div class="as-meta">${[a.organization, a.location].filter(Boolean).map(esc).join(' · ')}</div>
          ${a.description ? `<details class="as-details">
            <summary><span class="more">${esc(t('viewDetails', { n: bullets || '' }).replace(/\s*\(\)/, ''))}</span><span class="less">${esc(t('hideDetails'))}</span>${icon('chevron-down')}</summary>
            <div class="prose">${richText(a.description)}</div>
          </details>` : ''}
        </article>`;
      }).join('')}</div>`);
    },

    skills(s, d, ctx) {
      if (!has(d.skills)) return '';
      const groups = new Map();
      for (const sk of d.skills) {
        const g = sk.category || 'Skills';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(sk);
      }
      const cards = [...groups].map(([name, items], gi) => {
        const bars = items.filter((i) => Number(i.level) > 0);
        const chips = items.filter((i) => !(Number(i.level) > 0));
        return `<div class="card spot lift skill-card reveal" ${delay(gi)}>
          <div class="skill-card-head"><span class="ci">${icon(categoryIcon(name))}</span>
            <div><h3>${esc(name)}</h3>${t('skillsCount') ? `<span>${esc(t('skillsCount', { n: items.length }))}</span>` : ''}</div></div>
          ${bars.map((i) => {
            const lvl = Math.max(0, Math.min(100, Number(i.level)));
            return `<div class="skill"><div class="skill-row"><span>${esc(i.name)}</span><span>${lvl}%</span></div>
              <div class="bar"><span data-w="${lvl}"></span></div></div>`;
          }).join('')}
          ${chips.length ? `<div class="chips">${chips.map((i) => `<span class="chip">${esc(i.name)}</span>`).join('')}</div>` : ''}
        </div>`;
      }).join('');
      return ctx.wrap(s, `<div class="skill-grid">${cards}</div>`);
    },

    experience(s, d, ctx) {
      if (!has(d.experience)) return '';
      const items = d.experience.map((e, i) => {
        const date = [e.start, e.end].filter(Boolean).map(esc).join(' — ');
        return `<div class="card spot tl-item reveal" ${delay(i)}>
          <span class="tl-dot"></span>
          <div class="tl-top"><h3 class="tl-title">${esc(e.role)}</h3>${date ? `<span class="tl-date">${date}</span>` : ''}</div>
          <div class="tl-meta">
            ${e.company ? `<span>${icon('building-2')}${esc(e.company)}</span>` : ''}
            ${e.location ? `<span>${icon('map-pin')}${esc(e.location)}</span>` : ''}
          </div>
          ${(() => {
            const body = `<div class="${proseClass(e.description)}">${richText(e.description)}</div>`;
            if (!e.description) return '';
            if (i === 0 || d.settings?.collapseOlderRoles === false) return body;
            const n = String(e.description).split('\n').filter((l) => BULLET.test(l)).length;
            return `<details class="role-details">
              <summary><span class="more">${esc(t('roleMore', { n: n || '' }).replace(/\s*\(\)/, ''))}</span><span class="less">${esc(t('roleLess'))}</span>${icon('chevron-down')}</summary>
              ${body}
            </details>`;
          })()}
        </div>`;
      }).join('');
      return ctx.wrap(s, `<div class="timeline">${items}</div>`);
    },

    projects(s, d, ctx) {
      if (!has(d.projects)) return '';
      const cards = d.projects.map((p, i) => {
        const tags = String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        const [c1, c2] = gradientFor(p.name || i);
        const cover = safeUrl(p.image)
          ? `<div class="project-cover"><img src="${esc(safeUrl(p.image))}" alt="${esc(p.name)}" loading="lazy" /></div>`
          : `<div class="project-cover placeholder" style="--c1:${c1};--c2:${c2}"><span>${esc((p.name || '?').slice(0, 2))}</span></div>`;
        const links = [
          safeUrl(p.link) && `<a class="btn btn-primary btn-sm" href="${esc(safeUrl(p.link))}"${ext(p.link)}>${esc(t('liveDemo'))}${icon('arrow-up-right')}</a>`,
          safeUrl(p.repo) && `<a class="btn btn-sm" href="${esc(safeUrl(p.repo))}"${ext(p.repo)}>${icon('github')}${esc(t('source'))}</a>`,
        ].filter(Boolean);
        return `<article class="card spot lift project reveal" ${delay(i)}>
          ${cover}
          <div class="project-body">
            ${d.projects.length === 1 && t('featuredProject') ? `<span class="featured-badge">${esc(t('featuredProject'))}</span>` : ''}
            <h3>${esc(p.name)}</h3>
            <p>${esc(p.description)}</p>
            ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
            ${links.length ? `<div class="project-links">${links.join('')}</div>` : ''}
          </div>
        </article>`;
      }).join('');
      return ctx.wrap(s, `<div class="project-grid${d.projects.length === 1 ? ' single' : ''}">${cards}</div>`);
    },

    education(s, d, ctx) {
      if (!has(d.education)) return '';
      // When "certifications" directly follows, show both side by side in one section
      if (ctx.mergeCerts && has(d.certifications)) {
        const certTitle = (d.sections || []).find((x) => x.key === 'certifications')?.title || 'Certifications';
        const eduRows = d.education.map((e, i) => `
          <li class="card spot cred reveal" ${delay(i)}>
            <span class="mi">${icon('graduation-cap')}</span>
            <div class="cred-body"><h4>${esc(e.degree)}</h4><div class="ms">${esc(e.institution)}</div>
              ${e.description ? `<div class="prose">${richText(e.description)}</div>` : ''}</div>
            ${e.start || e.end ? `<span class="cred-year">${[e.start, e.end].filter(Boolean).map(esc).join(' – ')}</span>` : ''}
          </li>`).join('');
        const certRows = d.certifications.map((c, i) => `
          <li class="card spot cred reveal" ${delay(i)}>
            <span class="mi alt">${icon('award')}</span>
            <div class="cred-body"><h4>${esc(c.name)}</h4>${c.issuer ? `<div class="ms">${esc(c.issuer)}</div>` : ''}
              ${safeUrl(c.link) ? `<a class="more" href="${esc(safeUrl(c.link))}"${ext(c.link)}>${esc(t('viewCredential'))}${icon('arrow-up-right')}</a>` : ''}</div>
            ${c.year ? `<span class="cred-year">${esc(c.year)}</span>` : ''}
          </li>`).join('');
        return ctx.wrap(s, `<div class="cred-cols">
          <div><h3 class="cred-head">${icon('graduation-cap')}${esc(t('educationHeading'))}</h3><ul class="cred-list">${eduRows}</ul></div>
          <div><h3 class="cred-head">${icon('award')}${esc(certTitle)}</h3><ul class="cred-list">${certRows}</ul></div>
        </div>`);
      }
      return ctx.wrap(s, `<div class="cards-2">${d.education.map((e, i) => `
        <div class="card spot lift mini-card reveal" ${delay(i)}>
          <span class="mi">${icon('graduation-cap')}</span>
          <div><h3>${esc(e.degree)}</h3>
            <div class="ms">${[e.institution, [e.start, e.end].filter(Boolean).join(' — ')].filter(Boolean).map(esc).join(' · ')}</div>
            ${e.description ? `<div class="prose">${richText(e.description)}</div>` : ''}</div>
        </div>`).join('')}</div>`);
    },

    certifications(s, d, ctx) {
      if (!has(d.certifications) || ctx.mergedIntoEducation) return '';
      return ctx.wrap(s, `<div class="cards-2">${d.certifications.map((c, i) => `
        <div class="card spot lift mini-card reveal" ${delay(i)}>
          <span class="mi">${icon('award')}</span>
          <div><h3>${esc(c.name)}</h3>
            <div class="ms">${[c.issuer, c.year].filter(Boolean).map(esc).join(' · ')}</div>
            ${safeUrl(c.link) ? `<a class="more" href="${esc(safeUrl(c.link))}"${ext(c.link)}>${esc(t('viewCredential'))}${icon('arrow-up-right')}</a>` : ''}</div>
        </div>`).join('')}</div>`);
    },

    testimonials(s, d, ctx) {
      if (!has(d.testimonials)) return '';
      const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
      return ctx.wrap(s, `<div class="quote-grid">${d.testimonials.map((q, i) => `
        <figure class="card spot lift quote reveal" ${delay(i)}>
          <span class="q-mark">${icon('quote')}</span>
          <blockquote>${esc(q.quote)}</blockquote>
          <figcaption>
            ${safeUrl(q.photo) ? `<img class="q-avatar" src="${esc(safeUrl(q.photo))}" alt="" loading="lazy" />` : `<span class="q-avatar q-initials">${esc(initials(q.name))}</span>`}
            <span class="q-who"><strong>${esc(q.name)}</strong><span>${[q.role, q.company].filter(Boolean).map(esc).join(' · ')}</span></span>
            ${safeUrl(q.link) && t('testimonialSource') ? `<a class="q-link" href="${esc(safeUrl(q.link))}"${ext(q.link)} title="${esc(t('testimonialSource'))}">${icon('arrow-up-right')}</a>` : ''}
          </figcaption>
        </figure>`).join('')}</div>`);
    },

    interests(s, d, ctx) {
      if (!has(d.interests)) return '';
      return ctx.wrap(s, `<div class="interest-grid">${d.interests.map((x, i) => `
        <div class="card spot lift interest ${colorClass(x.color)} reveal" ${delay(i, 0.06)}>
          <span class="ib">${icon(x.icon)}</span><h3>${esc(x.label)}</h3>
        </div>`).join('')}</div>`);
    },

    connect(s, d, ctx) {
      const p = d.profile || {};
      const socials = socialLinks(d, 'social-btn');
      if (!socials && !p.email && !p.phone) return '';
      const actions = [];
      if (p.email) {
        actions.push(`<a class="btn" href="mailto:${esc(p.email)}">${icon('mail')}${esc(t('sendEmail'))}</a>`);
        actions.push(`<button class="btn glass" data-copy="${esc(p.email)}">${icon('copy')}${esc(t('copyEmail'))}</button>`);
      }
      if (p.phone) actions.push(`<a class="btn glass" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(p.phone)}</a>`);
      if (safeUrl(p.resume)) actions.push(`<a class="btn glass" href="${esc(safeUrl(p.resume))}" target="_blank" rel="noopener">${icon('file-down')}${esc(t('resume'))}</a>`);
      return `<section class="section section-cta" id="${secId(s.key)}"><div class="container">
        <div class="cta reveal">
          ${graphicFor(s) ? `<div class="cta-graphic" aria-hidden="true">${graphicFor(s)}</div>` : ''}
          <span class="eyebrow"><span class="num">${String(ctx.n).padStart(2, '0')}</span>${esc(s.eyebrow || 'Contact')}</span>
          <h2>${esc(p.ctaTitle || s.title)}</h2>
          ${p.ctaText ? `<p>${esc(p.ctaText)}</p>` : s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
          ${actions.length ? `<div class="cta-actions">${actions.join('')}</div>` : ''}
          ${socials ? `<div class="cta-socials">${socials}</div>` : ''}
        </div>
      </div></section>`;
    },
  };

  // ---------- render ----------
  // Drop items marked hidden in the admin (eye toggle) from every list
  function visibleOnly(data) {
    const out = { ...data };
    for (const [key, val] of Object.entries(data)) {
      if (key !== 'sections' && Array.isArray(val)) out[key] = val.filter((x) => !(x && x.hidden));
    }
    return out;
  }

  function render(raw) {
    const d = visibleOnly(raw);
    labels = d.labels || {};
    showGraphics = d.settings?.showGraphics !== false;
    const settings = d.settings || {};
    const profile = d.profile || {};
    const root = document.documentElement;

    document.title = settings.siteTitle || profile.name || 'Portfolio';
    document.querySelector('meta[name="description"]').setAttribute('content', settings.metaDescription || '');
    if (settings.accentColor) root.style.setProperty('--accent', settings.accentColor);
    if (settings.accentColor2) root.style.setProperty('--accent-2', settings.accentColor2);
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch {}
    if (!saved && (settings.defaultTheme === 'light' || settings.defaultTheme === 'dark')) root.dataset.theme = settings.defaultTheme;

    const enabled = (d.sections || []).filter((s) => s.enabled !== false && renderers[s.key]);
    const keys = new Set(enabled.map((s) => s.key));
    const html = [];
    const rendered = [];
    let n = 0;
    let alt = false;
    const eduIdx = enabled.findIndex((s) => s.key === 'education');
    const mergeCerts = eduIdx >= 0 && enabled[eduIdx + 1]?.key === 'certifications' && has(d.education) && has(d.certifications);
    for (const s of enabled) {
      if (s.key !== 'hero') n += 1;
      const ctx = {
        n,
        mergeCerts,
        mergedIntoEducation: mergeCerts,
        has: (k) => keys.has(k) && k !== s.key,
        wrap: (sec, inner) => {
          alt = !alt;
          return `<section class="section${alt ? ' alt' : ''}" id="${secId(sec.key)}"><div class="container">${sectionHead(sec, n)}${inner}</div></section>`;
        },
      };
      const out = renderers[s.key](s, d, ctx);
      if (out) { html.push(out); rendered.push(s); }
      else if (s.key !== 'hero') n -= 1;
    }
    // drop CTA links pointing to sections that rendered empty
    const renderedKeys = new Set(rendered.map((s) => s.key));
    $('app').innerHTML = html.join('');
    $('app').querySelectorAll('a[href^="#sec-"]').forEach((a) => {
      if (!document.querySelector(a.getAttribute('href'))) a.remove();
    });

    // nav
    const initials = String(profile.name || 'P').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    $('logo').textContent = initials;
    $('brandName').textContent = profile.name || '';
    const inMenu = rendered.filter((s) => s.key !== 'hero' && s.nav !== false);
    const navLabel = (s) => s.navLabel || NAV_LABELS[s.key] || s.title;
    $('navLinks').innerHTML = inMenu.map((s) => `<a href="#${secId(s.key)}" data-key="${s.key}">${esc(navLabel(s))}</a>`).join('');
    $('dotNav').hidden = settings.showDotNav === false || rendered.length < 3;
    $('dotNav').innerHTML = rendered.map((s) => `<a href="#${secId(s.key)}" aria-label="${esc(s.key === 'hero' ? (profile.name || 'Top') : navLabel(s))}">
      <span class="dn-label">${esc(s.key === 'hero' ? t('dotNavTop') : navLabel(s))}</span><span class="dn-dot"></span></a>`).join('');
    $('navCta').textContent = t('navCta');
    $('navCta').hidden = !renderedKeys.has('connect') || !t('navCta');
    $('navWrap').hidden = settings.showNav === false;

    // footer
    $('footer').innerHTML = `<div class="container footer-inner">
      <a href="#top" class="brand"><span class="logo">${esc(initials)}</span>${esc(profile.name || '')}</a>
      <div class="footer-links">${inMenu.map((s) => `<a href="#${secId(s.key)}">${esc(navLabel(s))}</a>`).join('')}</div>
      <div class="footer-copy">${esc(settings.footerText || '')}</div>
    </div>
    ${creditHTML()}`;

    if (window.lucide) window.lucide.createIcons();
    enhance(d);
  }

  // ---------- author credit ----------
  // Fixed credit for the creator of this template. Intentionally NOT part of the content/admin,
  // so it always appears in the footer. Please keep it if you use this project (see LICENSE / NOTICE).
  const AUTHOR = {
    name: 'Satendra Goswami',
    links: [
      { label: 'GitHub', icon: 'github', url: 'https://github.com/satendragoswamii' },
      { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/satendragoswami/' },
      { label: 'WhatsApp', icon: 'whatsapp', url: 'https://wa.me/919074534985' },
    ],
  };
  function creditHTML() {
    return `<div class="container footer-credit">
      <span>Built by <a href="${AUTHOR.links[0].url}" target="_blank" rel="noopener">${AUTHOR.name}</a></span>
      <span class="credit-links">${AUTHOR.links.map((l) =>
        `<a href="${l.url}" target="_blank" rel="noopener" aria-label="${AUTHOR.name} on ${l.label}" title="${l.label}">${icon(l.icon)}</a>`).join('')}</span>
    </div>`;
  }

  // ---------- interactions ----------
  function enhance(d) {
    // reveal on scroll (+ skill bars + counters)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        e.target.querySelectorAll('.bar span[data-w]').forEach((b) => (b.style.width = `${b.dataset.w}%`));
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(e.target);
      }
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // typewriter over highlight tags
    const typed = $('typed');
    if (typed) typewriter(typed, (d.highlights || []).map((h) => h.label).filter(Boolean));

    // active nav link
    const links = [...document.querySelectorAll('#navLinks a, #dotNav a')];
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
  }

  function countUp(el) {
    const raw = String(el.dataset.count);
    const m = raw.match(/^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!m || reducedMotion) return;
    const [, pre, numStr, post] = m;
    const grouped = numStr.includes(',');
    const num = numStr.replace(/,/g, '');
    const target = parseFloat(num);
    const decimals = (num.split('.')[1] || '').length;
    const fmt = (v) => (grouped ? Number(v.toFixed(decimals)).toLocaleString('en-US', { minimumFractionDigits: decimals }) : v.toFixed(decimals));
    const start = performance.now();
    const dur = 1400;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = `${pre}${fmt(target * eased)}${post}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function typewriter(el, words) {
    if (!words.length) return;
    if (reducedMotion) { el.textContent = words[0]; return; }
    let w = 0, c = 0, deleting = false;
    (function tick() {
      const word = words[w];
      c += deleting ? -1 : 1;
      el.textContent = word.slice(0, c);
      let wait = deleting ? 35 : 75;
      if (!deleting && c === word.length) { wait = 1700; deleting = true; }
      else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; wait = 350; }
      setTimeout(tick, wait);
    })();
  }

  function toast(msg) {
    const t = $('toast');
    t.innerHTML = `${icon('check-circle-2')}${esc(msg)}`;
    if (window.lucide) window.lucide.createIcons();
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // theme toggle
  $('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  });

  // mobile menu
  const toggleMenu = (open) => {
    $('navLinks').classList.toggle('open', open);
    $('navToggle').setAttribute('aria-expanded', String(open));
  };
  $('navToggle').addEventListener('click', () => toggleMenu(!$('navLinks').classList.contains('open')));
  $('navLinks').addEventListener('click', (e) => e.target.closest('a') && toggleMenu(false));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav')) toggleMenu(false);
  });

  // copy-to-clipboard buttons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast(t('emailCopied'));
    } catch {
      location.href = `mailto:${btn.dataset.copy}`;
    }
  });

  // card spotlight follows the pointer
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // scroll progress, nav auto-hide, back-to-top
  let lastY = 0;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      $('progress').style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      $('navWrap').classList.toggle('hide', y > lastY && y > 500 && !$('navLinks').classList.contains('open'));
      $('toTop').classList.toggle('show', y > 700);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
  $('toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  fetch('/api/content')
    .then((r) => r.json())
    .then((d) => {
      $('loader').remove();
      render(d);
    })
    .catch(() => {
      $('loader').innerHTML = `<p style="color:var(--muted)">${esc(t('loadError'))}</p>`;
    });
})();
