import { getFormInputs } from './scanner';
import { matchFieldWithConfidence } from '../mapping/rules';
import { setNativeValue } from './filler';
import { inferAnswerScope, isAnswerUsable, normalizeDomain } from '../shared/provenance';

console.log('AutoApply Content Script active');

function dataURLtoFile(dataurl: string, filename: string): File {
    let arr = dataurl.split(','),
        mimeMatch = arr[0].match(/:(.*?);/),
        mime = mimeMatch ? mimeMatch[1] : '',
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type: mime});
}

function resolvePath(obj: any, path: string): any {
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  return normalizedPath.split('.').reduce((prev, curr) => (prev == null ? undefined : prev[curr]), obj);
}

function getFieldLabel(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const labelText = Array.from(input.labels || []).map(label => label.textContent || '').join(' ').trim();
  if (labelText) return labelText;
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (text) return text;
  }
  return input.getAttribute('aria-label') || input.getAttribute('placeholder') || input.name || input.id || '';
}

function normalizeFieldPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

function getAnswerProvenance(label: string, fallbackScope: 'global' | 'company' = 'global') {
  const scope = inferAnswerScope(label, fallbackScope);
  return { scope, domain: scope === 'company' ? normalizeDomain(location.hostname) : undefined };
}

function performFormFill(profile: any): { filledCount: number; reviewFields: string[] } {
  const inputs = getFormInputs();
  let filledCount = 0;
  const reviewFields = new Set<string>();
  
  inputs.forEach((input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
    // Fill Resume File
    if (input instanceof HTMLInputElement && input.type === 'file' && profile.documents?.resumeBase64 && profile.documents?.resumeName) {
      try {
        const file = dataURLtoFile(profile.documents.resumeBase64, profile.documents.resumeName);
        if (input.accept && !input.accept.split(',').some(type => type.trim().startsWith('.')
          ? file.name.toLowerCase().endsWith(type.trim().toLowerCase())
          : file.type === type.trim())) return;
        if (input.files?.length && input.dataset.autofilled !== 'true') return;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        (input as HTMLInputElement).files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.style.border = '2px solid #22c55e';
        input.dataset.autofilled = 'true';
        filledCount++;
      } catch (e) { console.error('AutoApply: Failed to inject file', e); }
      return;
    }

    const hasExistingValue = input instanceof HTMLInputElement && (input.type === 'checkbox' || input.type === 'radio')
      ? input.checked
      : Boolean(input.value?.trim());
    if (hasExistingValue && input.dataset.autofilled !== 'true') return;

    const labelText = getFieldLabel(input);
    const normalizedLabel = labelText.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    const customMatch = Array.isArray(profile.customFields)
      ? profile.customFields.find((field: any) => field.label?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ') === normalizedLabel)
      : undefined;
    if (customMatch) {
      if (!isAnswerUsable(customMatch, location.hostname)) {
        reviewFields.add(labelText);
        return;
      }
      if (customMatch.value && setNativeValue(input, customMatch.value)) {
        input.style.border = '2px solid #22c55e';
        input.dataset.autofilled = 'true';
        filledCount++;
      }
      return;
    }

    const match = matchFieldWithConfidence(labelText, input.id, input.name, input.getAttribute('autocomplete') || '');
    
    if (match) {
      const value = resolvePath(profile, match.key);
      if (typeof value === 'string' && value.trim()) {
        const provenance = profile.fieldMetadata?.[normalizeFieldPath(match.key)];
        if (!isAnswerUsable(provenance, location.hostname)) {
          reviewFields.add(labelText);
          return;
        }
        if (match.confidence !== 'high') {
          reviewFields.add(labelText);
          return;
        }
      }
      if (typeof value === 'string' && setNativeValue(input, value)) {
        input.style.border = '2px solid #22c55e';
        input.dataset.autofilled = 'true';
        filledCount++;
        return;
      }
    }

  });
  
  return { filledCount, reviewFields: Array.from(reviewFields) };
}

chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'FILL_FORM') {
    const result = performFormFill(request.profile);
    sendResponse({ success: true, ...result });
  }
});

const resubmittingForms = new WeakSet<HTMLFormElement>();

function handleFormSubmit(event: SubmitEvent) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || resubmittingForms.has(form)) {
    if (form instanceof HTMLFormElement) resubmittingForms.delete(form);
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  const submitter = event.submitter instanceof HTMLElement ? event.submitter : undefined;
  chrome.storage.local.get(['profileVault'], (res) => {
    const profile: any = res.profileVault || {};
    const inputs = getFormInputs(form);
    
    let newCustomFields: { label: string, value: string }[] = [];
    let nativeUpdates: { keyPath: string, label: string, value: string }[] = [];

    inputs.forEach(input => {
      if (input instanceof HTMLInputElement && ['file', 'password', 'hidden', 'checkbox', 'radio'].includes(input.type)) return;
      
      const value = input.value?.trim();
      if (!value) return;

      // Ignore fields we just autofilled
      if (input.dataset.autofilled === 'true') return;

      const labelText = getFieldLabel(input).trim();
      if (!labelText) return;

      const match = matchFieldWithConfidence(labelText, input.id, input.name, input.getAttribute('autocomplete') || '');

      if (match?.confidence === 'high') {
        const existingVal = resolvePath(profile, match.key);
        // If native field is empty in profile, we should save it!
        if (typeof existingVal !== 'string' || existingVal.trim() === '') {
          nativeUpdates.push({ keyPath: match.key, label: labelText, value: value });
        }
      } else {
        // Not in schema. Is it in customFields?
        const customFields = Array.isArray(profile.customFields) ? profile.customFields : [];
        const alreadyHas = customFields.some((cf: any) => cf.label.toLowerCase() === labelText.toLowerCase());
        if (!alreadyHas && !newCustomFields.some(field => field.label.toLowerCase() === labelText.toLowerCase())) {
          newCustomFields.push({ label: labelText, value });
        }
      }
    });

    const resumeSubmission = () => {
      if (!form.isConnected) return;
      resubmittingForms.add(form);
      if (submitter && submitter.isConnected) form.requestSubmit(submitter as HTMLButtonElement);
      else form.requestSubmit();
    };

    if (newCustomFields.length === 0 && nativeUpdates.length === 0) {
      resumeSubmission();
      return;
    }

    nativeUpdates.forEach(update => {
      const path = update.keyPath.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = profile;
      for (const part of path.slice(0, -1)) {
        const index = Number(part);
        const key = /^\d+$/.test(part) ? index : part;
        if (target[key] == null) target[key] = typeof key === 'number' ? [] : {};
        target = target[key];
      }
      target[path[path.length - 1]] = update.value;
    });

    const updatedAt = Date.now();
    profile.fieldMetadata = { ...(profile.fieldMetadata || {}) };
    nativeUpdates.forEach(update => {
      profile.fieldMetadata[normalizeFieldPath(update.keyPath)] = {
        source: 'learned',
        confidence: 'high',
        ...getAnswerProvenance(update.label),
        updatedAt,
        verifiedAt: updatedAt,
      };
    });
    profile.customFields = [...(Array.isArray(profile.customFields) ? profile.customFields : []), ...newCustomFields.map(field => ({
      ...field,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: 'learned',
      confidence: 'high',
      ...getAnswerProvenance(field.label, 'company'),
      updatedAt,
      verifiedAt: updatedAt,
    }))];
    chrome.storage.local.set({ profileVault: profile }, resumeSubmission);
  });
}

document.addEventListener('submit', (event) => {
  handleFormSubmit(event as SubmitEvent);
}, true);
