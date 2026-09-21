import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CropForm } from "../components/CropForm";
import { fadeUp, staggerParent } from "../lib/motion";

export function CropPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl">
      <motion.div variants={staggerParent} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="text-center sm:text-left">
          <h1 className="font-display text-3xl font-semibold text-pine-900 sm:text-4xl">
            {t("crop.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-sage sm:mx-0">
            {t("crop.subtitle")}
          </p>
        </motion.div>
      </motion.div>

      <div className="mt-6">
        <CropForm />
      </div>
    </div>
  );
}