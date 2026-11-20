/* ===== RGB background (hue cycles forever) ===== */
let hue = 200;
(function cycle() {
  hue = (hue + 0.12) % 360;
  document.documentElement.style.setProperty('--h', hue.toFixed(1));
  requestAnimationFrame(cycle);
})();

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===== Tabs ===== */
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + t.dataset.tab));
  })
);

/* ===== Knowledge base ===== */
const BRANDS = {
  paypal: 'paypal.com', amazon: 'amazon.com', microsoft: 'microsoft.com', google: 'google.com', apple: 'apple.com',
  netflix: 'netflix.com', facebook: 'facebook.com', instagram: 'instagram.com', linkedin: 'linkedin.com',
  dhl: 'dhl.com', fedex: 'fedex.com', usps: 'usps.com', chase: 'chase.com', wellsfargo: 'wellsfargo.com',
  hdfc: 'hdfcbank.com', sbi: 'sbi.co.in', icici: 'icicibank.com', paytm: 'paytm.com', dropbox: 'dropbox.com', docusign: 'docusign.com'
};
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc'];
const BAD_TLDS = ['top', 'xyz', 'click', 'link', 'work', 'zip', 'mov', 'icu', 'cyou', 'buzz', 'rest', 'gq', 'tk', 'ml', 'cf', 'ga', 'support', 'monster'];
const URGENCY = ['urgent', 'immediately', 'within 24 hours', 'within 48 hours', 'act now', 'final notice', 'last warning', 'suspended', 'will be closed', 'locked', 'expires today', 'verify now', 'action required', 'limited time', 'unauthorized', 'unusual activity'];
const CREDS = ['password', 'verify your account', 'confirm your identity', 'login details', 'one-time password', 'otp', 'card number', 'cvv', 'ssn', 'social security', 'bank details', 'update your payment', 'security code'];
const LURES = ['lottery', 'you have won', 'winner', 'prize', 'inheritance', 'gift card', 'bitcoin', 'crypto wallet', 'refund', 'claim your reward'];
const RISKY_EXT = ['exe', 'scr', 'js', 'vbs', 'bat', 'cmd', 'jar', 'iso', 'img', 'html', 'htm', 'zip', 'rar', 'docm', 'xlsm', 'lnk'];
const PATH_WORDS = ['login', 'signin', 'verify', 'secure', 'update', 'account', 'password', 'confirm', 'banking', 'wallet', 'billing', 'suspend'];

/* ===== Helpers ===== */
function regDomain(host) {
  const p = host.toLowerCase().split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const sld = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];
  return sld.includes(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.');
}
const normalize = (s) => s.toLowerCase().replace(/rn/g, 'm').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/vv/g, 'w');
function lookalike(host) {
  const reg = regDomain(host), label = reg.split('.')[0], clean = normalize(label.replace(/-/g, ''));
  for (const [brand, official] of Object.entries(BRANDS)) {
    if (reg === official) continue;
    if (host.toLowerCase().endsWith('.' + official)) continue;
    if (clean.includes(brand) || host.toLowerCase().replace(/-/g, '').includes(brand)) return { brand, official };
  }
  return null;
}
const isIPv4 = (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every((n) => +n <= 255);
const isIPv6 = (s) => s.includes(':') && /^[0-9a-f:.]+$/i.test(s) && s.length >= 3;
function isPrivate(ip) {
  if (isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^(::1|fe80|fc|fd)/i.test(ip);
}

/* ===== Email parsing ===== */
function parseEmail(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const idx = text.search(/\n\s*\n/);
  let head = idx === -1 ? text : text.slice(0, idx);
  let body = idx === -1 ? '' : text.slice(idx).trim();
  if (!/^[A-Za-z-]+:\s/m.test(head.split('\n')[0] || '')) { head = ''; body = text; }
  const headers = {};
  head.replace(/\n[ \t]+/g, ' ').split('\n').forEach((line) => {
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m) (headers[m[1].toLowerCase()] ||= []).push(m[2]);
  });
  return { headers, body, raw: text };
}
function parseAddress(v = '') {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const name = m ? m[1].trim() : '';
  const addr = (m ? m[2] : v).trim().replace(/[<>]/g, '');
  return { name, addr, domain: (addr.split('@')[1] || '').toLowerCase() };
}
function extractLinks(src) {
  const out = [], seen = new Set();
  for (const m of src.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const shown = m[2].replace(/<[^>]+>/g, '').trim();
    out.push({ url: m[1], text: shown }); seen.add(m[1]);
  }
  for (const m of src.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) {
    const u = m[0].replace(/[.,;]+$/, '');
    if (!seen.has(u)) { out.push({ url: u, text: '' }); seen.add(u); }
  }
  return out.filter((l) => /^https?:/i.test(l.url));
}
function extractHops(headers) {
  const list = [];
  (headers['received'] || []).slice().reverse().forEach((r) => {
    const ips = [...r.matchAll(/\[?((?:\d{1,3}\.){3}\d{1,3})\]?/g)].map((m) => m[1]).filter(isIPv4)
      .concat([...r.matchAll(/\[(IPv6:)?([0-9a-f:]{3,})\]/gi)].map((m) => m[2]).filter(isIPv6));
    const by = (r.match(/by\s+([^\s;]+)/i) || [])[1] || '';
    const from = (r.match(/from\s+([^\s;(]+)/i) || [])[1] || '';
    const date = (r.match(/;\s*(.+)$/) || [])[1] || '';
    [...new Set(ips)].forEach((ip) => list.push({ ip, from, by, date, priv: isPrivate(ip) }));
  });
  ['x-originating-ip', 'x-sender-ip'].forEach((k) => (headers[k] || []).forEach((v) => {
    const ip = (v.match(/(\d{1,3}\.){3}\d{1,3}/) || [])[0];
    if (ip && !list.some((h) => h.ip === ip)) list.unshift({ ip, from: k, by: '', date: '', priv: isPrivate(ip) });
  }));
  return list;
}

/* ===== URL analysis ===== */
function analyzeUrl(input) {
  let u; const notes = []; let score = 0;
  const add = (pts, sev, msg) => { score += pts; notes.push({ sev, msg }); };
  try { u = new URL(/^[a-z]+:\/\//i.test(input) ? input : 'https://' + input); } catch { return { score: 50, notes: [{ sev: 'med', msg: 'This is not a valid URL.' }], host: input }; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') add(10, 'med', 'Does not use HTTPS, so the connection is not encrypted.');
  if (isIPv4(host)) add(30, 'high', 'Uses a raw IP address instead of a domain name.');
  if (input.includes('@') && /^https?:\/\/[^/]*@/.test(input)) add(25, 'high', 'Contains "@" before the host, a trick used to hide the real destination.');
  if (host.includes('xn--')) add(25, 'high', 'Punycode domain: may use look-alike characters from other alphabets.');
  if (SHORTENERS.includes(regDomain(host))) add(15, 'med', 'Link shortener hides the real destination.');
  const tld = host.split('.').pop();
  if (BAD_TLDS.includes(tld)) add(15, 'med', `The ".${tld}" ending is frequently used in scam campaigns.`);
  if (host.split('.').length > 4) add(10, 'med', 'Unusually many subdomains, often used to imitate a trusted name.');
  if ((host.match(/-/g) || []).length >= 3) add(10, 'med', 'Many hyphens in the domain name.');
  if (u.port && !['80', '443'].includes(u.port)) add(10, 'med', `Uses a non-standard port (${u.port}).`);
  if (input.length > 120) add(5, 'low', 'Very long URL.');
  const la = lookalike(host);
  if (la) add(35, 'high', `Imitates ${la.brand} but is not ${la.official}.`);
  const pw = PATH_WORDS.filter((w) => (u.pathname + u.search).toLowerCase().includes(w));
  if (pw.length) add(8, 'low', `Path contains account-related words (${pw.slice(0, 3).join(', ')}).`);
  if (!notes.length) notes.push({ sev: 'ok', msg: 'No common phishing traits found in this link.' });
  return { score: Math.min(score, 100), notes, host };
}

/* ===== IP geolocation (free, no key; needs internet) ===== */
async function geo(ip) {
  try {
    const r = await fetch('https://ipwho.is/' + encodeURIComponent(ip));
    const d = await r.json();
    if (d.success) return { ip: d.ip, country: `${d.flag?.emoji || ''} ${d.country}`, region: d.region, city: d.city, isp: d.connection?.isp || d.connection?.org, asn: d.connection?.asn ? 'AS' + d.connection.asn : '', lat: d.latitude, lon: d.longitude, tz: d.timezone?.id, type: d.type };
  } catch (e) { /* fall through */ }
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const d = await r.json();
    if (!d.error) return { ip: d.ip, country: d.country_name, region: d.region, city: d.city, isp: d.org, asn: d.asn, lat: d.latitude, lon: d.longitude, tz: d.timezone, type: d.version };
  } catch (e) { /* ignore */ }
  return null;
}
const geoSummary = (g) => [g.city, g.region, g.country].filter(Boolean).join(', ') + (g.isp ? ` · ${g.isp}` : '');
function geoTable(g) {
  const rows = [['IP', g.ip], ['Country', g.country], ['Region', g.region], ['City', g.city], ['Provider', g.isp], ['ASN', g.asn], ['Timezone', g.tz], ['Coordinates', g.lat != null ? `${g.lat}, ${g.lon}` : '']].filter((r) => r[1]);
  const map = g.lat != null ? `<p style="margin-top:12px"><a style="color:var(--accent)" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=8/${g.lat}/${g.lon}">Open on map</a></p>` : '';
  return `<div class="kv">${rows.map((r) => `<div><span>${r[0]}</span><span>${esc(r[1])}</span></div>`).join('')}</div>${map}`;
}

/* ===== Main analysis ===== */
let lastReport = '';
async function analyze() {
  const raw = $('emailInput').value.trim();
  if (!raw) { alert('Paste an email first, or load one of the samples.'); return; }
  const { headers, body, raw: full } = parseEmail(raw);
  const findings = []; let score = 0;
  const flag = (pts, sev, title, detail) => { score += pts; findings.push({ sev, title, detail }); };
  const lower = full.toLowerCase();

  const from = parseAddress((headers['from'] || [''])[0]);
  const reply = parseAddress((headers['reply-to'] || [''])[0]);
  const ret = parseAddress((headers['return-path'] || [''])[0]);
  const subject = (headers['subject'] || [''])[0];

  // Authentication
  const authText = [...(headers['authentication-results'] || []), ...(headers['received-spf'] || [])].join(' ');
  const auth = {};
  ['spf', 'dkim', 'dmarc'].forEach((k) => { auth[k] = (authText.match(new RegExp(k + '=(\\w+)', 'i')) || [])[1]?.toLowerCase() || (k === 'spf' && /^\s*(pass|fail|softfail|neutral|none)/i.test((headers['received-spf'] || [''])[0]) ? (headers['received-spf'][0].match(/^\s*(\w+)/)[1].toLowerCase()) : ''); });
  if (!authText && Object.keys(headers).length) flag(5, 'low', 'No authentication results', 'The headers contain no SPF, DKIM or DMARC verdict, so the sender could not be verified.');
  Object.entries(auth).forEach(([k, v]) => {
    if (v === 'fail') flag(15, 'high', `${k.toUpperCase()} failed`, `The ${k.toUpperCase()} check failed, which means the email may not come from who it claims.`);
    else if (v === 'softfail' || v === 'none' || v === 'permerror') flag(8, 'med', `${k.toUpperCase()} ${v}`, `${k.toUpperCase()} did not give a clean pass.`);
  });

  // Sender consistency
  if (from.domain) {
    if (reply.domain && regDomain(reply.domain) !== regDomain(from.domain)) flag(15, 'high', 'Reply-To differs from sender', `Replies go to ${reply.domain}, not ${from.domain}.`);
    if (ret.domain && regDomain(ret.domain) !== regDomain(from.domain)) flag(8, 'med', 'Return-Path differs from sender', `Bounces go to ${ret.domain}, not ${from.domain}.`);
    const embedded = from.name.match(/[\w.+-]+@([\w.-]+\.[a-z]{2,})/i);
    if (embedded && regDomain(embedded[1]) !== regDomain(from.domain)) flag(25, 'high', 'Display name shows a fake address', `The name shows "${embedded[0]}" but the real sender is ${from.addr}.`);
    const la = lookalike(from.domain);
    if (la) flag(30, 'high', 'Sender domain imitates a brand', `${from.domain} looks like ${la.official}, but it is a different domain.`);
    else {
      const dn = from.name.toLowerCase().replace(/[^a-z]/g, '');
      const b = Object.keys(BRANDS).find((k) => dn.includes(k));
      if (b && regDomain(from.domain) !== BRANDS[b]) flag(25, 'high', 'Display name impersonates a brand', `The name says "${from.name}" but the email comes from ${from.domain}.`);
    }
    if (BAD_TLDS.includes(from.domain.split('.').pop())) flag(10, 'med', 'Sender uses a high-risk domain ending', `.${from.domain.split('.').pop()} is common in scam campaigns.`);
  } else if (Object.keys(headers).length) flag(10, 'med', 'No sender found', 'The From header is missing or unreadable.');

  // Content signals
  const urg = URGENCY.filter((w) => lower.includes(w));
  if (urg.length) flag(Math.min(urg.length * 5, 20), urg.length > 2 ? 'high' : 'med', 'Pressure and urgency language', `Found: ${urg.slice(0, 5).join(', ')}.`);
  const cred = CREDS.filter((w) => lower.includes(w));
  if (cred.length) flag(15, 'high', 'Asks for sensitive information', `Mentions: ${cred.slice(0, 4).join(', ')}. Legitimate companies rarely ask for this by email.`);
  const lure = LURES.filter((w) => lower.includes(w));
  if (lure.length) flag(10, 'med', 'Prize, refund or money lure', `Found: ${lure.slice(0, 4).join(', ')}.`);
  if (/dear (customer|user|member|client|account holder|valued)/i.test(body)) flag(8, 'low', 'Generic greeting', 'Real providers usually address you by name.');
  if (/<form[\s>]/i.test(full)) flag(15, 'high', 'Contains an embedded form', 'Forms inside emails are used to harvest passwords.');

  // Attachments
  const atts = [...full.matchAll(/(?:file)?name\*?=\s*"?([^";\n]+)"?/gi)].map((m) => m[1].trim()).filter((n) => /\.\w{2,5}$/.test(n));
  atts.forEach((n) => {
    const ext = n.split('.').pop().toLowerCase(); const dbl = /\.\w{2,4}\.(exe|scr|js|vbs|bat)$/i.test(n);
    if (RISKY_EXT.includes(ext) || dbl) flag(dbl ? 25 : 20, 'high', 'Risky attachment', `"${n}" is a file type often used to deliver malware.`);
  });

  // Links
  const links = extractLinks(full).slice(0, 25);
  let maxLink = 0;
  const linkRows = links.map((l) => {
    const a = analyzeUrl(l.url); maxLink = Math.max(maxLink, a.score);
    let mismatch = '';
    const shown = l.text.match(/(?:https?:\/\/)?([\w-]+(?:\.[\w-]+)+)/);
    if (shown) { try { if (regDomain(shown[1]) !== regDomain(new URL(l.url).hostname)) { mismatch = `Text says ${shown[1]} but the link goes to ${new URL(l.url).hostname}.`; flag(20, 'high', 'Link text does not match its destination', mismatch); } } catch (e) { /* ignore */ } }
    return { ...l, a, mismatch };
  });
  if (maxLink >= 25) flag(Math.min(30, Math.round(maxLink * 0.6)), maxLink >= 50 ? 'high' : 'med', 'Suspicious link found', 'At least one link has traits typical of phishing (see "Links found").');

  // Hops
  const hops = extractHops(headers);
  const pub = hops.filter((h) => !h.priv);
  if (!hops.length && Object.keys(headers).length) findings.push({ sev: 'low', title: 'No IP trail', detail: 'No Received headers were found, so the origin cannot be traced.' });

  score = Math.min(100, score);
  if (!findings.some((f) => f.sev === 'high' || f.sev === 'med')) findings.push({ sev: 'ok', title: 'No strong red flags', detail: 'Still be careful with links and attachments you were not expecting.' });

  // Render
  $('results').classList.remove('hidden');
  const [label, sub, color] = score < 25 ? ['Looks safe', 'No major phishing traits were detected.', 'var(--good)']
    : score < 50 ? ['Suspicious', 'Some warning signs. Verify the sender through another channel before acting.', 'var(--warn)']
    : score < 75 ? ['Likely phishing', 'Several strong indicators. Do not click links or open attachments.', 'var(--bad)']
    : ['Dangerous phishing', 'Many serious indicators. Delete it and report it.', 'var(--bad)'];
  $('verdictTitle').textContent = label; $('verdictTitle').style.color = color;
  $('verdictSub').textContent = sub;
  const arc = $('gaugeArc'); arc.style.stroke = color; arc.style.strokeDashoffset = 326.7;
  requestAnimationFrame(() => requestAnimationFrame(() => (arc.style.strokeDashoffset = 326.7 * (1 - score / 100))));
  let n = 0; const num = $('scoreNum'); const t = setInterval(() => { n = Math.min(score, n + Math.ceil(score / 30) || 1); num.textContent = n; if (n >= score) clearInterval(t); }, 25);
  if (!score) num.textContent = 0;

  const order = { high: 0, med: 1, low: 2, ok: 3 };
  $('findings').innerHTML = findings.sort((a, b) => order[a.sev] - order[b.sev]).map((f) => `<li class="${f.sev}"><b>${esc(f.title)}</b>${esc(f.detail)}</li>`).join('');

  const pill = (v) => `<span class="pill ${v === 'pass' ? 'pass' : v === 'fail' ? 'fail' : 'none'}">${v || 'not found'}</span>`;
  $('headerInfo').innerHTML = [
    ['From', esc(from.addr || '—')], ['Display name', esc(from.name || '—')], ['Reply-To', esc(reply.addr || '—')], ['Return-Path', esc(ret.addr || '—')], ['Subject', esc(subject || '—')],
    ['SPF', pill(auth.spf)], ['DKIM', pill(auth.dkim)], ['DMARC', pill(auth.dmarc)],
  ].map((r) => `<div><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');

  $('linkList').innerHTML = linkRows.length ? linkRows.map((l) => {
    const cls = l.a.score >= 40 ? 'bad' : l.a.score >= 15 ? '' : 'safe';
    return `<div class="link ${cls}">${esc(l.url)}<small>${esc(l.mismatch || l.a.notes.map((x) => x.msg).join(' '))}</small></div>`;
  }).join('') : '<p class="empty">No links found in this email.</p>';

  $('hops').innerHTML = hops.length ? hops.map((h, i) => `<div class="hop"><div class="n">${i + 1}</div><div><code>${esc(h.ip)}</code> ${h.priv ? '<span class="pill none">private</span>' : ''}<p>${esc([h.from && 'from ' + h.from, h.by && 'by ' + h.by, h.date].filter(Boolean).join(' · '))}</p><p id="hopgeo${i}" class="loading">${h.priv ? 'Private network address, cannot be located.' : 'Looking up location...'}</p></div></div>`).join('')
    : '<p class="empty">No IP addresses found in the headers.</p>';

  const geos = {};
  await Promise.all(hops.map(async (h, i) => {
    if (h.priv) return;
    const g = await geo(h.ip); geos[i] = g;
    const el = $('hopgeo' + i); if (!el) return;
    el.className = ''; el.innerHTML = g ? esc(geoSummary(g)) : 'Lookup failed. Check your internet connection.';
  }));

  lastReport = [`PHISHING EMAIL DETECTOR REPORT`, `Verdict: ${label} (risk ${score}/100)`, `From: ${from.addr}  Subject: ${subject}`, '', 'Findings:', ...findings.map((f) => `- [${f.sev}] ${f.title}: ${f.detail}`), '', 'Mail route:', ...hops.map((h, i) => `${i + 1}. ${h.ip}${geos[i] ? ' - ' + geoSummary(geos[i]) : ''}`)].join('\n');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== IP tab ===== */
async function traceIP(ip) {
  const out = $('ipOut'); ip = (ip || '').trim();
  if (ip && !isIPv4(ip) && !isIPv6(ip)) { out.innerHTML = '<p class="empty">That does not look like a valid IP address.</p>'; return; }
  if (ip && isPrivate(ip)) { out.innerHTML = '<p class="empty">That is a private address (home, office or loopback network). It cannot be located on the internet.</p>'; return; }
  out.innerHTML = '<p class="loading">Tracing...</p>';
  const g = await geo(ip);
  out.innerHTML = g ? geoTable(g) : '<p class="empty">Lookup failed. Check your internet connection and try again.</p>';
}
$('ipBtn').onclick = () => traceIP($('ipInput').value);
$('myIpBtn').onclick = () => traceIP('');
$('ipInput').addEventListener('keydown', (e) => e.key === 'Enter' && traceIP($('ipInput').value));

/* ===== URL tab ===== */
function checkUrl() {
  const v = $('urlInput').value.trim(); if (!v) return;
  const a = analyzeUrl(v);
  const [label, color] = a.score < 20 ? ['Low risk', 'var(--good)'] : a.score < 45 ? ['Suspicious', 'var(--warn)'] : ['High risk', 'var(--bad)'];
  $('urlOut').innerHTML = `<h2 style="color:${color}">${label} <small style="color:var(--muted);font-weight:400">(${a.score}/100)</small></h2><ul class="findings">${a.notes.map((n) => `<li class="${n.sev}">${esc(n.msg)}</li>`).join('')}</ul>`;
}
$('urlBtn').onclick = checkUrl;
$('urlInput').addEventListener('keydown', (e) => e.key === 'Enter' && checkUrl());

/* ===== Buttons + samples ===== */
$('analyzeBtn').onclick = analyze;
$('clearBtn').onclick = () => { $('emailInput').value = ''; $('results').classList.add('hidden'); };
$('copyReport').onclick = async (e) => { try { await navigator.clipboard.writeText(lastReport); e.target.textContent = 'Copied'; setTimeout(() => (e.target.textContent = 'Copy report'), 1500); } catch { alert(lastReport); } };

const PHISH = `Received: from mail.secure-paypa1-alerts.top ([185.220.101.34]) by mx.google.com with ESMTP; Fri, 20 Nov 2026 03:12:44 +0000
Received: from [10.0.0.5] (unknown [10.0.0.5]) by mail.secure-paypa1-alerts.top with SMTP; Fri, 20 Nov 2026 03:12:40 +0000
Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=secure-paypa1-alerts.top; dkim=none; dmarc=fail
Return-Path: <bounce@secure-paypa1-alerts.top>
Reply-To: <helpdesk.recovery@gmail.com>
From: "PayPal Support" <service@secure-paypa1-alerts.top>
To: you@example.com
Subject: URGENT: Your account has been suspended - verify now
Content-Type: text/html

<p>Dear Customer,</p>
<p>We detected unusual activity. Your account will be closed within 24 hours unless you verify your account and confirm your password and card number.</p>
<p><a href="http://secure-paypa1-alerts.top/login/verify?id=88213">www.paypal.com/security</a></p>
<p>Or download the form: <a href="http://bit.ly/3xYzAbC">Invoice_Details.pdf.exe</a></p>
Content-Disposition: attachment; filename="Invoice_Details.pdf.exe"
<p>PayPal Security Team</p>`;
const SAFE = `Received: from smtp.github.com (smtp.github.com [192.30.252.209]) by mx.google.com with ESMTPS; Fri, 20 Nov 2026 09:02:11 +0000
Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=github.com; dkim=pass header.d=github.com; dmarc=pass
Return-Path: <noreply@github.com>
From: GitHub <noreply@github.com>
To: you@example.com
Subject: [GitHub] A new public key was added to your account
Content-Type: text/plain

Hi Alex,

A new public key was added to your account. If you did this, you can ignore this email.
Review your keys any time at https://github.com/settings/keys

Thanks,
The GitHub Team`;
$('loadPhish').onclick = () => { $('emailInput').value = PHISH; };
$('loadSafe').onclick = () => { $('emailInput').value = SAFE; };