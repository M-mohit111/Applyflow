import type { FieldProvenance } from './types';
import { inferAnswerScope } from './provenance';

export function removeImportedFieldMetadata(value: any, path: string[], metadata: Record<string, unknown>) {
  if (typeof value === 'string') {
    if (value.trim()) delete metadata[path.join('.')];
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => removeImportedFieldMetadata(item, [...path, String(index)], metadata));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (key !== 'id' && key !== 'fieldMetadata') {
        removeImportedFieldMetadata(child, [...path, key], metadata);
      }
    });
  }
}

export function mergeImportedValues(existing: any, imported: any): any {
  if (typeof imported === 'string') return imported.trim() ? imported : existing ?? imported;
  if (Array.isArray(imported)) {
    if (imported.length === 0) return existing ?? imported;
    const existingItems = Array.isArray(existing) ? existing : [];
    const mergedItems = imported.map((item, index) => mergeImportedValues(existingItems[index], item));
    return [...mergedItems, ...existingItems.slice(imported.length)];
  }
  if (imported && typeof imported === 'object') {
    const result = { ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}) };
    Object.entries(imported).forEach(([key, value]) => {
      if (key !== 'id') result[key] = mergeImportedValues(result[key], value);
    });
    return result;
  }
  return imported ?? existing;
}

function addLegacyFieldMetadata(value: any, path: string[], metadata: Record<string, FieldProvenance>, changed: { value: boolean }) {
  if (typeof value === 'string') {
    if (value.trim() && !metadata[path.join('.')]) {
      metadata[path.join('.')] = { source: 'legacy', confidence: 'medium', scope: inferAnswerScope(path.join('.')) };
      changed.value = true;
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => addLegacyFieldMetadata(item, [...path, String(index)], metadata, changed));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (key !== 'id' && key !== 'fieldMetadata' && key !== 'resumeBase64') {
        addLegacyFieldMetadata(child, [...path, key], metadata, changed);
      }
    });
  }
}

export function migrateLegacyProfile(profile: any): { profile: any; changed: boolean } {
  const changed = { value: false };
  const fieldMetadata = { ...(profile.fieldMetadata || {}) };
  Object.entries(profile).forEach(([section, value]) => {
    if (section !== 'fieldMetadata' && section !== 'customFields') {
      addLegacyFieldMetadata(value, [section], fieldMetadata, changed);
    }
  });
  const existingCustomFields = Array.isArray(profile.customFields) ? profile.customFields : [];
  const customFields = existingCustomFields
    .filter((field: any) => field && typeof field.label === 'string' && typeof field.value === 'string')
    .map((field: any) => {
      if (field.id && field.source && field.confidence && field.scope) return field;
      changed.value = true;
      return {
        ...field,
        source: field.source || 'legacy',
        confidence: field.confidence || 'medium',
        id: field.id || crypto.randomUUID(),
        scope: field.scope || inferAnswerScope(field.label, 'company'),
      };
    });
  if (customFields.length !== existingCustomFields.length) changed.value = true;
  return { profile: { ...profile, fieldMetadata, customFields }, changed: changed.value };
}