// src/pages/AppointmentsListPage.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp, // Import Timestamp
} from "firebase/firestore";
import { db } from "../firebase"; // Import your Firestore instance
import { useAuth } from "../contexts/AuthContext"; // Import your AuthContext
import LoadingSpinner from "../components/LoadingSpinner"; // Assuming you have a spinner component
import { Link } from "react-router-dom"; // For the Book Appointment button
import {
  AppointmentListItemIcon,
  ChevronDown,
  ChevronUp,
  LocationIcon,
  ServiceIcon,
} from "../svgs/Icons";

// Define clinic data (Replace with fetching from Firestore if needed)
const CLINICS = [
  { id: "clinicA", name: "Downtown Clinic", address: "123 Main St" },
  { id: "clinicB", name: "Uptown Clinic", address: "456 Oak Ave" },
  // Add more clinics as needed
];

export default function Appointments() {
  const { currentUser } = useAuth(); // Get the current user from AuthContext
  const [appointments, setAppointments] = useState([]); // State to hold the fetched appointments
  const [loading, setLoading] = useState(true); // State to manage loading status
  const [view, setView] = useState("upcoming"); // State to toggle between 'upcoming' and 'history'
  // State to track the key of the single expanded group, or null if none expanded
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);

  // Function to fetch appointments from Firestore
  const fetchAppointments = async (userId, currentView) => {
    setLoading(true); // Set loading to true before fetching
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      let q;

      // Use Timestamp.now() for accurate comparison with Firestore Timestamps
      const nowTimestamp = Timestamp.now();

      // Construct the query based on the selected view
      if (currentView === "upcoming") {
        q = query(
          appointmentsCollectionRef,
          where("userId", "==", userId), // Filter by the current user's ID
          where("appointmentTime", ">=", nowTimestamp), // Use Timestamp.now() for upcoming
          orderBy("appointmentTime", "asc") // Order by time ascending for upcoming
        );
      } else {
        // currentView === 'history'
        q = query(
          appointmentsCollectionRef,
          where("userId", "==", userId), // Filter by the current user's ID
          where("appointmentTime", "<", nowTimestamp), // Use Timestamp.now() for history
          orderBy("appointmentTime", "desc") // Order by time descending for history (most recent first)
        );
      }

      const querySnapshot = await getDocs(q); // Execute the query
      const fetchedAppointments = querySnapshot.docs.map((doc) => ({
        id: doc.id, // Include the document ID
        ...doc.data(), // Include all other fields from the document
      }));

      setAppointments(fetchedAppointments); // Update the appointments state
      setLoading(false); // Set loading to false after fetching
    } catch (error) {
      console.error("Error fetching appointments:", error);
      setLoading(false); // Set loading to false even if there's an error
      // TODO: Display an error message to the user
    }
  };

  // Fetch appointments when the component mounts or the view changes
  useEffect(() => {
    if (currentUser) {
      fetchAppointments(currentUser.uid, view);
    }
    // Reset expanded state when view changes
    setExpandedGroupKey(null); // Collapse all cards when switching views
  }, [currentUser, view]); // Re-run effect if currentUser or view changes

  // Function to group appointments by date AND clinic from an already sorted list
  const groupAppointmentsByDateAndClinic = (appointmentsList) => {
    const grouped = [];
    let currentGroup = null;

    appointmentsList.forEach((appointment) => {
      // Ensure appointmentTime is a Timestamp and clinicAddress exists
      if (
        !appointment.appointmentTime ||
        !appointment.appointmentTime.toDate ||
        !appointment.clinicAddress
      ) {
        console.warn(
          "Skipping appointment with missing date or clinic:",
          appointment
        );
        return; // Skip appointments with invalid data
      }

      const appointmentDate = appointment.appointmentTime.toDate(); // Get the Date object
      // Create a date key based on the local date parts
      const dateKey = `${appointmentDate.getFullYear()}-${appointmentDate.getMonth()}-${appointmentDate.getDate()}`;
      const clinicAddress = appointment.clinicAddress;

      // Check if this appointment belongs to the current group
      if (
        currentGroup &&
        currentGroup.dateKey === dateKey &&
        currentGroup.clinicAddress === clinicAddress
      ) {
        // Add individual appointment to the current group's appointments list
        currentGroup.appointments.push(appointment);
        // Update counts for the group summary
        if (appointment.serviceType === "TNVR") {
          currentGroup.tnvrCount++;
        } else if (appointment.serviceType === "Foster") {
          currentGroup.fosterCount++;
        }
      } else {
        // Start a new group
        currentGroup = {
          dateKey: dateKey, // Key for grouping
          displayDate: appointmentDate, // Date object for formatting
          clinicAddress: clinicAddress,
          clinicName:
            CLINICS.find((c) => c.address === clinicAddress)?.name ||
            "Unknown Clinic",
          tnvrCount: appointment.serviceType === "TNVR" ? 1 : 0,
          fosterCount: appointment.serviceType === "Foster" ? 1 : 0,
          appointments: [appointment], // Start a list of individual appointments for this group
        };
        grouped.push(currentGroup);
      }
    });

    return grouped; // The input list is already sorted by the fetchAppointments query
  };

  // Function to toggle expanded state of a single group card
  const toggleExpanded = (groupKey) => {
    setExpandedGroupKey((prevKey) => {
      // If the clicked card is already the expanded one, collapse it (set to null)
      // Otherwise, expand the clicked card (set state to groupKey)
      return prevKey === groupKey ? null : groupKey;
    });
  };

  return (
    // Main container: flex column to organize header, tabs, scrollable content, and fixed button
    <div className="px-4 py-24 flex flex-grow flex-col">
      {/* Header (handled elsewhere) */}

      {/* Toggle buttons for Upcoming/History */}
      <div className="fixed bg-primary-light-purple top-16 right-0 left-0 flex w-full p-4 flex-shrink-0">
        {" "}
        {/* flex-shrink-0 prevents tabs from shrinking */}
        <button
          className={`flex-1 text-center px-6 py-3 text-lg font-semibold transition-colors duration-200 rounded-tl-lg rounded-bl-lg
              ${
                view === "upcoming"
                  ? "bg-secondary-purple text-white shadow-md" // Active (Upcoming)
                  : "bg-primary-white text-gray-700 hover:bg-gray-300" // Inactive (Upcoming)
              }`}
          onClick={() => setView("upcoming")}
        >
          Upcoming
        </button>
        <button
          className={`flex-1 text-center px-6 py-3 text-lg font-semibold transition-colors duration-200 rounded-tr-lg rounded-br-lg
              ${
                view === "history"
                  ? "bg-secondary-purple text-white shadow-md" // Active (History)
                  : "bg-primary-white text-gray-700 hover:bg-gray-300" // Inactive (History)
              }`}
          onClick={() => setView("history")}
        >
          History
        </button>
      </div>

      {/* Scrollable Appointment List Container */}
      <div className="flex-grow overflow-visible">
        {/* Display Loading Spinner or Appointments List */}
        {loading ? (
          <LoadingSpinner />
        ) : appointments.length > 0 ? (
          <div className="space-y-6">
            {groupAppointmentsByDateAndClinic(appointments).map((group) => {
              const groupKey = `${group.dateKey}-${group.clinicAddress}`;
              const isExpanded = expandedGroupKey === groupKey;

              const displayDate = group.displayDate;
              const isDateValid = !isNaN(displayDate.getTime());

              const formattedDateHeader = isDateValid
                ? displayDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Invalid Date";

              const dayOfWeek = isDateValid
                ? displayDate.toLocaleDateString("en-US", {
                    weekday: "long",
                  })
                : "";

              return (
                // Card container
                <div key={groupKey} className="bg-white rounded-lg shadow-md">
                  {/* Card Header */}
                  {isDateValid && (
                    <div
                      onClick={() => toggleExpanded(groupKey)}
                      className="bg-secondary-purple cursor-pointer rounded-t-lg text-white px-4 py-3 flex justify-between items-center"
                    >
                      <div className="flex-grow">
                        <h3 className="text-lg font-semibold">
                          {formattedDateHeader}
                        </h3>
                        <span className="text-md">{dayOfWeek}</span>
                      </div>
                      {/* Expand/Collapse Icon */}
                      <div className="flex items-center ml-2">
                        {" "}
                        {isExpanded ? (
                          // Up Chevron when expanded
                          <ChevronUp />
                        ) : (
                          // Down Chevron when collapsed
                          <ChevronDown />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex gap-2 items-center text-gray-700 mb-2">
                      <LocationIcon />
                      <span>
                        {group.clinicName} - {group.clinicAddress}
                      </span>
                    </div>
                    {isExpanded ? (
                      // Expanded View: List of Individual Appointments (Service, Status)
                      <ul className="space-y-3">
                        {group.appointments.map((appointment) => (
                          <li key={appointment.id}>
                            <div className="flex justify-between items-center text-gray-700">
                              <div className="flex w-full items-center justify-between">
                                {/* Service Type Icon Placeholder */}
                                {/* Replace with your actual icon component */}
                                <div className="flex items-center">
                                  <AppointmentListItemIcon />
                                  <span className="mr-2">
                                    {appointment.serviceType}
                                  </span>
                                </div>
                                {/* Status Pill */}
                                {appointment.status && (
                                  <span
                                    className={`px-3 py-1 text-sm font-semibold rounded-full ${
                                      appointment.status === "Completed"
                                        ? "bg-tertiary-purple text-primary-dark-purple"
                                        : appointment.status === "Canceled"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {appointment.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      // Condensed View: Booked Slots Summary (Default)
                      <div className="flex gap-2 text-gray-700">
                        <ServiceIcon />
                        {group.tnvrCount > 0 && (
                          <>
                            {" TNVR "}
                            <span className="font-bold text-accent-purple">
                              {group.tnvrCount}
                            </span>
                          </>
                        )}
                        {group.tnvrCount > 0 && group.fosterCount > 0
                          ? " "
                          : ""}
                        {group.fosterCount > 0 && (
                          <>
                            {" Foster "}
                            <span className="font-bold text-accent-purple">
                              {group.fosterCount}
                            </span>
                          </>
                        )}
                        {group.tnvrCount === 0 &&
                          group.fosterCount === 0 &&
                          " None"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Message if no appointments are found
          <div className="text-center text-gray-600 mt-8">
            No {view} appointments found.
          </div>
        )}
      </div>

      {/* Book Appointment Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-primary-light-purple z-40">
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
