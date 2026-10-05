import { useState, useEffect } from 'react';
import { User, ChevronRight, Zap } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('Ready');
  const [profile, setProfile] = useState<any>(null);
  const [reviewFields, setReviewFields] = useState<string[]>([]);

  useEffect(() => {
    chrome.storage.local.get(['profileVault'], async (res) => {
      if (res.profileVault) setProfile(res.profileVault);
    });
  }, []);

  const handleFill = async () => {
    if (!profile) {
      setStatus('Set up your profile first.');
      return;
    }
    setReviewFields([]);
    setStatus('Filling...');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('No active tab found.');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'FILL_FORM', profile }, (response: any) => {
        if (chrome.runtime.lastError || !response?.success) {
          setStatus('This page cannot be filled. Try refreshing it first.');
          return;
        }
        const fieldsForReview = Array.isArray(response.reviewFields) ? response.reviewFields : [];
        setReviewFields(fieldsForReview);
        const filledStatus = response.filledCount > 0
          ? `Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'}.`
          : 'No high-confidence matches found.';
        setStatus(fieldsForReview.length > 0
          ? `${filledStatus} ${fieldsForReview.length} field${fieldsForReview.length === 1 ? '' : 's'} left for review in Profile.`
          : filledStatus);
      });
    } catch {
      setStatus('Could not access the active tab.');
    }
  };

  const openOptions = () => chrome.runtime.openOptionsPage();

  return (
    <div className="w-[320px] bg-[#0a0a0f] text-slate-200 p-5 font-sans border border-slate-800 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">ApplyFlow</h1>
          <p className="text-[11px] text-slate-400">One-Click Form Filler</p>
        </div>
      </div>

      <div className="text-center text-sm font-semibold text-emerald-400 mb-4">{status}</div>
      {reviewFields.length > 0 && (
        <ul className="mb-5 max-h-32 space-y-1 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" aria-label="Fields left for review">
          {reviewFields.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
        </ul>
      )}

      {/* Action Button */}
      <button 
        onClick={handleFill}
        disabled={!profile}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] mb-6"
      >
        Auto-Fill Form
      </button>

      {/* Footer Profile Link */}
      <button 
        onClick={openOptions}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-[#13131a] border border-slate-800 hover:border-indigo-500/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-1.5 rounded-full">
            <User size={16} className="text-slate-300" />
          </div>
          <span className="text-sm font-medium text-slate-300">
            {profile ? 'Edit Profile' : 'Setup Profile'}
          </span>
        </div>
        <ChevronRight size={16} className="text-slate-500" />
      </button>
    </div>
  );
}
