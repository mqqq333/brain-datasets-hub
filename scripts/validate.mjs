#!/usr/bin/env node
// Validate every data/datasets/*.yaml against schema/dataset.schema.json and
// check cross-record referential integrity. Exits 1 on any error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data', 'datasets');
const schemaPath = path.join(root, 'schema', 'dataset.schema.json');

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v) => (Array.isArray(v) ? v : []);
const rel = (file) => path.relative(root, file).split(path.sep).join('/');

function formatAjvErrors(errors, schema) {
  // Drop the noisy child errors that accompany a failing oneOf/anyOf at the
  // same location; the parent error plus its params is more useful.
  const branches = new Map(
    (errors ?? [])
      .filter((e) => e.keyword === 'oneOf' || e.keyword === 'anyOf')
      .map((e) => [e.instancePath, e.schemaPath]),
  );
  const describeBranch = (schemaPath) => {
    const match = /^(#\/\$defs\/[^/]+)\//.exec(schemaPath ?? '');
    const def = match ? schema.$defs?.[match[1].slice('#/$defs/'.length)] : null;
    const branchTitles = (def?.anyOf ?? def?.oneOf ?? [])
      .map((b) => b.type ?? (b.const ? JSON.stringify(b.const) : null))
      .filter(Boolean);
    return branchTitles.length
      ? ` expected ${branchTitles.join(' or ')}`
      : '';
  };

  return (errors ?? [])
    .filter(
      (e) =>
        !(
          branches.has(e.instancePath) &&
          e.keyword !== 'oneOf' &&
          e.keyword !== 'anyOf'
        ),
    )
    .map((e) => {
      const where = e.instancePath || '/';
      const params = Object.entries(e.params ?? {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      const hint =
        e.keyword === 'anyOf' || e.keyword === 'oneOf'
          ? describeBranch(e.schemaPath)
          : '';
      return `schema ${where}: ${e.message}${params ? ` (${params})` : ''}${hint}`;
    });
}

/** Find every `source_refs` array nested anywhere in the record. */
function collectSourceRefs(node, at, out) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectSourceRefs(v, `${at}[${i}]`, out));
  } else if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      const here = `${at}.${key}`;
      if (key === 'source_refs' && Array.isArray(value)) {
        value.forEach((ref, i) => {
          if (typeof ref === 'string') out.push({ ref, at: `${here}[${i}]` });
        });
      }
      collectSourceRefs(value, here, out);
    }
  }
}

function checkReferences(doc, errors) {
  const sources = new Set(
    asArray(doc.sources)
      .filter((s) => isObject(s) && typeof s.id === 'string')
      .map((s) => s.id),
  );
  const channels = new Set(
    asArray(doc.access_channels)
      .filter((c) => isObject(c) && typeof c.id === 'string')
      .map((c) => c.id),
  );
  const subsets = new Set();
  const subsetLocations = [];

  asArray(doc.releases).forEach((release, ri) => {
    asArray(release?.subsets).forEach((subset, si) => {
      if (!isObject(subset) || typeof subset.id !== 'string') return;
      subsets.add(subset.id);
      subsetLocations.push({ id: subset.id, at: `/releases[${ri}]/subsets[${si}]` });
      asArray(subset.channels).forEach((ref, ci) => {
        if (typeof ref === 'string' && !channels.has(ref)) {
          errors.push(
            `ref /releases[${ri}]/subsets[${si}]/channels[${ci}]: unknown access_channels id ${JSON.stringify(ref)}`,
          );
        }
      });
    });
  });

  asArray(doc.access_channels).forEach((channel, ci) => {
    asArray(channel?.covers).forEach((ref, i) => {
      if (typeof ref === 'string' && !subsets.has(ref)) {
        errors.push(
          `ref /access_channels[${ci}]/covers[${i}]: unknown subset id ${JSON.stringify(ref)}`,
        );
      }
    });
  });

  const refs = [];
  collectSourceRefs(doc, '', refs);
  for (const { ref, at } of refs) {
    if (!sources.has(ref)) {
      errors.push(`ref ${at || '/'}: unknown sources id ${JSON.stringify(ref)}`);
    }
  }

  // Ids used as foreign-key targets must themselves be unique within a file.
  for (const [label, items, location] of [
    ['subset', subsetLocations, '/releases[].subsets[].id'],
    [
      'access channel',
      asArray(doc.access_channels).map((c, i) => ({ id: c?.id, at: `/access_channels[${i}]/id` })),
      '/access_channels[].id',
    ],
    [
      'source',
      asArray(doc.sources).map((s, i) => ({ id: s?.id, at: `/sources[${i}]/id` })),
      '/sources[].id',
    ],
  ]) {
    const seen = new Map();
    for (const { id, at } of items) {
      if (typeof id !== 'string') continue;
      if (seen.has(id)) {
        errors.push(
          `ref ${at}: duplicate ${label} id ${JSON.stringify(id)} (first used at ${seen.get(id)}, ${location})`,
        );
      } else {
        seen.set(id, at);
      }
    }
  }

  const v = doc.verification;
  if (
    isObject(v) &&
    typeof v.last_verified === 'string' &&
    typeof v.review_due === 'string' &&
    v.review_due < v.last_verified
  ) {
    errors.push(
      `ref /verification/review_due: ${v.review_due} is earlier than last_verified ${v.last_verified}`,
    );
  }
}

function main() {
  if (!fs.existsSync(dataDir)) {
    console.log(`Notice: ${rel(dataDir)} does not exist yet; nothing to validate.`);
    return 0;
  }

  const files = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.yaml') && !e.name.startsWith('_'))
    .map((e) => path.join(dataDir, e.name))
    .sort();

  if (files.length === 0) {
    console.log(`Notice: no dataset YAML files in ${rel(dataDir)}; nothing to validate.`);
    return 0;
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (err) {
    console.error(`FATAL: cannot read ${rel(schemaPath)}: ${err.message}`);
    return 1;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const results = [];
  const idOwners = new Map(); // id -> first file that declared it

  for (const file of files) {
    const errors = [];
    let doc;
    try {
      // JSON_SCHEMA keeps unquoted YYYY-MM-DD / YYYY as strings (the core
      // YAML schema parses timestamps into Date objects), while still parsing
      // numbers, booleans and null normally.
      doc = yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA });
    } catch (err) {
      errors.push(`yaml: ${err.message.split('\n')[0]}`);
    }

    if (doc !== undefined) {
      if (!isObject(doc)) {
        errors.push('schema /: must be an object');
      } else {
        if (!validate(doc)) errors.push(...formatAjvErrors(validate.errors, schema));

        const expectedName = typeof doc.id === 'string' ? `${doc.id}.yaml` : null;
        if (expectedName === null || path.basename(file) !== expectedName) {
          errors.push(
            `filename: ${path.basename(file)} must equal id + ".yaml" (${expectedName ?? 'id missing or not a string'})`,
          );
        }
        if (typeof doc.id === 'string') {
          const owner = idOwners.get(doc.id);
          if (owner) {
            errors.push(`id: duplicate dataset id ${JSON.stringify(doc.id)} (also in ${rel(owner)})`);
          } else {
            idOwners.set(doc.id, file);
          }
        }
        checkReferences(doc, errors);
      }
    }
    results.push({ file, errors });
  }

  let totalErrors = 0;
  for (const { file, errors } of results) {
    if (errors.length === 0) {
      console.log(`OK   ${rel(file)}`);
    } else {
      totalErrors += errors.length;
      console.log(`FAIL ${rel(file)}`);
      for (const error of errors) console.log(`  - ${error}`);
    }
  }

  if (totalErrors > 0) {
    console.log(`\n${totalErrors} error(s) in ${results.length} file(s) checked.`);
    return 1;
  }
  console.log(`\nAll ${results.length} dataset file(s) valid.`);
  return 0;
}

process.exitCode = main();
