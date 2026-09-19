import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { IconArrowRight } from "./Icons";
import { cn } from "../lib/utils";
import { fadeUp } from "../lib/motion";

const ACCENTS = {
  pine: {
    tile: "bg-pine-100 text-pine-700",
    ghost: "group-hover:bg-pine-700 group-hover:text-paper group-hover:shadow-card",
  },
  leaf: {
    tile: "bg-leaf-100 text-leaf-700",
    ghost: "group-hover:bg-leaf-600 group-hover:text-paper group-hover:shadow-card",
  },
  honey: {
    tile: "bg-honey-100 text-honey-600",
    ghost: "group-hover:bg-honey-500 group-hover:text-pine-950 group-hover:shadow-card",
  },
  clay: {
    tile: "bg-clay-100 text-clay-600",
    ghost: "group-hover:bg-clay-500 group-hover:text-paper group-hover:shadow-card",
  },
};

interface FeatureCardProps {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent: keyof typeof ACCENTS;
}

export function FeatureCard({ to, title, description, icon, accent }: FeatureCardProps) {
  const a = ACCENTS[accent];
  return (
    <motion.div variants={fadeUp}>
      <Link
        to={to}
        className="card card-lift group relative block h-full overflow-hidden p-5"
      >
        <span
          className={cn(
            "inline-flex rounded-2xl p-3 transition-all duration-300",
            a.tile,
            a.ghost,
          )}
        >
          <span className="block h-6 w-6 transition-transform duration-300 group-hover:scale-110">
            {icon}
          </span>
        </span>
        <h3 className="font-display mt-4 text-[17px] font-semibold text-pine-900">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-sage">{description}</p>
        <span className="absolute right-5 top-5 text-sage transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-pine-600">
          <IconArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
}