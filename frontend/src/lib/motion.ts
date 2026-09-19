// Centralized motion vocabulary — one easing curve for the whole product.

export const SPRING: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: SPRING } },
};

export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const page = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: SPRING } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: "easeIn" as const } },
};

export const popIn = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: SPRING } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: "easeIn" as const } },
};