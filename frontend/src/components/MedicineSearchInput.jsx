import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Pill, AlertCircle, Check, X, Sparkles } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { searchLocalMedicines } from '../constants/medicinesCatalog';

/**
 * MedicineSearchInput
 * High-speed autocomplete for prescribing medicines:
 * - 0ms instant local lookup for 1 to 3+ characters (e.g. 'p', 'pa', 'par', 'dolo', 'amox')
 * - Full hospital formulary with standard Indian & international brand names
 * - Background integration with backend RxNorm catalog for exhaustive coverage
 * - Auto-populates dosage, frequency, duration, and instructions on selection
 */
export default function MedicineSearchInput({
  value = '',
  onChange,
  placeholder = 'Medicine Name (e.g. Paracetamol, Dolo, Amoxicillin)',
  className = ''
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const wrapperRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync internal query when value prop changes from outside (e.g. reset)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Multi-tier search effect (Instant local matching + debounced backend fetch)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = (query || '').trim();

    // Show suggestions starting from 1 letter!
    if (trimmed.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      setApiError(null);
      setHasSearched(false);
      return;
    }

    // Do not trigger search if the current query equals the already selected value and suggestions are closed
    if (trimmed.toLowerCase() === (value || '').trim().toLowerCase() && !isOpen) {
      return;
    }

    // 1. INSTANT LOCAL LOOKUP (0ms latency, works even on 1-3 letters)
    const localMatches = searchLocalMedicines(trimmed, 25);
    setSuggestions(localMatches);
    setHasSearched(true);
    setIsOpen(true);

    // 2. BACKGROUND DEBOUNCED BACKEND SEARCH (For queries >= 2 chars)
    if (trimmed.length >= 2) {
      setIsLoading(true);
      setApiError(null);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await hospitalApi.searchMedicines(trimmed);
          const backendList = Array.isArray(results) ? results : (results?.results || results?.suggestions || []);

          if (backendList.length > 0) {
            // Merge local and backend suggestions, avoiding duplicate names
            setSuggestions(prevLocal => {
              const seenNames = new Set(
                prevLocal.map(m => (m.prescribable_name || m.name || '').toLowerCase().trim())
              );
              const uniqueBackend = backendList.filter(m => {
                const bName = (m.prescribable_name || m.name || '').toLowerCase().trim();
                return bName && !seenNames.has(bName);
              });
              return [...prevLocal, ...uniqueBackend].slice(0, 35);
            });
          }
        } catch (err) {
          console.warn('[MedicineSearch] Backend query failed (local catalog active):', err);
          // If local matches exist, do NOT show error banner to disrupt user
          if (localMatches.length === 0) {
            setApiError('External medicine catalog is temporarily unreachable. You can still type the medicine name manually.');
          }
        } finally {
          setIsLoading(false);
        }
      }, 250);
    } else {
      setIsLoading(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (onChange) {
      onChange(val, null);
    }
    if (val.trim().length >= 1) {
      setIsOpen(true);
    }
  };

  const handleSelectMedicine = (item) => {
    const chosenName = item.prescribable_name || item.name || item.synonym;
    setQuery(chosenName);
    setIsOpen(false);
    if (onChange) {
      onChange(chosenName, item);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setApiError(null);
    if (onChange) {
      onChange('', null);
    }
  };

  // Helper badge color for term type
  const getTtyBadgeColor = (tty) => {
    switch (tty) {
      case 'SCD':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'SBD':
        return 'bg-sky-500/20 text-sky-300 border-sky-400/30';
      case 'GPCK':
      case 'BPCK':
        return 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {/* Input Field with Icons */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            const trimmed = (query || '').trim();
            if (trimmed.length >= 1) {
              const localMatches = searchLocalMedicines(trimmed, 25);
              setSuggestions(localMatches);
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-2.5 pr-8 py-1.5 bg-white/10 border border-white/15 rounded-lg text-xs text-white placeholder:text-slate-400 focus:bg-white/20 focus:border-sky-400/50 focus:outline-none transition shadow-inner"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          )}

          {!isLoading && query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
              title="Clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown Popup */}
      {isOpen && query.trim().length >= 1 && (
        <div className="absolute left-0 top-full mt-1 w-full sm:min-w-[360px] max-w-lg bg-slate-900/98 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/10">
          
          {/* Header Info */}
          <div className="px-3 py-1.5 bg-slate-800/90 flex items-center justify-between text-[10px] text-slate-300">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-300">
              <Pill className="w-3.5 h-3.5 text-sky-400" />
              Hospital Formulary & Medicine Catalog
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {isLoading && suggestions.length === 0
                ? 'Searching...'
                : `${suggestions.length} match${suggestions.length === 1 ? '' : 'es'}`}
            </span>
          </div>

          {/* Body Content */}
          <div className="max-h-64 overflow-y-auto">
            {/* 1. API Error Fallback (only when 0 suggestions) */}
            {!isLoading && apiError && suggestions.length === 0 && (
              <div className="p-3 bg-amber-500/10 border-l-2 border-amber-400 text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Notice</span>
                </div>
                <p className="text-[11px] text-amber-300/90 leading-tight">
                  {apiError}
                </p>
              </div>
            )}

            {/* 2. Empty State */}
            {!isLoading && hasSearched && suggestions.length === 0 && !apiError && (
              <div className="p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-300">
                  No predefined medicine found for "{query}"
                </p>
                <p className="text-[11px] text-slate-400">
                  You can keep typing to prescribe custom medicine "{query}".
                </p>
              </div>
            )}

            {/* 3. Suggestions List */}
            {suggestions.length > 0 && (
              <ul className="divide-y divide-white/5">
                {suggestions.map((item, idx) => {
                  const displayName = item.prescribable_name || item.name;
                  const isMatch = (value || '').toLowerCase() === displayName.toLowerCase();

                  return (
                    <li key={`${item.rxcui || item.name}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectMedicine(item)}
                        className={`w-full text-left p-2.5 hover:bg-sky-500/20 transition cursor-pointer flex flex-col gap-1 group ${
                          isMatch ? 'bg-sky-500/15' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-sky-200 transition leading-snug">
                            {displayName}
                          </span>
                          {isMatch && (
                            <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Brand names & Category */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          {item.brand_names && item.brand_names.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">Brands:</span>
                              {item.brand_names.map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="px-1.5 py-0.2 rounded bg-sky-400/10 text-sky-300 font-semibold border border-sky-400/20"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.category && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/20 ml-auto">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Synonym or Default dosage preview */}
                        {(item.default_dosage || item.default_frequency || item.synonym) && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            {item.default_dosage && (
                              <span>Dosage: <strong className="text-slate-300">{item.default_dosage}</strong></span>
                            )}
                            {item.default_frequency && (
                              <span>• Freq: <strong className="text-slate-300">{item.default_frequency}</strong></span>
                            )}
                            {item.default_instructions && (
                              <span>• <em className="text-slate-400">{item.default_instructions}</em></span>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer Guidance Micro-Strip */}
          <div className="px-3 py-1 bg-slate-950/80 text-[9px] text-slate-400 flex items-center justify-between">
            <span>Tip: Click any medicine to auto-fill dosage & frequency</span>
            <span className="font-mono text-sky-400">Type 1+ letters to filter</span>
          </div>

        </div>
      )}
    </div>
  );
}
