const http = require('http');

const API_BASE = 'http://localhost:4000/api';

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

const dummyCVEs = [
  { title: 'Buffer Overflow in OpenSSL TLS Handshake', description: 'A heap-based buffer overflow in the TLS handshake processing code allows remote attackers to execute arbitrary code via a crafted ClientHello message.', affectedProduct: 'OpenSSL', affectedVersions: ['3.0.0', '3.0.1', '3.0.2'], cvssScore: 9.8, cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', severity: 'CRITICAL', cweId: 'CWE-122', cweDescription: 'Heap-based Buffer Overflow', patchInfo: 'Upgrade to OpenSSL 3.0.3 or later' },
  { title: 'Apache HTTP Server Path Traversal', description: 'A path traversal vulnerability in Apache HTTP Server allows unauthenticated attackers to access files outside the document root.', affectedProduct: 'Apache HTTP Server', affectedVersions: ['2.4.49', '2.4.50'], cvssScore: 7.5, severity: 'HIGH', cweId: 'CWE-22', cweDescription: 'Path Traversal' },
  { title: 'Linux Kernel Race Condition in io_uring', description: 'A race condition in the io_uring subsystem of the Linux kernel leads to use-after-free, allowing local privilege escalation.', affectedProduct: 'Linux Kernel', affectedVersions: ['5.15', '5.16', '5.17'], cvssScore: 7.8, severity: 'HIGH', cweId: 'CWE-362', cweDescription: 'Race Condition', embargoDate: new Date(Date.now() + 30 * 86400000).toISOString() },
  { title: 'PostgreSQL SQL Injection via pg_dump', description: 'Improper neutralization of special elements in pg_dump allows authenticated users to execute arbitrary SQL commands.', affectedProduct: 'PostgreSQL', affectedVersions: ['14.0', '14.1', '14.2'], cvssScore: 8.8, severity: 'HIGH', cweId: 'CWE-89', cweDescription: 'SQL Injection' },
  { title: 'Nginx Integer Overflow in mp4 Module', description: 'An integer overflow in the nginx mp4 streaming module allows remote attackers to cause denial of service or potential code execution.', affectedProduct: 'Nginx', affectedVersions: ['1.23.0', '1.23.1'], cvssScore: 7.5, severity: 'HIGH', cweId: 'CWE-190', cweDescription: 'Integer Overflow' },
  { title: 'Redis Lua Sandbox Escape', description: 'A vulnerability in Redis Lua scripting engine allows authenticated users to escape the sandbox and execute arbitrary commands on the host.', affectedProduct: 'Redis', affectedVersions: ['7.0.0', '7.0.1', '7.0.2'], cvssScore: 8.0, severity: 'HIGH', cweId: 'CWE-693', cweDescription: 'Protection Mechanism Failure' },
  { title: 'Docker Container Escape via runc', description: 'A vulnerability in runc allows a malicious container to overwrite the host runc binary and gain root-level code execution on the host.', affectedProduct: 'Docker', affectedVersions: ['20.10.0', '20.10.1'], cvssScore: 9.3, severity: 'CRITICAL', cweId: 'CWE-78', cweDescription: 'OS Command Injection' },
  { title: 'Node.js HTTP Request Smuggling', description: 'Node.js HTTP parser incorrectly handles Transfer-Encoding headers, allowing HTTP request smuggling attacks.', affectedProduct: 'Node.js', affectedVersions: ['18.0.0', '18.1.0', '18.2.0'], cvssScore: 6.5, severity: 'MEDIUM', cweId: 'CWE-444', cweDescription: 'HTTP Request Smuggling' },
  { title: 'Kubernetes API Server Authentication Bypass', description: 'An authentication bypass in the Kubernetes API server allows unauthenticated users to access cluster resources under specific configurations.', affectedProduct: 'Kubernetes', affectedVersions: ['1.25.0', '1.25.1'], cvssScore: 9.1, severity: 'CRITICAL', cweId: 'CWE-287', cweDescription: 'Improper Authentication' },
  { title: 'React XSS via dangerouslySetInnerHTML', description: 'Applications using React with user-controlled dangerouslySetInnerHTML are vulnerable to stored XSS when sanitization is bypassed.', affectedProduct: 'React', affectedVersions: ['18.0.0', '18.1.0'], cvssScore: 6.1, severity: 'MEDIUM', cweId: 'CWE-79', cweDescription: 'Cross-site Scripting' },
  { title: 'MongoDB Authentication Bypass', description: 'A type confusion vulnerability in MongoDB authentication mechanism allows unauthenticated access to databases.', affectedProduct: 'MongoDB', affectedVersions: ['6.0.0', '6.0.1'], cvssScore: 9.8, severity: 'CRITICAL', cweId: 'CWE-843', cweDescription: 'Type Confusion' },
  { title: 'Git Remote Code Execution', description: 'A vulnerability in Git clone --recurse-submodules allows specially crafted repositories to execute arbitrary code during clone operations.', affectedProduct: 'Git', affectedVersions: ['2.39.0', '2.39.1'], cvssScore: 8.6, severity: 'HIGH', cweId: 'CWE-94', cweDescription: 'Code Injection' },
  { title: 'Elasticsearch Information Disclosure', description: 'Insufficient access controls in Elasticsearch allow unauthenticated read access to sensitive indices.', affectedProduct: 'Elasticsearch', affectedVersions: ['8.5.0', '8.5.1', '8.5.2'], cvssScore: 5.3, severity: 'MEDIUM', cweId: 'CWE-200', cweDescription: 'Information Exposure' },
  { title: 'Grafana SSRF via Data Source Proxy', description: 'Server-side request forgery in Grafana data source proxy allows authenticated users to access internal network resources.', affectedProduct: 'Grafana', affectedVersions: ['9.3.0', '9.3.1'], cvssScore: 4.3, severity: 'MEDIUM', cweId: 'CWE-918', cweDescription: 'Server-Side Request Forgery' },
  { title: 'Terraform Provider Credential Leak', description: 'Terraform logs provider credentials in debug mode, potentially exposing cloud API keys.', affectedProduct: 'Terraform', affectedVersions: ['1.4.0', '1.4.1'], cvssScore: 3.3, severity: 'LOW', cweId: 'CWE-532', cweDescription: 'Information Exposure Through Log Files' },
];

const dummyProposals = [
  { title: 'Reduce Default Embargo Period to 60 Days', description: 'Proposal to reduce the default embargo window from 90 days to 60 days to accelerate patch deployment.', type: 'POLICY_CHANGE' },
  { title: 'Admit SecurityCorp as New CNA', description: 'Proposal to admit SecurityCorp as a new CVE Numbering Authority with scope limited to their product ecosystem.', type: 'CNA_MEMBERSHIP' },
  { title: 'Update Critical Severity Threshold to CVSS 9.5', description: 'Raise the CRITICAL severity classification threshold from CVSS 9.0 to 9.5 to reduce alert fatigue.', type: 'SEVERITY_THRESHOLD' },
];

async function seed() {
  console.log('Seeding CVE Platform with dummy data...\n');

  // Register users
  console.log('Creating users...');
  await request('POST', '/api/auth/register', { username: 'cna_alpha_admin', email: 'admin@cna-alpha.com', password: 'password123', role: 'CNA_MEMBER', organization: 'CNA-Alpha' });
  await request('POST', '/api/auth/register', { username: 'cna_beta_admin', email: 'admin@cna-beta.com', password: 'password123', role: 'CNA_MEMBER', organization: 'CNA-Beta' });
  await request('POST', '/api/auth/register', { username: 'regulator_admin', email: 'admin@regulator.gov', password: 'password123', role: 'NATIONAL_BODY', organization: 'Regulator' });
  await request('POST', '/api/auth/register', { username: 'researcher1', email: 'researcher@security.org', password: 'password123', role: 'RESEARCHER', organization: 'IndependentResearch' });
  await request('POST', '/api/auth/register', { username: 'public_user', email: 'user@public.com', password: 'password123', role: 'PUBLIC' });

  // Login as CNA Alpha
  const loginRes = await request('POST', '/api/auth/login', { username: 'cna_alpha_admin', password: 'password123' });
  const token = loginRes.token;
  console.log(`Logged in as cna_alpha_admin\n`);

  // Create CVEs
  console.log('Creating CVEs...');
  const cveIds = [];
  for (const cve of dummyCVEs) {
    const res = await request('POST', '/api/cve', cve, token);
    console.log(`  Created: ${res.cveId} - ${cve.title}`);
    cveIds.push(res.cveId);
  }

  // Transition some CVEs through lifecycle
  console.log('\nTransitioning CVE statuses...');

  // Published CVEs (first 5)
  for (let i = 0; i < 5; i++) {
    await request('PUT', `/api/cve/${cveIds[i]}/status`, { status: 'UNDER_REVIEW', notes: 'Reviewed by CNA' }, token);
    await request('PUT', `/api/cve/${cveIds[i]}/status`, { status: 'PUBLISHED', notes: 'Approved for public disclosure' }, token);
    console.log(`  ${cveIds[i]} → PUBLISHED`);
  }

  // Under Review (5-7)
  for (let i = 5; i < 8; i++) {
    await request('PUT', `/api/cve/${cveIds[i]}/status`, { status: 'UNDER_REVIEW', notes: 'Under technical review' }, token);
    console.log(`  ${cveIds[i]} → UNDER_REVIEW`);
  }

  // Embargoed (index 2 already has embargoDate, but let's also do 8-9)
  await request('PUT', `/api/cve/${cveIds[2]}/status`, { status: 'UNDER_REVIEW', notes: 'Embargo review' }, token);
  await request('PUT', `/api/cve/${cveIds[2]}/status`, { status: 'EMBARGOED', notes: 'Under coordinated disclosure' }, token);
  console.log(`  ${cveIds[2]} → EMBARGOED`);

  // Disputed (index 8)
  await request('PUT', `/api/cve/${cveIds[8]}/status`, { status: 'UNDER_REVIEW', notes: 'Review' }, token);
  await request('PUT', `/api/cve/${cveIds[8]}/status`, { status: 'PUBLISHED', notes: 'Published' }, token);
  await request('PUT', `/api/cve/${cveIds[8]}/status`, { status: 'DISPUTED', notes: 'Scope of vulnerability questioned' }, token);
  console.log(`  ${cveIds[8]} → DISPUTED`);

  // Deprecated (index 9)
  await request('PUT', `/api/cve/${cveIds[9]}/status`, { status: 'UNDER_REVIEW', notes: 'Review' }, token);
  await request('PUT', `/api/cve/${cveIds[9]}/status`, { status: 'PUBLISHED', notes: 'Published' }, token);
  await request('PUT', `/api/cve/${cveIds[9]}/status`, { status: 'DEPRECATED', notes: 'Duplicate of another CVE' }, token);
  console.log(`  ${cveIds[9]} → DEPRECATED`);

  // Create governance proposals
  console.log('\nCreating governance proposals...');
  for (const proposal of dummyProposals) {
    const res = await request('POST', '/api/governance/proposals', proposal, token);
    console.log(`  Created: ${res.proposalId} - ${proposal.title}`);

    // Activate first proposal
    if (dummyProposals.indexOf(proposal) === 0) {
      await request('PUT', `/api/governance/proposals/${res.proposalId}/activate`, {}, token);
      console.log(`  ${res.proposalId} → ACTIVE`);

      // Cast a vote
      await request('POST', `/api/governance/proposals/${res.proposalId}/vote`, { decision: 'YES', reason: 'Faster patches benefit everyone' }, token);
      console.log(`  Vote cast on ${res.proposalId}: YES`);
    }
  }

  console.log('\n✓ Seed complete!');
  console.log(`  ${dummyCVEs.length} CVEs created`);
  console.log(`  ${dummyProposals.length} proposals created`);
  console.log(`  5 users created`);
  console.log('\nTest accounts:');
  console.log('  cna_alpha_admin / password123 (CNA_MEMBER)');
  console.log('  cna_beta_admin / password123 (CNA_MEMBER)');
  console.log('  regulator_admin / password123 (NATIONAL_BODY)');
  console.log('  researcher1 / password123 (RESEARCHER)');
  console.log('  public_user / password123 (PUBLIC)');
}

seed().catch(console.error);
