// Section illustrations — inline SVG that follows the site's accent colours and light/dark theme.
// Pick one per section in Admin → Sections & Order (or upload your own image there).
(function () {
  const W = 360;
  const H = 240;

  // Four-point "AI sparkle" star centred on (cx, cy)
  const sparkle = (cx, cy, r, attrs) => {
    const k = r * 0.14;
    return `<path d="M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z" ${attrs}/>`;
  };
  const check = (x, y, s = 1) => `<path class="gw" d="M${x} ${y} l${6 * s} ${6 * s} l${12 * s} -${12 * s}"/>`;

  // Wraps a drawing with the shared gradient, soft backdrop and dot grid. Ids are unique per graphic.
  let uid = 0;
  function frame(name, inner) {
    const id = `${name}-${++uid}`;
    const g = `url(#${id}-g)`;
    return `<svg class="sg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <defs>
        <linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/>
        </linearGradient>
        <pattern id="${id}-d" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" class="gdot"/></pattern>
      </defs>
      <rect x="20" y="20" width="320" height="200" rx="28" fill="url(#${id}-d)" opacity=".7"/>
      <circle cx="190" cy="124" r="96" class="gsoft"/>
      ${inner(g)}
    </svg>`;
  }

  const GRAPHICS = {
    // Layered cards with a star badge — strengths / expertise
    expertise: () => frame('gx-exp', (g) => `
      <rect x="70" y="66" width="150" height="110" rx="14" class="gs gk" transform="rotate(-8 145 121)"/>
      <rect x="96" y="74" width="160" height="118" rx="14" class="gs gk" transform="rotate(4 176 133)"/>
      <g class="gfloat">
        <rect x="118" y="56" width="172" height="126" rx="16" class="gs gk"/>
        <rect x="136" y="76" width="42" height="42" rx="11" fill="${g}"/>${check(148, 97)}
        <rect x="190" y="82" width="82" height="9" rx="4.5" class="gs2"/>
        <rect x="190" y="99" width="56" height="9" rx="4.5" class="gs2"/>
        <rect x="136" y="134" width="136" height="8" rx="4" class="gs2"/>
        <rect x="136" y="150" width="98" height="8" rx="4" class="gs2"/>
      </g>
      <g class="gfloat2">
        <circle cx="292" cy="62" r="27" fill="${g}"/>
        <path d="M292 48l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2-8.2-4.3-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3z" fill="#fff"/>
      </g>`),

    // Winding road with milestones and a flag — career journey
    journey: () => frame('gx-jr', (g) => `
      <path d="M40 200 C120 200 110 120 190 120 S260 50 320 50" fill="none" class="groad"/>
      <path d="M40 200 C120 200 110 120 190 120 S260 50 320 50" fill="none" stroke="${g}" stroke-width="3" stroke-dasharray="8 10" stroke-linecap="round"/>
      ${[[40, 200], [115, 160], [190, 120], [262, 85]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" class="gs" stroke="${g}" stroke-width="4"/>`).join('')}
      <g class="gfloat">
        <line x1="320" y1="52" x2="320" y2="12" class="gpole"/>
        <path d="M321 13 L350 21 L321 31 Z" fill="${g}"/>
        <circle cx="320" cy="52" r="6" fill="${g}"/>
      </g>`),

    // Briefcase with a rising chart — work experience
    experience: () => frame('gx-xp', (g) => `
      <g class="gfloat">
        <path d="M120 94v-12a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v12" class="gpole" fill="none"/>
        <rect x="90" y="94" width="120" height="88" rx="14" fill="${g}"/>
        <rect x="90" y="124" width="120" height="9" fill="#fff" opacity=".22"/>
        <rect x="140" y="117" width="20" height="23" rx="5" class="gs"/>
      </g>
      <line x1="230" y1="184" x2="330" y2="184" class="gkline"/>
      ${[[236, 154], [258, 132], [280, 106], [302, 80]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="18" height="${184 - y}" rx="5" ${i === 3 ? `fill="${g}"` : 'class="gs2 gk"'}/>`).join('')}
      <polyline points="232,140 262,116 288,124 320,70" fill="none" class="garrow"/>
      <path d="M309 70 L322 66 L320 80" fill="none" class="garrow"/>`),

    // Exam monitor with a checklist and a shield — assessment projects
    assessments: () => frame('gx-as', (g) => `
      <rect x="78" y="44" width="204" height="134" rx="14" class="gs gk"/>
      <path d="M78 58a14 14 0 0 1 14-14h176a14 14 0 0 1 14 14v10H78z" class="gs2"/>
      <circle cx="94" cy="56" r="3.5" class="ga"/><circle cx="106" cy="56" r="3.5" class="gb"/><circle cx="118" cy="56" r="3.5" class="gm"/>
      ${[86, 112].map((y) => `<rect x="98" y="${y}" width="18" height="18" rx="5" fill="${g}"/>${check(102, y + 9, 0.7)}<rect x="126" y="${y + 5}" width="${y === 86 ? 116 : 92}" height="8" rx="4" class="gs2"/>`).join('')}
      <rect x="98" y="138" width="18" height="18" rx="5" class="gs gk"/><rect x="126" y="143" width="104" height="8" rx="4" class="gs2"/>
      <rect x="166" y="178" width="28" height="16" class="gs2"/><rect x="138" y="194" width="84" height="8" rx="4" class="gs2 gk"/>
      <g class="gfloat2">
        <path d="M286 116 l28 10 v22 c0 19-13 32-28 38 c-15-6-28-19-28-38 v-22z" fill="${g}"/>
        ${check(275, 150, 1)}
      </g>`),

    // Server rack, gear and cloud — skills & tools
    skills: () => frame('gx-sk', (g) => `
      <rect x="84" y="58" width="132" height="134" rx="14" class="gs gk"/>
      ${[72, 110, 148].map((y, i) => `<rect x="98" y="${y}" width="104" height="30" rx="7" class="gs2"/>
        <circle cx="112" cy="${y + 15}" r="4" class="${i === 1 ? 'gb' : 'ga'} gblink" style="animation-delay:${i * 0.6}s"/><circle cx="124" cy="${y + 15}" r="4" class="gm"/>
        <rect x="146" y="${y + 12}" width="44" height="6" rx="3" class="gs"/>`).join('')}
      <path d="M240 92 a17 17 0 0 1 3-33 a24 24 0 0 1 45 7 a15 15 0 0 1-2 30 z" class="gs gk gfloat2"/>
      <g transform="translate(274 150)"><g class="gspin">
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="-7" y="-37" width="14" height="16" rx="3" fill="${g}" transform="rotate(${a})"/>`).join('')}
        <circle r="27" fill="${g}"/><circle r="10" class="gs"/>
      </g></g>`),

    // Laptop with a finished task and a speed bolt — tools I've built
    projects: () => frame('gx-pr', (g) => `
      <rect x="92" y="68" width="172" height="112" rx="12" class="gs gk"/>
      <rect x="108" y="86" width="62" height="46" rx="9" fill="${g}" opacity=".92"/>
      ${check(127, 109, 1.1)}
      <rect x="182" y="88" width="66" height="8" rx="4" class="gs2"/><rect x="182" y="104" width="48" height="8" rx="4" class="gs2"/>
      <rect x="108" y="146" width="140" height="8" rx="4" class="gs2"/><rect x="108" y="160" width="96" height="8" rx="4" class="gs2"/>
      <path d="M72 184h212l-12 14H84z" class="gs2 gk"/>
      <g class="gfloat">
        <rect x="34" y="48" width="70" height="42" rx="13" class="gs gk"/>
        <path d="M52 89 l-6 13 17-13" class="gs gk"/>
        <circle cx="56" cy="69" r="4" class="ga"/><circle cx="69" cy="69" r="4" class="gb"/><circle cx="82" cy="69" r="4" class="gm"/>
      </g>
      <g class="gfloat2"><circle cx="292" cy="64" r="30" fill="${g}"/><path d="M297 42 L280 68 H292 L287 88 L305 60 H293 Z" fill="#fff"/>${sparkle(326, 110, 9, `fill="${g}"`)}${sparkle(254, 30, 7, `fill="${g}"`)}</g>`),

    // Graduation cap on books with a certificate — education
    education: () => frame('gx-ed', (g) => `
      <rect x="108" y="170" width="152" height="22" rx="6" fill="${g}"/>
      <rect x="118" y="148" width="132" height="22" rx="6" class="gs gk"/>
      <rect x="102" y="126" width="142" height="22" rx="6" class="gb" opacity=".85"/>
      <rect x="128" y="155" width="90" height="4" rx="2" class="gs2"/>
      <g class="gfloat">
        <path d="M140 104v18c0 8 16 14 35 14s35-6 35-14v-18l-35 13z" class="gt" opacity=".9"/>
        <path d="M175 66 L247 94 L175 122 L103 94 Z" class="gt"/>
        <path d="M175 94 L233 102 L233 128" fill="none" class="gtassel"/>
        <circle cx="233" cy="131" r="5" class="ga"/>
      </g>
      <g class="gfloat2" transform="rotate(8 296 110)">
        <rect x="266" y="66" width="62" height="84" rx="8" class="gs gk"/>
        <rect x="278" y="82" width="38" height="6" rx="3" class="gs2"/><rect x="278" y="96" width="28" height="6" rx="3" class="gs2"/>
        <circle cx="297" cy="128" r="10" fill="${g}"/><path d="M291 136 l-3 14 9-5 9 5 -3-14" fill="${g}"/>
      </g>`),

    // Lightbulb and rocket — hobbies & interests
    interests: () => frame('gx-in', (g) => `
      ${[[170, 30, 170, 44], [112, 54, 122, 64], [228, 54, 218, 64], [96, 104, 110, 104], [244, 104, 230, 104]].map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" class="garrow"/>`).join('')}
      <g class="gfloat">
        <circle cx="170" cy="102" r="46" fill="${g}"/>
        <path d="M154 106 q8-16 16 0 t16 0" fill="none" class="gw"/>
        <rect x="150" y="142" width="40" height="13" rx="4" class="gs2 gk"/>
        <rect x="155" y="157" width="30" height="11" rx="4" class="gs2 gk"/>
      </g>
      <g class="gfloat2" transform="translate(284 124) rotate(38)">
        <path d="M0 -46 C15 -31 17 -8 13 15 H-13 C-17 -8 -15 -31 0 -46Z" class="gs gk"/>
        <circle cy="-15" r="7" fill="${g}"/>
        <path d="M-13 3 L-26 23 L-13 19Z M13 3 L26 23 L13 19Z" fill="${g}"/>
        <path d="M-8 17 Q0 40 8 17Z" class="ga gflame"/>
      </g>`),

    // Speech bubbles with stars — testimonials
    testimonials: () => frame('gx-tm', (g) => `
      <g class="gfloat">
        <rect x="70" y="52" width="170" height="96" rx="20" class="gs gk"/>
        <path d="M108 147 l-10 24 30-24" class="gs gk"/>
        <path d="M98 76 q-10 0-10 12 v14 h16 v-14 h-8 q0-6 6-6z M128 76 q-10 0-10 12 v14 h16 v-14 h-8 q0-6 6-6z" fill="${g}"/>
        <rect x="150" y="80" width="70" height="8" rx="4" class="gs2"/><rect x="150" y="96" width="52" height="8" rx="4" class="gs2"/>
        <rect x="92" y="118" width="128" height="8" rx="4" class="gs2"/>
      </g>
      <g class="gfloat2">
        <rect x="196" y="122" width="132" height="70" rx="18" fill="${g}"/>
        <path d="M290 191 l14 20 -2-20z" fill="${g}"/>
        ${[226, 250, 274, 298].map((x) => `<path d="M${x} 145l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9-7-3.7-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1z" fill="#fff"/>`).join('')}
      </g>`),

    // Paper plane — contact (drawn in white for the dark contact block)
    connect: () => `<svg class="sg sg-plane" viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <path d="M8 150 C40 140 30 104 70 98" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="6 8" stroke-linecap="round"/>
      <g class="gfloat">
        <path d="M70 92 L190 20 L150 136 L118 104 Z" fill="#fff" fill-opacity=".92"/>
        <path d="M118 104 L190 20 L104 118 Z" fill="#fff" fill-opacity=".6"/>
      </g>
    </svg>`,
  };

  GRAPHICS.certifications = GRAPHICS.education;
  window.SECTION_GRAPHICS = GRAPHICS;
})();
