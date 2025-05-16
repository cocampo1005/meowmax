import React from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import BottomNavBar from "../components/BottomNavBar";
import { LogoHorizontal } from "../svgs/Logos";

export default function ProtectedRoute() {
  const { currentUser, loading } = useAuth();

  // While loading, render loading spinner
  if (loading) {
    return <LoadingSpinner />;
  }

  // If user is authenticated, render the child routes with Top Logo and BottomNavBar
  if (currentUser) {
    return (
      <>
        <Link
          to={"/"}
          className="fixed bg-primary-light-purple top-0 right-0 left-0 flex justify-center items-center"
        >
          <LogoHorizontal />
        </Link>
        <div className="py-16 h-screen">
          <Outlet />
        </div>
        <BottomNavBar />
      </>
    );
  }

  // If user is not authenticated, redirect to the login page
  return <Navigate to="/login" />;
}
