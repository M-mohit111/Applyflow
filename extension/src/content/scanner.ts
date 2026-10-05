type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function getFormInputs(root: Document | Element | ShadowRoot = document): FormControl[] {
  const inputs: (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] = [];
  
  function scanNode(node: Document | Element | ShadowRoot) {
    const elements = Array.from(node.querySelectorAll('input, select, textarea')) as FormControl[];
    for (const el of elements) {
      const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : '';
      const descriptor = [el.name, el.id, el.getAttribute('autocomplete'), el.getAttribute('aria-label'), el.getAttribute('placeholder')]
        .filter(Boolean).join(' ').toLowerCase();

      if (['hidden', 'submit', 'button', 'reset', 'image', 'password'].includes(type)) continue;
      if (el.disabled || el.getAttribute('aria-hidden') === 'true' || el.getClientRects().length === 0) continue;
      if (/captcha|turnstile|recaptcha|credit.?card|card.?number|cc-number|cc-csc|cvv|\bssn\b|social.?security|bank.?account|routing.?number|current.?password|new.?password/.test(descriptor)) continue;

      inputs.push(el);
    }
    
    for (const child of Array.from(node.querySelectorAll('*'))) {
      if (child.shadowRoot) {
        scanNode(child.shadowRoot);
      }
    }
  }
  
  scanNode(root);
  
  // Deduplicate just in case
  return Array.from(new Set(inputs));
}
