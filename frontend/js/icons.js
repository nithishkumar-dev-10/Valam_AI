// Inline SVG icons — crisp at any size, unlike emoji, and themeable via CSS.
// All use currentColor so `color` on the parent controls the tint.

const ic = (paths, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const iconMic = ic(
  `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>`,
);
export const iconStop = ic(
  `<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>`,
);
export const iconPlay = ic(`<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>`);
export const iconUpload = ic(
  `<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>`,
);
export const iconCamera = ic(
  `<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>`,
);
export const iconPin = ic(
  `<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>`,
);
export const iconLeaf = ic(
  `<path d="M20 4c-9 0-15 4.5-15 12 0 3 1.6 4.6 4 4 2.8-1 6-5.2 11-16z"/><path d="M5 20C9 12 14 8 19 6"/>`,
);
export const iconBug = ic(
  `<circle cx="12" cy="12" r="4.5"/><path d="M12 7.5V5M12 19v-2.5M4.5 9.5 7 11M19.5 9.5 17 11M4.5 14.5 7 13M19.5 14.5 17 13"/><path d="M12 5h-3M12 5h3"/>`,
);
export const iconChevronLeft = ic(`<path d="m14.5 6-6 6 6 6"/>`);
export const iconChevronRight = ic(`<path d="m9.5 6 6 6-6 6"/>`);
export const iconSpeaker = ic(
  `<path d="M5 10v4h3l4 3V7l-4 3H5z"/><path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M17.5 7.5a7.5 7.5 0 0 1 0 9"/>`,
);
export const iconCheck = ic(`<path d="m5 12.5 4.5 4.5L19 7.5"/>`);
export const iconX = ic(`<path d="M6 6l12 12M18 6 6 18"/>`);
export const iconAlert = ic(
  `<path d="M12 4 3 19h18L12 4z"/><path d="M12 10v4"/><path d="M12 16.5v.5"/>`,
);
export const iconInfo = ic(
  `<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5"/><path d="M12 7.5v.5"/>`,
);
export const iconGlobe = ic(
  `<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.7 2.6 4 6 4 9.5s-1.3 6.9-4 9.5c-2.7-2.6-4-6-4-9.5s1.3-6.9 4-9.5z"/>`,
);
export const iconSpark = ic(
  `<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>`,
);
export const iconEye = ic(
  `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
);
export const iconEyeOff = ic(
  `<path d="M2.5 12S6 5.5 12 5.5c1.5 0 2.9.4 4 1M21.5 12s-3.5 6.5-9.5 6.5c-1.6 0-3-.4-4.2-1"/><path d="m4 4 16 16"/>`,
);
export const iconUser = ic(
  `<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>`,
);
export const iconClock = ic(
  `<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>`,
);
export const iconRefresh = ic(
  `<path d="M20 12a8 8 0 1 1-2.4-5.6"/><path d="M20 3v5h-5"/>`,
);

export default iconMic;