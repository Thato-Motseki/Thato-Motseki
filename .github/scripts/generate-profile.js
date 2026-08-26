
// Generates the entire T.Motseki profile as ONE single SVG
// Fetches real data from GitHub GraphQL API

const QUERY = `
query ($login: String!, $cursor: String) {
  user(login: $login) {
    name
    createdAt
    repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        description
        stargazerCount
        forkCount
        primaryLanguage { name color }
        url
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
    }
  }
}`;

const YEARLY_QUERY = `
query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
    }
  }
}`;

async function gql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ace-readme',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data;
}

async function fetchData(username, token) {
  let cursor = null;
  let user;
  let repositories = [];
  do {
    user = (await gql(token, QUERY, { login: username, cursor })).user;
    repositories = repositories.concat(user.repositories.nodes);
    cursor = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (cursor);
  user.repositories.nodes = repositories;
  return user;
}

async function fetchAllTimeCommits(username, token, createdAt) {
  const startYear = new Date(createdAt).getFullYear();
  const now = new Date();
  const endYear = now.getFullYear();
  let total = 0;
  for (let yr = startYear; yr <= endYear; yr++) {
    const from = new Date(`${yr}-01-01T00:00:00Z`).toISOString();
    const to = yr === endYear ? now.toISOString() : new Date(`${yr+1}-01-01T00:00:00Z`).toISOString();
    const data = await gql(token, YEARLY_QUERY, { login: username, from, to });
    const c = data.user.contributionsCollection.totalCommitContributions;
    console.log(`  ${yr}: ${c} commits`);
    total += c;
  }
  return total;
}

function processData(user) {
  const repos = user.repositories.nodes;
  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = repos.reduce((s, r) => s + r.forkCount, 0);
  const totalRepos = user.repositories.totalCount;
  const totalCommits = user._allTimeCommits || user.contributionsCollection.totalCommitContributions;

  const langMap = {};
  for (const r of repos) {
    if (r.primaryLanguage) {
      const name = r.primaryLanguage.name;
      if (!langMap[name]) langMap[name] = { name, color: r.primaryLanguage.color, count: 0 };
      langMap[name].count++;
    }
  }
  const languages = [
    { name: 'PHP', color: '#036bc0', percentage: 14 },
    { name: 'C#', color: '#72c7ff', percentage: 9 },
    { name: 'C++', color: '#ff6f91', percentage: 14 },
    { name: 'PYTHON', color: '#ffd166', percentage: 14 },
    { name: 'JAVASCRIPT', color: '#f7d154', percentage: 12 },
    { name: 'JAVA', color: '#fc7629', percentage: 8 },
    { name: 'NEXT.JS', color: '#f75d79', percentage: 8 },
    { name: 'TYPESCRIPT', color: '#07304b', percentage: 9 },
    { name: 'TAILWIND CSS', color: '#c72902', percentage: 6 },
    { name: 'REACT.JS', color: '#03723e', percentage: 6 },
  ];

  const deploymentSpecs = [
    { name: 'Ethiopian Legal Chatbot', desc: 'An AI-powered legal chatbot designed to help users navigate Ethiopian law by providing accessible, conversational answers to legal questions using relevant legal documents and information.', lang: 'PYTHON','HTML': 'CSS' },
    { name: 'Sentinel AI', desc: 'Sentinel AI is an intelligent monitoring and threat detection platform that uses AI to identify suspicious activity, detect potential security threats, and provide real-time insights to help users respond to risks faster.', lang: 'TYPESCRIPT', lang: 'JAVASCRIPT'},
    { name: 'Market Price Predictor', desc: 'A data-driven forecasting platform that analyzes historical market trends and relevant data to predict potential price movements, helping users make more informed market decisions.', lang: 'REACT.JS', 'TAILWIND CSS': 'PYTHON' },
  ];
  const topProjects = deploymentSpecs.map(spec => {
    const repo = repos.find(r => r.name.toLowerCase() === spec.name.toLowerCase());
    return {
      ...spec,
      stars: repo ? repo.stargazerCount : 0,
      forks: repo ? repo.forkCount : 0,
      langColor: repo && repo.primaryLanguage ? repo.primaryLanguage.color : '#ff6f91',
      url: repo ? repo.url : null,
    };
  });

  return {
    stats: { totalStars, totalForks, totalRepos, totalCommits },
    languages,
    topProjects,
    calendar: user.contributionsCollection.contributionCalendar,
  };
}

function generateSVG(data, bannerData) {
  const W = 800;
  const heroH = 280;
  const techH = 70;
  const statsH = 110;
  const langH = 200;
  const calH = 160;
  const projH = 240;
  const aboutH = 270;
  const footerH = 40;
  const gap = 14;
  const totalH = heroH + techH + statsH + langH + calH + projH + aboutH + footerH + gap * 7;
  const font = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif`;

  let y = 0;

  // ═══════════════ STYLES (perf-optimised) ═══════════════
  const style = `
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 400 900; font-display: swap; src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyMZhrib2Bg-4.woff2) format('woff2'); }
    @keyframes drift-r { 0%, 100% { transform: translate(0,0); opacity: 0.6; } 50% { transform: translate(35px,-18px); opacity: 1; } }
    @keyframes drift-l { 0%, 100% { transform: translate(0,0); opacity: 0.55; } 50% { transform: translate(-30px,16px); opacity: 0.95; } }
    @keyframes drift-u { 0%, 100% { transform: translate(0,0); opacity: 0.7; } 50% { transform: translate(25px,-25px); opacity: 1.05; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.2); opacity: 0.35; } }
    @keyframes scan { 0% { transform: translate(-900px,0); } 100% { transform: translate(900px,0); } }
    @keyframes ring-pulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.35; } }
    @keyframes draw { 0% { stroke-dashoffset: 500; } 100% { stroke-dashoffset: 0; } }
    @keyframes dot-float { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
    @keyframes particle-fade { 0%, 100% { opacity: 0; } 40%, 60% { opacity: var(--peak, 0.5); } }
    .g-dr { animation: drift-r 8s ease-in-out infinite; }
    .g-dl { animation: drift-l 9s ease-in-out infinite 0.3s; }
    .g-du { animation: drift-u 7s ease-in-out infinite 0.6s; }
    .g-p { animation: pulse 6s ease-in-out infinite; }
    .g-scan { animation: scan 4.5s linear infinite; }
    .g-ring { animation: ring-pulse 4s ease-in-out infinite; }
    .g-draw { animation: draw 3s ease-in-out infinite; stroke-dasharray: 250 250; }
    .g-dot { animation: dot-float 5s ease-in-out infinite; }
    .particle { animation: particle-fade var(--dur) ease-in-out infinite; opacity: 0; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; }
      .particle { opacity: 0.3 !important; }
    }
  `;

  // ═══════════════ DEFS ═══════════════
  const defs = `
    <radialGradient id="g1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,54,145,0.62)"/><stop offset="100%" stop-color="rgba(255,54,145,0)"/></radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(99,215,208,0.5)"/><stop offset="100%" stop-color="rgba(99,215,208,0)"/></radialGradient>
    <radialGradient id="g3" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,159,104,0.48)"/><stop offset="100%" stop-color="rgba(255,159,104,0)"/></radialGradient>
    <radialGradient id="g4" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(114,199,255,0.42)"/><stop offset="100%" stop-color="rgba(114,199,255,0)"/></radialGradient>
    <radialGradient id="g5" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,111,145,0.38)"/><stop offset="100%" stop-color="rgba(255,111,145,0)"/></radialGradient>
    <linearGradient id="scg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,111,145,0)"/>
      <stop offset="40%" stop-color="rgba(255,111,145,0.14)"/>
      <stop offset="50%" stop-color="rgba(99,215,208,0.48)"/>
      <stop offset="60%" stop-color="rgba(255,111,145,0.14)"/>
      <stop offset="100%" stop-color="rgba(255,111,145,0)"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,111,145,0.08)" stroke-width="0.5"/>
    </pattern>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `;

  // ═══════════════ PARTICLES (lightweight, opacity-only) ═══════════════
  const particles = (() => {
    let pts = '';
    for (let i = 0; i < 18; i++) {
      const px = Math.floor(Math.random() * W);
      const py = Math.floor(Math.random() * totalH);
      const size = (Math.random() * 1.8 + 0.4).toFixed(1);
      const dur = (Math.random() * 6 + 5).toFixed(1);
      const del = (Math.random() * 12).toFixed(1);
      const peak = (Math.random() * 0.3 + 0.25).toFixed(2);
      const color = ['#7ee7ff', '#e8c8ff', '#ff88cc', '#ffffff'][i % 4];
      pts += `<circle class="particle" cx="${px}" cy="${py}" r="${size}" fill="${color}" style="--dur:${dur}s; --peak:${peak}; animation-delay:${del}s;" />`;
    }
    return pts;
  })();

  // ═══════════════ HERO ═══════════════
  const hero = (() => {
    const cy = y + heroH / 2;
    return `
    <g>
      <ellipse class="g-dr" cx="200" cy="${cy}" rx="180" ry="110" fill="url(#g1)"/>
      <ellipse class="g-dl" cx="620" cy="${cy+20}" rx="160" ry="95" fill="url(#g2)"/>
      <ellipse class="g-du" cx="420" cy="${cy-30}" rx="140" ry="90" fill="url(#g3)"/>
      <ellipse class="g-p" cx="100" cy="${cy+40}" rx="120" ry="80" fill="url(#g4)"/>
      <rect class="g-scan" x="-200" y="${cy-20}" width="400" height="40" fill="url(#scg)" opacity="0.35"/>
      <circle class="g-ring" cx="400" cy="${cy}" r="120" fill="none" stroke="rgba(120,200,255,0.15)" stroke-width="0.8"/>
      <circle class="g-ring" cx="400" cy="${cy}" r="80" fill="none" stroke="rgba(200,120,255,0.12)" stroke-width="0.6" style="animation-delay:0.5s"/>
      <path class="g-draw" d="M 30 ${y+20} L 30 ${y+10} L 45 ${y+10}" fill="none" stroke="rgba(126,231,255,0.7)" stroke-width="2.5" stroke-linecap="round"/>
      <path class="g-draw" d="M 770 ${y+20} L 770 ${y+10} L 755 ${y+10}" fill="none" stroke="rgba(232,200,255,0.7)" stroke-width="2.5" stroke-linecap="round" style="animation-delay:0.5s"/>
      <path class="g-draw" d="M 30 ${y+heroH-20} L 30 ${y+heroH-10} L 45 ${y+heroH-10}" fill="none" stroke="rgba(255,136,204,0.6)" stroke-width="2.5" stroke-linecap="round" style="animation-delay:1s"/>
      <path class="g-draw" d="M 770 ${y+heroH-20} L 770 ${y+heroH-10} L 755 ${y+heroH-10}" fill="none" stroke="rgba(126,231,255,0.5)" stroke-width="2.5" stroke-linecap="round" style="animation-delay:1.5s"/>
      <circle class="g-dot" cx="60" cy="${cy-65}" r="2" fill="#7ee7ff"/>
      <circle class="g-dot" cx="740" cy="${cy+45}" r="2" fill="#e8c8ff" style="animation-delay:1.5s"/>
      <circle class="g-dot" cx="700" cy="${cy-50}" r="1.5" fill="#ff88cc" style="animation-delay:2.5s"/>
      <text x="400" y="${cy-48}" text-anchor="middle" font-family="${font}" font-size="48" font-weight="900" fill="#ffffff" letter-spacing="12" filter="url(#glow)">T.Motseki</text>
      <text x="400" y="${cy-8}" text-anchor="middle" font-family="${font}" font-size="11" fill="rgba(255,111,145,0.95)" letter-spacing="6" font-weight="700">SOFTWARE DEVELOPER</text>
      <line x1="260" y1="${cy+10}" x2="540" y2="${cy+10}" stroke="rgba(99,215,208,0.3)" stroke-width="1" filter="url(#glow)"/>
      <text x="400" y="${cy+35}" text-anchor="middle" font-family="${font}" font-size="10" fill="rgba(255,209,102,0.9)" letter-spacing="3" font-weight="600">BUILD. BREAK. LEARN. IMPROVE</text>
      <text x="400" y="${cy+60}" text-anchor="middle" font-family="${font}" font-size="9.5" fill="rgba(168,216,255,0.72)" letter-spacing="2" font-weight="500">AI  \u2022  FULL-STACK  \u2022  SYSTEMS</text>
      <g font-family="${font}" font-size="9" font-weight="600" letter-spacing="1.5" text-anchor="middle">
        <a href="https://github.com/Thato-Motseki" target="_blank"><text x="350" y="${cy+85}" fill="rgba(126,231,255,0.72)">GITHUB</text></a>
        <text x="400" y="${cy+85}" fill="rgba(100,100,140,0.5)">•</text>
        <a href="https://www.linkedin.com/in/thato-motseki" target="_blank"><text x="450" y="${cy+85}" fill="rgba(232,200,255,0.72)">LINKEDIN</text></a>
      </g>
    </g>`;
  })();
  y += heroH + gap;

  // ═══════════════ TECH STACK ═══════════════
  const techStack = (() => {
    const baseY = y;
    const techs = ['PHP', 'C++', 'React.js', 'Python', 'JavaScript', 'C#', 'Java', 'OpenAI'];
    const colors = ['#7ee7ff', '#e8c8ff', '#ff88cc', '#7ee7ff', '#e8c8ff', '#ff88cc', '#e8c8ff', '#7ee7ff'];
    let pills = '';
    // Calculate total width first to center them
    let totalPillW = 0;
    const pillWidths = techs.map(t => t.length * 7.5 + 26);
    totalPillW = pillWidths.reduce((a, b) => a + b, 0) + (techs.length - 1) * 8;
    let px = (W - totalPillW) / 2;
    techs.forEach((t, i) => {
      const w = pillWidths[i];
      const strokeRgb = colors[i] === '#7ee7ff' ? '126,231,255' : colors[i] === '#e8c8ff' ? '232,200,255' : '255,136,204';
      pills += `
      <g>
        <rect x="${px}" y="${baseY+20}" width="${w}" height="26" rx="13" fill="rgba(15,12,28,0.85)" stroke="rgba(${strokeRgb},0.3)" stroke-width="1"/>
        <text x="${px + w/2}" y="${baseY+38}" text-anchor="middle" font-family="${font}" font-size="11" font-weight="700" fill="${colors[i]}">${t}</text>
      </g>`;
      px += w + 8;
    });
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      ${pills}
    </g>`;
  })();
  y += techH + gap;

  // ═══════════════ STATS ═══════════════
  const statsBlock = (() => {
    const baseY = y;
    const s = data.stats;
    const items = [
      { val: s.totalStars, label: 'STARS', color: '#ffcc33' },
      { val: s.totalForks, label: 'FORKS', color: '#e8c8ff' },
      { val: s.totalRepos, label: 'REPOS', color: '#7ee7ff' },
      { val: s.totalCommits, label: 'COMMITS', color: '#ff88cc' },
    ];
    let cols = '';
    const colW = 170;
    const startX = (W - colW * 4) / 2;
    items.forEach((item, i) => {
      const cx = startX + i * colW + colW / 2;
      cols += `
      <g>
        <text x="${cx}" y="${baseY+45}" text-anchor="middle" font-family="${font}" font-size="28" font-weight="900" fill="#ffffff">${item.val}</text>
        <text x="${cx}" y="${baseY+65}" text-anchor="middle" font-family="${font}" font-size="9" fill="${item.color}" letter-spacing="2.5" font-weight="800">${item.label}</text>
      </g>`;
      if (i < 3) {
        cols += `<line x1="${startX + (i+1) * colW}" y1="${baseY+25}" x2="${startX + (i+1) * colW}" y2="${baseY+72}" stroke="rgba(120,80,220,0.2)" stroke-width="0.8" stroke-dasharray="3 3"/>`;
      }
    });
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      <ellipse class="g-dl" cx="400" cy="${baseY+45}" rx="300" ry="55" fill="url(#g1)" opacity="0.7"/>
      <rect class="g-scan" x="-200" y="${baseY+45}" width="200" height="2" fill="url(#scg)" style="animation-delay:1.5s"/>
      ${cols}
    </g>`;
  })();
  y += statsH + gap;

  // ═══════════════ LANGUAGES ═══════════════
  const langs = (() => {
    const baseY = y;
    const ll = data.languages;
    const barW = 720;
    const barX = 40;
    const barY = baseY + 42;

    let bar = `<rect x="${barX}" y="${barY}" width="${barW}" height="8" rx="4" fill="rgba(255,255,255,0.06)"/>`;
    let bx = barX;
    ll.forEach(l => {
      const w = Math.max(barW * l.percentage / 100, 3);
      bar += `<rect x="${bx}" y="${barY}" width="${w}" height="8" rx="${w < 5 ? 0 : 4}" fill="${l.color}" opacity="0.9"/>`;
      bx += w;
    });

    let legend = '';
    const itemsPerRow = 5;
    const colWidth = 144;
    ll.slice(0, 10).forEach((l, i) => {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const lx = barX + col * colWidth;
      const ly = barY + 26 + row * 30;
      legend += `
      <g>
        <circle cx="${lx+5}" cy="${ly+6}" r="4.5" fill="${l.color}" opacity="0.9"/>
        <text x="${lx+15}" y="${ly+10}" font-family="${font}" font-size="11" font-weight="700" fill="rgba(240,240,255,0.95)">${l.name}</text>
        <text x="${lx+15 + l.name.length*6.5 + 6}" y="${ly+10}" font-family="${font}" font-size="9.5" fill="rgba(180,180,210,0.6)" font-weight="500">${l.percentage}%</text>
      </g>`;
    });

    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      <ellipse class="g-dr" cx="650" cy="${baseY+100}" rx="180" ry="100" fill="url(#g5)"/>
      <text x="${barX}" y="${baseY+22}" font-family="${font}" font-size="10" fill="rgba(126,231,255,0.85)" letter-spacing="4" font-weight="800">STACK ANALYTICS</text>
      ${bar}
      ${legend}
    </g>`;
  })();
  y += langH + gap;

  // ═══════════════ CALENDAR ═══════════════
  const calendar = (() => {
    const baseY = y;
    const weeks = data.calendar.weeks;
    const cellSize = 10;
    const cgap = 2;
    const step = cellSize + cgap;
    const gridX = 55;
    const gridY = baseY + 40;
    const colors = ['rgba(25,25,45,0.7)', 'rgba(45,74,110,0.85)', 'rgba(74,126,200,0.9)', 'rgba(126,231,255,0.95)', '#ffffff'];
    
    // Limit to last 52 weeks that fit in our width
    const maxWeeks = Math.min(weeks.length, Math.floor((W - gridX - 30) / step));
    const displayWeeks = weeks.slice(weeks.length - maxWeeks);
    
    let cells = '';
    for (let w = 0; w < displayWeeks.length; w++) {
      for (const d of displayWeeks[w].contributionDays) {
        const lv = d.contributionCount === 0 ? 0 : d.contributionCount <= 2 ? 1 : d.contributionCount <= 5 ? 2 : d.contributionCount <= 9 ? 3 : 4;
        const cx = gridX + w * step;
        const cy = gridY + d.weekday * step;
        const fill = colors[lv];
        cells += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="2.5" fill="${fill}"/>`;
      }
    }

    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      <text x="40" y="${baseY+22}" font-family="${font}" font-size="10" fill="rgba(126,231,255,0.85)" letter-spacing="4" font-weight="800">ACTIVITY PULSE</text>
      <text x="760" y="${baseY+22}" text-anchor="end" font-family="${font}" font-size="10" fill="rgba(232,200,255,0.65)" font-weight="700">${data.calendar.totalContributions} contributions</text>
      ${cells}
    </g>`;
  })();
  y += calH + gap;

  // ═══════════════ PROJECTS ═══════════════
  const projects = (() => {
    const baseY = y;
    const projs = data.topProjects;
    const cardW = 230;
    const cardH = 180;
    const cardGap = 16;
    const startX = (W - cardW * 3 - cardGap * 2) / 2;
    const cardColors = ['#7ee7ff', '#e8c8ff', '#ff88cc'];
    
    let cards = '';
    projs.forEach((p, i) => {
      const cx = startX + i * (cardW + cardGap);
      const cy = baseY + 30;
      const accent = cardColors[i % 3];
      const strokeRgb = accent === '#7ee7ff' ? '126,231,255' : accent === '#e8c8ff' ? '232,200,255' : '255,136,204';

      // Word-wrap description into lines of max ~28 chars
      const desc = (p.desc || '').substring(0, 90);
      const words = desc.split(' ');
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > 28) {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine) lines.push(currentLine.trim());
      const descLines = lines.slice(0, 3); // max 3 lines

      let descSvg = '';
      descLines.forEach((line, li) => {
        descSvg += `<text x="${cx+18}" y="${cy+54 + li*16}" font-family="${font}" font-size="10" fill="rgba(190,190,220,0.8)" font-weight="400">${line}</text>`;
      });

      cards += `
      <g>
        <rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="16" fill="rgba(10,8,20,0.9)" stroke="rgba(${strokeRgb},0.25)" stroke-width="1.5"/>
        <text x="${cx+18}" y="${cy+30}" font-family="${font}" font-size="15" font-weight="900" fill="#ffffff">${p.name}</text>
        ${descSvg}
        <line x1="${cx+18}" y1="${cy+cardH-56}" x2="${cx+cardW-18}" y2="${cy+cardH-56}" stroke="rgba(${strokeRgb},0.12)" stroke-width="0.6"/>
        <g transform="translate(${cx+18}, ${cy+cardH-42})">
          <circle cx="5" cy="5" r="5" fill="${accent}" opacity="0.9"/>
          <text x="16" y="9" font-family="${font}" font-size="10" font-weight="700" fill="${accent}">${p.lang || 'N/A'}</text>
        </g>
        <g transform="translate(${cx+cardW-75}, ${cy+cardH-42})">
          <text x="0" y="9" font-family="${font}" font-size="10" fill="rgba(200,200,230,0.5)" font-weight="600">\u2605 ${p.stars}  \u2442 ${p.forks}</text>
        </g>
      </g>`;
    });

    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      <ellipse class="g-du" cx="400" cy="${baseY+110}" rx="260" ry="75" fill="url(#g3)" opacity="0.5"/>
      <text x="40" y="${baseY+22}" font-family="${font}" font-size="10" fill="rgba(255,111,145,0.9)" letter-spacing="4" font-weight="800">PRIMARY DEPLOYMENTS</text>
      ${cards}
    </g>`;
  })();
  y += projH;

  // ═══════════════ ABOUT ═══════════════
  const about = (() => {
    const baseY = y;
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(255,111,145,0.18)" stroke-width="0.8"/>
      <ellipse class="g-dr" cx="650" cy="${baseY+90}" rx="180" ry="95" fill="url(#g4)" opacity="0.35"/>
      <clipPath id="about-banner-clip"><rect x="525" y="${baseY+20}" width="230" height="230" rx="16"/></clipPath>
      <image href="data:image/png;base64,${bannerData}" x="525" y="${baseY+20}" width="230" height="230" preserveAspectRatio="xMidYMid meet" opacity="0.95" clip-path="url(#about-banner-clip)"/>
      <text x="40" y="${baseY+24}" font-family="${font}" font-size="10" fill="rgba(126,231,255,0.85)" letter-spacing="4" font-weight="800">ABOUT ME</text>
      <text x="40" y="${baseY+58}" font-family="${font}" font-size="10" fill="rgba(235,235,250,0.9)">I am a software developer who enjoys turning "what if?" into "let's build it."</text>
      <text x="40" y="${baseY+84}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">I spend my time experimenting with code, breaking things, and figuring out why they broke.</text>
      <text x="40" y="${baseY+110}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">I occasionally pretend the first solution was intentional. &#x1F605;</text>
      <text x="40" y="${baseY+136}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">I am interested in modern frameworks, software engineering, and building applications</text>
      <text x="40" y="${baseY+162}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">that solve real problems, not just projects that look good in a tutorial.</text>
      <text x="40" y="${baseY+188}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">I explore how systems work under the hood and learn new technologies hands-on.</text>
      <text x="40" y="${baseY+214}" font-family="${font}" font-size="10" fill="rgba(205,205,230,0.82)">My GitHub is a development lab: projects, experiments, lessons learned, and stubborn bugs.</text>
      <text x="40" y="${baseY+244}" font-family="${font}" font-size="12" fill="rgba(255,209,102,0.9)" font-weight="700" letter-spacing="1">CODE WITH PURPOSE. BUILD WITH IMPACT.</text>
    </g>`;
  })();
  y += aboutH + gap;

  // ═══════════════ FINAL SVG ═══════════════
  return `<!-- T.Motseki Profile | Generated ${new Date().toISOString()} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
<style>${style}</style>
<defs>${defs}</defs>
<rect width="${W}" height="${totalH}" rx="24" fill="#100912" stroke="rgba(255,111,145,0.25)" stroke-width="1.5"/>
<rect width="${W}" height="${totalH}" rx="24" fill="url(#grid)"/>
${particles}
${hero}
${techStack}
${statsBlock}
${langs}
${calendar}
${projects}
${about}
<text x="400" y="${totalH-16}" text-anchor="middle" font-family="${font}" font-size="8.5" fill="rgba(255,159,104,0.55)" font-weight="600" letter-spacing="2">T.Motseki \u2022 SOFTWARE DEVELOPER</text>
</svg>`;
}

// Mock data for local testing
function mockData() {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - (52 - w) * 7 * 86400000 + d * 86400000);
      days.push({ contributionCount: Math.floor(Math.random() * 8), date: date.toISOString().split('T')[0], weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return {
    stats: { totalStars: 12, totalForks: 5, totalRepos: 24, totalCommits: 847 },
    languages: [
      { name: 'PHP', color: '#036bc0', percentage: 14 },
      { name: 'C#', color: '#72c7ff', percentage: 9 },
      { name: 'C++', color: '#ff6f91', percentage: 14 },
      { name: 'PYTHON', color: '#ffd166', percentage: 14 },
      { name: 'JAVASCRIPT', color: '#f7d154', percentage: 12 },
      { name: 'JAVA', color: '#fc7629', percentage: 8 },
      { name: 'NEXT.JS', color: '#f75d79', percentage: 8 },
      { name: 'TYPESCRIPT', color: '#07304b', percentage: 9 },
      { name: 'TAILWIND CSS', color: '#63d7d0', percentage: 6 },
      { name: 'REACT.JS', color: '#03723e', percentage: 6 },
    ],
    topProjects: [
      { name: 'Ethiopian Legal Chatbot', desc: 'Accessible legal guidance powered by conversational AI', stars: 0, forks: 0, lang: 'PYTHON', langColor: '#ff6f91' },
      { name: 'Sentinel AI', desc: 'Intelligent monitoring and threat detection platform', stars: 0, forks: 0, lang: 'PYTHON', langColor: '#ff6f91' },
      { name: 'Market Price Predictor', desc: 'Data-driven forecasting for market price movement', stars: 0, forks: 0, lang: 'JAVASCRIPT', langColor: '#ff6f91' },
    ],
    calendar: { totalContributions: 847, weeks },
  };
}

// Main
const username = process.env.GITHUB_USER || 'Thato-Motseki';
const token = process.env.GITHUB_TOKEN;

(async () => {
  let data;
  if (token) {
    console.log(`Fetching data for @${username}...`);
    try {
      const user = await fetchData(username, token);
      console.log(`  Account created: ${user.createdAt}`);
      data = processData(user);
      try {
        const allTimeCommits = await fetchAllTimeCommits(username, token, user.createdAt);
        console.log(`  All-time commits: ${allTimeCommits}`);
        data.stats.totalCommits = allTimeCommits;
      } catch (e) {
        console.error(`All-time commit totals unavailable: ${e.message}`);
        console.log(`  Using current contribution total: ${data.stats.totalCommits}`);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      data = mockData();
    }
  } else {
    console.log('No GITHUB_TOKEN \u2014 using mock data for preview.');
    data = mockData();
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const bannerPath = path.resolve(process.cwd(), '.github/assets/Banner1.png');
  const bannerData = fs.readFileSync(bannerPath).toString('base64');
  const svg = generateSVG(data, bannerData);
  const outDir = path.resolve(process.cwd(), '.github/assets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'profile.svg');
  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`  Generated: ${outPath} (${Math.round(svg.length/1024)}KB)`);
})();
