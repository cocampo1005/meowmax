// src/pages/BookAppointmentPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  runTransaction,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { SuccessIcon } from "../svgs/Icons";
import { DateTime } from "luxon";
import { LogoMeowMaxed } from "../svgs/Logos";

// Clinic Data
const CLINIC = {
  id: "clinicA",
  name: "Street Cat Clinic",
  address: "500 NE 167th St, Miami, FL 33162",
};

export default function BookAppointmentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState({
    tnvr: 0,
    foster: 0,
  });
  const [dailyCapacity, setDailyCapacity] = useState({ tnvr: 0, foster: 0 });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [tnvrSlotsToBook, setTnvrSlotsToBook] = useState(0);
  const [fosterSlotsToBook, setFosterSlotsToBook] = useState(0);
  const [notes, setNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appointmentCapacitiesMap, setAppointmentCapacitiesMap] = useState({}); // New state for capacities map

  // State for Confirmation Modal
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookedAppointmentDetails, setBookedAppointmentDetails] =
    useState(null);

  // --- Slot Availability Logic ---

  // Function to fetch available slots for a selected date
  const fetchAvailableSlotsForDate = useCallback(async (date) => {
    setLoadingSlots(true);
    setError(null);
    setTnvrSlotsToBook(0);
    setFosterSlotsToBook(0);

    const docId = date.toISOString().split("T")[0]; // e.g., "YYYY-MM-DD"

    try {
      // Fetch daily capacity first using the document ID
      const capacityDocRef = doc(db, "appointmentCapacities", docId);
      const capacityDoc = await getDoc(capacityDocRef);

      let tnvrCap = 0;
      let fosterCap = 0;

      if (capacityDoc.exists()) {
        const data = capacityDoc.data();
        tnvrCap = data.tnvrCapacity || 0;
        fosterCap = data.fosterCapacity || 0;
      }
      setDailyCapacity({ tnvr: tnvrCap, foster: fosterCap });

      const timeZone = "America/New_York";

      const startOfDay = DateTime.fromJSDate(date, { zone: timeZone })
        .startOf("day")
        .toJSDate();

      const endOfDay = DateTime.fromJSDate(date, { zone: timeZone })
        .endOf("day")
        .toJSDate();

      const appointmentsRef = collection(db, "appointments");
      const q = query(
        appointmentsRef,
        where("appointmentTime", ">=", Timestamp.fromDate(startOfDay)),
        where("appointmentTime", "<=", Timestamp.fromDate(endOfDay)),
        where("clinicAddress", "==", CLINIC.address)
      );

      const querySnapshot = await getDocs(q);
      let bookedTNVR = 0;
      let bookedFoster = 0;

      querySnapshot.forEach((doc) => {
        const appointment = doc.data();
        if (appointment.serviceType === "TNVR") {
          bookedTNVR++;
        } else if (appointment.serviceType === "Foster") {
          bookedFoster++;
        }
      });

      setAvailableSlots({
        tnvr: tnvrCap - bookedTNVR,
        foster: fosterCap - bookedFoster,
      });
    } catch (err) {
      console.error("Error fetching available slots:", err);
      setError("Failed to load available slots.");
      setAvailableSlots({ tnvr: 0, foster: 0 });
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Effect to fetch capacities for all days in the current month
  useEffect(() => {
    const fetchMonthlyCapacities = async () => {
      const startOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      );
      const endOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      );

      const capacitiesRef = collection(db, "appointmentCapacities");
      // Query for all documents in the collection (or a reasonable range if your collection is huge)
      // Since document IDs are date strings, we can't directly query by Timestamp field that doesn't exist.
      // We will fetch all and filter client-side by month based on doc.id.
      // If your collection becomes very large, consider re-adding a 'date' field as Timestamp for server-side filtering.
      const q = query(capacitiesRef); // Fetch all documents in the collection

      try {
        const querySnapshot = await getDocs(q);
        const capacities = {};
        querySnapshot.forEach((doc) => {
          const docId = doc.id; // doc.id is already "YYYY-MM-DD"
          const [year, month, day] = docId.split("-").map(Number);
          const docDate = new Date(year, month - 1, day); // Month is 0-indexed in JS Date

          // Filter client-side to include only documents for the current month
          if (
            docDate.getMonth() === currentMonth.getMonth() &&
            docDate.getFullYear() === currentMonth.getFullYear()
          ) {
            const data = doc.data();
            capacities[docId] = {
              tnvrCapacity: data.tnvrCapacity || 0,
              fosterCapacity: data.fosterCapacity || 0,
            };
          }
        });
        setAppointmentCapacitiesMap(capacities);
      } catch (err) {
        console.error("Error fetching monthly capacities:", err);
      }
    };

    fetchMonthlyCapacities();
  }, [currentMonth]); // Re-fetch when currentMonth changes

  // Fetch available slots when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlotsForDate(selectedDate);
    } else {
      // Reset available slots and quantities when date is cleared
      setAvailableSlots({ tnvr: 0, foster: 0 });
      setDailyCapacity({ tnvr: 0, foster: 0 });
      setTnvrSlotsToBook(0);
      setFosterSlotsToBook(0);
    }
  }, [selectedDate, fetchAvailableSlotsForDate, currentUser]);

  // --- Calendar Logic ---
  const daysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const generateCalendarDays = (date) => {
    const numDays = daysInMonth(date);
    const startDay = firstDayOfMonth(date);
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= numDays; i++) {
      days.push(i);
    }
    return days;
  };
  const calendarDays = generateCalendarDays(currentMonth);

  const resetSelection = () => {
    setSelectedDate(null);
    setTnvrSlotsToBook(0);
    setFosterSlotsToBook(0);
    setNotes(""); // Clear notes on reset
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(
        prevMonth.getFullYear(),
        prevMonth.getMonth() - 1,
        1
      );
      if (
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        resetSelection();
      }
      return newMonth;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(
        prevMonth.getFullYear(),
        prevMonth.getMonth() + 1,
        1
      );
      if (
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        resetSelection();
      }
      return newMonth;
    });
  };

  const handleDaySelect = async (day) => {
    if (day === null) return;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    const dayOfWeek = date.getDay();
    const isPast = date < new Date().setHours(0, 0, 0, 0);
    const isClinicClosed =
      dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thursday, Friday, Saturday

    if (isPast || isClinicClosed) return;

    const docId = date.toISOString().split("T")[0]; // e.g., "YYYY-MM-DD"
    const capacityData = appointmentCapacitiesMap[docId];

    if (!capacityData) {
      console.log("No capacity set for selected date.");
      // Optionally, you can set an error or message to the user
      setError("No capacity information available for this date.");
      return;
    }

    const tnvrCap = capacityData.tnvrCapacity || 0;
    const fosterCap = capacityData.fosterCapacity || 0;

    if (tnvrCap === 0 && fosterCap === 0) {
      console.log("Capacity is 0 for both services on this date.");
      setError("No available slots for any service on this date.");
      return;
    }
    setError(null); // Clear previous error if selection is valid
    setSelectedDate(date);
    // Capacity and available slots will be set by the useEffect watching selectedDate
  };

  // --- Booking Logic ---

  const handleBookAppointment = async () => {
    console.log("🔥 Booking started");
    console.log("Selected Date:", selectedDate);
    console.log(
      "Slots to book — TNVR:",
      tnvrSlotsToBook,
      "Foster:",
      fosterSlotsToBook
    );
    console.log("Current User:", currentUser);

    if (
      !selectedDate ||
      (!tnvrSlotsToBook && !fosterSlotsToBook) ||
      !currentUser
    ) {
      setError("Please select a date, and at least one slot.");
      console.warn("❌ Missing required info to book");
      return;
    }

    if (
      !currentUser.firstName ||
      !currentUser.lastName ||
      !currentUser.trapperNumber
    ) {
      setError("Your profile is missing required information.");
      console.warn("❌ currentUser is missing profile fields:", currentUser);
      return;
    }

    if (tnvrSlotsToBook < 0 || fosterSlotsToBook < 0) {
      setError("Number of slots cannot be negative.");
      console.warn("❌ Negative slot count");
      return;
    }

    if (
      tnvrSlotsToBook > availableSlots.tnvr ||
      fosterSlotsToBook > availableSlots.foster
    ) {
      setError("You are trying to book more slots than available.");
      console.warn("❌ Overbooking detected");
      fetchAvailableSlotsForDate(selectedDate);
      return;
    }

    setBookingLoading(true);
    setError(null);

    try {
      const appointmentDateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      const appointmentTimestamp = Timestamp.fromDate(appointmentDateTime);
      const nowTimestamp = Timestamp.now();

      const clinicAddress = CLINIC.address;
      const clinicName = CLINIC.name;

      const appointmentsRef = collection(db, "appointments");
      const bookedAppointmentDetailsList = [];

      console.log("📝 Starting transaction...");

      await runTransaction(db, async (transaction) => {
        for (let i = 0; i < tnvrSlotsToBook; i++) {
          const docRef = doc(appointmentsRef); // creates new doc ID
          const appointmentData = {
            userId: currentUser.uid,
            trapperFirstName: currentUser.firstName,
            trapperLastName: currentUser.lastName,
            trapperPhone: currentUser.phone || "",
            trapperNumber: currentUser.trapperNumber,
            serviceType: "TNVR",
            clinicAddress,
            appointmentTime: appointmentTimestamp,
            status: "Upcoming",
            createdAt: nowTimestamp,
            createdByUserId: currentUser.uid,
            updatedAt: nowTimestamp,
            lastModifiedByUserId: currentUser.uid,
            notes,
          };
          console.log("🟣 Setting TNVR appointment:", appointmentData);
          transaction.set(docRef, appointmentData);
          bookedAppointmentDetailsList.push(appointmentData);
        }

        for (let i = 0; i < fosterSlotsToBook; i++) {
          const docRef = doc(appointmentsRef);
          const appointmentData = {
            userId: currentUser.uid,
            trapperFirstName: currentUser.firstName,
            trapperLastName: currentUser.lastName,
            trapperPhone: currentUser.phone || "",
            trapperNumber: currentUser.trapperNumber,
            serviceType: "Foster",
            clinicAddress,
            appointmentTime: appointmentTimestamp,
            status: "Upcoming",
            createdAt: nowTimestamp,
            createdByUserId: currentUser.uid,
            updatedAt: nowTimestamp,
            lastModifiedByUserId: currentUser.uid,
            notes,
          };
          console.log("🟢 Setting Foster appointment:", appointmentData);
          transaction.set(docRef, appointmentData);
          bookedAppointmentDetailsList.push(appointmentData);
        }
      });

      console.log("✅ Transaction committed successfully");

      const totalBookedCount = tnvrSlotsToBook + fosterSlotsToBook;

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "performanceMetrics.totalAppointmentsBooked":
          increment(totalBookedCount),
      });
      console.log("📈 Updated performance metrics");

      setBookedAppointmentDetails({
        bookedCount: totalBookedCount,
        selectedDate,
        clinicName,
        clinicAddress,
        appointmentTime: appointmentDateTime.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        serviceTypes: { tnvr: tnvrSlotsToBook, foster: fosterSlotsToBook },
      });

      setShowConfirmationModal(true);
      console.log("🎉 Booking success — showing confirmation modal");

      const previouslySelectedDate = selectedDate;
      resetSelection();
      fetchAvailableSlotsForDate(previouslySelectedDate);
    } catch (err) {
      console.error("❌ Error booking appointment:", err);
      setError(err.message || "Failed to book appointment. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  // Modal Close Handler
  const handleCloseModal = () => {
    setShowConfirmationModal(false);
    setBookedAppointmentDetails(null);
    navigate("/appointments");
  };

  // Calculate already booked slots based on available slots and daily capacity
  const alreadyBookedTnvrSlots = dailyCapacity.tnvr - availableSlots.tnvr;
  const alreadyBookedFosterSlots = dailyCapacity.foster - availableSlots.foster;

  // Calculate the total slots to display on the progress bar (already booked + user input)
  const displayedTotalBookedTnvr = alreadyBookedTnvrSlots + tnvrSlotsToBook;
  const displayedTotalBookedFoster =
    alreadyBookedFosterSlots + fosterSlotsToBook;

  return (
    <div className="container mx-auto p-8 pb-24 md:p-8 md:max-w-3xl">
      <h1 className="text-2xl text-center text-accent-purple font-bold mb-4">
        Book Appointment
      </h1>

      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={goToPreviousMonth}
          className="px-2 py-1 active:bg-tertiary-purple rounded"
        >
          &lt;
        </button>
        <h2 className="text-xl text-accent-purple font-bold">
          {currentMonth.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          onClick={goToNextMonth}
          className="px-2 py-1 active:bg-tertiary-purple rounded"
        >
          &gt;
        </button>
      </div>

      {/* Calendar Grid (Days of the week header) */}
      <div className="grid grid-cols-7 text-center text-sm font-medium mb-2">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Calendar Grid (Days) */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((day, index) => {
          const date =
            day !== null
              ? new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day
                )
              : null;
          const isPastDate = date && date < new Date().setHours(0, 0, 0, 0);
          const dayOfWeek = date ? date.getDay() : null;
          const isClinicClosed =
            dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thursday, Friday, Saturday
          const docId = date ? date.toISOString().split("T")[0] : null;
          const capacityForDay = appointmentCapacitiesMap[docId];
          const isCapacityMissing = !capacityForDay;
          const isNoAvailableCapacity =
            capacityForDay &&
            capacityForDay.tnvrCapacity === 0 &&
            capacityForDay.fosterCapacity === 0;

          return (
            <div
              key={index}
              className={`p-2 rounded cursor-pointer
                ${day === null ? "bg-purple-100" : ""}
                ${
                  day !== null &&
                  (isPastDate ||
                    isClinicClosed ||
                    isCapacityMissing ||
                    isNoAvailableCapacity)
                    ? "text-gray-300 cursor-not-allowed"
                    : ""
                }
                ${
                  selectedDate &&
                  day === selectedDate.getDate() &&
                  currentMonth.getMonth() === selectedDate.getMonth() &&
                  currentMonth.getFullYear() === selectedDate.getFullYear()
                    ? "bg-accent-purple text-white font-bold"
                    : day !== null &&
                      !isPastDate &&
                      !isClinicClosed &&
                      !isNoAvailableCapacity &&
                      !isCapacityMissing
                    ? "hover:bg-tertiary-purple hover:text-primary-white"
                    : ""
                }
              `}
              onClick={() => handleDaySelect(day)}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Available Slots and Slot Quantity Selection */}
      {selectedDate && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          {loadingSlots ? (
            <LoadingSpinner />
          ) : error && !bookingLoading ? (
            <div className="text-red-500">{error}</div>
          ) : availableSlots.tnvr === 0 && availableSlots.foster === 0 ? (
            // NEW: Check if all slots are fully booked
            <div className="flex flex-col items-center justify-center text-center py-8 text-accent-purple">
              <LogoMeowMaxed />
              <div className="text-lg font-semibold mb-2">
                All slots have been fully booked for this day.
              </div>
              <div className="text-sm">
                Please select another date or check back later for
                cancellations.
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-lg text-accent-purple font-semibold mb-4">
                Available Slots for {selectedDate.toLocaleDateString()} at{" "}
                {CLINIC.name}
              </h3>
              {/* Slot Quantity Selection and Progress Bars */}
              <div className="mb-4">
                <h4 className="font-medium text-accent-purple mb-4">
                  Book Slots:
                </h4>
                <div className="flex flex-col gap-4">
                  {/* TNVR Slots */}
                  <div className="flex items-center gap-4">
                    <label htmlFor="tnvr-slots" className="w-14 font-semibold">
                      TNVR:
                    </label>
                    <input
                      id="tnvr-slots"
                      type="number"
                      min="0"
                      max={availableSlots.tnvr}
                      value={tnvrSlotsToBook}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setTnvrSlotsToBook(
                          Math.max(
                            0,
                            Math.min(
                              availableSlots.tnvr,
                              parseInt(e.target.value) || 0
                            )
                          )
                        )
                      }
                      className="w-16 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple text-center"
                      disabled={availableSlots.tnvr <= 0}
                    />
                    {/* Progress Bar and Count */}
                    <div className="flex items-center flex-grow">
                      <div className="w-full h-4 bg-gray-200 rounded-l-full overflow-hidden">
                        <div
                          className="h-full bg-accent-purple transition-all duration-300 ease-in-out"
                          style={{
                            width: `${
                              dailyCapacity.tnvr > 0
                                ? (displayedTotalBookedTnvr /
                                    dailyCapacity.tnvr) *
                                  100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                        {displayedTotalBookedTnvr}/{dailyCapacity.tnvr}
                      </span>
                    </div>
                  </div>

                  {/* Foster Slots */}
                  <div className="flex items-center gap-4">
                    <label
                      htmlFor="foster-slots"
                      className="w-14 font-semibold"
                    >
                      Foster:
                    </label>
                    <input
                      id="foster-slots"
                      type="number"
                      min="0"
                      max={availableSlots.foster}
                      value={fosterSlotsToBook}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setFosterSlotsToBook(
                          Math.max(
                            0,
                            Math.min(
                              availableSlots.foster,
                              parseInt(e.target.value) || 0
                            )
                          )
                        )
                      }
                      className="w-16 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple text-center"
                      disabled={availableSlots.foster <= 0}
                    />
                    {/* Progress Bar and Count */}
                    <div className="flex items-center flex-grow">
                      <div className="w-full h-4 bg-gray-200 rounded-l-full overflow-hidden">
                        <div
                          className="h-full bg-accent-purple transition-all duration-300 ease-in-out"
                          style={{
                            width: `${
                              dailyCapacity.foster > 0
                                ? (displayedTotalBookedFoster /
                                    dailyCapacity.foster) *
                                  100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                        {displayedTotalBookedFoster}/{dailyCapacity.foster}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Field */}
              <div className="mb-4">
                <label
                  htmlFor="notes"
                  className="block text-accent-purple font-medium mb-2"
                >
                  Notes (Optional):
                </label>
                <textarea
                  id="notes"
                  className="w-full p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              {/* Book Appointment Button */}
              <button
                className="button w-full"
                onClick={handleBookAppointment}
                disabled={
                  (!tnvrSlotsToBook && !fosterSlotsToBook) || bookingLoading
                }
              >
                {bookingLoading
                  ? "Booking..."
                  : `Book ${tnvrSlotsToBook + fosterSlotsToBook} Slot(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {/* --- Confirmation Modal --- */}
      {showConfirmationModal && bookedAppointmentDetails && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="absolute w-screen h-screen bg-slate-900 opacity-70"></div>
          <div className="bg-primary-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4 z-100">
            <h2 className="text-2xl font-bold mb-4 text-center text-accent-purple">
              {bookedAppointmentDetails.bookedCount > 1
                ? "Appointments Booked!"
                : "Appointment Booked!"}
            </h2>
            <div className="flex items-center justify-center mb-4">
              <SuccessIcon />
            </div>
            <p className="mb-2 text-gray-700 text-center">
              {bookedAppointmentDetails.bookedCount > 1
                ? "Your appointments are confirmed for:"
                : "Your appointment is confirmed for:"}
            </p>
            <div className="text-center mb-4">
              <p className="font-semibold text-3xl">
                {/* Check if selectedDate is a valid Date object before formatting */}
                {
                  bookedAppointmentDetails.selectedDate instanceof Date &&
                  !isNaN(bookedAppointmentDetails.selectedDate.getTime())
                    ? `${bookedAppointmentDetails.selectedDate.toLocaleDateString(
                        undefined,
                        { weekday: "long" }
                      )} - ${bookedAppointmentDetails.selectedDate.toLocaleDateString(
                        undefined,
                        { month: "long", day: "numeric", year: "numeric" }
                      )}`
                    : bookedAppointmentDetails.selectedDate // Fallback for invalid date
                }
              </p>
              <p className="text-gray-600">
                {bookedAppointmentDetails.clinicName}
              </p>
              <p className="text-gray-600">
                {bookedAppointmentDetails.clinicAddress}
              </p>
            </div>
            <div className="text-center mb-4">
              <p className="font-semibold text-md">
                {bookedAppointmentDetails.bookedCount > 1
                  ? "Booked slots:"
                  : "Booked slot:"}
              </p>
              {bookedAppointmentDetails.serviceTypes.tnvr > 0 && (
                <p className="text-gray-700">
                  {bookedAppointmentDetails.serviceTypes.tnvr} x TNVR
                </p>
              )}
              {bookedAppointmentDetails.serviceTypes.foster > 0 && (
                <p className="text-gray-700">
                  {bookedAppointmentDetails.serviceTypes.foster} x Foster
                </p>
              )}
            </div>
            <button className="button w-full" onClick={handleCloseModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
