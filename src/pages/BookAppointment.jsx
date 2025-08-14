import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useTranslation, Trans } from "react-i18next";

// Clinic Data
const CLINIC = {
  id: "clinicA",
  name: "Street Cat Clinic",
  address: "500 NE 167th St, Miami, FL 33162",
};

export default function BookAppointmentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation("common");
  const lang = i18n.language?.startsWith("es") ? "es-ES" : "en-US";
  const dtLocale = i18n.language?.startsWith("es") ? "es" : "en";

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
  const [appointmentCapacitiesMap, setAppointmentCapacitiesMap] = useState({});

  // State for Confirmation Modal
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookedAppointmentDetails, setBookedAppointmentDetails] =
    useState(null);

  // --- Slot Availability Logic ---

  // Function to fetch available slots for a selected date
  const fetchAvailableSlotsForDate = useCallback(
    async (date) => {
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
        setError(t("errors.failedToLoad") + " available slots.");
        setAvailableSlots({ tnvr: 0, foster: 0 });
      } finally {
        setLoadingSlots(false);
      }
    },
    [t]
  );

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
      const q = query(capacitiesRef);

      try {
        const querySnapshot = await getDocs(q);
        const capacities = {};
        querySnapshot.forEach((doc) => {
          const docId = doc.id;
          const [year, month, day] = docId.split("-").map(Number);
          const docDate = new Date(year, month - 1, day);

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
  }, [currentMonth]);

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
    setNotes("");
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
      dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;

    if (isPast || isClinicClosed) return;

    const docId = date.toISOString().split("T")[0];
    const capacityData = appointmentCapacitiesMap[docId];

    if (!capacityData) {
      console.log("No capacity set for selected date.");
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
    setError(null);
    setSelectedDate(date);
  };

  // --- Booking Logic ---

  const handleBookAppointment = async () => {
    if (
      !selectedDate ||
      (!tnvrSlotsToBook && !fosterSlotsToBook) ||
      !currentUser
    ) {
      setError(t("book.validation.missingDateOrSlots"));
      console.warn("⚠ Missing required info to book");
      return;
    }

    if (
      !currentUser.firstName ||
      !currentUser.lastName ||
      !currentUser.trapperNumber
    ) {
      setError(t("book.validation.missingProfile"));
      console.warn("⚠ currentUser is missing profile fields:", currentUser);
      return;
    }

    if (tnvrSlotsToBook < 0 || fosterSlotsToBook < 0) {
      setError(t("book.validation.negativeSlots"));
      console.warn("⚠ Negative slot count");
      return;
    }

    if (
      tnvrSlotsToBook > availableSlots.tnvr ||
      fosterSlotsToBook > availableSlots.foster
    ) {
      setError(t("book.validation.overbooking"));
      console.warn("⚠ Overbooking detected");
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

      await runTransaction(db, async (transaction) => {
        for (let i = 0; i < tnvrSlotsToBook; i++) {
          const docRef = doc(appointmentsRef);
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
          transaction.set(docRef, appointmentData);
          bookedAppointmentDetailsList.push(appointmentData);
        }
      });

      const totalBookedCount = tnvrSlotsToBook + fosterSlotsToBook;

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "performanceMetrics.totalAppointmentsBooked":
          increment(totalBookedCount),
      });

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

      const previouslySelectedDate = selectedDate;
      resetSelection();
      fetchAvailableSlotsForDate(previouslySelectedDate);
    } catch (err) {
      console.error("⚠ Error booking appointment:", err);
      setError(err.message || t("errors.somethingWentWrong"));
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

  // Helper function to get localized month name
  const getLocalizedMonth = (date) => {
    const monthKey = date.toLocaleString("en", { month: "long" }).toLowerCase();
    return t(`calendar.months.${monthKey}`);
  };

  // Helper function to get localized weekday name
  const getLocalizedWeekday = (date) => {
    const dayKey = date.toLocaleString("en", { weekday: "long" }).toLowerCase();
    return t(`calendar.weekdays.${dayKey}`);
  };

  const formattedSelectedDate = selectedDate
    ? DateTime.fromJSDate(selectedDate)
        .setLocale(dtLocale)
        .toLocaleString({ month: "long", day: "numeric", year: "numeric" })
    : "";

  const bookedCount = useMemo(
    () => Number(bookedAppointmentDetails?.bookedCount ?? 0),
    [bookedAppointmentDetails?.bookedCount]
  );
  const ctx = bookedCount === 1 ? "singular" : "plural";

  return (
    <div className="container mx-auto p-8 pb-24 md:p-8 md:max-w-3xl">
      <h1 className="text-2xl text-center text-accent-purple font-bold mb-4">
        {t("book.title")}
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
          {getLocalizedMonth(currentMonth)} {currentMonth.getFullYear()}
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
        <div>{t("days.sun")}</div>
        <div>{t("days.mon")}</div>
        <div>{t("days.tue")}</div>
        <div>{t("days.wed")}</div>
        <div>{t("days.thu")}</div>
        <div>{t("days.fri")}</div>
        <div>{t("days.sat")}</div>
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
            dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;
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
            <div className="flex flex-col items-center justify-center text-center py-8 text-accent-purple">
              <LogoMeowMaxed />
              <div className="text-lg font-semibold mb-2">
                {t("book.fullyBooked.title")}
              </div>
              <div className="text-sm">{t("book.fullyBooked.hint")}</div>
            </div>
          ) : (
            <>
              <h3 className="text-lg text-accent-purple font-semibold mb-4">
                {t("book.availableSlotsHeader", {
                  date: formattedSelectedDate,
                  clinic: CLINIC.name,
                })}
              </h3>
              {/* Slot Quantity Selection and Progress Bars */}
              <div className="mb-4">
                <h4 className="font-medium text-accent-purple mb-4">
                  {t("book.bookSlots")}
                </h4>
                <div className="flex flex-col gap-4">
                  {/* TNVR Slots */}
                  <div className="flex items-center gap-4">
                    <label htmlFor="tnvr-slots" className="w-14 font-semibold">
                      {t("book.tnvr")}:
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
                      {t("book.foster")}:
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
                  {t("book.notes")}
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
                  ? t("book.booking")
                  : t("book.bookX", {
                      count: tnvrSlotsToBook + fosterSlotsToBook,
                    })}
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
              {t("book.confirmation.title", { context: ctx })}
            </h2>

            <div className="flex items-center justify-center mb-4">
              <SuccessIcon />
            </div>

            <p className="mb-2 text-gray-700 text-center">
              {t("book.confirmation.subtitle", { context: ctx })}
            </p>

            <div className="text-center mb-4">
              <p className="font-semibold text-3xl">
                {bookedAppointmentDetails.selectedDate instanceof Date &&
                !isNaN(bookedAppointmentDetails.selectedDate.getTime())
                  ? `${getLocalizedWeekday(
                      bookedAppointmentDetails.selectedDate
                    )} - ${bookedAppointmentDetails.selectedDate.toLocaleDateString(
                      lang,
                      { month: "long", day: "numeric", year: "numeric" }
                    )}`
                  : bookedAppointmentDetails.selectedDate}
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
                {t("book.confirmation.bookedSlotsLabel", { context: ctx })}
              </p>

              {bookedAppointmentDetails.serviceTypes.tnvr > 0 && (
                <p className="text-gray-700">
                  {bookedAppointmentDetails.serviceTypes.tnvr} x{" "}
                  {t("book.tnvr")}
                </p>
              )}
              {bookedAppointmentDetails.serviceTypes.foster > 0 && (
                <p className="text-gray-700">
                  {bookedAppointmentDetails.serviceTypes.foster} x{" "}
                  {t("book.foster")}
                </p>
              )}
            </div>

            <button className="button w-full" onClick={handleCloseModal}>
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
