import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: 'EN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', flag: 'ಕ' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी', flag: 'हि' }
];

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('simsrh_language');
      if (saved && (saved === 'en' || saved === 'kn' || saved === 'hi')) {
        return saved;
      }
    } catch (e) {
      console.warn('Could not read saved language', e);
    }
    return 'en';
  });

  const setLanguage = (langCode) => {
    if (langCode === 'en' || langCode === 'kn' || langCode === 'hi') {
      setLanguageState(langCode);
      try {
        localStorage.setItem('simsrh_language', langCode);
        document.documentElement.lang = langCode;
      } catch (e) {
        console.warn('Could not persist language', e);
      }
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Translation function: returns localized string or English fallback or custom fallback
  const t = (key, fallback) => {
    if (!key) return '';
    const langDict = translations[language] || translations.en;
    if (langDict && langDict[key] !== undefined) {
      return langDict[key];
    }
    const enDict = translations.en;
    if (enDict && enDict[key] !== undefined) {
      return enDict[key];
    }
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
