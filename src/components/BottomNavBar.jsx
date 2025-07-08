import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, User, Users, ClipboardList } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const BottomNavBar = () => {
  const location = useLocation();
  const { currentUser } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navItemClass = (path) =>
    `flex flex-col items-center justify-center text-sm font-medium transition-colors ${
      isActive(path)
        ? "text-accent-purple bg-[radial-gradient(ellipse_at_center,_rgba(192,_132,_252,_0.3)_0%,_transparent_70%)]"
        : "text-gray-500 hover:text-accent-purple"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full bg-primary-light-purple shadow-[0_-4px_6px_-1px_rgb(216_203_230_/0.75),_0_-2px_4px_-2px_rgb(216_203_230_/0.05)] md:hidden">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {/* Home Link */}
          <Link to="/" className={navItemClass("/")} aria-label="Home">
            <Home size={24} />
            <span>Home</span>
          </Link>

          {/* Appointments */}
          <Link
            to="/appointments"
            className={navItemClass("/appointments")}
            aria-label="Appointments"
          >
            <CalendarDays size={24} />
            <span>Appointments</span>
          </Link>

          {/* Admin-only: Accounts Manager */}
          {currentUser?.role === "admin" && (
            <Link
              to="/accounts-manager"
              className={navItemClass("/accounts-manager")}
              aria-label="Accounts Manager"
            >
              <Users size={24} />
              <span>Accounts</span>
            </Link>
          )}

          {/* Admin-only: Appointments Manager */}
          {currentUser?.role === "admin" && (
            <Link
              to="/appointments-manager"
              className={navItemClass("/appointments-manager")}
              aria-label="Appointments Manager"
            >
              <ClipboardList size={24} />
              <span>Manage</span>
            </Link>
          )}

          {/* Profile */}
          <Link
            to="/profile"
            className={navItemClass("/profile")}
            aria-label="Profile"
          >
            <User size={24} />
            <span>Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavBar;
