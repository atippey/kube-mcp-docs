import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

type Json = Record<string, unknown>;

type SchemaNode = {
  type?: string;
  description?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  additionalProperties?: boolean | SchemaNode;
  oneOf?: SchemaNode[];
  anyOf?: SchemaNode[];
  allOf?: SchemaNode[];
  format?: string;
  default?: unknown;
};

type CrdDoc = {
  spec?: {
    group?: string;
    names?: { kind?: string };
    versions?: Array<{
      name?: string;
      schema?: {
        openAPIV3Schema?: SchemaNode;
      };
    }>;
  };
};

const ROOT = process.cwd();
const UPSTREAM_DIR = path.join(ROOT, 'ext', 'kube-mcp');
const CRD_DIR = path.join(UPSTREAM_DIR, 'crd');
const EXAMPLES_FILE = path.join(CRD_DIR, 'examples.yaml');
const OUT_DIR = path.join(ROOT, 'src', 'content', 'docs', 'reference');

function ensureString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeCell(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\n/g, '<br />');
}

function formatType(node: SchemaNode): string {
  if (node.oneOf?.length) {
    return node.oneOf.map(formatType).join(' | ');
  }
  if (node.anyOf?.length) {
    return node.anyOf.map(formatType).join(' | ');
  }
  if (node.allOf?.length) {
    return node.allOf.map(formatType).join(' & ');
  }

  if (node.type === 'array') {
    if (!node.items) return 'array';
    return `array<${formatType(node.items)}>`;
  }

  if (node.type === 'object') {
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      return `map<string, ${formatType(node.additionalProperties)}>`;
    }
    return 'object';
  }

  const baseType = node.type ?? 'unknown';
  const enumSuffix = node.enum?.length
    ? ` (${node.enum.map((v) => JSON.stringify(v)).join(', ')})`
    : '';
  const formatSuffix = node.format ? ` [${node.format}]` : '';
  return `${baseType}${formatSuffix}${enumSuffix}`;
}

function formatDefault(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function headingForPath(nodePath: string): string {
  if (nodePath === '#') return 'Root';
  return nodePath.replace(/^#\.?/, '');
}

function toObjectEntries(node: SchemaNode): Array<[string, SchemaNode]> {
  return Object.entries(node.properties ?? {});
}

function buildSection(nodePath: string, node: SchemaNode): string {
  const rows: string[] = [];
  const required = new Set(node.required ?? []);

  for (const [name, child] of toObjectEntries(node)) {
    const description = normalizeDescription(ensureString(child.description, ''));
    rows.push(
      `| \`${name}\` | \`${escapeCell(formatType(child))}\` | ${required.has(name) ? 'Yes' : 'No'} | ${escapeCell(description || '—')} | ${escapeCell(formatDefault(child.default) || '—')} |`,
    );
  }

  const blocks: string[] = [];
  blocks.push(`## ${headingForPath(nodePath)}`);
  if (node.description) {
    blocks.push('', normalizeDescription(node.description));
  }

  if (rows.length) {
    blocks.push(
      '',
      '| Field | Type | Required | Description | Default |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
    );
  } else {
    blocks.push('', '_No direct properties at this level._');
  }

  for (const [name, child] of toObjectEntries(node)) {
    const childPath = nodePath === '#' ? `#.${name}` : `${nodePath}.${name}`;

    if (child.type === 'object' && child.properties && Object.keys(child.properties).length > 0) {
      blocks.push('', buildSection(childPath, child));
      continue;
    }

    if (child.type === 'array' && child.items?.type === 'object' && child.items.properties) {
      blocks.push('', buildSection(`${childPath}[]`, child.items));
    }
  }

  return blocks.join('\n');
}

async function loadExamplesByKind(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const text = await fs.readFile(EXAMPLES_FILE, 'utf8');
  const codeBlockRegex = /```yaml\n([\s\S]*?)```/g;

  for (const match of text.matchAll(codeBlockRegex)) {
    const yamlSnippet = match[1].trim();
    try {
      const docs = YAML.parseAllDocuments(yamlSnippet);
      for (const doc of docs) {
        const parsed = doc.toJSON() as Json;
        const kind = ensureString(parsed.kind);
        if (!kind) continue;
        if (!out.has(kind.toLowerCase())) {
          out.set(kind.toLowerCase(), yamlSnippet);
        }
      }
    } catch {
      // Keep going; malformed example snippets should not fail docs generation.
    }
  }

  return out;
}

function mdxForCrd(args: {
  kind: string;
  group: string;
  version: string;
  schema: SchemaNode;
  example?: string;
}): string {
  const { kind, group, version, schema, example } = args;
  const title = kind;
  const slug = kind.toLowerCase();

  const sections = [
    '---',
    `title: ${title}`,
    `description: Auto-generated CRD schema reference for ${kind}`,
    '---',
    '',
    '> This page is auto-generated by `scripts/generate-schema-docs.ts`. Do not edit manually.',
    '',
    `- **Kind:** \`${kind}\``,
    `- **API Group:** \`${group}\``,
    `- **Version:** \`${version}\``,
    `- **apiVersion:** \`${group}/${version}\``,
    `- **Reference Slug:** \`/reference/${slug}/\``,
    '',
    '# Schema',
    '',
    buildSection('#', schema),
  ];

  if (example) {
    sections.push('', '# Example', '', '```yaml', example, '```');
  }

  return sections.join('\n');
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const examplesByKind = await loadExamplesByKind();

  const files = (await fs.readdir(CRD_DIR))
    .filter((name) => name.endsWith('-crd.yaml'))
    .map((name) => path.join(CRD_DIR, name));

  for (const filePath of files) {
    const fileText = await fs.readFile(filePath, 'utf8');
    const docs = YAML.parseAllDocuments(fileText);

    for (const doc of docs) {
      const parsed = doc.toJSON() as CrdDoc;
      const kind = ensureString(parsed.spec?.names?.kind);
      if (!kind) continue;

      const group = ensureString(parsed.spec?.group);
      const version = ensureString(parsed.spec?.versions?.[0]?.name);
      const schema = parsed.spec?.versions?.[0]?.schema?.openAPIV3Schema;

      if (!schema) {
        throw new Error(`Missing openAPIV3Schema for ${kind} in ${filePath}`);
      }

      const output = mdxForCrd({
        kind,
        group,
        version,
        schema,
        example: examplesByKind.get(kind.toLowerCase()),
      });

      const outFile = path.join(OUT_DIR, `${kind.toLowerCase()}.mdx`);
      await fs.writeFile(outFile, output, 'utf8');
      console.log(`Generated ${path.relative(ROOT, outFile)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
