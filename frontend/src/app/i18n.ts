import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import knTranslation from './locales/kn.json';
import hiTranslation from './locales/hi.json';
import taTranslation from './locales/ta.json';

const resources = {
  en: { translation: enTranslation },
  kn: { translation: knTranslation },
  hi: { translation: hiTranslation },
  ta: { translation: taTranslation }
};

let savedLanguage = 'en';
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    savedLanguage = window.localStorage.getItem('gravity-lang') || 'en';
  }
} catch (e) {
  savedLanguage = 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
