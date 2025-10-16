import React, { useState, useEffect, useCallback } from "react";
import {
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase"; // Assuming you have your firebase config in ../firebase.js
import LoadingSpinner from "./LoadingSpinner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { DateTime } from "luxon";

// Clinic Data - copied from AppointmentsManager.jsx and BookAppointment.jsx for consistency
const CLINIC = {
  id: "clinicA",
  name: "Street Cat Clinic",
  address: "500 NE 167th St, Miami, FL 33162",
};

// Constants for slot capacity (assuming these are global capacities for the clinic)
// const TNVR_CAPACITY = 70;
// const FOSTER_CAPACITY = 10;

export default function AppointmentModal({
  isOpen,
  onClose,
  appointment, // If provided, it's for editing; otherwise, for creating
  onSave, // Callback function to handle saving (create or update)
  initialDate, // Optional: for pre-selecting a date when creating a new appointment from calendar
}) {
  const { currentUser } = useAuth();
  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [trapperFirstName, setTrapperFirstName] = useState("");
  const [trapperLastName, setTrapperLastName] = useState("");
  const [trapperPhone, setTrapperPhone] = useState("");
  const [trapperNumber, setTrapperNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [tnvrSlotsToBook, setTnvrSlotsToBook] = useState(0); // For create mode, or current for edit
  const [fosterSlotsToBook, setFosterSlotsToBook] = useState(0); // For create mode, or current for edit

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Availability states
  const [availableSlots, setAvailableSlots] = useState({
    tnvr: 0,
    foster: 0,
  });
  const [dailyCapacity, setDailyCapacity] = useState({ tnvr: 0, foster: 0 });

  const [loadingSlots, setLoadingSlots] = useState(false);

  // User data for dropdown and metadata
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [createdByUserName, setCreatedByUserName] = useState("");
  const [lastModifiedByUserName, setLastModifiedByUserName] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditMode = !!appointment;

  // Fetch users for the dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("trapperNumber", "asc"));
        const querySnapshot = await getDocs(q);
        const usersList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users for selection.");
      } finally {
        setLoadingUsers(false);
      }
    };
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  // Populate form fields if an appointment is passed (edit mode)
  useEffect(() => {
    // Helper to find the next available date
    const findNextAvailableDate = (startDate) => {
      let date = new Date(startDate);
      date.setHours(0, 0, 0, 0); // Normalize to start of day

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (true) {
        const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

        // Conditions for a disabled day: past date OR Thursday/Friday/Saturday
        const isPastDate = date < today;
        const isClinicClosed =
          dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thursday, Friday, Saturday

        if (!isPastDate && !isClinicClosed) {
          return date; // Found an available date
        }
        date.setDate(date.getDate() + 1); // Move to the next day
      }
    };

    if (appointment) {
      setSelectedUserId(appointment.userId || "");
      setTrapperFirstName(appointment.trapperFirstName || "");
      setTrapperLastName(appointment.trapperLastName || "");
      setTrapperPhone(appointment.trapperPhone || "");
      setTrapperNumber(appointment.trapperNumber || "");
      setNotes(appointment.notes || "");
      if (appointment.serviceType === "TNVR") {
        setTnvrSlotsToBook(1);
        setFosterSlotsToBook(0);
      } else if (appointment.serviceType === "Foster") {
        setTnvrSlotsToBook(0);
        setFosterSlotsToBook(1);
      }
      setSelectedDate(appointment.appointmentTime.toDate());
      setCurrentMonth(appointment.appointmentTime.toDate());

      // Fetch created by and last modified by user names
      const fetchUserNames = async () => {
        if (appointment.createdByUserId) {
          const userDoc = await getDoc(
            doc(db, "users", appointment.createdByUserId)
          );
          if (userDoc.exists()) {
            setCreatedByUserName(
              `${userDoc.data().firstName} ${userDoc.data().lastName}`
            );
          }
        }
        if (appointment.lastModifiedByUserId) {
          const userDoc = await getDoc(
            doc(db, "users", appointment.lastModifiedByUserId)
          );
          if (userDoc.exists()) {
            setLastModifiedByUserName(
              `${userDoc.data().firstName} ${userDoc.data().lastName}`
            );
          }
        }
      };
      fetchUserNames();
    } else {
      // Create mode - reset fields
      setSelectedUserId("");
      setTrapperFirstName("");
      setTrapperLastName("");
      setTrapperPhone("");
      setTrapperNumber("");
      setNotes("");
      setTnvrSlotsToBook(0);
      setFosterSlotsToBook(0);

      let initialDayToSelect;
      if (initialDate) {
        // If an initial date is provided, find the next available day from it
        initialDayToSelect = findNextAvailableDate(initialDate);
      } else {
        // If no initial date, find the next available day starting from today
        initialDayToSelect = findNextAvailableDate(new Date());
      }

      setSelectedDate(initialDayToSelect);
      setCurrentMonth(initialDayToSelect);
      setCreatedByUserName("");
      setLastModifiedByUserName("");
    }
    setError(null);
  }, [isOpen, appointment, initialDate]);

  // Function to fetch available slots - Adapted from BookAppointment.jsx
  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedDate) {
      setAvailableSlots({ tnvr: 0, foster: 0 });
      setDailyCapacity({ tnvr: 0, foster: 0 });
      if (!isEditMode) {
        setTnvrSlotsToBook(0);
        setFosterSlotsToBook(0);
      }
      return;
    }

    setLoadingSlots(true);
    setError(null);
    if (!isEditMode) {
      setTnvrSlotsToBook(0);
      setFosterSlotsToBook(0);
    }

    try {
      const docId = selectedDate.toISOString().split("T")[0];
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

      const startOfDay = DateTime.fromJSDate(selectedDate, { zone: timeZone })
        .startOf("day")
        .toJSDate();

      const endOfDay = DateTime.fromJSDate(selectedDate, { zone: timeZone })
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
        const appt = doc.data();
        if (appointment && doc.id === appointment.id) return;
        if (appt.serviceType === "TNVR") bookedTNVR++;
        else if (appt.serviceType === "Foster") bookedFoster++;
      });

      setAvailableSlots({
        tnvr: tnvrCap - bookedTNVR,
        foster: fosterCap - bookedFoster,
      });
    } catch (err) {
      console.error("Error fetching available slots:", err);
      setError("Failed to load available slots.");
      setAvailableSlots({ tnvr: 0, foster: 0 });
      setDailyCapacity({ tnvr: 0, foster: 0 });
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, appointment, isEditMode]);

  // Fetch available slots when selectedDate changes or modal opens for edit mode
  useEffect(() => {
    if (isOpen) {
      fetchAvailableSlots();
    }
  }, [selectedDate, isOpen, fetchAvailableSlots]);

  // Calendar Logic
  const daysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 = Sunday, 6 = Saturday

  const generateCalendarDays = (date) => {
    const numDays = daysInMonth(date);
    const startDay = firstDayOfMonth(date);
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null); // Placeholder for days before the 1st
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
      // If changing month would deselect the date, clear it in create mode
      if (
        !appointment &&
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        setSelectedDate(null);
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
      // If changing month would deselect the date, clear it in create mode
      if (
        !appointment &&
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        setSelectedDate(null);
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
    const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

    // Disable past dates and Thursday (4), Friday (5), Saturday (6) for booking
    // However, for admin *editing*, allow selecting any date.
    if (
      !isEditMode && // Only apply restrictions in create mode
      (date < today || dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6)
    ) {
      console.log(
        "Cannot select a past date or a day when the clinic is closed for booking."
      );
      return;
    }
    setSelectedDate(date);
    // In create mode, if a user changes the date, reset slot counts
    if (!isEditMode) {
      setTnvrSlotsToBook(0);
      setFosterSlotsToBook(0);
    }
  };

  // Handle user selection from dropdown
  const handleUserSelect = (e) => {
    const userId = e.target.value;
    setSelectedUserId(userId);
    const selectedUser = users.find((user) => user.id === userId);
    if (selectedUser) {
      setTrapperFirstName(selectedUser.firstName || "");
      setTrapperLastName(selectedUser.lastName || "");
      setTrapperPhone(selectedUser.phone || "");
      setTrapperNumber(selectedUser.trapperNumber || "");
    } else {
      setTrapperFirstName("");
      setTrapperLastName("");
      setTrapperPhone("");
      setTrapperNumber("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic validation
    if (!selectedDate) {
      setError("Please select an appointment date.");
      setLoading(false);
      return;
    }
    if (!selectedUserId) {
      setError("Please select a trapper.");
      setLoading(false);
      return;
    }

    if (!isEditMode && tnvrSlotsToBook === 0 && fosterSlotsToBook === 0) {
      // For create mode
      setError("Please book at least one slot (TNVR or Foster).");
      setLoading(false);
      return;
    }

    if (isEditMode) {
      // For edit mode, ensure only one slot type is selected
      if (tnvrSlotsToBook === 0 && fosterSlotsToBook === 0) {
        setError("Please book at least one slot.");
        setLoading(false);
        return;
      }
      if (tnvrSlotsToBook > 1 || fosterSlotsToBook > 1) {
        setError("In edit mode, you can only book one slot at a time.");
        setLoading(false);
        return;
      }
      if (tnvrSlotsToBook === 1 && fosterSlotsToBook === 1) {
        setError("In edit mode, you can only select one service type.");
        setLoading(false);
        return;
      }
    }

    try {
      const appointmentTime = Timestamp.fromDate(selectedDate);
      const nowTimestamp = Timestamp.now();

      const baseAppointmentData = {
        userId: selectedUserId,
        trapperFirstName: trapperFirstName.trim(),
        trapperLastName: trapperLastName.trim(),
        trapperPhone: trapperPhone.trim(),
        trapperNumber: trapperNumber.trim(),
        notes: notes.trim(),
        clinicAddress: CLINIC.address,
        appointmentTime: appointmentTime,
        status: "Upcoming", // Default status for new/edited appointments
      };

      if (isEditMode) {
        // Determine serviceType for edit mode based on which slot count is 1
        const serviceTypeToUpdate = tnvrSlotsToBook === 1 ? "TNVR" : "Foster";
        await onSave(appointment.id, {
          ...baseAppointmentData,
          serviceType: serviceTypeToUpdate,
          updatedAt: nowTimestamp,
          lastModifiedByUserId: currentUser.uid,
        });
      } else {
        // Create new appointment(s)
        const appointmentsToCreate = [];
        for (let i = 0; i < tnvrSlotsToBook; i++) {
          appointmentsToCreate.push({
            ...baseAppointmentData,
            serviceType: "TNVR",
            createdAt: nowTimestamp,
            createdByUserId: currentUser.uid,
            updatedAt: nowTimestamp,
            lastModifiedByUserId: currentUser.uid,
          });
        }
        for (let i = 0; i < fosterSlotsToBook; i++) {
          appointmentsToCreate.push({
            ...baseAppointmentData,
            serviceType: "Foster",
            createdAt: nowTimestamp,
            createdByUserId: currentUser.uid,
            updatedAt: nowTimestamp,
            lastModifiedByUserId: currentUser.uid,
          });
        }
        await onSave(appointmentsToCreate); // Pass array of appointments for batch creation
      }

      setLoading(false);
      onClose(); // Close modal on success
    } catch (err) {
      console.error("Error saving appointment:", err);
      setError("Failed to save appointment. Please try again.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = isEditMode ? "Edit Appointment" : "Create New Appointment";
  const saveButtonText = isEditMode ? "Save Changes" : "Book Appointment";

  // Calculate already booked slots based on available slots
  const alreadyBookedTnvrSlots = dailyCapacity.tnvr - availableSlots.tnvr;
  const alreadyBookedFosterSlots = dailyCapacity.foster - availableSlots.foster;

  // Calculate the total slots to display on the progress bar (already booked + user input)
  const displayedTotalBookedTnvr = alreadyBookedTnvrSlots + tnvrSlotsToBook;
  const displayedTotalBookedFoster =
    alreadyBookedFosterSlots + fosterSlotsToBook;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-100 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95svh] flex flex-col">
        <div className="p-6 sm:p-8 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-semibold text-primary-dark-purple">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Calendar Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-accent-purple mb-4">
                Select Date
              </h3>
              <div className="flex justify-between items-center mb-4">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-full hover:bg-gray-200"
                >
                  <ChevronLeft size={20} />
                </button>
                <h4 className="text-lg font-bold text-accent-purple">
                  {currentMonth.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </h4>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-2 rounded-full hover:bg-gray-200"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-sm font-medium mb-2">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>
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
                  const isSelected =
                    selectedDate &&
                    date &&
                    date.toDateString() === selectedDate.toDateString();
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPastDate = date && date < today;
                  const dayOfWeek = date ? date.getDay() : null;
                  const isClinicClosed =
                    dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thursday, Friday, Saturday

                  const isDisabled =
                    !isEditMode && (isPastDate || isClinicClosed); // Only disable for create mode

                  return (
                    <div
                      key={index}
                      className={`p-2 rounded relative
                      ${day === null ? "bg-gray-100" : ""}
                      ${
                        isDisabled
                          ? "text-gray-300 cursor-not-allowed"
                          : "cursor-pointer"
                      }
                      ${
                        isSelected
                          ? "bg-accent-purple text-white font-bold"
                          : day !== null && !isDisabled
                          ? "hover:bg-tertiary-purple hover:text-primary-white"
                          : ""
                      }
                      ${
                        date &&
                        date.toDateString() === new Date().toDateString() &&
                        !isSelected
                          ? "border-2 border-accent-purple"
                          : ""
                      }
                    `}
                      onClick={() => !isDisabled && handleDaySelect(day)}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trapper Selection */}
            <div className="flex flex-col mb-4">
              <label
                htmlFor="trapperSelect"
                className="text-lg font-semibold text-accent-purple mb-2"
              >
                Select Trapper for Appointment:
              </label>
              {loadingUsers ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  id="trapperSelect"
                  className="input"
                  value={selectedUserId}
                  onChange={handleUserSelect}
                  required
                  disabled={isEditMode} // Disable selection in edit mode as trapper is fixed
                >
                  <option value="">-- Select a Trapper --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.trapperNumber} - {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Slot Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-accent-purple mb-2">
                Slot Details:
              </h3>

              {loadingSlots ? (
                <LoadingSpinner />
              ) : (
                <>
                  {/* TNVR Slots */}
                  <div className="flex items-center gap-4">
                    <label htmlFor="tnvr-slots" className="w-14 font-semibold">
                      TNVR:
                    </label>
                    <input
                      id="tnvr-slots"
                      type="number"
                      min="0"
                      max={
                        isEditMode
                          ? 1
                          : dailyCapacity.tnvr > 0
                          ? availableSlots.tnvr
                          : 100 // If no capacity set, allow up to 100
                      }
                      value={tnvrSlotsToBook}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        if (isEditMode) {
                          setTnvrSlotsToBook(Math.min(1, Math.max(0, value)));
                          if (value === 1) setFosterSlotsToBook(0);
                        } else {
                          // If capacity is set (> 0), respect the available slots limit
                          // If no capacity is set, just use a reasonable upper limit
                          const maxAllowed =
                            dailyCapacity.tnvr > 0 ? availableSlots.tnvr : 100;
                          setTnvrSlotsToBook(
                            Math.max(0, Math.min(maxAllowed, value))
                          );
                        }
                      }}
                      className="w-16 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple text-center"
                      disabled={
                        isEditMode && appointment?.serviceType === "Foster"
                      } // Disable if editing a Foster appointment
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
                                : displayedTotalBookedTnvr > 0
                                ? 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                        {displayedTotalBookedTnvr}
                        {dailyCapacity.tnvr > 0 ? `/${dailyCapacity.tnvr}` : ""}
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
                      max={
                        isEditMode
                          ? 1
                          : dailyCapacity.foster > 0
                          ? availableSlots.foster
                          : 100 // If no capacity set, allow up to 100
                      }
                      value={fosterSlotsToBook}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        if (isEditMode) {
                          setFosterSlotsToBook(Math.min(1, Math.max(0, value)));
                          if (value === 1) setTnvrSlotsToBook(0);
                        } else {
                          // If capacity is set (> 0), respect the available slots limit
                          // If no capacity is set, just use a reasonable upper limit
                          const maxAllowed =
                            dailyCapacity.foster > 0
                              ? availableSlots.foster
                              : 100;
                          setFosterSlotsToBook(
                            Math.max(0, Math.min(maxAllowed, value))
                          );
                        }
                      }}
                      className="w-16 p-2 border rounded-lg outline-none border-tertiary-purple focus:border-accent-purple text-center"
                      disabled={
                        isEditMode && appointment?.serviceType === "TNVR"
                      } // Disable if editing a TNVR appointment
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
                                : displayedTotalBookedFoster > 0
                                ? 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                        {displayedTotalBookedFoster}
                        {dailyCapacity.foster > 0
                          ? `/${dailyCapacity.foster}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="form-label mb-2 block">
                Notes (Optional):
              </label>
              <textarea
                id="notes"
                className="input w-full resize-none"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>

            {/* Metadata */}
            {isEditMode && appointment && (
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                <h3 className="font-semibold mb-2">Booking Information:</h3>
                <p>
                  Booked by: {createdByUserName || "N/A"} on{" "}
                  {appointment.createdAt?.toDate().toLocaleString()}
                </p>
                <p>
                  Last Modified by: {lastModifiedByUserName || "N/A"} on{" "}
                  {appointment.updatedAt?.toDate().toLocaleString()}
                </p>
              </div>
            )}

            {error && <div className="text-red-500 text-center">{error}</div>}
          </form>
        </div>
        {/* Footer - Fixed */}
        <div className="px-6 py-4 sm:py-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="outline-button w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="button w-full sm:w-auto"
              disabled={loading}
            >
              {loading ? <LoadingSpinner size="sm" /> : saveButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
