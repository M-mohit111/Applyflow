import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const typescript = require('typescript');
const moduleCache = new Map();

function loadTypeScript(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath);

  const loadedModule = { exports: {} };
  moduleCache.set(resolvedPath, loadedModule.exports);
  const source = readFileSync(resolvedPath, 'utf8');
  const javascript = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = specifier => specifier.startsWith('.')
    ? loadTypeScript(path.resolve(path.dirname(resolvedPath), `${specifier}.ts`))
    : require(specifier);

  new Function('require', 'module', 'exports', javascript)(localRequire, loadedModule, loadedModule.exports);
  moduleCache.set(resolvedPath, loadedModule.exports);
  return loadedModule.exports;
}

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const { matchFieldWithConfidence } = loadTypeScript(path.join(sourceRoot, 'mapping/rules.ts'));
const { inferAnswerScope, isAnswerUsable, matchesDomain } = loadTypeScript(path.join(sourceRoot, 'shared/provenance.ts'));
const { mergeImportedValues, migrateLegacyProfile, removeImportedFieldMetadata } = loadTypeScript(path.join(sourceRoot, 'shared/profileImport.ts'));

test('field matches carry confidence and preserve repeated record indexes', () => {
  assert.deepEqual(matchFieldWithConfidence('Email Address', '', ''), {
    key: 'contactDetails.personalEmail',
    confidence: 'high',
  });
  assert.deepEqual(matchFieldWithConfidence('Project 2 Name', '', 'project_2_name'), {
    key: 'projects[1].projectName',
    confidence: 'high',
  });
  assert.equal(matchFieldWithConfidence('Position', '', '').confidence, 'medium');
  assert.equal(matchFieldWithConfidence('C', '', '').confidence, 'low');
  assert.equal(matchFieldWithConfidence('Completely Unrelated', '', ''), null);
});

test('answer scope detects contextual answers and respects hostname boundaries', () => {
  assert.equal(inferAnswerScope('Why this company'), 'company');
  assert.equal(inferAnswerScope('Expected Salary'), 'company');
  assert.equal(inferAnswerScope('Favorite programming language'), 'global');
  assert.equal(inferAnswerScope('Unrecognized application question', 'company'), 'company');
  assert.equal(matchesDomain('careers.example.com', 'example.com'), true);
  assert.equal(matchesDomain('example-company.com', 'example.com'), false);
  assert.equal(matchesDomain('other.com', ''), false);
});

test('autofill requires confirmed high-confidence provenance and matching scope', () => {
  const manualAnswer = { source: 'manual', confidence: 'high', scope: 'global', updatedAt: 10 };
  const importedButUnconfirmed = { source: 'ai_import', confidence: 'high', scope: 'global', updatedAt: 10 };
  const companyAnswer = { source: 'learned', confidence: 'high', scope: 'company', domain: 'example.com', updatedAt: 10 };

  assert.equal(isAnswerUsable(manualAnswer, 'jobs.other.com'), true);
  assert.equal(isAnswerUsable(importedButUnconfirmed, 'jobs.other.com'), false);
  assert.equal(isAnswerUsable({ ...importedButUnconfirmed, verifiedAt: 11 }, 'jobs.other.com'), true);
  assert.equal(isAnswerUsable(companyAnswer, 'careers.example.com'), true);
  assert.equal(isAnswerUsable(companyAnswer, 'other.com'), false);
  assert.equal(isAnswerUsable({ ...manualAnswer, confidence: 'medium' }, 'jobs.other.com'), false);
});

test('blank AI template values preserve confirmed values and their provenance', () => {
  const existing = {
    personalInformation: { firstName: 'Asha', lastName: 'Rao' },
    projects: [
      { id: 'project-one', projectName: 'Existing project', projectLink: 'https://example.com' },
      { id: 'project-two', projectName: 'Second project', projectLink: '' },
    ],
  };
  const imported = {
    personalInformation: { firstName: '', lastName: 'Mehta' },
    projects: [{ projectName: '', projectLink: 'https://new.example.com' }],
  };
  const metadata = {
    'personalInformation.firstName': { source: 'manual', confidence: 'high' },
    'personalInformation.lastName': { source: 'manual', confidence: 'high' },
    'projects.0.projectName': { source: 'manual', confidence: 'high' },
    'projects.0.projectLink': { source: 'manual', confidence: 'high' },
  };

  const merged = mergeImportedValues(existing, imported);
  removeImportedFieldMetadata(imported.personalInformation, ['personalInformation'], metadata);
  removeImportedFieldMetadata(imported.projects, ['projects'], metadata);

  assert.equal(merged.personalInformation.firstName, 'Asha');
  assert.equal(merged.personalInformation.lastName, 'Mehta');
  assert.equal(merged.projects[0].id, 'project-one');
  assert.equal(merged.projects[0].projectName, 'Existing project');
  assert.equal(merged.projects[0].projectLink, 'https://new.example.com');
  assert.equal(merged.projects[1].projectName, 'Second project');
  assert.equal(metadata['personalInformation.firstName'].source, 'manual');
  assert.equal(metadata['personalInformation.lastName'], undefined);
  assert.equal(metadata['projects.0.projectName'].source, 'manual');
  assert.equal(metadata['projects.0.projectLink'], undefined);
});

test('legacy profiles migrate without trusting old answers or losing custom answers', () => {
  const migrated = migrateLegacyProfile({
    personalInformation: { firstName: 'Asha' },
    customFields: [{ label: 'What is your favorite hobby?', value: 'Gardening' }, null],
  });

  assert.equal(migrated.changed, true);
  assert.deepEqual(migrated.profile.fieldMetadata['personalInformation.firstName'], {
    source: 'legacy',
    confidence: 'medium',
    scope: 'global',
  });
  assert.equal(migrated.profile.customFields.length, 1);
  assert.equal(migrated.profile.customFields[0].value, 'Gardening');
  assert.equal(migrated.profile.customFields[0].source, 'legacy');
  assert.equal(migrated.profile.customFields[0].confidence, 'medium');
  assert.equal(migrated.profile.customFields[0].scope, 'company');
  assert.ok(migrated.profile.customFields[0].id);

  const migratedAgain = migrateLegacyProfile(migrated.profile);
  assert.equal(migratedAgain.changed, false);
});