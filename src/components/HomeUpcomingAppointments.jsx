import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";

// Define clinic data (Ensure this is the same as used elsewhere)
const CLINICS = [
  { id: "clinicA", name: "Downtown Clinic", address: "123 Main St" },
  { id: "clinicB", name: "Uptown Clinic", address: "456 Oak Ave" },
];

export default function HomeUpcomingAppointments() {
  const { currentUser } = useAuth();
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation("common");

  // Function to fetch upcoming appointments
  const fetchUpcomingAppointments = async (userId) => {
    if (!userId) return;

    setLoading(true);
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      const clinicZone = "America/New_York";
      const todayStart = DateTime.now()
        .setZone(clinicZone)
        .startOf("day")
        .toJSDate();

      // Fetch more appointments than needed to ensure we get at least 3 unique dates
      const q = query(
        appointmentsCollectionRef,
        where("userId", "==", userId),
        where("appointmentTime", ">=", Timestamp.fromDate(todayStart)),
        orderBy("appointmentTime", "asc"),
        limit(100)
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
    }
  };

  // Function to group appointments by date/clinic and limit to the next N distinct dates
  const groupAndLimitAppointments = (appointmentsList, limitDates) => {
    const groupedMap = new Map();

    // Group appointments by date and clinic
    appointmentsList.forEach((appointment) => {
      if (
        !appointment.appointmentTime ||
        !appointment.appointmentTime.toDate ||
        !appointment.clinicAddress
      ) {
        console.warn("Skipping invalid appointment:", appointment);
        return;
      }

      const appointmentDate = appointment.appointmentTime.toDate();

      const dateKey = `${appointmentDate.getFullYear()}-${appointmentDate.getMonth()}-${appointmentDate.getDate()}`;
      const clinicAddress = appointment.clinicAddress;
      const groupKey = `${dateKey}-${clinicAddress}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          groupKey,
          displayDate: appointmentDate,
          clinicAddress,
          clinicName:
            CLINICS.find((c) => c.address === clinicAddress)?.name ||
            "Unknown Clinic",
          tnvrCount: 0,
          fosterCount: 0,
          appointments: [],
        });
      }

      const group = groupedMap.get(groupKey);
      group.appointments.push(appointment);

      if (appointment.serviceType === "TNVR") {
        group.tnvrCount++;
      } else if (appointment.serviceType === "Foster") {
        group.fosterCount++;
      }
    });

    // Convert to array and sort by date
    const groupedArray = Array.from(groupedMap.values());
    groupedArray.sort(
      (a, b) => a.displayDate.getTime() - b.displayDate.getTime()
    );

    // Keep only the first N distinct dates
    const seenDates = new Set();
    const limitedGroups = [];

    for (const group of groupedArray) {
      const dateKey = `${group.displayDate.getFullYear()}-${group.displayDate.getMonth()}-${group.displayDate.getDate()}`;

      if (!seenDates.has(dateKey)) {
        if (seenDates.size >= limitDates) break;
        seenDates.add(dateKey);
      }

      limitedGroups.push(group); // Includes all groups from the allowed dates
    }

    return limitedGroups;
  };

  useEffect(() => {
    fetchUpcomingAppointments(currentUser?.uid);
  }, [currentUser]); // Re-fetch if currentUser changes

  // Locale for weekday labels based on current i18n language
  const weekdayLocale = i18n.language === "es" ? "es-ES" : "en-US";

  return (
    <div className="mt-8 flex-grow">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h2 className="text-xl font-semibold text-primary-dark-purple">
            {t("home.upcomingTitle")}
          </h2>
          <Link
            to="/appointments"
            className="ml-4 text-secondary-purple hover:underline active:text-primary-dark-purple text-sm font-semibold md:ml-6"
            aria-label={t("home.viewAll")}
          >
            {t("home.viewAll")} &gt;
          </Link>
        </div>

        {/* Desktop-only Book Appointment button */}
        <div className="hidden md:flex">
          <Link to="/book-appointment" className="button text-sm px-4 py-2">
            {t("book.title")}
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : upcomingAppointments.length > 0 ? (
        <div className="space-y-3 md:w-[33%]">
          {upcomingAppointments.map((group) => {
            const displayDate = group.displayDate;
            const isDateValid = !isNaN(displayDate.getTime());

            const shortDay = isDateValid
              ? displayDate.toLocaleDateString(weekdayLocale, {
                  weekday: "short",
                })
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
                  <div className="flex gap-2 items-center justify-center text-lg">
                    {group.tnvrCount > 0 && (
                      <>
                        {t("book.tnvr")}{" "}
                        <span className="ml-1 font-bold text-secondary-purple">
                          {group.tnvrCount}
                        </span>
                        {group.fosterCount > 0 && (
                          <span className="mx-2">|</span>
                        )}
                      </>
                    )}
                    {group.fosterCount > 0 && (
                      <>
                        {t("book.foster")}{" "}
                        <span className="ml-1 font-bold text-secondary-purple">
                          {group.fosterCount}
                        </span>
                      </>
                    )}
                    {group.tnvrCount === 0 &&
                      group.fosterCount === 0 &&
                      t("home.noSlotsBooked")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-600 mt-4 px-4">
          {t("home.noUpcoming")}
        </div>
      )}
    </div>
  );
}
