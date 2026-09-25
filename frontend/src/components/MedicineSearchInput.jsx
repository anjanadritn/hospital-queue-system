import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Pill, AlertCircle, Check, X } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

/**
 * MedicineSearchInput
 * Integrates official NLM RxNorm Prescribe API autocomplete with debounce,
 * loading state, empty state, API error fallback, and manual input support.
 */
export default function MedicineSearchInput({
  value = '',
  onChange,
  placeholder = 'Medicine Name (e.g. Paracetamol)',
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

  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = (query || '').trim();

    // Only search when at least 2 characters are typed
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setApiError(null);
      setHasSearched(false);
      return;
    }

    // Do not trigger search if the current query equals the already selected value
    if (trimmed.toLowerCase() === (value || '').trim().toLowerCase() && suggestions.length === 0) {
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await hospitalApi.searchMedicines(trimmed);
        const list = Array.isArray(results) ? results : (results?.results || results?.suggestions || []);
        setSuggestions(list);
        setHasSearched(true);
      } catch (err) {
        console.warn('[MedicineSearch] RxNorm API query failed:', err);
        setApiError('Unable to connect to RxNorm medicine catalog. You can still type the medicine name manually.');
        setSuggestions([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

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
    if (val.trim().length >= 2) {
      setIsOpen(true);
    }
  };

  const handleSelectMedicine = (item) => {
    const chosenName = item.prescribable_name || item.name || item.synonym;
    setQuery(chosenName);
    setIsOpen(false);
    setSuggestions([]);
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
            if ((query || '').trim().length >= 2) {
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
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-1 w-full sm:min-w-[340px] max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/10">
          
          {/* Header Info */}
          <div className="px-3 py-1.5 bg-slate-800/80 flex items-center justify-between text-[10px] text-slate-300">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-300">
              <Pill className="w-3 h-3 text-sky-400" />
              NLM RxNorm Catalog
            </span>
            <span>
              {isLoading
                ? 'Searching...'
                : `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`}
            </span>
          </div>

          {/* Body Content */}
          <div className="max-h-60 overflow-y-auto">
            {/* 1. Loading State */}
            {isLoading && (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-300">
                <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                <span>Searching prescribable medicines...</span>
              </div>
            )}

            {/* 2. API Error Fallback */}
            {!isLoading && apiError && (
              <div className="p-3 bg-amber-500/10 border-l-2 border-amber-400 text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>RxNorm Service Notice</span>
                </div>
                <p className="text-[11px] text-amber-300/90 leading-tight">
                  {apiError}
                </p>
              </div>
            )}

            {/* 3. Empty State */}
            {!isLoading && !apiError && hasSearched && suggestions.length === 0 && (
              <div className="p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-300">
                  No matching prescribable medicines found
                </p>
                <p className="text-[11px] text-slate-400">
                  You can keep "{query}" and prescribe it manually.
                </p>
              </div>
            )}

            {/* 4. Suggestions List */}
            {!isLoading && suggestions.length > 0 && (
              <ul className="divide-y divide-white/5">
                {suggestions.map((item, idx) => {
                  const displayName = item.prescribable_name || item.name;
                  const isMatch = (value || '').toLowerCase() === displayName.toLowerCase();

                  return (
                    <li key={`${item.rxcui}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectMedicine(item)}
                        className={`w-full text-left p-2.5 hover:bg-sky-500/20 transition cursor-pointer flex flex-col gap-1 group ${
                          isMatch ? 'bg-sky-500/15' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-white group-hover:text-sky-200 transition leading-snug">
                            {displayName}
                          </span>
                          {isMatch && (
                            <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Synonym if available and different */}
                        {item.synonym && item.synonym !== displayName && (
                          <span className="text-[10px] text-slate-400 italic line-clamp-1">
                            Syn: {item.synonym}
                          </span>
                        )}

                        {/* Badges: RxCUI & Term Type */}
                        <div className="flex items-center gap-2 pt-0.5">
                          {item.term_type && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getTtyBadgeColor(
                                item.term_type
                              )}`}
                            >
                              {item.term_type}
                            </span>
                          )}
                          {item.rxcui && (
                            <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                              RxCUI: {item.rxcui}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer Attribution Micro-Strip */}
          <div className="px-3 py-1 bg-slate-950/70 text-[9px] text-slate-500 flex items-center justify-between">
            <span>U.S. National Library of Medicine</span>
            <span>RxNorm Prescribe</span>
          </div>

        </div>
      )}
    </div>
  );
}
