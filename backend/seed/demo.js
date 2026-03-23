#!/usr/bin/env node
/**
 * VulnChain — Interactive Demo Seeder
 *
 * Usage:  node seed/demo.js [number]
 *
 *   node seed/demo.js        → shows menu
 *   node seed/demo.js 1      → runs option 1 (register users)
 *   node seed/demo.js all    → runs everything (full demo setup)
 *
 * Features:
 *   - Random CVE & proposal generation (unique each run)
 *   - Duplicate detection (checks ledger before creating)
 *   - Network-level Fabric CA user enrollment (real blockchain identities)
 */

const http = require('http');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API = 'http://localhost:4000';
const CREDS_FILE = path.join(__dirname, '..', 'demo-credentials.txt');

// ── HTTP helper ──
function req(method, urlPath, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method, headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const r = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

// ── Token cache ──
const tokens = {};
async function login(username) {
  if (tokens[username]) return tokens[username];
  const res = await req('POST', '/api/auth/login', { username, password: 'password123' });
  if (!res.token) throw new Error(`Login failed for ${username}: ${JSON.stringify(res)}`);
  tokens[username] = res.token;
  return res.token;
}

// ── Helpers ──
const sleep = ms => new Promise(r => setTimeout(r, ms));
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(arr, n) { return shuffle(arr).slice(0, n); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dec = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(dec)); }
function randVersion() { return `${rand(1, 20)}.${rand(0, 9)}.${rand(0, 5)}`; }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Fabric CA org config ──
const ORG_CA_CONFIG = {
  'CNA-Alpha': { ns: 'cna-alpha-ns', caPod: 'fabric-ca-server-ca-cna-alpha-0', caHost: 'ca.cna-alpha-ns', caAdmin: 'cna-alpha-admin', caPw: 'cna-alpha-adminpw' },
  'CNA-Beta':  { ns: 'cna-beta-ns',  caPod: 'fabric-ca-server-ca-cna-beta-0',  caHost: 'ca.cna-beta-ns',  caAdmin: 'cna-beta-admin',  caPw: 'cna-beta-adminpw' },
  'Regulator': { ns: 'regulator-ns',  caPod: 'fabric-ca-server-ca-regulator-0', caHost: 'ca.regulator-ns', caAdmin: 'regulator-admin', caPw: 'regulator-adminpw' },
};

// ── Fabric CA enrollment ──
function fabricCARegister(orgName, username, password) {
  const org = ORG_CA_CONFIG[orgName];
  if (!org) return { ok: false, msg: `No CA config for org: ${orgName}` };

  try {
    const cmd = `kubectl exec ${org.caPod} -n ${org.ns} -c ca -- bash -c '
      export FABRIC_CA_CLIENT_HOME=/tmp/ca-admin-enroll
      mkdir -p $FABRIC_CA_CLIENT_HOME

      # Enroll admin (idempotent — skips if already enrolled)
      if [ ! -f $FABRIC_CA_CLIENT_HOME/msp/signcerts/cert.pem ]; then
        fabric-ca-client enroll \\
          -u https://${org.caAdmin}:${org.caPw}@${org.caHost}:7054 \\
          --tls.certfiles /etc/hyperledger/fabric-ca-server-config/server.crt 2>&1
      fi

      # Register user (may already exist)
      fabric-ca-client register \\
        --id.name ${username} --id.secret ${password} --id.type client \\
        --tls.certfiles /etc/hyperledger/fabric-ca-server-config/server.crt \\
        -u https://${org.caHost}:7054 2>&1

      # Enroll user to generate their certs
      export FABRIC_CA_CLIENT_HOME=/tmp/user-${username}
      mkdir -p $FABRIC_CA_CLIENT_HOME
      fabric-ca-client enroll \\
        -u https://${username}:${password}@${org.caHost}:7054 \\
        --tls.certfiles /etc/hyperledger/fabric-ca-server-config/server.crt 2>&1
    '`;
    const output = execSync(cmd, { timeout: 30000, encoding: 'utf8' });
    const alreadyExists = output.includes('already registered');
    const enrolled = output.includes('Stored client certificate');
    return { ok: true, existed: alreadyExists, enrolled, output };
  } catch (e) {
    return { ok: false, msg: e.stderr || e.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  RANDOM CVE GENERATOR
// ══════════════════════════════════════════════════════════════
const PRODUCTS = [
  'OpenSSL', 'Apache HTTP Server', 'Nginx', 'Linux Kernel', 'PostgreSQL', 'MySQL',
  'Redis', 'MongoDB', 'Docker', 'Kubernetes', 'Node.js', 'React', 'Django',
  'Spring Framework', 'Git', 'Jenkins', 'Grafana', 'Elasticsearch', 'Terraform',
  'Ansible', 'HashiCorp Vault', 'Prometheus', 'RabbitMQ', 'Apache Kafka',
  'Envoy Proxy', 'Istio', 'ArgoCD', 'Traefik', 'Keycloak', 'MinIO',
  'VMware ESXi', 'Google Chrome', 'FortiOS', 'Cisco IOS XE', 'Windows',
  'Juniper Junos', 'Ivanti Connect Secure', 'SonicWall SMA', 'PAN-OS',
  'WordPress', 'GitLab', 'Apache Tomcat', 'curl', 'Go stdlib', 'Python pip',
  'Rust Tokio', 'HashiCorp Consul', 'Apache Struts', 'Samba', 'BIND DNS',
];

const VULN_TYPES = [
  { type: 'Buffer Overflow',       cwe: 'CWE-122', cweName: 'Heap-based Buffer Overflow',       verbs: ['triggers a heap overflow', 'causes memory corruption', 'overwrites adjacent heap memory'] },
  { type: 'SQL Injection',         cwe: 'CWE-89',  cweName: 'SQL Injection',                    verbs: ['allows arbitrary SQL execution', 'bypasses query parameterization', 'enables SQL command injection'] },
  { type: 'Path Traversal',        cwe: 'CWE-22',  cweName: 'Path Traversal',                   verbs: ['allows file access outside root', 'traverses directory boundaries', 'reads arbitrary files on disk'] },
  { type: 'Command Injection',     cwe: 'CWE-78',  cweName: 'OS Command Injection',             verbs: ['allows OS command execution', 'injects shell commands', 'executes arbitrary system commands'] },
  { type: 'XSS',                   cwe: 'CWE-79',  cweName: 'Cross-site Scripting',             verbs: ['enables script injection', 'allows stored XSS attacks', 'executes malicious JavaScript'] },
  { type: 'Auth Bypass',           cwe: 'CWE-287', cweName: 'Improper Authentication',           verbs: ['bypasses authentication checks', 'allows unauthenticated access', 'circumvents login requirements'] },
  { type: 'Privilege Escalation',  cwe: 'CWE-269', cweName: 'Improper Privilege Management',    verbs: ['escalates to admin privileges', 'gains elevated permissions', 'bypasses authorization controls'] },
  { type: 'RCE',                   cwe: 'CWE-94',  cweName: 'Code Injection',                   verbs: ['allows remote code execution', 'executes arbitrary code', 'enables server-side code injection'] },
  { type: 'SSRF',                  cwe: 'CWE-918', cweName: 'Server-Side Request Forgery',      verbs: ['enables internal network access', 'allows server-side request forgery', 'reaches internal services'] },
  { type: 'Information Disclosure',cwe: 'CWE-200', cweName: 'Information Exposure',              verbs: ['exposes sensitive data', 'leaks internal information', 'discloses confidential configuration'] },
  { type: 'Race Condition',        cwe: 'CWE-362', cweName: 'Race Condition',                   verbs: ['causes use-after-free via race', 'leads to TOCTOU vulnerability', 'creates exploitable timing window'] },
  { type: 'Type Confusion',        cwe: 'CWE-843', cweName: 'Type Confusion',                   verbs: ['triggers type confusion in engine', 'causes object type mismatch', 'corrupts type metadata'] },
  { type: 'Deserialization',       cwe: 'CWE-502', cweName: 'Deserialization of Untrusted Data', verbs: ['deserializes untrusted objects', 'triggers gadget chain via deserialization', 'processes malicious serialized data'] },
  { type: 'DoS',                   cwe: 'CWE-400', cweName: 'Uncontrolled Resource Consumption', verbs: ['causes denial of service', 'exhausts server resources', 'triggers unbounded memory allocation'] },
  { type: 'Integer Overflow',      cwe: 'CWE-190', cweName: 'Integer Overflow',                 verbs: ['overflows integer boundary', 'wraps integer causing corruption', 'triggers arithmetic overflow'] },
  { type: 'Log Credential Leak',   cwe: 'CWE-532', cweName: 'Log Information Exposure',         verbs: ['logs sensitive credentials', 'exposes API keys in output', 'writes secrets to log files'] },
  { type: 'CSRF',                  cwe: 'CWE-352', cweName: 'Cross-Site Request Forgery',       verbs: ['allows cross-site request forgery', 'enables unauthorized actions via CSRF', 'lacks CSRF token validation'] },
  { type: 'Open Redirect',         cwe: 'CWE-601', cweName: 'Open Redirect',                    verbs: ['redirects to attacker-controlled URL', 'allows phishing via redirect', 'bypasses redirect validation'] },
  { type: 'Sandbox Escape',        cwe: 'CWE-693', cweName: 'Protection Mechanism Failure',     verbs: ['escapes sandbox restrictions', 'bypasses security boundary', 'breaks out of restricted environment'] },
];

const COMPONENTS = [
  'API endpoint', 'authentication module', 'parser', 'TLS handshake', 'session handler',
  'request router', 'file upload handler', 'admin panel', 'REST API', 'WebSocket handler',
  'CLI tool', 'database driver', 'cache layer', 'proxy module', 'plugin system',
  'configuration parser', 'template engine', 'serialization layer', 'logging module',
  'certificate validator', 'query builder', 'migration tool', 'package manager',
  'streaming module', 'worker thread pool', 'IPC handler', 'memory allocator',
];

const ATTACKERS = [
  'remote unauthenticated attackers', 'authenticated users', 'local attackers',
  'adjacent network attackers', 'malicious insiders', 'remote attackers with low privileges',
];

function generateCVE() {
  const product = randItem(PRODUCTS);
  const vuln = randItem(VULN_TYPES);
  const component = randItem(COMPONENTS);
  const attacker = randItem(ATTACKERS);
  const verb = randItem(vuln.verbs);
  const uid = rand(1000, 9999);

  const title = `${product} ${vuln.type} in ${component} [${uid}]`;
  const description = `A ${vuln.type.toLowerCase()} vulnerability in the ${component} of ${product} ${verb}. This allows ${attacker} to compromise affected systems.`;

  const cvss = vuln.type === 'DoS' ? randFloat(4.0, 7.5)
    : vuln.type === 'Log Credential Leak' ? randFloat(2.0, 5.5)
    : vuln.type === 'Information Disclosure' ? randFloat(3.0, 6.5)
    : vuln.type === 'XSS' || vuln.type === 'CSRF' || vuln.type === 'Open Redirect' ? randFloat(4.0, 7.0)
    : randFloat(6.0, 10.0);

  const severity = cvss >= 9.0 ? 'CRITICAL' : cvss >= 7.0 ? 'HIGH' : cvss >= 4.0 ? 'MEDIUM' : 'LOW';

  const versions = [randVersion(), randVersion()];
  if (Math.random() > 0.5) versions.push(randVersion());

  return {
    title,
    description,
    affectedProduct: product,
    affectedVersions: versions,
    cvssScore: cvss,
    severity,
    cweId: vuln.cwe,
    cweDescription: vuln.cweName,
    ...(cvss >= 9.0 ? { cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' } : {}),
    ...(Math.random() > 0.88 ? { embargoDate: new Date(Date.now() + rand(15, 90) * 86400000).toISOString() } : {}),
  };
}

// ── Random proposal generator ──
const PROPOSAL_TOPICS = [
  { prefix: 'Reduce embargo period to', unit: 'days', range: [30, 90], type: 'POLICY_CHANGE', descTpl: 'Reduce the default embargo window to {val} days to accelerate patch deployment.' },
  { prefix: 'Admit', suffix: 'as New CNA', type: 'CNA_MEMBERSHIP', names: ['SecurityCorp', 'CloudDefense', 'IoTSecure Labs', 'CyberWatch', 'ThreatIntel Co', 'VulnTrack Inc', 'PatchGuard', 'NetShield'], descTpl: 'Admit {name} as a CVE Numbering Authority with scope limited to their product ecosystem.' },
  { prefix: 'Update critical threshold to CVSS', type: 'SEVERITY_THRESHOLD', vals: [9.0, 9.2, 9.5, 9.8], descTpl: 'Adjust CRITICAL severity classification threshold to CVSS {val} to improve alert relevance.' },
  { prefix: 'Mandate', suffix: 'response SLA', type: 'POLICY_CHANGE', slas: ['24-hour', '48-hour', '72-hour', '5-day'], descTpl: 'All CNAs must acknowledge new vulnerability reports within {val}.' },
  { prefix: 'Revoke', suffix: 'CNA membership', type: 'CNA_MEMBERSHIP', names: ['InactiveCNA', 'LegacyVuln', 'StaleOrg', 'DormantSec'], descTpl: 'Revoke CNA status of {name} due to prolonged inactivity.' },
  { prefix: 'Require', type: 'POLICY_CHANGE', reqs: ['CVSS 4.0 scoring', 'CWE classification', 'patch timeline field', 'vendor notification proof', 'peer review for CRITICAL CVEs', 'automated CVSS validation'], descTpl: 'Make {req} mandatory for all new CVE submissions.' },
];

function generateProposal() {
  const topic = randItem(PROPOSAL_TOPICS);
  const uid = rand(100, 999);
  let title, description;

  if (topic.range) {
    const val = rand(topic.range[0], topic.range[1]);
    title = `${topic.prefix} ${val} ${topic.unit} [${uid}]`;
    description = topic.descTpl.replace('{val}', val);
  } else if (topic.names) {
    const name = randItem(topic.names);
    title = `${topic.prefix} ${name} ${topic.suffix || ''} [${uid}]`.trim();
    description = topic.descTpl.replace('{name}', name);
  } else if (topic.vals) {
    const val = randItem(topic.vals);
    title = `${topic.prefix} ${val} [${uid}]`;
    description = topic.descTpl.replace('{val}', val);
  } else if (topic.slas) {
    const sla = randItem(topic.slas);
    title = `${topic.prefix} ${sla} ${topic.suffix} [${uid}]`;
    description = topic.descTpl.replace('{val}', sla);
  } else if (topic.reqs) {
    const r = randItem(topic.reqs);
    title = `${topic.prefix} ${r} [${uid}]`;
    description = topic.descTpl.replace('{req}', r);
  }

  return { title, description, type: topic.type };
}

// ══════════════════════════════════════════════════════════════
//  OPTION 1 — Register Users (API + Fabric CA enrollment)
// ══════════════════════════════════════════════════════════════
const coreUsers = [
  { username: 'cna_alpha_admin', email: 'admin@cna-alpha.com',    password: 'password123', role: 'CNA_MEMBER',    organization: 'CNA-Alpha' },
  { username: 'cna_beta_admin',  email: 'admin@cna-beta.com',     password: 'password123', role: 'CNA_MEMBER',    organization: 'CNA-Beta' },
  { username: 'regulator_admin', email: 'admin@regulator.gov',    password: 'password123', role: 'NATIONAL_BODY', organization: 'Regulator' },
  { username: 'researcher1',    email: 'researcher@security.org', password: 'password123', role: 'RESEARCHER',    organization: 'CNA-Alpha' },
  { username: 'public_user',    email: 'user@public.com',         password: 'password123', role: 'PUBLIC' },
  { username: 'alpha_analyst',  email: 'analyst@cna-alpha.com',   password: 'password123', role: 'CNA_MEMBER',    organization: 'CNA-Alpha' },
  { username: 'beta_analyst',   email: 'analyst@cna-beta.com',    password: 'password123', role: 'CNA_MEMBER',    organization: 'CNA-Beta' },
  { username: 'researcher2',    email: 'researcher2@bugbounty.io',password: 'password123', role: 'RESEARCHER',    organization: 'CNA-Beta' },
  { username: 'auditor1',       email: 'auditor@regulator.gov',   password: 'password123', role: 'NATIONAL_BODY', organization: 'Regulator' },
  { username: 'viewer1',        email: 'viewer@company.com',      password: 'password123', role: 'PUBLIC' },
];

async function registerUsers() {
  console.log('\n━━ Registering Users ━━');

  // Step 1: Register in backend API (SQLite)
  console.log('\n  Backend API Registration:');
  for (const u of coreUsers) {
    const res = await req('POST', '/api/auth/register', u);
    const status = res.token ? 'registered' : (res.message || 'exists');
    console.log(`    ${u.role.padEnd(14)} ${u.username.padEnd(18)} → ${status}`);
  }

  // Step 2: Enroll with Fabric CA (network-level identity)
  console.log('\n  Fabric CA Enrollment (network-level):');
  const caUsers = coreUsers.filter(u => u.organization && ORG_CA_CONFIG[u.organization]);
  for (const u of caUsers) {
    const result = fabricCARegister(u.organization, u.username, u.password);
    if (result.ok) {
      const status = result.existed ? 'already enrolled' : 'enrolled';
      console.log(`    ${u.organization.padEnd(12)} ${u.username.padEnd(18)} → ${status} (Fabric CA: ${ORG_CA_CONFIG[u.organization].caHost})`);
    } else {
      console.log(`    ${u.organization.padEnd(12)} ${u.username.padEnd(18)} → FAILED: ${result.msg}`);
    }
  }

  // Credentials table
  console.log('\n  ┌────────────────────┬────────────────┬──────────────────────┬──────────────┐');
  console.log('  │ Username           │ Role           │ Organization         │ Fabric CA    │');
  console.log('  ├────────────────────┼────────────────┼──────────────────────┼──────────────┤');
  for (const u of coreUsers) {
    const hasCa = u.organization && ORG_CA_CONFIG[u.organization] ? 'enrolled' : '-';
    console.log(`  │ ${u.username.padEnd(18)} │ ${u.role.padEnd(14)} │ ${(u.organization||'-').padEnd(20)} │ ${hasCa.padEnd(12)} │`);
  }
  console.log('  └────────────────────┴────────────────┴──────────────────────┴──────────────┘');

  // Save credentials file
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  VulnChain — Demo Credentials',
    `  Generated: ${new Date().toISOString()}`,
    '═══════════════════════════════════════════════════════════════',
    '', '  Frontend: http://localhost:5173', '  Backend:  http://localhost:4000', '',
    '  ┌────────────────────┬────────────────┬────────────────┬──────────────────────┬──────────────┐',
    '  │ Username           │ Password       │ Role           │ Organization         │ Fabric CA    │',
    '  ├────────────────────┼────────────────┼────────────────┼──────────────────────┼──────────────┤',
    ...coreUsers.map(u => {
      const ca = u.organization && ORG_CA_CONFIG[u.organization] ? 'enrolled' : '-';
      return `  │ ${u.username.padEnd(18)} │ ${'password123'.padEnd(14)} │ ${u.role.padEnd(14)} │ ${(u.organization||'-').padEnd(20)} │ ${ca.padEnd(12)} │`;
    }),
    '  └────────────────────┴────────────────┴────────────────┴──────────────────────┴──────────────┘',
    '',
    '  Blockchain Network Identities (Fabric CA enrolled):',
    '  ──────────────────────────────────────────────────────────────',
    '  CNA-Alpha users   → ca.cna-alpha-ns:7054  (CNAAlphaMSP)',
    '  CNA-Beta users    → ca.cna-beta-ns:7054   (CNABetaMSP)',
    '  Regulator users   → ca.regulator-ns:7054  (RegulatorMSP)',
    '  Public users      → no blockchain identity', '',
  ];
  fs.writeFileSync(CREDS_FILE, lines.join('\n'), 'utf8');
  console.log(`\n  Credentials saved to: ${CREDS_FILE}`);
}

// ══════════════════════════════════════════════════════════════
//  OPTION 2 — Create Random CVEs (CNA-Alpha)
// ══════════════════════════════════════════════════════════════
async function createCVEs() {
  console.log('\n━━ Creating Random CVEs (CNA-Alpha) ━━');
  const token = await login('cna_alpha_admin');

  // Check existing CVEs for duplicate detection
  const existing = await req('GET', '/api/cve', null, token);
  const existingTitles = new Set((existing.cves || []).map(c => c.title));
  const existingCount = existingTitles.size;

  const ids = [];
  let attempts = 0;
  const target = 15;

  while (ids.length < target && attempts < 50) {
    const cve = generateCVE();
    attempts++;

    // Skip if title already exists (dedup)
    if (existingTitles.has(cve.title)) continue;

    const res = await req('POST', '/api/cve', cve, token);
    if (res.cveId) {
      ids.push(res.cveId);
      existingTitles.add(cve.title); // track for this batch too
      console.log(`  ${res.cveId.padEnd(16)} ${cve.severity.padEnd(10)} ${cve.title}`);
    } else {
      console.log(`  FAIL             ${cve.severity.padEnd(10)} ${cve.title}`);
      console.log(`                   ${res.error || res.message || ''}`);
    }
  }

  console.log(`\n  ${ids.length} new CVEs created (${existingCount} already existed)`);
  return ids;
}

// ══════════════════════════════════════════════════════════════
//  OPTION 3 — CVE Lifecycle Transitions
// ══════════════════════════════════════════════════════════════
async function transitionCVEs() {
  console.log('\n━━ CVE Lifecycle Transitions ━━');
  const token = await login('cna_alpha_admin');

  const data = await req('GET', '/api/cve', null, token);
  const cves = (data.cves || data || []);
  if (!cves.length) { console.log('  No CVEs found — run option 2 first'); return; }

  const drafts = shuffle(cves.filter(c => c.status === 'DRAFT'));
  const published = cves.filter(c => c.status === 'PUBLISHED');

  if (!drafts.length && !published.length) {
    console.log('  No DRAFT or PUBLISHED CVEs to transition');
    return;
  }

  let count = 0;

  // DRAFT → PUBLISHED (up to 5)
  for (const cve of drafts.slice(0, 5)) {
    await req('PUT', `/api/cve/${cve.cveId}/status`, { status: 'UNDER_REVIEW', notes: 'Reviewed by CNA analyst' }, token);
    const r = await req('PUT', `/api/cve/${cve.cveId}/status`, { status: 'PUBLISHED', notes: 'Approved for disclosure' }, token);
    if (!r.error) { console.log(`  ${cve.cveId} → PUBLISHED`); count++; }
  }

  // DRAFT → UNDER_REVIEW (up to 3)
  for (const cve of drafts.slice(5, 8)) {
    await req('PUT', `/api/cve/${cve.cveId}/status`, { status: 'UNDER_REVIEW', notes: 'Under technical review' }, token);
    console.log(`  ${cve.cveId} → UNDER_REVIEW`); count++;
  }

  // EMBARGOED
  if (drafts[8]) {
    await req('PUT', `/api/cve/${drafts[8].cveId}/status`, { status: 'UNDER_REVIEW', notes: 'Embargo review' }, token);
    await req('PUT', `/api/cve/${drafts[8].cveId}/status`, { status: 'EMBARGOED', notes: 'Coordinated disclosure' }, token);
    console.log(`  ${drafts[8].cveId} → EMBARGOED`); count++;
  }

  // DISPUTED
  const disputeTarget = published[0] || drafts[9];
  if (disputeTarget) {
    if (disputeTarget.status === 'DRAFT') {
      await req('PUT', `/api/cve/${disputeTarget.cveId}/status`, { status: 'UNDER_REVIEW', notes: 'Review' }, token);
      await req('PUT', `/api/cve/${disputeTarget.cveId}/status`, { status: 'PUBLISHED', notes: 'Published' }, token);
    }
    await req('PUT', `/api/cve/${disputeTarget.cveId}/status`, { status: 'DISPUTED', notes: 'Vendor disputes severity' }, token);
    console.log(`  ${disputeTarget.cveId} → DISPUTED`); count++;
  }

  // DEPRECATED
  const deprecTarget = published[1] || drafts[10];
  if (deprecTarget) {
    if (deprecTarget.status === 'DRAFT') {
      await req('PUT', `/api/cve/${deprecTarget.cveId}/status`, { status: 'UNDER_REVIEW', notes: 'Review' }, token);
      await req('PUT', `/api/cve/${deprecTarget.cveId}/status`, { status: 'PUBLISHED', notes: 'Published' }, token);
    }
    await req('PUT', `/api/cve/${deprecTarget.cveId}/status`, { status: 'DEPRECATED', notes: 'Duplicate CVE' }, token);
    console.log(`  ${deprecTarget.cveId} → DEPRECATED`); count++;
  }

  console.log(`\n  ${count} CVEs transitioned`);
}

// ══════════════════════════════════════════════════════════════
//  OPTION 4 — Governance Proposals + Voting (random)
// ══════════════════════════════════════════════════════════════
async function governanceDemo() {
  console.log('\n━━ Governance Proposals & Voting ━━');
  const alphaToken = await login('cna_alpha_admin');
  const betaToken  = await login('cna_beta_admin');
  const regToken   = await login('regulator_admin');

  // Generate 6 unique proposals
  const proposals = [];
  const usedTitles = new Set();
  let attempts = 0;
  while (proposals.length < 6 && attempts < 30) {
    const p = generateProposal();
    attempts++;
    if (!usedTitles.has(p.title)) {
      usedTitles.add(p.title);
      proposals.push(p);
    }
  }

  const propIds = [];
  for (const p of proposals) {
    const res = await req('POST', '/api/governance/proposals', p, alphaToken);
    const id = res.proposalId || null;
    propIds.push(id);
    if (id) { console.log(`  Created: ${id} — ${p.title}`); }
    else { console.log(`  FAIL — ${p.title}: ${res.error || res.message || ''}`); }
  }

  const valid = propIds.filter(Boolean);

  // Full vote cycle on proposal 1
  if (valid[0]) {
    await req('PUT', `/api/governance/proposals/${valid[0]}/activate`, {}, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[0]}/vote`, { decision: 'YES', reason: 'Benefits the ecosystem' }, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[0]}/vote`, { decision: 'YES', reason: 'Agree with this change' }, betaToken);
    await req('POST', `/api/governance/proposals/${valid[0]}/vote`, { decision: 'NO', reason: 'Regulatory concerns' }, regToken);
    const tally = await req('POST', `/api/governance/proposals/${valid[0]}/tally`, {}, alphaToken);
    console.log(`  ${valid[0]} → voted & tallied (${tally.status || tally.result?.status || '?'})`);
  }

  // Partial votes on proposal 2
  if (valid[1]) {
    await req('PUT', `/api/governance/proposals/${valid[1]}/activate`, {}, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[1]}/vote`, { decision: 'YES', reason: 'Strong support' }, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[1]}/vote`, { decision: 'ABSTAIN', reason: 'Need more info' }, betaToken);
    console.log(`  ${valid[1]} → ACTIVE (2 votes)`);
  }

  // Activate only proposal 3
  if (valid[2]) {
    await req('PUT', `/api/governance/proposals/${valid[2]}/activate`, {}, alphaToken);
    console.log(`  ${valid[2]} → ACTIVE (awaiting votes)`);
  }

  // Unanimous YES on proposal 4
  if (valid[3]) {
    await req('PUT', `/api/governance/proposals/${valid[3]}/activate`, {}, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[3]}/vote`, { decision: 'YES', reason: 'Full support' }, alphaToken);
    await req('POST', `/api/governance/proposals/${valid[3]}/vote`, { decision: 'YES', reason: 'Agreed' }, betaToken);
    await req('POST', `/api/governance/proposals/${valid[3]}/vote`, { decision: 'YES', reason: 'Best practice' }, regToken);
    const t2 = await req('POST', `/api/governance/proposals/${valid[3]}/tally`, {}, alphaToken);
    console.log(`  ${valid[3]} → ${t2.status || t2.result?.status || 'tallied'} (unanimous)`);
  }

  console.log(`\n  ${valid.length} proposals: 2 tallied, 1 partial, 1 awaiting, ${valid.slice(4).length} drafts`);
}

// ══════════════════════════════════════════════════════════════
//  OPTION 5 — Multi-Org Random CVE Submissions
// ══════════════════════════════════════════════════════════════
async function multiOrgCVEs() {
  console.log('\n━━ Multi-Organization CVE Submissions ━━');
  const token = await login('cna_alpha_admin');

  // Check existing for dedup
  const existing = await req('GET', '/api/cve', null, token);
  const existingTitles = new Set((existing.cves || []).map(c => c.title));

  const orgs = [
    { label: 'CNA-Beta  ', user: 'cna_beta_admin',  count: 4 },
    { label: 'Regulator ', user: 'regulator_admin', count: 3 },
    { label: 'Researcher', user: 'researcher1',     count: 3 },
  ];

  let total = 0;
  for (const org of orgs) {
    const orgToken = await login(org.user);
    let created = 0;
    let attempts = 0;
    while (created < org.count && attempts < 20) {
      const cve = generateCVE();
      attempts++;
      if (existingTitles.has(cve.title)) continue;

      const res = await req('POST', '/api/cve', cve, orgToken);
      if (res.cveId) {
        existingTitles.add(cve.title);
        console.log(`  ${org.label} → ${res.cveId.padEnd(16)} ${cve.title}`);
        created++; total++;
      } else {
        console.log(`  ${org.label} → FAIL              ${cve.title}`);
        console.log(`               ${res.error || res.message || ''}`);
      }
    }
  }
  console.log(`\n  ${total} CVEs submitted by 3 organizations`);
}

// ══════════════════════════════════════════════════════════════
//  OPTION 6 — Show Analytics
// ══════════════════════════════════════════════════════════════
async function showAnalytics() {
  console.log('\n━━ Platform Analytics ━━');
  const token = await login('cna_alpha_admin');

  const summary = await req('GET', '/api/analytics/summary', null, token);
  const orgStats = await req('GET', '/api/analytics/orgs', null, token);

  if (summary.statusCounts) {
    const s = summary.statusCounts;
    const sev = summary.severityCounts || {};
    console.log(`  Total CVEs:       ${s.total || '?'}`);
    console.log(`  By Severity:      CRITICAL=${sev.CRITICAL||0}  HIGH=${sev.HIGH||0}  MEDIUM=${sev.MEDIUM||0}  LOW=${sev.LOW||0}`);
    console.log(`  By Status:        PUBLISHED=${s.published||0}  DRAFT=${s.draft||0}  REVIEW=${s.underReview||0}  EMBARGOED=${s.embargoed||0}  DISPUTED=${s.disputed||0}`);
  } else {
    console.log('  Summary:', JSON.stringify(summary).substring(0, 300));
  }

  if (Array.isArray(orgStats)) {
    console.log('\n  Organization Stats:');
    for (const o of orgStats) {
      console.log(`    ${(o.org||o.mspId||o.organization||'?').padEnd(16)} → ${o.count||o.cveCount||'?'} CVEs`);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  OPTION 7 — Full Demo
// ══════════════════════════════════════════════════════════════
async function fullDemo() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     VulnChain — Full Demo Setup              ║');
  console.log('╚══════════════════════════════════════════════╝');

  await registerUsers();     await sleep(500);
  await createCVEs();        await sleep(500);
  await multiOrgCVEs();      await sleep(500);
  await transitionCVEs();    await sleep(500);
  await governanceDemo();    await sleep(500);
  await showAnalytics();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Demo setup complete!                         ║');
  console.log('║                                               ║');
  console.log('║  Frontend: http://localhost:5173               ║');
  console.log('║  Backend:  http://localhost:4000               ║');
  console.log('║                                               ║');
  console.log('║  All users enrolled with Fabric CA             ║');
  console.log('║  Credentials: demo-credentials.txt            ║');
  console.log('╚══════════════════════════════════════════════╝');
}

// ══════════════════════════════════════════════════════════════
//  MENU
// ══════════════════════════════════════════════════════════════
function showMenu() {
  console.log(`
╔══════════════════════════════════════════════╗
║       VulnChain — Demo Data Seeder           ║
╠══════════════════════════════════════════════╣
║                                              ║
║  1. Register Users (API + Fabric CA)         ║
║  2. Create Random CVEs (15 unique)           ║
║  3. CVE Lifecycle Transitions                ║
║  4. Governance Proposals + Voting            ║
║  5. Multi-Org Random CVE Submissions         ║
║  6. Show Analytics & Summary                 ║
║  7. Full Demo (run ALL)                      ║
║  0. Exit                                     ║
║                                              ║
╚══════════════════════════════════════════════╝
`);
}

const actions = { 1: registerUsers, 2: createCVEs, 3: transitionCVEs, 4: governanceDemo, 5: multiOrgCVEs, 6: showAnalytics, 7: fullDemo };

async function run() {
  const arg = process.argv[2];
  if (arg === 'all' || arg === '7') { await fullDemo(); process.exit(0); }
  if (arg && actions[parseInt(arg)]) { await actions[parseInt(arg)](); process.exit(0); }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));
  while (true) {
    showMenu();
    const choice = await ask('  Enter option (0-7): ');
    const n = parseInt(choice);
    if (n === 0 || choice.toLowerCase() === 'q') { console.log('  Bye!'); rl.close(); process.exit(0); }
    if (actions[n]) {
      try { await actions[n](); } catch (e) { console.error(`\n  Error: ${e.message}`); }
      await ask('\n  Press Enter to continue...');
    } else { console.log('  Invalid option'); }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
