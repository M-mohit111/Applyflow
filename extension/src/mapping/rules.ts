import { applicationSchema } from '../shared/schema';

type FieldPattern = { key: string; label: string; pattern: RegExp };
const fieldPatterns: FieldPattern[] = [];

export type MatchConfidence = 'high' | 'medium' | 'low';
export interface FieldMatch {
  key: string;
  confidence: MatchConfidence;
}

applicationSchema.forEach(section => {
  section.fields.forEach(field => fieldPatterns.push({
    key: `${section.id}${section.isArray ? '[0]' : ''}.${field.id}`,
    label: field.label,
    pattern: field.regex,
  }));
});

const aliases: Record<string, string> = {
  email: 'contactDetails.personalEmail',
  phone: 'contactDetails.mobileNumber',
  tel: 'contactDetails.mobileNumber',
  'address-line1': 'contactDetails.addressLine1',
  'address-line2': 'contactDetails.addressLine2',
  'address-level2': 'contactDetails.city',
  'address-level1': 'contactDetails.state',
  'postal-code': 'contactDetails.pinCode',
  'country-name': 'contactDetails.country',
  'given-name': 'personalInformation.firstName',
  'family-name': 'personalInformation.lastName',
  'birthdate': 'personalInformation.dateOfBirth',
};

function normalize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return (` ${text} `).includes(` ${phrase} `);
}

export function matchFieldWithConfidence(label: string, id: string, name: string, autocomplete = ''): FieldMatch | null {
  const combined = [label, id, name, autocomplete].filter(Boolean).join(' ');
  const normalized = normalize(combined);
  const normalizedForScoring = normalized.replace(/\b(project|experience|internship|education)\s+\d+\s+/g, '$1 ');
  const normalizedLabel = normalize(label);
  const normalizedAttributes = normalize(`${id} ${name}`);
  const alias = aliases[autocomplete.toLowerCase()];
  if (alias) return { key: alias, confidence: 'high' };
  if (/^(email|email address)$/.test(normalizedLabel)) return { key: 'contactDetails.personalEmail', confidence: 'high' };
  if (/^(phone|phone number|telephone|mobile|mobile number)$/.test(normalizedLabel)) return { key: 'contactDetails.mobileNumber', confidence: 'high' };
  const workHistoryContext = /\b(work experience|employer|employment|experience)\b/.test(normalizedAttributes);
  if (normalizedLabel === 'current salary') {
    return { key: workHistoryContext ? 'workExperience[0].currentSalary' : 'salaryCompensation.currentSalary', confidence: 'high' };
  }
  if (normalizedLabel === 'current ctc') {
    return { key: workHistoryContext ? 'workExperience[0].currentCtc' : 'salaryCompensation.currentCtc', confidence: 'high' };
  }
  if (normalizedLabel === 'notice period') {
    return { key: workHistoryContext ? 'workExperience[0].noticePeriod' : 'availability.noticePeriod', confidence: 'high' };
  }

  const matches = fieldPatterns
    .filter(({ pattern }) => pattern.test(combined))
    .map(field => {
      const fieldLabel = normalize(field.label);
      const keyLabel = normalize(field.key.split('.').at(-1) || '');
      const score = (fieldLabel && containsPhrase(normalizedForScoring, fieldLabel) ? 10000 + fieldLabel.length : 0)
        + (keyLabel && containsPhrase(normalizedForScoring, keyLabel) ? 5000 + keyLabel.length : 0)
        + Math.min(field.pattern.source.length, 100);
      const exactPhrase = fieldLabel === normalizedLabel
        || keyLabel === normalizedLabel
        || (fieldLabel.length >= 3 && containsPhrase(normalizedForScoring, fieldLabel));
      const confidence: MatchConfidence = normalizedLabel.length < 2 || field.pattern.source.length <= 3
        ? 'low'
        : exactPhrase ? 'high' : 'medium';
      return { field, score, confidence, exactPhrase };
    })
    .sort((left, right) => right.score - left.score);

  const rankedMatch = matches[0];
  if (!rankedMatch) return null;
  if (rankedMatch.confidence === 'low' && !rankedMatch.exactPhrase) return null;

  const indexMatch = combined.match(/(?:project|experience|internship|education)\s*[_#-]?\s*(\d+)/i);
  const key = rankedMatch.field.key.includes('[0]') && indexMatch
    ? rankedMatch.field.key.replace('[0]', `[${Math.max(0, Number(indexMatch[1]) - 1)}]`)
    : rankedMatch.field.key;
  const tiedMatch = matches[1]?.score === rankedMatch.score;
  const confidence = tiedMatch && rankedMatch.confidence === 'high' ? 'medium' : rankedMatch.confidence;

  return { key, confidence };
}

export function matchField(label: string, id: string, name: string, autocomplete = ''): string | null {
  return matchFieldWithConfidence(label, id, name, autocomplete)?.key || null;
}
