#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('skills/nextjs-architecture');
const required = [
  'SKILL.md',
  'SKILL.ko.md',
  'architecture-rules.md',
  'architecture-rules.ko.md',
  'rules/project-structure.md',
  'rules/project-structure.ko.md',
  'rules/services.md',
  'rules/services.ko.md',
  'rules/hooks.md',
  'rules/hooks.ko.md',
  'rules/db.md',
  'rules/db.ko.md',
  'rules/routes.md',
  'rules/routes.ko.md',
  'rules/execution-model.md',
  'rules/execution-model.ko.md',
  'rules/data-fetching.md',
  'rules/data-fetching.ko.md',
  'rules/server-actions.md',
  'rules/server-actions.ko.md',
  'rules/route-handlers.md',
  'rules/route-handlers.ko.md',
  'rules/platform.md',
  'rules/platform.ko.md',
  'references/official/nextjs-docs.md',
  'references/official/nextjs-docs.ko.md',
  'references/official/current-docs-2026-06-02.md',
  'references/official/current-docs-2026-06-02.ko.md',
  'references/official/drizzle-docs.md',
  'references/official/drizzle-docs.ko.md',
  'rules/validation.md',
  'rules/validation.ko.md',
];

const mustContain = {
  'SKILL.md': ['cacheComponents', 'updateTag', 'Route Handlers', 'Proxy', 'Server Action', 'rules/project-structure.md', 'rules/services.md', 'rules/hooks.md', 'rules/db.md', 'references/official/drizzle-docs.md', 'instruction_contract', 'activation_examples', 'current-docs-2026-06-02'],
  'SKILL.ko.md': ['cacheComponents', 'updateTag', 'Route Handlers', 'Proxy', 'Server Action', 'rules/project-structure.ko.md', 'rules/services.ko.md', 'rules/hooks.ko.md', 'rules/db.ko.md', 'references/official/drizzle-docs.ko.md', 'instruction_contract', 'activation_examples', 'current-docs-2026-06-02'],
  'architecture-rules.md': ['Current Official Baselines', 'latest checked Next.js 16', 'cacheComponents', 'connection()', 'updateTag', 'middleware', 'Layer Taxonomy', 'src/modules', 'src/db', 'Drizzle schema/config/migrations', 'rules/project-structure.md', 'rules/services.md', 'rules/hooks.md', 'rules/db.md', 'current-docs-2026-06-02'],
  'architecture-rules.ko.md': ['현재 공식 기준선', 'Cache Components', 'connection()', 'updateTag', 'middleware', 'Layer Taxonomy', 'src/modules', 'src/db', 'Drizzle schema/config/migrations', 'rules/project-structure.ko.md', 'rules/services.ko.md', 'rules/hooks.ko.md', 'rules/db.ko.md'],
  'rules/project-structure.md': ['Project Structure', 'Nested Shared Folder Grouping', 'src/modules', 'src/lib', 'src/services', 'src/db', 'src/server', 'src/integrations', 'src/config', 'direct leaf', 'private folders', 'Hypercore local convention', 'not official Next.js requirement'],
  'rules/project-structure.ko.md': ['Project Structure', 'Nested Shared Folder Grouping', 'src/modules', 'src/services', 'src/db', 'src/server', 'src/integrations', 'src/config', 'direct leaf', 'private folders', 'Hypercore local convention', 'official Next.js requirement'],
  'rules/services.md': ['Services, DAL, and Provider Boundaries', 'DAL/service/provider boundaries', 'DTO', 'authorization', 'server-only helper', 'Route Handlers are public HTTP endpoints', 'src/integrations/<provider>'],
  'rules/services.ko.md': ['Services, DAL, Provider Boundaries', 'DAL/service/provider layering', 'DTO', 'authorization', 'server-only helper', 'Route Handlers는 public HTTP endpoints', 'src/integrations/<provider>'],
  'rules/hooks.md': ['Client Hooks and Orchestration Boundaries', 'client orchestration', 'server/data layers', 'Drizzle schema', 'private env', 'Server Action'],
  'rules/hooks.ko.md': ['Client Hooks and Orchestration Boundaries', 'client orchestration', 'server/data layer', 'Drizzle schema', 'private env', 'Server Action'],
  'rules/db.md': ['Database and Drizzle Boundaries', 'Drizzle schema', 'drizzle.config.ts', 'generate', 'migrate', 'prepared statements', 'RQB', 'validation integrations', 'Hypercore local convention'],
  'rules/db.ko.md': ['Database and Drizzle Boundaries', 'Drizzle schema', 'drizzle.config.ts', 'generate', 'migrate', 'prepared statements', 'RQB', 'validation integrations', 'Hypercore local convention'],
  'rules/data-fetching.md': ['`fetch` requests are not cached by default', 'use cache: remote', 'use cache: private', 'connection()', 'unstable_noStore', 'updateTag', "revalidateTag(tag, 'max')"],
  'rules/server-actions.md': ['reachable POST entry point', 'useActionState', 'refresh', 'updateTag'],
  'rules/route-handlers.md': ['HTTP method exports', 'RouteContext', 'params', 'cacheComponents', 'use cache', 'NextResponse.next()'],
  'rules/platform.md': ['Route Segment Config', "runtime: 'edge'", 'proxy.ts', 'Node.js runtime', 'middleware'],
  'references/official/nextjs-docs.md': ['Last verified: 2026-05-24', 'Next.js 16.2.6', 'https://r.jina.ai/https://nextjs.org/docs/', 'use cache: remote', 'Route Segment Config', 'Authentication', 'authInterrupts'],
  'references/official/current-docs-2026-06-02.md': ['checked_at: 2026-06-02', '/vercel/next.js', 'Next.js 16', 'cacheComponents', 'use cache: remote', 'Server Actions', 'Route Handlers', 'proxy.ts', 'NEXT_PUBLIC_', 'not official Next.js requirement'],
  'references/official/drizzle-docs.md': ['Official Drizzle Docs Summary', 'Drizzle schema', 'drizzle.config.ts', 'out', 'drizzle-kit generate', 'drizzle-kit migrate', 'push', 'pull', 'prepared statement', 'RQB', 'validation integrations'],
  'references/official/drizzle-docs.ko.md': ['Official Drizzle Docs Summary', 'Drizzle schema', 'drizzle.config.ts', 'out', 'drizzle-kit generate', 'drizzle-kit migrate', 'push', 'pull', 'prepared statement', 'RQB', 'validation integrations'],
  'rules/validation.md': ['Skill Anatomy Validation', 'current-docs-2026-06-02', 'src/services', 'src/modules', 'src/db', 'direct leaf', 'Deprecated feature-folder guidance is absent', 'Korean parity', 'mirror'],
  'rules/validation.ko.md': ['Skill Anatomy Validation', 'current-docs-2026-06-02', 'src/services', 'src/modules', 'src/db', 'direct leaf', 'Deprecated feature-folder guidance is absent', 'Korean parity', 'mirror'],
};

const errors = [];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing required file: ${rel}`);
}

for (const [rel, needles] of Object.entries(mustContain)) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) errors.push(`${rel} missing required phrase: ${needle}`);
  }
}

const skillLines = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8').split('\n').length;
if (skillLines > 300) errors.push(`SKILL.md too long: ${skillLines} lines > 300`);

const mdFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) mdFiles.push(full);
  }
}
walk(root);
for (const file of mdFiles) {
  const rel = path.relative(root, file);
  if (rel.endsWith('.ko.md')) continue;
  const koRel = rel.replace(/\.md$/, '.ko.md');
  if (!fs.existsSync(path.join(root, koRel))) errors.push(`${rel} missing Korean sibling ${koRel}`);
}

const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const directLinks = [...skill.matchAll(/`([^`]+\.md)`/g)].map((m) => m[1]);
for (const link of directLinks) {
  if (link.includes('../')) errors.push(`upward reference not allowed in SKILL.md: ${link}`);
  if (link.split('/').length > 3) errors.push(`reference chain too deep from SKILL.md: ${link}`);
}

if (errors.length) {
  console.error('nextjs-architecture skill validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  skillLines,
  checkedFiles: required.length,
  checkedMarkdownFiles: mdFiles.length,
  checks: ['required-files', 'official-baseline-phrases', 'services-hooks-db-drizzle-phrases', 'korean-phrase-parity', 'project-structure-rule', 'core-size', 'korean-siblings', 'reference-depth'],
}, null, 2));
