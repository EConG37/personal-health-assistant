// Inspect the exact Git index before publishing. Private comparison values stay
// in memory; reports contain only repository-relative paths and finding types.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const git = args => execFileSync('git', args, {cwd: root, maxBuffer: 120 * 1024 * 1024});
const fingerprints = [];
function add(value, kind) {
  if (typeof value !== 'string' || value.length < 5) return;
  for (const encoding of ['utf8', 'utf16le']) fingerprints.push({kind, bytes: Buffer.from(value, encoding)});
}
add(os.homedir(), 'machine_home');
add(os.userInfo().username, 'machine_username');
add(root, 'workspace_path');
add(root.replace(/\\/g, '/'), 'workspace_path');
try { add(git(['config', '--global', '--get', 'user.email']).toString().trim(), 'personal_email'); } catch {}
const local = path.join(process.env.APPDATA || path.join(os.homedir(), 'Library', 'Application Support'), 'uric-acid-companion');
for (const name of ['data.json', 'feishu-credentials.enc']) {
  const file = path.join(local, name);
  if (!fs.existsSync(file)) continue;
  const bytes = fs.readFileSync(file);
  if (bytes.length > 32) fingerprints.push({kind: name === 'data.json' ? 'health_record' : 'encrypted_credentials', bytes});
  if (name !== 'data.json') continue;
  const data = JSON.parse(bytes.toString('utf8'));
  const collect = (value, key = '') => {
    if (['provider', 'identity', 'permission'].includes(key)) return;
    if (typeof value === 'string' && value.length >= 8) add(value, 'saved_connection');
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collect(v, k);
  };
  collect(data.sync);
  add(data.profile?.clinicianNote, 'clinician_note');
}
const patterns = [
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['github_token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['cloud_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['feishu_app_id', /\bcli_[A-Za-z0-9]{8,}\b/g],
  ['feishu_user_id', /\b(?:ou_|on_)[a-z0-9]{20,}\b/g],
  ['feishu_resource_url', /https:\/\/(?!test\.|example\.)[a-z0-9-]+\.(?:feishu\.cn|larksuite\.com)\/(?:base|wiki)\/[A-Za-z0-9]+/gi],
  ['machine_path', /[A-Z]:[\\/]+(?:Users|code building)[\\/]+[^\s<>"']+/gi],
  ['literal_secret', /(?:app_?secret|access_?token|refresh_?token|api_?key|password)\s*[=:]\s*["'][^"'\r\n]{8,}["']/gi]
];
// Exact, deliberately invalid fixtures used only by the isolated test harnesses.
// Real local fingerprints above are never exempted by these fixture rules.
const fixtures = {
  'scripts/test-interactions.js': {literal_secret: ["appSecret:'test-secret-987'", "appSecret:'test-secret'"]},
  'scripts/verify-ui.js': {literal_secret: ["appSecret:'isolated-test-secret'"]},
  'scripts/test-security.js': {feishu_resource_url: ['https://company.feishu.cn/base/ABCDEFGHIJKLMNO']}
};
const files = git(['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
const findings = [];
const exportDir = process.argv.includes('--export') ? fs.mkdtempSync(path.join(os.tmpdir(), 'health-github-index-')) : null;
let totalBytes = 0;
for (const file of files) {
  if (/(?:^|\/)(?:node_modules|dist|release|\.oil-ui|\.git|user-data|program-backups)(?:\/|$)|(?:^|\/)(?:data\.json|\.env(?:\..*)?|.*credentials.*|.*secrets.*|.*\.enc|.*\.log|.*\.bak)$|^docs\/research-handoff\/(?:downloads|build|acceptance(?:-r\d+)?)(?:\/|$)/i.test(file)) findings.push({file, kind: 'private_or_generated_file'});
  const bytes = git(['show', ':' + file]);
  if (exportDir) {
    const target = path.join(exportDir, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
  }
  totalBytes += bytes.length;
  for (const fingerprint of fingerprints) if (bytes.includes(fingerprint.bytes)) findings.push({file, kind: fingerprint.kind});
  if (/\.(?:js|cjs|json|html|css|md|txt|svg|ya?ml|ps1|sh|py|cs|toml)$/.test(file) || file === '.gitignore') {
    const text = bytes.toString('utf8');
    for (const [kind, regex] of patterns) {
      regex.lastIndex = 0;
      for (const match of text.matchAll(regex)) {
        if (fixtures[file]?.[kind]?.includes(match[0])) continue;
        if (file === 'scripts/audit-repository.js' && Object.values(fixtures).some(rules => rules[kind]?.includes(match[0]))) continue;
        findings.push({file, kind, line: text.slice(0, match.index).split('\n').length});
      }
    }
  }
}
const report = {scope: 'git_index', ok: findings.length === 0, files: files.length, bytes: totalBytes, findings};
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/privacy-repository.json'), JSON.stringify(report, null, 2) + '\n');
if (exportDir) fs.writeFileSync(path.join(root, 'dist/github-audit-export.json'), JSON.stringify({directory: exportDir}));
console.log(JSON.stringify(report));
if (!report.ok) process.exitCode = 1;
