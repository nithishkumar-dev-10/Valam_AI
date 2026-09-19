import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { FeatureCard } from "../components/FeatureCard";
import {
  IconDroplet,
  IconEar,
  IconLeaf,
  IconMic,
  IconScan,
  IconSparkle,
  IconSun,
} from "../components/Icons";
import { useAuth } from "../lib/auth";
import { fadeUp, staggerParent } from "../lib/motion";

const FEATURES = [
  {
    to: "/crop",
    title: "Crop suggestion",
    description: "Tell us where you farm — we pull live weather & regional soil and suggest the best crop.",
    icon: <IconEar className="h-6 w-6" />,
    accent: "honey" as const,
  },
  {
    to: "/scan",
    title: "Disease detection",
    description: "Photograph a sick leaf and get a diagnosis with an honest confidence score.",
    icon: <IconLeaf className="h-6 w-6" />,
    accent: "leaf" as const,
  },
  {
    to: "/scan",
    title: "Pest & weed watch",
    description: "Same photo pipeline, trained on weeds and pests that sneak onto the field.",
    icon: <IconScan className="h-6 w-6" />,
    accent: "clay" as const,
  },
  {
    to: "/voice",
    title: "Voice assistant",
    description: "Ask anything in Tamil or English — answers come back spoken, in your language.",
    icon: <IconMic className="h-6 w-6" />,
    accent: "pine" as const,
  },
];

const STEPS = [
  { n: "01", t: "Speak or snap", d: "Ask in Tamil or English, or photograph the plant." },
  { n: "02", t: "We dig deeper", d: "Live weather, regional soil and a vision model size up your field." },
  { n: "03", t: "Act with confidence", d: "Clear guidance — spoken back, with the score behind it." },
];

const SOURCES = [
  { icon: IconSun, label: "NASA POWER" },
  { icon: IconDroplet, label: "OpenWeather" },
  { icon: IconLeaf, label: "Regional soil data" },
  { icon: IconSparkle, label: "Trained vision models" },
];

export function HomePage() {
  const navigate = useNavigate();
  const { status, farmer } = useAuth();

  return (
    <>
      <section className="relative overflow-hidden pb-8 pt-2 sm:pb-12 sm:pt-6">
        <HeroArt />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-leaf-800"
          >
            <IconSparkle className="h-3.5 w-3.5" />
            {status === "authed" && farmer ? `Vanakkam, ${farmer.name.split(" ")[0]}!` : "Your AI farm partner"}
            <span className="font-normal text-leaf-600">· தமிழிலும் பேசலாம்</span>
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-display mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-pine-900 sm:text-6xl"
          >
            A good harvest starts
            <br />
            with a good <span className="relative text-honey-600">guess
              <motion.svg
                viewBox="0 0 120 10"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-honey-400"
                fill="none"
                aria-hidden="true"
              >
                <motion.path
                  d="M2 8C30 3 60 3 118 6"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </motion.svg>
            </span>.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-sage sm:text-base"
          >
            Valam AI listens, looks and advises in your language — crop ideas grounded in
            real soil and weather data, and disease or pest answers from a single field photo.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate("/voice")} className="w-full sm:w-auto">
              <IconMic className="h-4 w-4" />
              Ask with your voice
            </Button>
            <Button variant="secondary" onClick={() => navigate("/scan")} className="w-full sm:w-auto">
              <IconScan className="h-4 w-4" />
              Scan a leaf
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <motion.section
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </motion.section>

      <motion.section
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-14"
      >
        <h2 className="font-display text-center text-2xl font-semibold text-pine-900 sm:text-3xl">
          How it works
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <motion.div variants={fadeUp} key={s.n} className="card card-lift relative p-6">
              <span className="font-display text-4xl font-semibold text-leaf-200">{s.n}</span>
              <h3 className="font-display mt-2 text-lg font-semibold text-pine-900">{s.t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-sage">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-12"
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-mist bg-surface/70 px-5 py-4">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-sage">
            Grounded in
          </span>
          {SOURCES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-paper px-3 py-1.5 text-[12.5px] font-medium text-pine-800"
            >
              <Icon className="h-3.5 w-3.5 text-leaf-600" />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-[12px] leading-relaxed text-sage">
          Built as a volunteer research project — always double-check critical decisions before acting.
        </p>
      </motion.section>
    </>
  );
}

function HeroArt() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <motion.div
        animate={{ x: [0, -10, 0], y: [0, 8, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-16 -top-8 text-honey-200 sm:right-8 sm:top-2"
      >
        <IconSun className="h-40 w-40 opacity-70 sm:h-52 sm:w-52" />
      </motion.div>
      <motion.div
        animate={{ x: [0, 12, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-20 bottom-4 text-leaf-200 sm:left-4"
      >
        <IconLeaf className="h-36 w-36 opacity-60" />
      </motion.div>
    </div>
  );
}