import { AnimatePresence, motion } from "framer-motion";

const COLORS = ["#3e9b6a", "#eea43b", "#1e5b3c", "#e28d2b", "#9dba83", "#d9772f"];
const PARTICLES = 18;

export function Burst({ burst, size = 160 }: { burst: number; size?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible"
      aria-hidden="true"
    >
      <AnimatePresence>
        {burst > 0 && (
          <motion.div
            key={burst}
            className="relative"
            style={{ width: size, height: size }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {Array.from({ length: PARTICLES }).map((_, i) => {
              const angle = (i / PARTICLES) * Math.PI * 2;
              const dist = 46 + ((i * 7) % 30);
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 rounded-[2px]"
                  style={{
                    width: i % 3 === 0 ? 8 : 6,
                    height: i % 2 === 0 ? 6 : 9,
                    background: COLORS[i % COLORS.length],
                    marginLeft: -3,
                    marginTop: -4,
                  }}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    rotate: (i * 67) % 120,
                    scale: 1,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75 + (i % 5) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}