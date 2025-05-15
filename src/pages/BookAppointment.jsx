// src/pages/BookAppointmentPage.jsx
import React, { useState, useEffect } from "react";
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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { useNavigate } from "react-router-dom";

// Mock Clinic Data
const CLINICS = [
  { id: "clinicA", name: "Downtown Clinic", address: "123 Main St" },
  { id: "clinicB", name: "Uptown Clinic", address: "456 Oak Ave" },
];

// Constants for slot capacity
const TNVR_CAPACITY = 70;
const FOSTER_CAPACITY = 10;

export default function BookAppointmentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [availableSlots, setAvailableSlots] = useState({
    tnvr: TNVR_CAPACITY,
    foster: FOSTER_CAPACITY,
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [tnvrSlotsToBook, setTnvrSlotsToBook] = useState(0);
  const [fosterSlotsToBook, setFosterSlotsToBook] = useState(0);
  const [notes, setNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trapperDetails, setTrapperDetails] = useState(null); // To store trapper details for denormalization

  // State for Confirmation Modal
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookedAppointmentDetails, setBookedAppointmentDetails] =
    useState(null);

  // Fetch Trapper Details on Load
  useEffect(() => {
    const fetchTrapperDetails = async () => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setTrapperDetails(userDoc.data());
          } else {
            console.error(
              "Trapper document not found for current user:",
              currentUser.uid
            );
            setError("Could not load trapper details.");
          }
        } catch (err) {
          console.error("Error fetching trapper details:", err);
          setError("Failed to load trapper details.");
        }
      }
    };
    fetchTrapperDetails();
  }, [currentUser]);

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
        setSelectedDate(null);
        setSelectedClinicId("");
        setAvailableSlots({ tnvr: TNVR_CAPACITY, foster: FOSTER_CAPACITY });
        setTnvrSlotsToBook(0);
        setFosterSlotsToBook(0);
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
        setSelectedDate(null);
        setSelectedClinicId("");
        setAvailableSlots({ tnvr: TNVR_CAPACITY, foster: FOSTER_CAPACITY });
        setTnvrSlotsToBook(0);
        setFosterSlotsToBook(0);
      }
      return newMonth;
    });
  };

  const handleDaySelect = (day) => {
    if (day === null) return;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    // Prevent selecting past dates
    if (date < new Date().setHours(0, 0, 0, 0)) {
      console.log("Cannot select a past date.");
      return;
    }
    setSelectedDate(date);
    setSelectedClinicId(""); // Reset clinic when date changes
    setTnvrSlotsToBook(0);
    setFosterSlotsToBook(0);
  };

  // --- Slot Availability Logic ---

  // Fetch available slots when selectedDate or selectedClinicId changes
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDate || !selectedClinicId) {
        setAvailableSlots({ tnvr: TNVR_CAPACITY, foster: FOSTER_CAPACITY });
        return;
      }

      setLoadingSlots(true);
      setError(null);

      try {
        const startOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0
        );
        const endOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59
        );

        const appointmentsRef = collection(db, "appointments");
        const q = query(
          appointmentsRef,
          where("appointmentTime", ">=", Timestamp.fromDate(startOfDay)),
          where("appointmentTime", "<=", Timestamp.fromDate(endOfDay)),
          where(
            "clinicAddress",
            "==",
            CLINICS.find((c) => c.id === selectedClinicId)?.address || ""
          ) // Filter by clinic address
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
          tnvr: TNVR_CAPACITY - bookedTNVR,
          foster: FOSTER_CAPACITY - bookedFoster,
        });
      } catch (err) {
        console.error("Error fetching available slots:", err);
        setError("Failed to load available slots.");
        setAvailableSlots({ tnvr: 0, foster: 0 });
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [selectedDate, selectedClinicId]);

  // --- Booking Logic ---

  const handleBookAppointment = async () => {
    // Basic client-side validation
    if (
      !selectedDate ||
      !selectedClinicId ||
      (!tnvrSlotsToBook && !fosterSlotsToBook) ||
      !currentUser ||
      !trapperDetails
    ) {
      setError("Please select a date, clinic, and at least one slot.");
      return;
    }

    if (tnvrSlotsToBook < 0 || fosterSlotsToBook < 0) {
      setError("Number of slots cannot be negative.");
      return;
    }

    setBookingLoading(true);
    setError(null);

    try {
      const appointmentDateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        9, // Using 9:00 AM as a fixed time
        0,
        0
      );
      const appointmentTimestamp = Timestamp.fromDate(appointmentDateTime);
      const nowTimestamp = Timestamp.now();

      const clinic = CLINICS.find((c) => c.id === selectedClinicId);
      const clinicAddress = clinic?.address || "";
      const clinicName = clinic?.name || "";

      if (!clinicAddress) {
        throw new Error("Selected clinic address not found.");
      }

      const appointmentsRef = collection(db, "appointments");
      const bookedAppointmentDetailsList = []; // To collect details for confirmation

      // Create documents for TNVR slots
      for (let i = 0; i < tnvrSlotsToBook; i++) {
        const newAppointment = {
          userId: currentUser.uid,
          trapperFirstName: trapperDetails.firstName || "",
          trapperLastName: trapperDetails.lastName || "",
          trapperPhoneNumber: trapperDetails.phone || "",
          serviceType: "TNVR",
          clinicAddress: clinicAddress,
          appointmentTime: appointmentTimestamp,
          status: "Upcoming",
          createdAt: nowTimestamp,
          createdByUserId: currentUser.uid,
          updatedAt: nowTimestamp,
          lastModifiedByUserId: currentUser.uid,
          notes: notes,
        };
        await addDoc(appointmentsRef, newAppointment); // Use addDoc to create a new document with a generated ID
        bookedAppointmentDetailsList.push(newAppointment); // Add to list for confirmation
      }

      // Create documents for Foster slots
      for (let i = 0; i < fosterSlotsToBook; i++) {
        const newAppointment = {
          userId: currentUser.uid,
          trapperFirstName: trapperDetails.firstName || "",
          trapperLastName: trapperDetails.lastName || "",
          trapperPhoneNumber: trapperDetails.phone || "",
          serviceType: "Foster",
          clinicAddress: clinicAddress,
          appointmentTime: appointmentTimestamp,
          status: "Upcoming",
          createdAt: nowTimestamp,
          createdByUserId: currentUser.uid,
          updatedAt: nowTimestamp,
          lastModifiedByUserId: currentUser.uid,
          notes: notes,
        };
        await addDoc(appointmentsRef, newAppointment); // Use addDoc to create a new document with a generated ID
        bookedAppointmentDetailsList.push(newAppointment); // Add to list for confirmation
      }

      setBookingLoading(false);
      // Set confirmation details based on booked slots
      setBookedAppointmentDetails({
        bookedCount: tnvrSlotsToBook + fosterSlotsToBook,
        selectedDate: selectedDate,
        clinicName: clinicName,
        clinicAddress: clinicAddress,
        appointmentTime: appointmentDateTime.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        serviceTypes: { tnvr: tnvrSlotsToBook, foster: fosterSlotsToBook },
      });
      setShowConfirmationModal(true);

      // Reset the form after successful booking
      setSelectedDate(null);
      setSelectedClinicId("");
      setTnvrSlotsToBook(0);
      setFosterSlotsToBook(0);
      setNotes("");
      // Re-fetch availability for display after booking
      const dateString = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const availabilityDocRef = doc(
        db,
        "dailyAvailability",
        `${selectedClinicId}-${dateString}`
      );
      const availabilityDocSnap = await getDoc(availabilityDocRef);

      if (availabilityDocSnap.exists()) {
        const data = availabilityDocSnap.data();
        setAvailableSlots({
          tnvr: data.tnvrAvailable || 0,
          foster: data.fosterAvailable || 0,
        });
      } else {
        setAvailableSlots({ tnvr: TNVR_CAPACITY, foster: FOSTER_CAPACITY });
      }
    } catch (err) {
      console.error("Error booking appointment:", err);
      setError("Failed to book appointment. Please try again.");
      setBookingLoading(false);
    }
  };

  // Modal Close Handler
  const handleCloseModal = () => {
    setShowConfirmationModal(false);
    setBookedAppointmentDetails(null);
    navigate("/appointments");
  };

  // Show loading spinner while fetching trapper details
  if (!trapperDetails) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Book Appointment</h1>

      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={goToPreviousMonth}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          &lt;
        </button>
        <h2 className="text-xl font-semibold">
          {currentMonth.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          onClick={goToNextMonth}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          &gt;
        </button>
      </div>

      {/* Calendar Grid (Days of the week header) */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-600 mb-2">
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
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`p-2 rounded cursor-pointer
              ${day === null ? "bg-gray-100" : ""}
              ${
                day !== null &&
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day
                ) < new Date().setHours(0, 0, 0, 0)
                  ? "text-gray-400 cursor-not-allowed"
                  : ""
              }
              ${
                selectedDate &&
                day === selectedDate.getDate() &&
                currentMonth.getMonth() === selectedDate.getMonth() &&
                currentMonth.getFullYear() === selectedDate.getFullYear()
                  ? "bg-accent-purple text-white font-bold"
                  : day !== null &&
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth(),
                      day
                    ) >= new Date().setHours(0, 0, 0, 0)
                  ? "hover:bg-gray-200"
                  : ""
              }
            `}
            onClick={() => handleDaySelect(day)}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Clinic Selection */}
      {selectedDate && (
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            Select Clinic for {selectedDate.toLocaleDateString()}
          </h3>
          <select
            className="w-full p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple"
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
          >
            <option value="">-- Select a Clinic --</option>
            {CLINICS.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Available Slots and Slot Quantity Selection */}
      {selectedDate && selectedClinicId && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            Available Slots for {selectedDate.toLocaleDateString()} at{" "}
            {CLINICS.find((c) => c.id === selectedClinicId)?.name}
          </h3>

          {loadingSlots ? (
            <LoadingSpinner />
          ) : error && !bookingLoading ? (
            <div className="text-red-500">{error}</div>
          ) : (
            <>
              {/* Display Available Slots */}
              <div className="mb-4">
                <p className="text-gray-700">
                  TNVR Slots Available: {availableSlots.tnvr}
                </p>
                <p className="text-gray-700">
                  Foster Slots Available: {availableSlots.foster}
                </p>
              </div>

              {/* Slot Quantity Selection */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Number of Slots to Book:</h4>
                <div className="flex flex-col gap-4">
                  {/* TNVR Slots */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="tnvr-slots" className="w-20">
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
                      className="w-15 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple"
                      disabled={availableSlots.tnvr <= 0}
                    />
                    <span className="text-gray-600">
                      {" "}
                      (Max {availableSlots.tnvr})
                    </span>
                  </div>

                  {/* Foster Slots */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="foster-slots" className="w-20">
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
                      className="w-15 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple"
                      disabled={availableSlots.foster <= 0}
                    />
                    <span className="text-gray-600">
                      {" "}
                      (Max {availableSlots.foster})
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes Field */}
              <div className="mb-4">
                <label htmlFor="notes" className="block font-medium mb-2">
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

      {/* Display Booking Error */}
      {error && !loadingSlots && !bookingLoading && (
        <div className="mt-4 text-red-500 text-center">{error}</div>
      )}

      {/* --- Confirmation Modal --- */}
      {showConfirmationModal && bookedAppointmentDetails && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="absolute w-screen h-screen bg-primary-dark-purple opacity-50"></div>
          <div className="bg-primary-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4 z-100">
            <h2 className="text-2xl font-bold mb-4 text-center text-accent-purple">
              Appointment Booked!
            </h2>
            <div className="text-center mb-4">
              <p className="text-success-green text-4xl">✓</p>{" "}
              {/* Simple checkmark */}
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
