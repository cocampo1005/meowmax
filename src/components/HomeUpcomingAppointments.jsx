// src/components/HomeUpcomingAppointments.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit, // Import limit
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner"; // Adjust path as needed
import { Link } from "react-router-dom";
import { LocationIcon, ServiceIcon } from "../svgs/Icons"; // Assuming you have these icons

// Define clinic data (Ensure this is the same as used elsewhere)
const CLINICS = [
  { id: "clinicA", name: "Downtown Clinic", address: "123 Main St" },
  { id: "clinicB", name: "Uptown Clinic", address: "456 Oak Ave" },
  // Add more clinics as needed
];

export default function HomeUpcomingAppointments() {
  const { currentUser } = useAuth();
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Function to fetch upcoming appointments
  const fetchUpcomingAppointments = async (userId) => {
    if (!userId) return;

    setLoading(true);
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch more appointments than needed to ensure we get at least 3 unique dates
      const q = query(
        appointmentsCollectionRef,
        where("userId", "==", userId),
        where("appointmentTime", ">=", Timestamp.fromDate(todayStart)),
        orderBy("appointmentTime", "asc"),
        limit(20) // Fetch up to 20 appointments to find the next few dates
      );

      const querySnapshot = await getDocs(q);
      const fetchedAppointments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group appointments by date and clinic and select the next 3 distinct dates
      const groupedByDateAndClinic = groupAndLimitAppointments(
        fetchedAppointments,
        3
      );

      setUpcomingAppointments(groupedByDateAndClinic);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching upcoming appointments for home:", error);
      setLoading(false);
      // Optionally set an error state to display
    }
  };

  // Function to group appointments by date/clinic and limit to the next N distinct dates
  const groupAndLimitAppointments = (appointmentsList, limitDates) => {
    const groupedMap = new Map();

    appointmentsList.forEach((appointment) => {
      if (
        !appointment.appointmentTime ||
        !appointment.appointmentTime.toDate ||
        !appointment.clinicAddress
      ) {
        console.warn(
          "Skipping appointment with missing date or clinic:",
          appointment
        );
        return;
      }

      const appointmentDate = appointment.appointmentTime.toDate();
      // Use the date part for grouping, ignore time
      const dateKey = `${appointmentDate.getFullYear()}-${appointmentDate.getMonth()}-${appointmentDate.getDate()}`;
      const clinicAddress = appointment.clinicAddress;

      // Create a unique key for the group (Date + Clinic Address)
      const groupKey = `${dateKey}-${clinicAddress}`;

      if (groupedMap.has(groupKey)) {
        const existingGroup = groupedMap.get(groupKey);
        existingGroup.appointments.push(appointment);
        if (appointment.serviceType === "TNVR") {
          existingGroup.tnvrCount++;
        } else if (appointment.serviceType === "Foster") {
          existingGroup.fosterCount++;
        }
      } else {
        const newGroup = {
          groupKey: groupKey, // Store the key for potential future use (though not needed for display here)
          displayDate: appointmentDate,
          clinicAddress: clinicAddress,
          clinicName:
            CLINICS.find((c) => c.address === clinicAddress)?.name ||
            "Unknown Clinic",
          tnvrCount: appointment.serviceType === "TNVR" ? 1 : 0,
          fosterCount: appointment.serviceType === "Foster" ? 1 : 0,
          appointments: [appointment], // Store individual appointments if needed later (not displayed in home cards)
        };
        groupedMap.set(groupKey, newGroup);
      }
    });

    // Convert map values to array and sort by date
    const groupedArray = Array.from(groupedMap.values());
    groupedArray.sort(
      (a, b) => a.displayDate.getTime() - b.displayDate.getTime()
    );

    // Limit to the first `limitDates` distinct dates
    const limitedGroups = [];
    const distinctDates = new Set();

    for (const group of groupedArray) {
      const dateKey = `${group.displayDate.getFullYear()}-${group.displayDate.getMonth()}-${group.displayDate.getDate()}`;
      if (distinctDates.size < limitDates || distinctDates.has(dateKey)) {
        limitedGroups.push(group);
        distinctDates.add(dateKey);
      } else {
        // If we've already collected 3 distinct dates and this group is for a new date, stop
        break;
      }
    }

    // If needed, you can sort the limited groups by date again,
    // but the initial sort should handle this.
    limitedGroups.sort(
      (a, b) => a.displayDate.getTime() - b.displayDate.getTime()
    );

    return limitedGroups;
  };

  useEffect(() => {
    fetchUpcomingAppointments(currentUser?.uid);
  }, [currentUser]); // Re-fetch if currentUser changes

  return (
    <div className="mt-8 flex-grow">
      {" "}
      {/* Add some top margin to space it from content above */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <div className="flex items-center justify-between w-full md:w-auto">
          {" "}
          {/* New wrapper for heading and "View All" */}
          <h2 className="text-xl font-semibold text-primary-dark-purple">
            Upcoming appointments
          </h2>
          <Link
            to="/appointments"
            className="ml-4 text-secondary-purple hover:underline active:text-primary-dark-purple text-sm font-semibold md:ml-6"
          >
            View All &gt;
          </Link>
        </div>
        {/* Mobile-only Book Appointment button */}
        <div className="hidden md:flex">
          <Link
            to="/book-appointment"
            className="button text-sm px-4 py-2" // Added md:hidden
          >
            Book Appointment
          </Link>
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : upcomingAppointments.length > 0 ? (
        <div className="space-y-3 md:w-[33%]">
          {" "}
          {/* Add horizontal padding */}
          {upcomingAppointments.map((group) => {
            const displayDate = group.displayDate;
            const isDateValid = !isNaN(displayDate.getTime()); // Validate date

            const shortDay = isDateValid
              ? displayDate.toLocaleDateString("en-US", { weekday: "short" })
              : "---";
            const dayOfMonth = isDateValid ? displayDate.getDate() : "--";

            return (
              <div
                key={group.groupKey}
                className="flex bg-white rounded-lg shadow-md overflow-hidden"
              >
                {/* Left Date Section */}
                {isDateValid && (
                  <div className="w-20 flex-shrink-0 bg-secondary-purple text-white flex flex-col items-center justify-center p-2">
                    <span className="text-sm font-medium">{shortDay}</span>
                    <span className="text-2xl font-bold">{dayOfMonth}</span>
                  </div>
                )}

                {/* Right Appointment Summary Section */}
                <div className="flex-grow p-3 text-gray-700 flex flex-col justify-center">
                  {/* <div className="flex gap-2 items-center text-sm mb-1">
                    <LocationIcon />
                    <span>
                      {group.clinicName} - {group.clinicAddress}
                    </span>
                  </div> */}
                  <div className="flex gap-2 items-center justify-center text-lg">
                    {/* <ServiceIcon /> */}
                    {group.tnvrCount > 0 && (
                      <>
                        TNVR{" "}
                        <span className="ml-1 font-bold text-secondary-purple">
                          {group.tnvrCount}
                        </span>
                        {group.fosterCount > 0 && (
                          <span className="mx-2">|</span>
                        )}{" "}
                        {/* Separator if both exist */}
                      </>
                    )}
                    {group.fosterCount > 0 && (
                      <>
                        Foster{" "}
                        <span className="ml-1 font-bold text-secondary-purple">
                          {group.fosterCount}
                        </span>
                      </>
                    )}
                    {group.tnvrCount === 0 &&
                      group.fosterCount === 0 &&
                      "No slots booked"}{" "}
                    {/* Handle case with no slots */}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-600 mt-4 px-4">
          {" "}
          {/* Add horizontal padding */}
          No upcoming appointments.
        </div>
      )}
    </div>
  );
}
