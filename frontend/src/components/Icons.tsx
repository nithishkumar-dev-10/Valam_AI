import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function make(children: ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg {...base} {...props} aria-hidden="true">
        {children}
      </svg>
    );
  };
}

// Sprout rising from a soil mound.
export const IconSprout = make(
  <>
    <path d="M12 21v-6" />
    <path d="M12 15c0-4.5-2.5-7-6.5-8C6 10.5 8.5 12.5 12 15z" />
    <path d="M12 13c0-4 2-6 5.8-6.9C17 9.4 14.8 11.4 12 13z" />
    <path d="M4 21h16" strokeWidth="1.5" />
  </>,
);

export const IconSun = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M5.1 18.9l1.8-1.8M17.1 6.9l1.8-1.8" strokeWidth="1.6" />
  </>,
);

export const IconDroplet = make(
  <path d="M12 3s6 6.3 6 10.8a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" />,
);

export const IconLeaf = make(
  <>
    <path d="M4 20c7-1 16-5 16-16-8 0-15 4-16 16z" />
    <path d="M4 20c3-5 8-9 12-12" />
  </>,
);

export const IconEar = make(
  <>
    <path d="M12 21V8.5" />
    <path d="M9 10c-1.4-1-2.5-2.3-2.9-4 2.6.2 4 1.3 4.4 3.2" />
    <path d="M15.9 10c1.4-1 2.5-2.3 2.9-4-2.6.2-4 1.3-4.4 3.2" />
    <path d="M9.4 13.5c-1.8-1-3-2.5-3.3-4.6 2.7.1 4.2 1.5 4.7 3.7" />
    <path d="M14.6 13.5c1.8-1 3-2.5 3.3-4.6-2.7.1-4.2 1.5-4.7 3.7" />
    <path d="M10 17c-2-1-3.4-2.6-3.8-5 3 .1 4.6 1.6 5 4" />
    <path d="M14 17c2-1 3.4-2.6 3.8-5-3 .1-4.6 1.6-5 4" />
  </>,
);

export const IconScan = make(
  <>
    <path d="M4 9V6a2 2 0 0 1 2-2h3" />
    <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
    <path d="M15 4h3a2 2 0 0 1 2 2v3" />
    <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
    <path d="M12 8v3.5" />
    <circle cx="12" cy="14.5" r="2.2" />
  </>,
);

export const IconMic = make(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </>,
);

export const IconCamera = make(
  <>
    <path d="M4 8h2.5l1.2-2h8.6l1.2 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.4" />
  </>,
);

export const IconUpload = make(
  <>
    <path d="M12 16V4" />
    <path d="M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>,
);

export const IconHome = make(
  <>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </>,
);

export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </>,
);

export const IconArrowRight = make(
  <>
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </>,
);

export const IconChevronRight = make(<path d="M9 5l7 7-7 7" />);

export const IconCheck = make(<path d="M4.5 12.5l5 5 10-11" />);

export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);

export const IconAlert = make(
  <>
    <path d="M12 4.5 21 20H3z" />
    <path d="M12 10v4" />
    <path d="M12 17.2v.3" />
  </>,
);

export const IconRefresh = make(
  <>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 3.5V8h-4.5" />
  </>,
);

export const IconGlobe = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.4 2.3 3.6 5.4 3.6 9S14.4 18.7 12 21c-2.4-2.3-3.6-5.4-3.6-9S9.6 5.3 12 3z" />
  </>,
);

export const IconSparkle = make(
  <>
    <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.7l-1.6-4.5L6 10.6 10.4 9z" />
    <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </>,
);

export const IconPlay = make(<path d="M8 5.5v13l11-6.5z" />);

export const IconPause = make(<path d="M9 5v14M15 5v14" />);

export const IconTrash = make(
  <>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V4h5v2.5" />
    <path d="M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13" />
    <path d="M10 11v6M14 11v6" />
  </>,
);

export const IconLogout = make(
  <>
    <path d="M14 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h8" />
    <path d="M10 12h10" />
    <path d="M16.5 8.5 20 12l-3.5 3.5" />
  </>,
);

export const IconMapPin = make(
  <>
    <path d="M12 21s-6.5-5.2-6.5-10.2A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.8C18.5 15.8 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.2" />
  </>,
);

export const IconEye = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
);

export const IconEyeOff = make(
  <>
    <path d="M4 4l16 16" />
    <path d="M10.6 6.2A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3" />
    <path d="M6.2 8.2C4 9.8 2.5 12 2.5 12S6 18 12 18c1.2 0 2.3-.2 3.3-.6" />
    <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
  </>,
);

export const IconShield = make(
  <>
    <path d="M12 3l7 2.5V11c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V5.5z" />
    <path d="M9 11.5l2.2 2.2L15.5 9" />
  </>,
);

// Brand glyph — sprout in soil, filled (used in the wordmark).
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M11.6 21C12 13.5 12 9 11.6 5.4 9 9 4.6 9.8 2.5 7.2 3.4 12.4 7 15 11.6 21z" opacity="0.9" />
      <path d="M11.9 21C11.4 13.5 11.4 9 11.9 5.4 14.5 9 18.9 9.8 21 7.2 20.1 12.4 16.5 15 11.9 21z" opacity="0.9" />
      <path d="M12 10.5c0-3 1.9-5.3 5-6.2-.5 3.6-2 5.4-5 6.2z" opacity="0.85" />
      <path d="M12 8.6c0-2.6 1.6-4.6 4.2-5.5-.4 3-1.7 4.5-4.2 5.2z" opacity="0.85" />
    </svg>
  );
}