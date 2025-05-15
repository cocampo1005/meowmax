import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, User } from "lucide-react";

const BottomNavBar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full bg-primary-light-purple shadow-[0_-4px_6px_-1px_rgb(216_203_230_/0.75),_0_-2px_4px_-2px_rgb(216_203_230_/0.05)]">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {/* Home Link */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center text-sm font-medium transition-colors ${
              isActive("/")
                ? "text-accent-purple bg-[radial-gradient(ellipse_at_center,_rgba(192,_132,_252,_0.3)_0%,_transparent_70%)]"
                : "text-gray-500 hover:text-accent-purple" // Highlight active link
            }`}
            aria-label="Home"
          >
            <Home size={24} /> {/* Home icon */}
            <span>Home</span>
          </Link>

          {/* Appointments Link */}
          <Link
            to="/appointments"
            className={`flex flex-col items-center justify-center text-sm font-medium transition-colors ${
              isActive("/appointments")
                ? "text-accent-purple bg-[radial-gradient(ellipse_at_center,_rgba(192,_132,_252,_0.3)_0%,_transparent_70%)]"
                : "text-gray-500 hover:text-accent-purple" // Highlight active link
            }`}
            aria-label="Appointments"
          >
            <CalendarDays size={24} /> {/* Calendar icon */}
            <span>Appointments</span>
          </Link>

          {/* Profile Link */}
          <Link
            to="/profile"
            className={`flex flex-col items-center justify-center text-sm font-medium transition-colors ${
              isActive("/profile")
                ? "text-accent-purple bg-[radial-gradient(ellipse_at_center,_rgba(192,_132,_252,_0.3)_0%,_transparent_70%)]"
                : "text-gray-500 hover:text-accent-purple" // Highlight active link
            }`}
            aria-label="Profile"
          >
            <User size={24} /> {/* User icon */}
            <span>Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavBar;
