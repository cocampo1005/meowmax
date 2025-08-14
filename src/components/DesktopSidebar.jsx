import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, User, Users, ClipboardList } from "lucide-react";
import { LogoHorizontalWhite } from "../svgs/Logos";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

const DesktopSidebar = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { t } = useTranslation("common");

  const isActive = (path) => location.pathname === path;

  const navLinkClasses = (path) =>
    `flex items-center p-4 text-lg font-medium transition-colors duration-200 ease-in-out relative overflow-hidden ${
      isActive(path)
        ? "text-accent-purple bg-primary-light-purple shadow-[inset_-10px_0px_8px_-3px_rgba(192,132,252,0.7)]"
        : "text-white hover:bg-primary-light-purple hover:text-accent-purple"
    }`;

  return (
    <div className="hidden md:flex flex-col bg-secondary-purple text-white w-64 min-h-screen">
      <Link to="/" className="p-4 mb-8">
        <LogoHorizontalWhite />
      </Link>

      <nav className="flex flex-col flex-grow">
        <Link to="/" className={navLinkClasses("/")} aria-label={t("nav.home")}>
          <Home size={24} className="mr-3" />
          {t("nav.home")}
        </Link>
        <Link
          to="/appointments"
          className={navLinkClasses("/appointments")}
          aria-label={t("nav.appointments")}
        >
          <CalendarDays size={24} className="mr-3" />
          {t("nav.appointments")}
        </Link>

        {currentUser?.role === "admin" && (
          <>
            <Link
              to="/accounts-manager"
              className={navLinkClasses("/accounts-manager")}
              aria-label={t("nav.accountsManager")}
            >
              <Users size={24} className="mr-3" />
              {t("nav.accountsManager")}
            </Link>
            <Link
              to="/appointments-manager"
              className={navLinkClasses("/appointments-manager")}
              aria-label={t("nav.appointmentsManager")}
            >
              <ClipboardList size={24} className="mr-3" />
              {t("nav.appointmentsManager")}
            </Link>
          </>
        )}

        <div className="mt-auto">
          <Link
            to="/profile"
            className={navLinkClasses("/profile")}
            aria-label={t("nav.profile")}
          >
            <User size={24} className="mr-3" />
            {t("nav.profile")}
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default DesktopSidebar;
