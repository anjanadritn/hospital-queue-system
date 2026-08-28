import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Activity, Check } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function SymptomSelector({ selectedSymptoms, onChangeSymptoms, customSymptoms, onChangeCustomSymptoms }) {
  const [symptoms, setSymptoms] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    hospitalApi.getSymptoms().then(setSymptoms).catch(console.error);
  }, []);

  const categories = ['ALL', 'GENERAL', 'RESPIRATORY', 'DIGESTIVE', 'NEUROLOGICAL', 'SKIN', 'ENT', 'URINARY', 'MUSCULOSKELETAL'];

  const filteredSymptoms = symptoms.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = activeCategory === 'ALL' || s.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const toggleSymptom = (name) => {
    if (selectedSymptoms.includes(name)) {
      onChangeSymptoms(selectedSymptoms.filter((s) => s !== name));
    } else {
      onChangeSymptoms([...selectedSymptoms, name]);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Search & Category Pills */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Select Presenting Symptoms
        </label>

        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Type to search symptoms (e.g. fever, cough, chest)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold shrink-0 transition ${
                activeCategory === cat ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Symptom Checkboxes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200/80 rounded-xl">
        {filteredSymptoms.map((s) => {
          const isSelected = selectedSymptoms.includes(s.name);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSymptom(s.name)}
              className={`p-2 rounded-lg text-left text-xs font-semibold transition flex items-center justify-between border ${
                isSelected
                  ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                  : 'bg-white border-slate-200/60 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="truncate">{s.name}</span>
              {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Selected Tags */}
      {selectedSymptoms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedSymptoms.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-bold border border-sky-200"
            >
              {s}
              <button type="button" onClick={() => toggleSymptom(s)} className="hover:text-sky-950">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom Symptoms Textarea */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Add Other Symptoms / Health Concerns
        </label>
        <textarea
          rows={2}
          value={customSymptoms}
          onChange={(e) => onChangeCustomSymptoms(e.target.value)}
          placeholder="Describe any other symptoms (e.g. 'I have had a mild headache for two days and fatigue')..."
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition resize-none"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          * Note: Symptoms are collected to estimate consultation duration and optimize queue scheduling. This is NOT a medical diagnosis.
        </p>
      </div>

    </div>
  );
}
