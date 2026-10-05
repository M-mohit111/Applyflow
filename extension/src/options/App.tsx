import React, { useState, useEffect } from 'react';
import { applicationSchema, SectionSchema } from '../shared/schema';
import { FieldProvenance } from '../shared/types';
import { inferAnswerScope, normalizeDomain } from '../shared/provenance';
import { mergeImportedValues, migrateLegacyProfile, removeImportedFieldMetadata } from '../shared/profileImport';
import { CheckCircle2, Plus, Trash2, Zap, FileText, ChevronDown, ChevronUp, Bot, Sparkles, Code, Sun, Moon, Download, FileUp } from 'lucide-react';

function collectImportedFieldMetadata(value: any, path: string[], metadata: Record<string, FieldProvenance>, updatedAt: number) {
  if (typeof value === 'string') {
    if (value.trim()) metadata[path.join('.')] = { source: 'ai_import', confidence: 'medium', scope: inferAnswerScope(path.join('.')), updatedAt };
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImportedFieldMetadata(item, [...path, String(index)], metadata, updatedAt));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (key !== 'id' && key !== 'fieldMetadata') {
        collectImportedFieldMetadata(child, [...path, key], metadata, updatedAt);
      }
    });
  }
}

function createManualProvenance(previous?: FieldProvenance, fallbackScope: 'global' | 'company' = 'global'): FieldProvenance {
  const now = Date.now();
  return { source: 'manual', confidence: 'high', scope: previous?.scope || fallbackScope, domain: previous?.domain, updatedAt: now, verifiedAt: now };
}

const SectionCard = ({ section, profile, updateNested, addArrayItem, updateArrayItem, removeArrayItem, updateFieldScope }: any) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const getIcon = (_iconName: string) => <CheckCircle2 size={18} className="text-blue-400" />;

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/60 rounded-xl shadow-sm overflow-hidden mb-6">
      <div 
        className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            {getIcon(section.icon)}
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 tracking-wide">{section.title}</h3>
        </div>
        <div className="flex items-center gap-4">
          {section.isArray && isOpen && (
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); addArrayItem(section.id); }} 
              className="text-xs flex items-center gap-1 bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          )}
          <span className="text-slate-500">
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          {section.isArray ? (
            <div className="space-y-6 mt-4">
              {profile[section.id]?.map((item: any, itemIndex: number) => (
                <div key={item.id} className="relative bg-slate-50 dark:bg-[#0b0f19] p-5 rounded-xl border border-slate-200 dark:border-slate-800/60">
                  <button type="button" onClick={() => removeArrayItem(section.id, item.id)} className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {section.fields.map((field: any) => (
                      <div key={field.id}>
                        <label className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {field.label}
                          {profile.fieldMetadata?.[`${section.id}.${itemIndex}.${field.id}`] && (
                            <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                              {profile.fieldMetadata[`${section.id}.${itemIndex}.${field.id}`].source} · {profile.fieldMetadata[`${section.id}.${itemIndex}.${field.id}`].confidence}
                              {profile.fieldMetadata[`${section.id}.${itemIndex}.${field.id}`].verifiedAt ? ` · verified ${new Date(profile.fieldMetadata[`${section.id}.${itemIndex}.${field.id}`].verifiedAt).toLocaleDateString()}` : ''}
                            </span>
                          )}
                        </label>
                        {field.type === 'select' ? (
                          <select value={item[field.id] || ''} onChange={e => updateArrayItem(section.id, item.id, field.id, e.target.value)} className="w-full bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                            <option value="">Select...</option>
                            {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={field.type} value={item[field.id] || ''} onChange={e => updateArrayItem(section.id, item.id, field.id, e.target.value)} placeholder={field.label} className="w-full bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                        )}
                        {item[field.id] && inferAnswerScope(`${section.id}.${field.id}`) === 'company' && (() => {
                          const path = `${section.id}.${itemIndex}.${field.id}`;
                          const provenance = profile.fieldMetadata?.[path];
                          const scope = provenance?.scope || 'company';
                          return (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <select value={scope} onChange={e => updateFieldScope(section.id, `${itemIndex}.${field.id}`, e.target.value, provenance?.domain)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300">
                                <option value="global">Reusable anywhere</option>
                                <option value="company">This company only</option>
                              </select>
                              {scope === 'company' && (
                                <input type="text" aria-label={`${field.label} company domain`} placeholder="company.com" value={provenance?.domain || ''} onChange={e => updateFieldScope(section.id, `${itemIndex}.${field.id}`, 'company', e.target.value)} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300" />
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(!profile[section.id] || profile[section.id]?.length === 0) && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No {section.title.toLowerCase()} added yet.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              {section.fields.map((field: any) => (
                <div key={field.id}>
                  <label className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {field.label}
                    {profile.fieldMetadata?.[`${section.id}.${field.id}`] && (
                      <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                        {profile.fieldMetadata[`${section.id}.${field.id}`].source} · {profile.fieldMetadata[`${section.id}.${field.id}`].confidence}
                        {profile.fieldMetadata[`${section.id}.${field.id}`].verifiedAt ? ` · verified ${new Date(profile.fieldMetadata[`${section.id}.${field.id}`].verifiedAt).toLocaleDateString()}` : ''}
                      </span>
                    )}
                  </label>
                  {field.type === 'select' ? (
                    <select value={profile[section.id]?.[field.id] || ''} onChange={e => updateNested(section.id, field.id, e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                      <option value="">Select...</option>
                      {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={field.type} value={profile[section.id]?.[field.id] || ''} onChange={e => updateNested(section.id, field.id, e.target.value)} placeholder={field.label} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                  )}
                      {profile[section.id]?.[field.id] && inferAnswerScope(`${section.id}.${field.id}`) === 'company' && (() => {
                        const path = `${section.id}.${field.id}`;
                        const provenance = profile.fieldMetadata?.[path];
                        const scope = provenance?.scope || 'company';
                        return (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <select value={scope} onChange={e => updateFieldScope(section.id, field.id, e.target.value, provenance?.domain)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300">
                              <option value="global">Reusable anywhere</option>
                              <option value="company">This company only</option>
                            </select>
                            {scope === 'company' && (
                              <input type="text" aria-label={`${field.label} company domain`} placeholder="company.com" value={provenance?.domain || ''} onChange={e => updateFieldScope(section.id, field.id, 'company', e.target.value)} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300" />
                            )}
                            <span className="col-span-2 text-[10px] text-slate-400">
                              {provenance?.source || 'legacy'} · {provenance?.confidence || 'medium'}
                              {provenance?.updatedAt ? ` · updated ${new Date(provenance.updatedAt).toLocaleDateString()}` : ''}
                            </span>
                          </div>
                        );
                      })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    chrome.storage.local.get(['profileVault'], (result) => {
      if (result.profileVault) {
        const migrated = migrateLegacyProfile(result.profileVault);
        setProfile(migrated.profile);
        if (migrated.changed) chrome.storage.local.set({ profileVault: migrated.profile });
      } else {
        const emptyProfile: any = {};
        applicationSchema.forEach(s => {
          if (s.isArray) emptyProfile[s.id] = [];
          else emptyProfile[s.id] = Object.fromEntries(s.fields.map(f => [f.id, ""]));
        });
        setProfile(emptyProfile);
      }
    });
  }, []);

  const copyPrompt = async () => {
    const jsonStructure: any = {};
    applicationSchema.forEach(s => {
      if (s.isArray) {
        jsonStructure[s.id] = [Object.fromEntries(s.fields.map(f => [f.id, ""]))]
      } else {
        jsonStructure[s.id] = Object.fromEntries(s.fields.map(f => [f.id, ""]))
      }
    });

    if (Array.isArray(profile.customFields) && profile.customFields.length > 0) {
      jsonStructure.customFields = profile.customFields.map((cf: any) => ({
        label: cf.label,
        value: ""
      }));
    }

    const prompt = `I am setting up a form autofill tool. I want to compile my personal and professional details.

If I have attached my resume/CV or provided my details below, please read them and extract all the data into the exact JSON format below.
If I haven't provided any details or resume yet, please ask me for them first. Once I provide them, extract the data into the JSON format.

IMPORTANT INSTRUCTIONS:
1. Extract only facts explicitly present in my resume or messages; do not guess or infer personal, legal, eligibility, salary, or consent answers.
2. Reuse a value for another field only when the fields clearly ask for the same fact.
3. Use an empty string for information that is not provided.
4. Return ONLY valid JSON format, nothing else.

\`\`\`json
${JSON.stringify(jsonStructure, null, 2)}
\`\`\``;

    try {
      await navigator.clipboard.writeText(prompt);
      setStatus('AI prompt copied to clipboard.');
    } catch {
      setStatus('Clipboard access failed. Select and copy the prompt manually.');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleImport = () => {
    try {
      const jsonText = importJson.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The JSON root must be an object.');
      }
      const cleanNA = (obj: any) => {
        for (let k in obj) {
          if (typeof obj[k] === 'string') {
            const val = obj[k].trim().toLowerCase();
            if (val === 'na' || val === 'n/a' || val === 'not applicable' || val === 'none' || val === 'null') {
              obj[k] = '';
            }
          } else if (typeof obj[k] === 'object' && obj[k] !== null) {
            cleanNA(obj[k]);
          }
        }
      };
      cleanNA(parsed);

      const isObject = (item: any) => {
        return (item && typeof item === 'object' && !Array.isArray(item));
      };

      let newProfile = { ...profile };
      const fieldMetadata = { ...(profile.fieldMetadata || {}) };
      const importedAt = Date.now();
      for (const key in parsed) {
        if (key === 'fieldMetadata') continue;
        if (key === 'customFields') {
          if (!Array.isArray(parsed[key])) continue;
          const existingFields = Array.isArray(profile.customFields) ? profile.customFields : [];
          newProfile.customFields = parsed[key]
            .filter((field: any) => field && typeof field.label === 'string' && typeof field.value === 'string')
            .map((field: any) => {
              const existing = existingFields.find((item: any) => item.label?.trim().toLowerCase() === field.label.trim().toLowerCase());
              const hasImportedValue = Boolean(field.value.trim());
              return {
                id: existing?.id || field.id || crypto.randomUUID(),
                label: field.label,
                value: hasImportedValue ? field.value : existing?.value || '',
                source: hasImportedValue ? 'ai_import' : existing?.source || 'legacy',
                confidence: hasImportedValue ? 'medium' : existing?.confidence || 'medium',
                scope: existing?.scope || inferAnswerScope(field.label, 'company'),
                domain: existing?.domain,
                updatedAt: hasImportedValue ? importedAt : existing?.updatedAt,
                verifiedAt: hasImportedValue ? undefined : existing?.verifiedAt,
              };
            });
          continue;
        }
        if (Array.isArray(parsed[key])) {
          const existingItems = Array.isArray(profile[key]) ? profile[key] : [];
          const importedItems = parsed[key].filter((item: any) => item && typeof item === 'object' && !Array.isArray(item));
          const mergedItems = mergeImportedValues(existingItems, importedItems);
          newProfile[key] = mergedItems.map((item: any, index: number) => ({
            ...item,
            id: existingItems[index]?.id || importedItems[index]?.id || item.id || crypto.randomUUID(),
          }));
        } else if (isObject(parsed[key])) {
          newProfile[key] = mergeImportedValues(newProfile[key] || {}, parsed[key]);
        } else {
          newProfile[key] = parsed[key] === '' || parsed[key] === null ? newProfile[key] : parsed[key];
        }

        removeImportedFieldMetadata(parsed[key], [key], fieldMetadata);
        if (key !== 'customFields') collectImportedFieldMetadata(parsed[key], [key], fieldMetadata, importedAt);
      }
      newProfile.fieldMetadata = fieldMetadata;

      setProfile(newProfile);
      setImportJson('');
      setShowImport(false);
      setStatus('Review imported values, then confirm and save to enable autofill.');
      setTimeout(() => setStatus(''), 4000);
    } catch {
      setStatus('Invalid JSON. Paste a JSON object and check its brackets and quotes.');
      setTimeout(() => setStatus(''), 4000);
    }
  };

  const updateNested = (section: string, field: string, value: string) => {
    const path = `${section}.${field}`;
    setProfile({
      ...profile,
      [section]: {
        ...(profile[section] || {}),
        [field]: value
      },
      fieldMetadata: {
        ...(profile.fieldMetadata || {}),
        [path]: createManualProvenance(profile.fieldMetadata?.[path], inferAnswerScope(path)),
      },
    });
  };

  const addArrayItem = (sectionId: string) => {
    const section = applicationSchema.find(s => s.id === sectionId);
    if (!section) return;
    
    const newItem: any = { id: Date.now().toString() };
    section.fields.forEach(f => { newItem[f.id] = ''; });
    
    setProfile({
      ...profile,
      [sectionId]: [...(profile[sectionId] || []), newItem]
    });
  };

  const updateArrayItem = (sectionId: string, itemId: string, field: string, value: string) => {
    const itemIndex = profile[sectionId].findIndex((item: any) => item.id === itemId);
    const path = `${sectionId}.${itemIndex}.${field}`;
    setProfile({
      ...profile,
      [sectionId]: profile[sectionId].map((item: any) => item.id === itemId ? { ...item, [field]: value } : item),
      fieldMetadata: {
        ...(profile.fieldMetadata || {}),
        [path]: createManualProvenance(profile.fieldMetadata?.[path], inferAnswerScope(path)),
      },
    });
  };

  const removeArrayItem = (sectionId: string, itemId: string) => {
    const removedIndex = profile[sectionId].findIndex((item: any) => item.id === itemId);
    const fieldMetadata: Record<string, FieldProvenance> = {};
    Object.entries(profile.fieldMetadata || {}).forEach(([path, provenance]: [string, any]) => {
      const match = path.match(new RegExp(`^${sectionId}\\.(\\d+)\\.(.+)$`));
      if (!match) {
        fieldMetadata[path] = provenance;
        return;
      }
      const index = Number(match[1]);
      if (index === removedIndex) return;
      fieldMetadata[`${sectionId}.${index > removedIndex ? index - 1 : index}.${match[2]}`] = provenance;
    });
    setProfile({
      ...profile,
      [sectionId]: profile[sectionId].filter((item: any) => item.id !== itemId),
      fieldMetadata,
    });
  };

  const saveProfile = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const reviewedAt = Date.now();
    const reviewedProfile = {
      ...profile,
      fieldMetadata: Object.fromEntries(Object.entries(profile.fieldMetadata || {}).map(([path, provenance]: [string, any]) => [
        path,
        ['ai_import', 'legacy'].includes(provenance.source) && provenance.confidence !== 'high'
          ? { ...provenance, confidence: 'high', verifiedAt: reviewedAt }
          : provenance,
      ])),
      customFields: (Array.isArray(profile.customFields) ? profile.customFields : []).map((field: any) => ['ai_import', 'legacy'].includes(field.source) && field.confidence !== 'high'
        ? { ...field, confidence: 'high', verifiedAt: reviewedAt }
        : field),
    };
    setProfile(reviewedProfile);
    chrome.storage.local.set({ profileVault: reviewedProfile }, () => {
      if (chrome.runtime.lastError) {
        setStatus(`Could not save profile: ${chrome.runtime.lastError.message}`);
        return;
      }
      setStatus('Reviewed profile saved.');
      setTimeout(() => setStatus(''), 3000);
    });
  };

  const updateFieldScope = (section: string, field: string, scope: 'global' | 'company', domain?: string) => {
    const path = `${section}.${field}`;
    const previous = profile.fieldMetadata?.[path];
    setProfile({
      ...profile,
      fieldMetadata: {
        ...(profile.fieldMetadata || {}),
        [path]: {
          source: previous?.source || 'manual',
          confidence: previous?.confidence || 'high',
          scope,
          domain: scope === 'company' ? normalizeDomain(domain || previous?.domain || '') : undefined,
          updatedAt: Date.now(),
          verifiedAt: previous?.verifiedAt || Date.now(),
        },
      },
    });
  };

  const clearProfile = () => {
    if (window.confirm("Are you sure you want to delete ALL your profile data? This will clear everything immediately and cannot be undone.")) {
      const emptyProfile: any = {};
      applicationSchema.forEach(s => {
        if (s.isArray) {
          emptyProfile[s.id] = [];
        } else {
          emptyProfile[s.id] = Object.fromEntries(s.fields.map(f => [f.id, ""]));
        }
      });
      setProfile(emptyProfile);
      chrome.storage.local.set({ profileVault: emptyProfile }, () => {
        if (chrome.runtime.lastError) {
          setStatus(`Could not clear profile: ${chrome.runtime.lastError.message}`);
          return;
        }
        setStatus('Profile cleared.');
        setTimeout(() => setStatus(''), 3000);
      });
    }
  };

  if (!profile || Object.keys(profile).length === 0) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] flex items-center justify-center text-slate-900 dark:text-white">Loading...</div>;

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-[#0b0f19] font-sans text-slate-800 dark:text-slate-200 overflow-hidden selection:bg-blue-500/30 ${theme}`}>
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-[#0b0f19] flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <Sparkles size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">ApplyFlow</h1>
          </div>
          
          <div className="px-4 space-y-1 mt-4">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-500 dark:text-blue-400 rounded-xl font-medium transition-colors">
              <Bot size={18} />
              1. AI Prompt
            </button>
            <button onClick={() => setShowImport(!showImport)} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-xl font-medium transition-colors">
              <Code size={18} />
              2. Paste JSON
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800/60">
            <Zap size={16} className="text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Save time.</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Apply faster.<br/>Get closer to your dream job.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* NAVBAR */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between px-8 bg-slate-50 dark:bg-[#0b0f19]">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 text-sm md:hidden font-semibold">ApplyFlow</span>
            <span className="text-slate-400 dark:text-slate-500 text-sm hidden md:inline">Your details. One place. Auto-fill everywhere.</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/50 rounded-full transition-colors">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {status && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3">
                <CheckCircle2 size={20} />
                <span className="font-semibold text-sm">{status}</span>
              </div>
            )}

            {/* AI Banner */}
            <div className="bg-white dark:bg-linear-to-br dark:from-[#111827] dark:to-[#1e1b4b]/40 border border-indigo-500/30 rounded-2xl p-8 relative overflow-hidden shadow-lg shadow-indigo-900/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl border border-indigo-500/20 shrink-0 mt-1">
                    <Bot size={24} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Auto-Fill with ChatGPT / Gemini</h2>
                    <p className="text-sm text-indigo-900/70 dark:text-indigo-200/70 max-w-lg leading-relaxed">
                      <strong className="text-indigo-600 dark:text-indigo-300">Important:</strong> Copy the prompt below, go to ChatGPT, paste the prompt. It will ask for your details, just chat with it and then copy the JSON result here!
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={copyPrompt} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-2">
                    <FileText size={16} /> 1. Copy AI Prompt
                  </button>
                  <button type="button" onClick={() => setShowImport(!showImport)} className="px-5 py-3 bg-slate-50 dark:bg-[#0b0f19] text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-2">
                    <Code size={16} /> 2. Paste AI JSON
                  </button>
                </div>
              </div>
            </div>
            
            {showImport && (
              <div className="p-6 bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700/50 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Code size={16} className="text-blue-500 dark:text-blue-400"/> Paste JSON from ChatGPT / Gemini:</h3>
                <textarea 
                  value={importJson} 
                  onChange={(e) => setImportJson(e.target.value)} 
                  className="w-full h-64 bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 font-mono focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder='{\n  "personalInformation": {\n    "firstName": "John",\n    ...\n  }\n}'
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowImport(false)} className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleImport} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                    <Download size={16} /> Import Data
                  </button>
                </div>
              </div>
            )}

            {/* Resume Upload Card */}
            <div className="bg-white dark:bg-[#111827] border border-emerald-500/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shrink-0">
                  <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Upload Resume (PDF)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Upload your resume here so the extension can auto-attach it to job applications!</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                {profile.documents?.resumeName && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} /> {profile.documents.resumeName}
                  </span>
                )}
                <label className="cursor-pointer px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold rounded-xl transition-colors flex items-center gap-2">
                  <FileUp size={16} />
                  <span>{profile.documents?.resumeName ? 'Replace File' : 'Select File'}</span>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          setStatus('Resume files must be 2 MB or smaller.');
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result !== 'string') {
                            setStatus('Could not read the selected resume.');
                            return;
                          }
                          setProfile({...profile, documents: { ...(profile.documents || {}), resumeBase64: reader.result, resumeName: file.name }});
                          setStatus('Resume loaded. Save profile to keep it.');
                          setTimeout(() => setStatus(''), 3000);
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                </label>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-6 pt-2 pb-24">
              {applicationSchema.map((section: SectionSchema) => {
                if (section.id === 'documents') return null; // Handled specially above
                return (
                  <SectionCard 
                    key={section.id} 
                    section={section} 
                    profile={profile} 
                    updateNested={updateNested}
                    addArrayItem={addArrayItem}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    updateFieldScope={updateFieldScope}
                  />
                );
              })}

              {/* Custom Fields (Learned) */}
              {Array.isArray(profile.customFields) && profile.customFields.length > 0 && (
                <div className="bg-white dark:bg-[#111827] border border-amber-500/20 rounded-xl p-6 shadow-sm overflow-hidden mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Zap size={18} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 tracking-wide">Learned Custom Fields</h3>
                      <p className="text-[11px] text-slate-500 mt-1">These fields were saved automatically while you were filling forms.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                    {profile.customFields.map((field: any, idx: number) => (
                      <div key={field.id || idx} className="relative group mt-4">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{field.label}</label>
                          <span className="text-[10px] text-slate-400">
                            {field.source || 'legacy'} · {field.confidence || 'medium'}
                            {field.verifiedAt ? ` · verified ${new Date(field.verifiedAt).toLocaleDateString()}` : field.updatedAt ? ` · updated ${new Date(field.updatedAt).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                        <input type="text" value={field.value} onChange={(e) => {
                          const newFields = [...profile.customFields];
                          newFields[idx] = { ...newFields[idx], value: e.target.value, ...createManualProvenance(newFields[idx]) };
                          setProfile({...profile, customFields: newFields});
                        }} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select value={field.scope || 'global'} onChange={(e) => {
                            const newFields = [...profile.customFields];
                            newFields[idx] = { ...newFields[idx], scope: e.target.value, updatedAt: Date.now() };
                            setProfile({ ...profile, customFields: newFields });
                          }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300">
                            <option value="global">Reusable anywhere</option>
                            <option value="company">This company only</option>
                          </select>
                          {field.scope === 'company' && (
                            <input type="text" aria-label="Company domain" placeholder="company.com" value={field.domain || ''} onChange={(e) => {
                              const newFields = [...profile.customFields];
                              newFields[idx] = { ...newFields[idx], domain: e.target.value.trim().toLowerCase(), updatedAt: Date.now() };
                              setProfile({ ...profile, customFields: newFields });
                            }} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0b0f19] dark:text-slate-300" />
                          )}
                        </div>
                        <button type="button" onClick={() => {
                          const newFields = profile.customFields.filter((_:any, i:number) => i !== idx);
                          setProfile({...profile, customFields: newFields});
                        }} className="absolute top-0 right-0 p-1 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-6 right-8 z-50 flex gap-4">
          <button type="button" onClick={clearProfile} className="px-6 py-3.5 bg-white dark:bg-[#0b0f19] hover:bg-rose-50 dark:hover:bg-rose-600/10 text-rose-600 dark:text-rose-500 font-bold rounded-xl transition-all flex items-center gap-2 border border-rose-500/20 shadow-sm">
            <Trash2 size={18} />
            <span className="text-sm">Clear All Data</span>
          </button>
          <button type="button" onClick={saveProfile} className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_10px_25px_rgba(37,99,235,0.4)] transition-all hover:scale-105 flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span className="text-sm">Confirm &amp; Save Reviewed Profile</span>
          </button>
        </div>

      </main>
    </div>
  );
}
