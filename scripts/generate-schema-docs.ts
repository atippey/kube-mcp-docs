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
const CRD_DIR = path.join(UPSTREAM_DIR, 'manifests', 'base', 'crds');
const EXAMPLES_FILE = path.join(
  UPSTREAM_DIR,
  'examples',
  'echo-server',
  'manifests',
  'example-resources.yaml',
);
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
  let text: string;
  try {
    text = await fs.readFile(EXAMPLES_FILE, 'utf8');
  } catch {
    // Examples file is optional; missing file just means no examples in reference docs.
    return out;
  }

  const docs = YAML.parseAllDocuments(text);
  for (const doc of docs) {
    try {
      const parsed = doc.toJSON() as Json;
      if (!parsed || typeof parsed !== 'object') continue;
      const kind = ensureString(parsed.kind);
      if (!kind) continue;
      if (!out.has(kind.toLowerCase())) {
        out.set(kind.toLowerCase(), doc.toString().trim());
      }
    } catch {
      // Keep going; malformed documents should not fail docs generation.
    }
  }

  return out;
}

// Static content appended to specific CRD pages after the auto-generated schema.
const CONDITION_DOCS: Record<string, string> = {
  MCPServer: `
# Condition reference

The operator sets three conditions on every MCPServer during reconciliation.

| Condition | Reason (True) | Reason (False) | Description |
| --- | --- | --- | --- |
| \`ToolsDiscovered\` | \`ResourcesFound\` | \`NoResourcesFound\` | At least one MCPTool, MCPPrompt, or MCPResource matched \`spec.toolSelector\` |
| \`ConfigReady\` | \`ConfigMapCreated\` | — | The generated ConfigMap containing tool/prompt/resource config was written successfully |
| \`Ready\` | \`DeploymentReady\` | \`DeploymentNotReady\` | The MCPServer Deployment has at least one ready replica |

See the [Observability guide](/guides/observability/) for diagnostic patterns using these conditions.

# Generated resources

For each MCPServer the operator creates the following resources (all named \`mcp-server-{name}-*\` and owned by the MCPServer for automatic cleanup):

| Resource | Name | Notes |
| --- | --- | --- |
| Deployment | \`mcp-server-{name}\` | Runs \`spec.image\` on port 8080 |
| Service | \`mcp-server-{name}\` | ClusterIP on port 8080, named \`http\` |
| ConfigMap | \`mcp-server-{name}-config\` | Mounted read-only at \`/etc/mcp/config\` with \`tools.json\`, \`prompts.json\`, \`resources.json\` |
| NetworkPolicy | \`mcp-server-{name}-egress\` | Auto-generated egress to Redis, DNS, and discovered tool/resource services |
| Ingress | \`mcp-server-{name}\` | Only when \`spec.ingress\` is configured |

The operator always injects two environment variables into the container before any user-provided \`spec.env\` entries:

| Variable | Value |
| --- | --- |
| \`REDIS_HOST\` | \`spec.redis.serviceName\` |
| \`MCP_CONFIG_DIR\` | \`/etc/mcp/config\` |

> **Note:** \`spec.config.requestTimeout\` and \`spec.config.maxConcurrentRequests\` are accepted by the CRD schema but are not yet consumed by the operator. They are reserved for a future release.
`,

  MCPTool: `
# Condition reference

| Condition | Reason | Status | Description |
| --- | --- | --- | --- |
| \`Ready\` | \`ServiceResolved\` | True | Named Service found; \`status.resolvedEndpoint\` contains the full URL |
| \`Ready\` | \`ServiceNotFound\` | False | Named Service does not exist in the namespace |

See the [Observability guide](/guides/observability/) for diagnostic patterns using these conditions.
`,

  MCPPrompt: `
# Condition reference

| Condition | Reason | Status | Description |
| --- | --- | --- | --- |
| \`Validated\` | \`TemplateValid\` | True | All \`&#123;&#123;variable&#125;&#125;\` placeholders are declared in \`spec.variables\` |
| \`Validated\` | \`UndeclaredVariables\` | False | Template references variables not listed in \`spec.variables\` |
| \`Validated\` | \`UnusedVariables\` | False | \`spec.variables\` declares names not referenced in the template |

See the [Observability guide](/guides/observability/) for diagnostic patterns using these conditions.
`,

  MCPResource: `
# Condition reference

| Condition | Reason | Status | Description |
| --- | --- | --- | --- |
| \`Ready\` | \`ContentValid\` | True | Inline \`spec.content\` validated successfully |
| \`Ready\` | \`OperationsValid\` | True | All \`spec.operations\` validated and service endpoints resolved |
| \`Ready\` | \`InvalidSpec\` | False | Neither \`spec.operations\` nor \`spec.content\` is defined |
| \`Ready\` | \`EmptyContent\` | False | \`spec.content\` has neither \`text\` nor \`blob\` |
| \`Ready\` | \`ServiceNotFound\` | False | A Service referenced in \`spec.operations\` does not exist in the namespace |

See the [Observability guide](/guides/observability/) for diagnostic patterns using these conditions.
`,
};

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

  if (CONDITION_DOCS[kind]) {
    sections.push(CONDITION_DOCS[kind]);
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
