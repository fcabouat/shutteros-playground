// Explicit language links take precedence over browser detection. No cookies or storage.
if (document.documentElement.hasAttribute('data-auto-locale')) {
  const requested = new URLSearchParams(location.search).get('lang');
  const preferred = navigator.languages?.[0] ?? navigator.language ?? 'en';
  if (requested === 'fr' || (requested !== 'en' && /^fr(?:-|$)/i.test(preferred))) {
    location.replace(`fr.html${location.hash}`);
  }
}
