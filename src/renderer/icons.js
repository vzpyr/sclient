const LUCIDE_VERSION = "1.44.0";

const LUCIDE_ICONS = {
  x: '<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>',
  "arrow-down": '<path d="M12 5v14"/> <path d="m19 12-7 7-7-7"/>',
  "trash-2":
    '<path d="M10 11v6"/> <path d="M14 11v6"/> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/> <path d="M3 6h18"/> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/> <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/> <path d="M2 12h20"/>',
  heart:
    '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  "chart-column":
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/> <path d="M18 17V9"/> <path d="M13 17V5"/> <path d="M8 17v-3"/>',
  turntable:
    '<path d="M10 12.01h.01"/> <path d="M18 8v4a8 8 0 0 1-1.07 4"/> <circle cx="10" cy="12" r="4"/> <rect x="2" y="4" width="20" height="16" rx="2"/>',
  settings:
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/> <circle cx="12" cy="12" r="3"/>',
  search: '<path d="m21 21-4.34-4.34"/> <circle cx="11" cy="11" r="8"/>',
  "rotate-cw":
    '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/> <path d="M21 3v5h-5"/>',
  plus: '<path d="M5 12h14"/> <path d="M12 5v14"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/> <path d="m15 5 4 4"/>',
  "panel-right-open":
    '<rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M15 3v18"/> <path d="m10 15-3-3 3-3"/>',
  "panel-right-close":
    '<rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M15 3v18"/> <path d="m8 9 3 3-3 3"/>',
  music:
    '<path d="M9 18V5l12-2v13"/> <circle cx="6" cy="18" r="3"/> <circle cx="18" cy="16" r="3"/>',
  "grip-vertical":
    '<circle cx="9" cy="12" r="1"/> <circle cx="9" cy="5" r="1"/> <circle cx="9" cy="19" r="1"/> <circle cx="15" cy="12" r="1"/> <circle cx="15" cy="5" r="1"/> <circle cx="15" cy="19" r="1"/>',
  gauge: '<path d="m12 14 4-4"/> <path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  "folder-down":
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/> <path d="M12 10v6"/> <path d="m15 13-3 3-3-3"/>',
  "database-arrow-up":
    '<path d="M19 22v-6"/> <path d="M21 12.536V5"/> <path d="m22 19-3-3-3 3"/> <path d="M3 12A9 3 0 0 0 14.457 14.886"/> <path d="M3 5V19A9 3 0 0 0 13.318 21.968"/> <ellipse cx="12" cy="5" rx="9" ry="3"/>',
  "database-arrow-down":
    '<path d="m16 19 3 3 3-3"/> <path d="M19 16v6"/> <path d="M21 12.536V5"/> <path d="M3 12A9 3 0 0 0 15.182 14.806"/> <path d="M3 5V19A9 3 0 0 0 13.318 21.968"/> <ellipse cx="12" cy="5" rx="9" ry="3"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/> <path d="M4 4a16 16 0 0 1 16 16"/> <circle cx="5" cy="19" r="1"/>',
  library:
    '<path d="m16 6 4 14"/> <path d="M12 6v14"/> <path d="M8 8v12"/> <path d="M4 4v16"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/> <rect x="2" y="4" width="20" height="16" rx="2"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevrons-down": '<path d="m7 6 5 5 5-5"/> <path d="m7 13 5 5 5-5"/>',
  ellipsis:
    '<circle cx="12" cy="12" r="1"/> <circle cx="19" cy="12" r="1"/> <circle cx="5" cy="12" r="1"/>',
  "keyboard-music":
    '<rect width="20" height="16" x="2" y="4" rx="2"/> <path d="M6 8h4"/> <path d="M14 8h.01"/> <path d="M18 8h.01"/> <path d="M2 12h20"/> <path d="M6 12v4"/> <path d="M10 12v4"/> <path d="M14 12v4"/> <path d="M18 12v4"/>',
  upload:
    '<path d="M12 3v12"/> <path d="m17 8-5-5-5 5"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  languages:
    '<path d="m5 8 6 6"/> <path d="m4 14 6-6 2-3"/> <path d="M2 5h12"/> <path d="M7 2h1"/> <path d="m22 22-5-10-5 10"/> <path d="M14 18h6"/>',
  "mic-vocal":
    '<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/> <path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/> <circle cx="16" cy="7" r="5"/>',
  "repeat-1":
    '<path d="m17 2 4 4-4 4"/> <path d="M3 11v-1a4 4 0 0 1 4-4h14"/> <path d="m7 22-4-4 4-4"/> <path d="M21 13v1a4 4 0 0 1-4 4H3"/> <path d="M11 10h1v4"/>',
  shuffle:
    '<path d="m18 14 4 4-4 4"/> <path d="m18 2 4 4-4 4"/> <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/> <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/> <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  "skip-back":
    '<path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"/> <path d="M3 20V4"/>',
  "skip-forward":
    '<path d="M21 4v16"/> <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>',
  pause:
    '<rect x="14" y="3" width="5" height="18" rx="1"/> <rect x="5" y="3" width="5" height="18" rx="1"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/> <path d="M21 8V5a2 2 0 0 0-2-2h-3"/> <path d="M3 16v3a2 2 0 0 0 2 2h3"/> <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minus: '<path d="M5 12h14"/>',
};

function lucideIcon(name, size = 16, attrs = "") {
  const body = LUCIDE_ICONS[name];
  if (!body) throw new Error("[SClient] Unknown icon: " + name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}-icon lucide-${name}"${attrs ? " " + attrs : ""}>${body}</svg>`;
}
