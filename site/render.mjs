import { content } from './content.mjs';

export const repository = 'https://github.com/fcabouat/shutteros-playground';
export const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const home = (locale) => (locale === 'fr' ? 'fr.html' : 'index.html?lang=en');

/** All site-owned pages share real links; a language change never needs storage. */
export function navigation(locale, section = 'home', up = '') {
  const c = content[locale];
  const paths = [
    `demo/?lang=${locale}`,
    `guide/${locale}.html`,
    'overview.html',
    'api/index.html',
    'storybook/index.html',
    repository,
  ];
  const links = paths
    .map(
      (path, i) =>
        `<a href="${escapeHtml(path.startsWith('https:') ? path : up + path)}">${c.nav[i]}</a>`,
    )
    .join('');
  const translated = section === 'home' || section === 'guide';
  const languages = ['fr', 'en']
    .map((language) => {
      const label = language === 'fr' ? 'Français' : 'English';
      if (language === locale)
        return `<span lang="${language}" aria-current="true">${label}</span>`;
      if (!translated)
        return `<span lang="${language}" aria-disabled="true" title="${escapeHtml(c.englishOnly)}">${label}</span>`;
      const href = section === 'guide' ? `guide/${language}.html` : home(language);
      return `<a lang="${language}" hreflang="${language}" href="${up}${href}">${label}</a>`;
    })
    .join('');
  return `<header class="site-header"><div class="site-bar"><a class="site-brand" href="${up}${home(locale)}"><img src="${up}assets/favicon.svg" width="36" height="36" alt=""><span>ShutterOS <small>Playground</small></span></a><nav class="site-links" aria-label="${c.navigation}">${links}</nav><nav class="site-languages" aria-label="${c.language}">${languages}</nav></div></header>`;
}

export function documentPage({
  locale,
  title,
  body,
  section = 'home',
  up = '',
  autoLocale = false,
  version = '',
}) {
  const c = content[locale];
  return `<!doctype html><html lang="${locale}"${autoLocale ? ' data-auto-locale' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(c.description)}"><meta name="theme-color" content="#102e42"><link rel="icon" href="${up}assets/favicon.svg"><link rel="stylesheet" href="${up}assets/shell.css"><link rel="stylesheet" href="${up}assets/site.css"><script src="${up}assets/locale.js" defer></script></head><body><a class="skip-link" href="#main">${c.skip}</a>${navigation(locale, section, up)}${body}<footer class="site-footer"><div class="wrap"><div class="footer-links"><a href="${repository}">F. Cabouat · GitHub</a><a href="${up}docs/legal.html">${c.licenses}</a><a href="${up}THIRD-PARTY-NOTICES.txt">${locale === 'fr' ? 'Licences tierces' : 'Third-party notices'}</a><span>MIT${version ? ` · v${escapeHtml(version)}` : ''}</span></div><p>${c.privacy}</p><p>${c.legal}</p></div></footer></body></html>`;
}

export function landing(locale, version) {
  const c = content[locale];
  const body = `<main id="main"><section class="hero"><div class="wrap hero-grid"><div><p class="eyebrow">${c.eyebrow}</p><h1>${c.heading}</h1><p class="hero-lead">${c.lead}</p><div class="actions"><a class="button primary" href="demo/?lang=${locale}">${c.play}<span aria-hidden="true">↗</span></a><a class="button secondary" href="demo/portable/shutteros.html" download="shutteros.html">${c.download}<span aria-hidden="true">↓</span></a></div><p class="hero-note">${c.note}</p></div><div class="hero-art" aria-hidden="true"><div class="window-mark"><img src="assets/favicon.svg" width="190" height="190" alt=""></div><span class="art-caption">ShutterOS<span>PLAYGROUND</span></span></div></div><dl class="wrap stats">${c.stats.map(([value, label]) => `<div><dt>${value}</dt><dd>${label}</dd></div>`).join('')}</dl></section><section class="wrap preview"><div class="section-heading"><h2>${c.preview}</h2><p>${c.previewText}</p></div><figure><div class="preview-bar"><span aria-hidden="true">● ● ●</span><span>ShutterOS Playground</span></div><img src="assets/desktop${locale === 'fr' ? '.fr' : ''}.png" width="1280" height="720" alt="${c.imageAlt}" loading="lazy"></figure></section><section class="wrap situations"><h2>${c.situationsTitle}</h2><ul>${c.situations.map((label, i) => `<li><span aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${label}</li>`).join('')}</ul></section><section class="pale"><div class="wrap"><h2>${c.stepsTitle}</h2><div class="steps">${c.steps.map(([title, text], i) => `<article><span class="step-number">0${i + 1}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div></div></section><section class="wrap deployment"><div><p class="eyebrow">${c.deploymentEyebrow}</p><h2>${c.deployTitle}</h2><p>${c.deployText}</p></div><div><ul>${c.deployPoints.map((text) => `<li>${text}</li>`).join('')}</ul><a class="text-link" href="docs/ubuntu-kiosk.html">${c.deployLink} →</a></div></section><section class="wrap resources" id="resources"><h2>${c.resourcesTitle}</h2><div class="resource-grid">${c.resources.map(([title, text, href]) => `<a class="resource" href="${href}"><h3>${title}<span aria-hidden="true">↗</span></h3><p>${text}</p></a>`).join('')}</div><div class="source-links"><a href="${repository}">${c.source} ↗</a><a href="${repository}/releases">${c.release} ↗</a></div></section></main>`;
  return documentPage({ locale, title: c.title, body, autoLocale: locale === 'en', version });
}
