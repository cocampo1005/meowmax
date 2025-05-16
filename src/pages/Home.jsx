// src/pages/HomePage.jsx (or your home page component)
import React from "react";
import HomeUpcomingAppointments from "../components/HomeUpcomingAppointments"; // Adjust path
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="container flex flex-col h-full mx-auto p-4">
      {/* Other home page content */}
      <h1 className="text-2xl text-center font-bold mb-4">{`Welcome ${currentUser.firstName}!`}</h1>
      {/* ... other sections ... */}

      {/* Include the upcoming appointments component */}
      <HomeUpcomingAppointments />

      {/* ... potentially more content or a Book Appointment button */}
      {/* You might move your Book Appointment button from Appointments.jsx here */}
      <div className="mt-8">
        {" "}
        {/* Add some top margin */}
        <Link
          to="/book-appointment"
          className="button w-full text-center inline-block px-8 py-3 text-lg font-semibold"
        >
          Book Appointment
        </Link>
      </div>
    </div>
  );
}
