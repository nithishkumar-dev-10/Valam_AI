import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Skeleton } from "../components/Skeleton";
import { IconLogout, IconTrash, IconUser } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { apiErrorMessage, fmtDate, fmtPhone } from "../lib/utils";
import { fadeUp, staggerParent } from "../lib/motion";

export function ProfilePage() {
  const { status, farmer, signOut, updateName, deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="card flex items-center gap-4 p-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (status !== "authed" || !farmer) return <Navigate to="/auth" replace />;

  const startEdit = () => {
    setDraft(farmer.name);
    setEditing(true);
  };

  const saveName = async () => {
    const next = draft.trim();
    if (next.length < 2 || next.length > 80) {
      toast.error(t("profile.toastNameLen"));
      return;
    }
    setSaving(true);
    try {
      await updateName(next);
      setEditing(false);
      toast.success(t("profile.toastNameUpdated"));
    } catch (err) {
      toast.error(t("profile.toastNameErrTitle"), apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.info(t("profile.toastAccountDeleted"));
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(t("profile.toastDeleteErrTitle"), apiErrorMessage(err));
      setDeleting(false);
    }
  };

  const initials = farmer.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-xl">
      <motion.h1
        variants={fadeUp}
        className="font-display text-3xl font-semibold text-pine-900 sm:text-4xl"
      >
        {t("profile.title")}
      </motion.h1>

      <motion.div variants={fadeUp} className="card mt-6 flex items-center gap-5 p-6">
        <div className="relative">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 font-display text-2xl font-semibold text-paper shadow-card">
            {initials || <IconUser className="h-8 w-8" />}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-leaf-500 text-paper shadow-edge">
            <CheckMarkDot />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl font-semibold text-pine-900">{farmer.name}</h2>
          <p className="tnum mt-0.5 text-[14px] text-sage">{fmtPhone(farmer.phone_number)}</p>
          <p className="mt-0.5 text-[12.5px] text-sage">{t("profile.memberSince", { date: fmtDate(farmer.created_at) })}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="card mt-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-pine-900">{t("profile.displayName")}</h3>
            <p className="mt-0.5 text-[12.5px] text-sage">{t("profile.displayNameSub")}</p>
          </div>
          {!editing && (
            <Button variant="secondary" onClick={startEdit}>
              {t("profile.edit")}
            </Button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {editing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden"
            >
              <div className="mt-4">
                <Field
                  label={t("profile.nameLabel")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  autoFocus
                />
                <div className="mt-3 flex gap-3">
                  <Button loading={saving} onClick={() => void saveName()}>
                    {t("profile.save")}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    {t("profile.cancel")}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div variants={fadeUp} className="card mt-4 p-6">
        <h3 className="text-[15px] font-semibold text-pine-900">{t("profile.session")}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sage">
          {t("profile.sessionSub")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              signOut();
              navigate("/", { replace: true });
            }}
          >
            <IconLogout className="h-4 w-4" /> {t("profile.signOut")}
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmDelete(true)}
          >
            <IconTrash className="h-4 w-4" /> {t("profile.deleteAccount")}
          </Button>
        </div>

        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-5 rounded-2xl border border-clay-200 bg-clay-50 p-4">
                <p className="text-[13.5px] font-semibold text-clay-700">
                  {t("profile.deleteTitle")}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-clay-600">
                  {t("profile.deleteSub")}
                </p>
                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    {t("profile.keepAccount")}
                  </Button>
                  <Button variant="danger" loading={deleting} onClick={() => void doDelete()}>
                    {t("profile.deleteForever")}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function CheckMarkDot() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}