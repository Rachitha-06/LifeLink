import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
];

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => i18n.changeLanguage(lang.code)}
          aria-pressed={i18n.resolvedLanguage === lang.code}
          className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
            i18n.resolvedLanguage === lang.code
              ? dark
                ? 'bg-white/20 text-white'
                : 'bg-brand-teal-light text-brand-teal'
              : dark
                ? 'text-white/60 hover:text-white'
                : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
