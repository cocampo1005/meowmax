import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, User, Users, ClipboardList } from "lucide-react";
import { LogoHorizontalWhite } from "../svgs/Logos";
const DesktopSidebar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navLinkClasses = (path) =>
    `flex items-center p-4 text-lg font-medium transition-colors duration-200 ease-in-out relative overflow-hidden ${
      isActive(path)
        ? "text-accent-purple bg-primary-light-purple shadow-[inset_-10px_0px_8px_-3px_rgba(192,132,252,0.7)]" // Active state styles
        : "text-white hover:bg-primary-light-purple hover:text-accent-purple" // Inactive state styles
    }`;

  return (
    <div className="hidden md:flex flex-col bg-secondary-purple text-white w-64 min-h-screen">
      {/* Logo at the top */}
      <Link to={"/"} className="p-4 mb-8">
        <LogoHorizontalWhite />
      </Link>
      {/* Navigation Links */}
      <nav className="flex flex-col flex-grow">
        <Link to="/" className={navLinkClasses("/")}>
          <Home size={24} className="mr-3" />
          Home
        </Link>
        <Link to="/appointments" className={navLinkClasses("/appointments")}>
          <CalendarDays size={24} className="mr-3" />
          Appointments
        </Link>
        <Link
          to="/accounts-manager"
          className={navLinkClasses("/accounts-manager")}
        >
          <Users size={24} className="mr-3" />
          Accounts Manager
        </Link>
        <Link
          to="/appointments-manager"
          className={navLinkClasses("/appointments-manager")}
        >
          <ClipboardList size={24} className="mr-3" />
          Appointments Manager
        </Link>
        <div className="mt-auto">
          <Link to="/profile" className={navLinkClasses("/profile")}>
            <User size={24} className="mr-3" />
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default DesktopSidebar;
