import type { AnswerScope, FieldProvenance } from './types';

export function inferAnswerScope(value: string, fallbackScope: AnswerScope = 'global'): AnswerScope {
  const normalized = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const companySpecific = /company specific questions/.test(normalized)
    || /why .* (company|organization|startup|role|opportunity|join|work here)/.test(normalized)
    || /what .* (company|role|opportunity)/.test(normalized)
    || /expected salary|expected .* salary|current salary|current .* salary|expected ctc|expected .* ctc|current ctc|current .* ctc|salary expectations|notice period|start date|joining date/.test(normalized)
    || /sponsorship|visa|work authorization|authorized to work/.test(normalized)
    || /\bavailability\b/.test(normalized);
  return companySpecific ? 'company' : fallbackScope;
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/:?#]/)[0];
}

export function matchesDomain(currentHost: string, expectedDomain?: string): boolean {
  if (!expectedDomain) return false;
  const expected = normalizeDomain(expectedDomain);
  const current = normalizeDomain(currentHost);
  return current === expected || current.endsWith(`.${expected}`);
}

export function isAnswerUsable(provenance: FieldProvenance | undefined, currentHost: string): boolean {
  if (!provenance || provenance.confidence !== 'high') return false;
  if (provenance.source === 'ai_import' && !provenance.verifiedAt) return false;
  if (provenance.scope === 'company' && !matchesDomain(currentHost, provenance.domain)) return false;
  return true;
}