import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import BottomNavBar from "../components/BottomNavBar";
import DesktopSidebar from "../components/DesktopSidebar";
import { LogoHorizontal } from "../svgs/Logos";

export default function ProtectedRoute() {
  const { currentUser, loading } = useAuth();

  // While loading, render loading spinner
  if (loading) {
    return <LoadingSpinner />;
  }

  // If user is authenticated, render the child routes
  if (currentUser) {
    return (
      <div className="flex h-screen">
        {/* Desktop Sidebar - Hidden on mobile */}
        <DesktopSidebar />
        <div className="flex-grow flex flex-col overflow-y-auto">
          {/* Logo at the top for mobile devices */}
          <Link
            to={"/"}
            className="fixed top-0 right-0 left-0 flex justify-center items-center bg-primary-light-purple md:hidden z-50" // Hide on md and up, keep on top layering
          >
            <LogoHorizontal />
          </Link>
          {/* Main content area */}
          <div className="pt-16 md:p-6 flex-grow relative">
            <Outlet />
          </div>
        </div>
        {/* Bottom navigation bar for mobile devices */}
        <div className="md:hidden">
          <BottomNavBar />
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect to the login page
  return <Navigate to="/login" />;
}
