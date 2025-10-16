import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, User, Users, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

const BottomNavBar = () => {
  const location = useLocation();
  const { t } = useTranslation("common");
  const { currentUser } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navItemClass = (path) =>
    `flex flex-col items-center justify-center text-sm font-medium transition-colors ${
      isActive(path)
        ? "text-accent-purple bg-[radial-gradient(ellipse_at_center,_rgba(192,_132,_252,_0.3)_0%,_transparent_70%)]"
        : "text-gray-500 hover:text-primary-dark-purple"
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full bg-primary-light-purple shadow-[0_-4px_6px_-1px_rgb(216_203_230_/0.75),_0_-2px_4px_-2px_rgb(216_203_230_/0.05)] md:hidden"
      aria-label="Bottom navigation"
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {/* Home Link */}
          <Link
            to="/"
            className={navItemClass("/")}
            aria-label={t("aria.nav.home")}
            title={t("nav.home")}
          >
            <Home className="mb-1" aria-hidden="true" />
            <span>{t("nav.home")}</span>
          </Link>

          {/* Appointments Link */}
          <Link
            to="/appointments"
            className={navItemClass("/appointments")}
            aria-label={t("aria.nav.appointments")}
            title={t("nav.appointments")}
          >
            <CalendarDays className="mb-1" aria-hidden="true" />
            <span>{t("nav.appointments")}</span>
          </Link>

          {/* Admin-only: Accounts */}
          {currentUser?.role === "admin" && (
            <Link
              to="/accounts-manager"
              className={navItemClass("/accounts-manager")}
              aria-label={t("aria.nav.accounts")}
              title={t("nav.accounts")}
            >
              <Users className="mb-1" aria-hidden="true" />
              <span>{t("nav.accounts")}</span>
            </Link>
          )}

          {/* Admin-only: Manage */}
          {currentUser?.role === "admin" && (
            <Link
              to="/appointments-manager"
              className={navItemClass("/appointments-manager")}
              aria-label={t("aria.nav.manage")}
              title={t("nav.manage")}
            >
              <ClipboardList className="mb-1" aria-hidden="true" />
              <span>{t("nav.manage")}</span>
            </Link>
          )}

          {/* Profile Link */}
          <Link
            to="/profile"
            className={navItemClass("/profile")}
            aria-label={t("aria.nav.profile")}
            title={t("nav.profile")}
          >
            <User className="mb-1" aria-hidden="true" />
            <span>{t("nav.profile")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavBar;
