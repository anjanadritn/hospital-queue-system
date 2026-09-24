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

  // Translation function: returns localized string with support for variable interpolation
  const t = (key, fallbackOrParams, params) => {
    if (!key) return '';
    let fallback = undefined;
    let interpolationParams = null;

    if (fallbackOrParams && typeof fallbackOrParams === 'object') {
      interpolationParams = fallbackOrParams;
      if (typeof params === 'string') {
        fallback = params;
      }
    } else {
      fallback = fallbackOrParams;
      if (params && typeof params === 'object') {
        interpolationParams = params;
      }
    }

    const langDict = translations[language] || translations.en;
    let text = undefined;
    if (langDict && langDict[key] !== undefined) {
      text = langDict[key];
    } else if (translations.en && translations.en[key] !== undefined) {
      text = translations.en[key];
    } else {
      text = fallback !== undefined ? fallback : key;
    }

    if (interpolationParams && typeof text === 'string') {
      Object.keys(interpolationParams).forEach((pKey) => {
        const val = interpolationParams[pKey] != null ? interpolationParams[pKey] : '';
        text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), val);
      });
    }

    return text;
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
