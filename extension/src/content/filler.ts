export function setNativeValue(el: HTMLElement, value: string): boolean {
  if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly || !value) return false;
  const normalizedValue = value.trim().toLowerCase();

  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const labelText = Array.from(el.labels || []).map(label => label.textContent || '').join(' ').trim().toLowerCase();
    const shouldCheck = el.type === 'radio'
      ? [el.value.trim().toLowerCase(), labelText].some(candidate => candidate === normalizedValue)
      : [el.value.trim().toLowerCase(), labelText].some(candidate => candidate === normalizedValue);

    if (shouldCheck && !el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  if (el instanceof HTMLSelectElement) {
    const option = Array.from(el.options).find(candidate =>
      candidate.value.trim().toLowerCase() === normalizedValue || candidate.text.trim().toLowerCase() === normalizedValue,
    );
    if (option && el.value !== option.value) {
      el.value = option.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  if (el instanceof HTMLInputElement && el.type === 'file') return false;
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const setter = descriptor ? descriptor.set : undefined;
  
  let normalizedInputValue = value;
  if (el instanceof HTMLInputElement && el.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dayFirstDate = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
    if (!dayFirstDate) return false;
    normalizedInputValue = `${dayFirstDate[3]}-${dayFirstDate[2].padStart(2, '0')}-${dayFirstDate[1].padStart(2, '0')}`;
  }

  if ((el as HTMLInputElement).value === normalizedInputValue) return false;
  el.focus();
  if (setter) {
    setter.call(el, normalizedInputValue);
  } else {
    (el as HTMLInputElement).value = normalizedInputValue;
  }
  if (!(el as HTMLInputElement).value) return false;
  
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
  return true;
}
