import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDoc,
  Timestamp,
  deleteDoc,
  doc,
  writeBatch,
  onSnapshot,
  updateDoc,
  setDoc,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmationModal from "../components/ConfirmationModal";
import AppointmentModal from "../components/AppointmentModal";
import { ChevronLeft, ChevronRight, Edit, Plus } from "lucide-react";
import { ChevronDown, ChevronUp, NotesIcon } from "../svgs/Icons";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";

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

export default function AppointmentsManager() {
  const { currentUser } = useAuth();
  const { i18n, t } = useTranslation();
  const lang = i18n.language?.startsWith("es") ? "es-ES" : "en-US";

  // State to hold all appointments fetched for the selected day
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(
    findNextAvailableDate(new Date())
  );
  const [selectedDate, setSelectedDate] = useState(
    findNextAvailableDate(new Date())
  );
  // State to manage individual appointment expansion (for notes and buttons)
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  // New state to manage grouped appointment expansion (for listing individual appointments)
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [currentNote, setCurrentNote] = useState("");

  // Capacity for maximum appointments per service type
  const [capacity, setCapacity] = useState({ tnvr: 0, foster: 0 });
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState(null);
  const [newCapacityValue, setNewCapacityValue] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);

  // States for confirmation modals (for individual and group deletions)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);

  const [isDeletingIndividual, setIsDeletingIndividual] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // States for AppointmentModal (create functionality)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [initialDateForCreate, setInitialDateForCreate] = useState(null);

  // --- Calendar Logic ---
  // Helper to get the number of days in the current month
  const daysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  // Helper to get the day of the week for the 1st of the month (0 for Sunday)
  const firstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  // Generates an array representing the days of the calendar month
  const generateCalendarDays = (date) => {
    const numDays = daysInMonth(date);
    const startDay = firstDayOfMonth(date);
    const days = [];
    // Add null placeholders for days before the 1st of the month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Add actual day numbers
    for (let i = 1; i <= numDays; i++) {
      days.push(i);
    }
    return days;
  };

  const calendarDays = generateCalendarDays(currentMonth);

  // Navigates to the previous month in the calendar
  const goToPreviousMonth = () => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(
        prevMonth.getFullYear(),
        prevMonth.getMonth() - 1,
        1
      );
      // If selected date is no longer valid in the new month, clear it
      if (
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        setSelectedDate(null);
        setAppointments([]);
      }
      return newMonth;
    });
    setExpandedAppointmentId(null);
    setExpandedGroupKey(null);
    setEditingNoteId(null);
  };

  // Navigates to the next month in the calendar
  const goToNextMonth = () => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(
        prevMonth.getFullYear(),
        prevMonth.getMonth() + 1,
        1
      );
      // If selected date is no longer valid in the new month, clear it
      if (
        selectedDate &&
        (selectedDate.getMonth() !== newMonth.getMonth() ||
          selectedDate.getFullYear() !== newMonth.getFullYear())
      ) {
        setSelectedDate(null);
        setAppointments([]);
      }
      return newMonth;
    });
    setExpandedAppointmentId(null);
    setExpandedGroupKey(null);
    setEditingNoteId(null);
  };

  // Handles selecting a day on the calendar
  const handleDaySelect = (day) => {
    if (day === null) return; // Ignore clicks on placeholder days
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

    // Prevent selecting Thursday (4), Friday (5), Saturday (6) as clinic is closed
    const isClinicClosed =
      dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;

    // Only restrict non-admins from selecting closed days
    if (isClinicClosed && currentUser?.role !== "admin") {
      console.log("Cannot select a day when the clinic is closed.");
      return;
    }

    setSelectedDate(date);
    setExpandedAppointmentId(null);
    setExpandedGroupKey(null);
    setEditingNoteId(null);
  };

  // This useEffect hook replaces your old fetch functions
  // It sets up real-time listeners for both appointments and capacity
  useEffect(() => {
    if (!selectedDate) {
      setAppointments([]);
      setCapacity({ tnvr: 0, foster: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    const timeZone = "America/New_York";

    const startOfDay = DateTime.fromJSDate(selectedDate, { zone: timeZone })
      .startOf("day")
      .toJSDate();

    const endOfDay = DateTime.fromJSDate(selectedDate, { zone: timeZone })
      .endOf("day")
      .toJSDate();

    const appointmentsCollectionRef = collection(db, "appointments");
    const q = query(
      appointmentsCollectionRef,
      where("appointmentTime", ">=", Timestamp.fromDate(startOfDay)),
      where("appointmentTime", "<=", Timestamp.fromDate(endOfDay)),
      orderBy("appointmentTime", "asc")
    );

    const capacityDocRef = doc(
      db,
      "appointmentCapacities",
      selectedDate.toISOString().split("T")[0]
    );

    // --- Real-time listener for appointments ---
    const unsubscribeAppointments = onSnapshot(
      q,
      (querySnapshot) => {
        let fetchedAppointments = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Your existing custom sort logic
        fetchedAppointments.sort((a, b) => {
          if (a.serviceType === "TNVR" && b.serviceType !== "TNVR") return -1;
          if (a.serviceType !== "TNVR" && b.serviceType === "TNVR") return 1;
          return a.trapperNumber.localeCompare(b.trapperNumber);
        });

        setAppointments(fetchedAppointments);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching real-time appointments:", error);
        setLoading(false);
      }
    );

    // --- Real-time listener for capacity ---
    const unsubscribeCapacity = onSnapshot(
      capacityDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setCapacity({
            tnvr: data.tnvrCapacity || 0,
            foster: data.fosterCapacity || 0,
          });
        } else {
          setCapacity({ tnvr: 0, foster: 0 }); // Default when not set
        }
      },
      (error) => {
        console.error("Error fetching real-time capacity:", error);
      }
    );

    // Cleanup function: this unsubscribes from the listeners
    // when the component unmounts or the selectedDate changes.
    return () => {
      unsubscribeAppointments();
      unsubscribeCapacity();
    };
  }, [selectedDate]);

  // Toggles the expansion state of an individual appointment card
  const toggleExpandedAppointment = (appointmentId) => {
    setExpandedAppointmentId((prevId) => {
      const isSame = prevId === appointmentId;
      if (isSame && editingNoteId === appointmentId) {
        setEditingNoteId(null);
      }
      return isSame ? null : appointmentId;
    });
  };

  // Toggles the expansion state of a grouped appointment container
  const toggleExpandedGroup = (groupKey) => {
    setExpandedGroupKey((prevKey) => (prevKey === groupKey ? null : groupKey));
    // When expanding/collapsing a group, collapse any individual note editing within it
    setEditingNoteId(null);
  };

  // Handles initiating the deletion of an individual appointment
  const handleReleaseAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setShowCancelModal(true);
  };

  // Confirms and executes the deletion of an individual appointment
  const confirmCancelAppointment = async () => {
    if (appointmentToCancel) {
      setIsDeletingIndividual(true);
      try {
        await deleteDoc(doc(db, "appointments", appointmentToCancel.id));
      } catch (error) {
        console.error("Error canceling appointment:", error);
        console.log("Failed to cancel appointment. Please try again.");
      } finally {
        setShowCancelModal(false);
        setAppointmentToCancel(null);
        setExpandedAppointmentId(null);
        setIsDeletingIndividual(false);
        setEditingNoteId(null);
      }
    }
  };

  // Handles initiating the deletion of all appointments within a group
  const handleDeleteAllAppointments = (group) => {
    setGroupToDelete(group);
    setShowDeleteAllModal(true);
  };

  // Confirms and executes the deletion of all appointments within a group
  const confirmDeleteAllAppointments = async () => {
    if (groupToDelete) {
      setIsDeletingGroup(true);
      try {
        const batch = writeBatch(db); // Use a batch write for atomic deletion
        groupToDelete.appointments.forEach((appointment) => {
          const appointmentRef = doc(db, "appointments", appointment.id);
          batch.delete(appointmentRef);
        });
        await batch.commit(); // Commit the batch deletion
      } catch (error) {
        console.error("Error deleting all appointments for group:", error);
        console.log(
          "Failed to delete all appointments for this group. Please try again."
        );
      } finally {
        setShowDeleteAllModal(false);
        setGroupToDelete(null);
        setIsDeletingGroup(false);
        setExpandedGroupKey(null);
        setEditingNoteId(null);
      }
    }
  };

  const handleEditNotes = (appointment) => {
    setEditingNoteId(appointment.id);
    setCurrentNote(appointment.notes || "");
  };

  const handleSaveNotes = async (appointmentId) => {
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        notes: currentNote,
        updatedAt: Timestamp.now(),
        lastModifiedByUserId: currentUser.uid, // Record who last modified it
      });
      console.log("Notes successfully updated for appointment:", appointmentId);
      setEditingNoteId(null); // Exit edit mode after saving
    } catch (error) {
      console.error("Error updating notes:", error);
      console.log("Failed to save notes. Please try again.");
    }
  };

  const handleCancelEditNotes = () => {
    setEditingNoteId(null);
    setCurrentNote("");
  };

  // --- Appointment Modal Handlers ---
  // Opens the AppointmentModal in create mode
  const handleOpenCreateAppointmentModal = (date = null) => {
    setInitialDateForCreate(date); // Pre-fill date if created from calendar click
    setShowAppointmentModal(true);
  };

  // Closes the AppointmentModal and triggers a re-fetch of appointments
  const handleCloseAppointmentModal = () => {
    setShowAppointmentModal(false);
    setInitialDateForCreate(null);
  };

  // Handles saving an appointment (either creating new or updating existing)
  const handleSaveAppointment = async (data) => {
    try {
      if (!data || data.length === 0) return;

      const trapperUid = data[0].userId;
      if (!trapperUid) {
        console.warn("Missing trapper userId. Cannot update metrics.");
        return;
      }

      const batch = writeBatch(db);

      data.forEach((newAppointment) => {
        const newDocRef = doc(collection(db, "appointments"));
        batch.set(newDocRef, {
          ...newAppointment,
          createdByUserId: currentUser.uid,
          lastModifiedByUserId: currentUser.uid,
          userId: trapperUid,
        });
      });

      await batch.commit();

      // Update the trapper's performance metrics
      const userRef = doc(db, "users", trapperUid);
      await updateDoc(userRef, {
        "performanceMetrics.totalAppointmentsBooked": increment(data.length),
      });
    } catch (error) {
      console.error("Error saving appointment:", error);
      throw error;
    }
  };

  const handleSaveCapacity = async () => {
    if (!selectedDate || !editingServiceType) return;
    setSavingCapacity(true);

    try {
      const docId = selectedDate.toISOString().split("T")[0];
      const docRef = doc(db, "appointmentCapacities", docId);
      const existing = await getDoc(docRef);

      const data = existing.exists() ? existing.data() : {};
      const updatedData = {
        ...data,
        [editingServiceType === "TNVR" ? "tnvrCapacity" : "fosterCapacity"]:
          parseInt(newCapacityValue, 10),
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid,
      };

      await setDoc(docRef, updatedData);
      setShowCapacityModal(false);
      setEditingServiceType(null);
      setNewCapacityValue("");
    } catch (err) {
      console.error("Error saving capacity:", err);
    } finally {
      setSavingCapacity(false);
    }
  };

  // --- Grouping Logic for Display ---
  // Groups fetched appointments by service type, trapper number, and trapper name
  const groupedAppointments = appointments.reduce((acc, appointment) => {
    // Create a unique key for each group
    const key = `${appointment.serviceType}-${appointment.trapperNumber}-${appointment.trapperFirstName}-${appointment.trapperLastName}`;
    if (!acc[key]) {
      // Initialize the group if it doesn't exist
      acc[key] = {
        groupKey: key,
        serviceType: appointment.serviceType,
        trapperNumber: appointment.trapperNumber,
        trapperFirstName: appointment.trapperFirstName,
        trapperLastName: appointment.trapperLastName,
        appointments: [],
      };
    }
    acc[key].appointments.push(appointment); // Add the appointment to the group
    return acc;
  }, {});

  // Separate the grouped appointments into TNVR and Foster categories
  const tnvrGroupedAppointments = Object.values(groupedAppointments).filter(
    (group) => group.serviceType === "TNVR"
  );
  const fosterGroupedAppointments = Object.values(groupedAppointments).filter(
    (group) => group.serviceType === "Foster"
  );

  // Calculate total counts for each service type for the selected day
  const tnvrAppointmentsCount = appointments.filter(
    (app) => app.serviceType === "TNVR"
  ).length;
  const fosterAppointmentsCount = appointments.filter(
    (app) => app.serviceType === "Foster"
  ).length;

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-2xl font-bold text-error-red">
          {t("errors.noPermission")}
        </h1>
      </div>
    );
  }

  return (
    <>
      <header className="w-full flex flex-col md:flex-row justify-between border-b-2 border-tertiary-purple p-8">
        <h1 className="font-bold text-2xl pb-4 text-primary-dark-purple flex items-center gap-2 md:pb-0">
          {t("appointments.manageTitle")}
        </h1>
        <button
          className="button flex items-center gap-1"
          onClick={() => handleOpenCreateAppointmentModal(selectedDate)}
        >
          <Plus size={20} /> {t("appointments.createNew")}
        </button>
      </header>

      <div className="p-8 mb-16 md:mb-0 md:p-8">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-full cursor-pointer hover:bg-tertiary-purple"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl text-accent-purple font-bold">
            {currentMonth.toLocaleDateString(lang, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-full cursor-pointer hover:bg-tertiary-purple"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Calendar Grid (Days of the week header) */}
        <div className="grid grid-cols-7 text-center text-sm font-medium mb-2">
          {[
            t("calendar.weekdaysShort.sun"),
            t("calendar.weekdaysShort.mon"),
            t("calendar.weekdaysShort.tue"),
            t("calendar.weekdaysShort.wed"),
            t("calendar.weekdaysShort.thu"),
            t("calendar.weekdaysShort.fri"),
            t("calendar.weekdaysShort.sat"),
          ].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid (Days) */}
        <div className="grid grid-cols-7 gap-1 text-center mb-8">
          {calendarDays.map((day, index) => {
            const date =
              day !== null
                ? new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth(),
                    day
                  )
                : null;
            const isToday =
              date && date.toDateString() === new Date().toDateString();
            const isSelected =
              selectedDate &&
              date &&
              date.toDateString() === selectedDate.toDateString();
            const dayOfWeek = date ? date.getDay() : null;
            const isPastDate = date && date < new Date().setHours(0, 0, 0, 0);
            const isClinicClosed =
              dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thursday, Friday, Saturday

            return (
              <div
                key={index}
                className={`p-2 rounded relative
                  ${day === null ? "bg-purple-100" : ""}
                   ${
                     day !== null && isClinicClosed
                       ? "text-gray-300 cursor-not-allowed"
                       : ""
                   }
                   ${
                     day !== null && isPastDate && !isClinicClosed
                       ? "text-purple-200 hover:bg-tertiary-purple hover:text-primary-white cursor-pointer"
                       : ""
                   }
                ${
                  isSelected
                    ? "bg-accent-purple text-white font-bold"
                    : day !== null && !isPastDate && !isClinicClosed
                    ? "hover:cursor-pointer hover:bg-tertiary-purple hover:text-primary-white"
                    : ""
                }
                  ${
                    isToday && !isSelected
                      ? "border-2 border-accent-purple"
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

        {/* Display Appointments for Selected Day */}
        <h2 className="text-xl text-primary-dark-purple font-bold mb-4">
          {selectedDate
            ? t("appointments.forDate", {
                date: selectedDate.toLocaleDateString(lang, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }),
              })
            : t("appointments.selectDatePrompt")}
        </h2>
        <div className="flex-grow overflow-visible">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-8">
              {/* TNVR Appointments Section */}
              <div>
                <div className="text-lg flex gap-4 items-center font-semibold text-primary-dark-purple mb-3 border-b pb-2">
                  <h3>{t("appointments.tnvrSectionTitle")}</h3>
                  <div className="flex items-center flex-grow">
                    <div className="w-full h-4 bg-gray-200 rounded-l-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple transition-all duration-300 ease-in-out"
                        style={{
                          width: `${
                            capacity.tnvr
                              ? (tnvrAppointmentsCount / capacity.tnvr) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                      {tnvrAppointmentsCount}/{capacity.tnvr}
                    </span>
                    <button
                      onClick={() => {
                        setEditingServiceType("TNVR");
                        setNewCapacityValue(capacity.tnvr);
                        setShowCapacityModal(true);
                      }}
                      className="flex items-center justify-center ml-2 h-7 min-w-8  rounded-md bg-secondary-purple text-primary-white hover:bg-accent-purple transition-colors duration-200 hover:cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tnvrGroupedAppointments.length > 0 ? (
                    tnvrGroupedAppointments.map((group) => {
                      const isGroupExpanded =
                        expandedGroupKey === group.groupKey;
                      return (
                        <div
                          key={group.groupKey}
                          className="bg-white rounded-lg shadow-md p-4 self-start"
                        >
                          <div
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => toggleExpandedGroup(group.groupKey)}
                          >
                            <h4 className="text-lg font-semibold text-primary-dark-purple">
                              {group.trapperNumber} - {group.trapperFirstName}{" "}
                              {group.trapperLastName} (
                              {group.appointments.length})
                            </h4>
                            <div className="flex items-center ml-2">
                              {isGroupExpanded ? (
                                <ChevronUp className="text-primary-dark-purple" />
                              ) : (
                                <ChevronDown className="text-primary-dark-purple" />
                              )}
                            </div>
                          </div>
                          {isGroupExpanded && (
                            <div className="mt-3">
                              {group.appointments.map((appointment) => {
                                const isAppointmentExpanded =
                                  expandedAppointmentId === appointment.id;
                                const isEditingCurrentNote =
                                  editingNoteId === appointment.id;

                                return (
                                  <div
                                    key={appointment.id}
                                    className="bg-gray-50 rounded-md p-3 mb-2 border border-gray-200"
                                  >
                                    <div
                                      className="flex justify-between items-center cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandedAppointment(
                                          appointment.id
                                        );
                                      }}
                                    >
                                      <p className="font-medium">
                                        {t("appointments.tnvrAppointment")}{" "}
                                      </p>
                                      <div className="flex items-center ml-2">
                                        {isAppointmentExpanded ? (
                                          <ChevronUp className="text-primary-dark-purple" />
                                        ) : (
                                          <ChevronDown className="text-primary-dark-purple" />
                                        )}
                                      </div>
                                    </div>
                                    {isAppointmentExpanded && (
                                      <div className="mt-2 p-2 bg-gray-100 rounded-md">
                                        <div className="flex justify-between items-center text-gray-700 mb-1">
                                          <div className="flex gap-1 items-center">
                                            <NotesIcon />
                                            <span className="font-semibold">
                                              {t("appointments.notes")}
                                            </span>
                                          </div>
                                          {!isEditingCurrentNote && (
                                            <button
                                              className="text-accent-purple hover:cursor-pointer hover:text-secondary-purple"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditNotes(appointment);
                                              }}
                                            >
                                              <Edit size={16} />
                                            </button>
                                          )}
                                        </div>
                                        {isEditingCurrentNote ? (
                                          <>
                                            <textarea
                                              value={currentNote}
                                              onChange={(e) =>
                                                setCurrentNote(e.target.value)
                                              }
                                              className="w-full p-2 border rounded-md min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent-purple"
                                            />
                                            <div className="flex justify-end gap-2 mt-2">
                                              <button
                                                className="outline-button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCancelEditNotes();
                                                }}
                                              >
                                                {t("common.cancel")}
                                              </button>
                                              <button
                                                className="button mt-4"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSaveNotes(
                                                    appointment.id
                                                  );
                                                }}
                                              >
                                                {t("common.save")}
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-gray-600 ml-6 break-words">
                                            {appointment.notes ||
                                              t("appointments.noNotesProvided")}
                                          </p>
                                        )}
                                        <div className="flex justify-end gap-2 mt-3">
                                          <button
                                            className="red-button flex items-center gap-1"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReleaseAppointment(
                                                appointment
                                              );
                                            }}
                                          >
                                            {t("appointments.release")}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <div className="flex justify-end mt-4">
                                <button
                                  className="red-button flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAllAppointments(group);
                                  }}
                                >
                                  {t("appointments.releaseAllTnvrForPerson")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-gray-600 col-span-full">
                      {t("appointments.noTnvrForDay")}
                    </div>
                  )}
                </div>
              </div>
              {/* Foster Appointments Section */}
              <div>
                <div className="text-lg flex gap-4 items-center font-semibold text-primary-dark-purple mb-3 border-b pb-2">
                  <h3>{t("appointments.fosterSectionTitle")}</h3>
                  <div className="flex items-center flex-grow">
                    <div className="w-full h-4 bg-gray-200 rounded-l-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple transition-all duration-300 ease-in-out"
                        style={{
                          width: `${
                            capacity.foster
                              ? (fosterAppointmentsCount / capacity.foster) *
                                100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="px-2 py-1 rounded-md bg-accent-purple text-primary-white font-semibold text-sm">
                      {fosterAppointmentsCount}/{capacity.foster}
                    </span>
                    <button
                      onClick={() => {
                        setEditingServiceType("Foster");
                        setNewCapacityValue(capacity.foster);
                        setShowCapacityModal(true);
                      }}
                      className="flex items-center justify-center ml-2 h-7 min-w-8  rounded-md bg-secondary-purple text-primary-white hover:bg-accent-purple transition-colors duration-200 hover:cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fosterGroupedAppointments.length > 0 ? (
                    fosterGroupedAppointments.map((group) => {
                      const isGroupExpanded =
                        expandedGroupKey === group.groupKey;
                      return (
                        <div
                          key={group.groupKey}
                          className="bg-white rounded-lg shadow-md p-4 self-start"
                        >
                          <div
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => toggleExpandedGroup(group.groupKey)}
                          >
                            <h4 className="text-lg font-semibold text-primary-dark-purple">
                              {group.trapperNumber} - {group.trapperFirstName}{" "}
                              {group.trapperLastName} (
                              {group.appointments.length})
                            </h4>
                            <div className="flex items-center ml-2">
                              {isGroupExpanded ? (
                                <ChevronUp className="text-primary-dark-purple" />
                              ) : (
                                <ChevronDown className="text-primary-dark-purple" />
                              )}
                            </div>
                          </div>
                          {isGroupExpanded && (
                            <div className="mt-3">
                              {group.appointments.map((appointment) => {
                                const isAppointmentExpanded =
                                  expandedAppointmentId === appointment.id;
                                const isEditingCurrentNote =
                                  editingNoteId === appointment.id;

                                return (
                                  <div
                                    key={appointment.id}
                                    className="bg-gray-50 rounded-md p-3 mb-2 border border-gray-200"
                                  >
                                    <div
                                      className="flex justify-between items-center cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandedAppointment(
                                          appointment.id
                                        );
                                      }}
                                    >
                                      <p className="font-medium">
                                        {t("appointments.fosterAppointment")}{" "}
                                      </p>
                                      <div className="flex items-center ml-2">
                                        {isAppointmentExpanded ? (
                                          <ChevronUp className="text-primary-dark-purple" />
                                        ) : (
                                          <ChevronDown className="text-primary-dark-purple" />
                                        )}
                                      </div>
                                    </div>
                                    {isAppointmentExpanded && (
                                      <div className="mt-2 p-2 bg-gray-100 rounded-md">
                                        <div className="flex justify-between items-center text-gray-700 mb-1">
                                          <div className="flex gap-1 items-center">
                                            <NotesIcon />
                                            <span className="font-semibold">
                                              {t("appointments.notes")}
                                            </span>
                                          </div>
                                          {!isEditingCurrentNote && (
                                            <button
                                              className="text-accent-purple hover:cursor-pointer hover:text-secondary-purple"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditNotes(appointment);
                                              }}
                                            >
                                              <Edit size={16} />
                                            </button>
                                          )}
                                        </div>
                                        {isEditingCurrentNote ? (
                                          <>
                                            <textarea
                                              value={currentNote}
                                              onChange={(e) =>
                                                setCurrentNote(e.target.value)
                                              }
                                              className="w-full p-2 border rounded-md min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent-purple"
                                            />
                                            <div className="flex justify-end gap-2 mt-2">
                                              <button
                                                className="outline-button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCancelEditNotes();
                                                }}
                                              >
                                                {t("common.cancel")}
                                              </button>
                                              <button
                                                className="button mt-4"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSaveNotes(
                                                    appointment.id
                                                  );
                                                }}
                                              >
                                                {t("common.save")}
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-gray-600 ml-6 break-words">
                                            {appointment.notes ||
                                              t("appointments.noNotesProvided")}
                                          </p>
                                        )}
                                        <div className="flex justify-end gap-2 mt-3">
                                          <button
                                            className="red-button flex items-center gap-1"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReleaseAppointment(
                                                appointment
                                              );
                                            }}
                                          >
                                            {t("appointments.release")}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <div className="flex justify-end mt-4">
                                <button
                                  className="red-button flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAllAppointments(group);
                                  }}
                                >
                                  {t("appointments.releaseAllTnvrForPerson")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-gray-600 col-span-full">
                      {t("appointments.noFosterForDay")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Individual Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCancelModal}
          title="Confirm Release"
          message={
            <>
              Are you sure you want to release this{" "}
              <strong>{appointmentToCancel?.serviceType}</strong> appointment
              for{" "}
              <strong>
                {appointmentToCancel?.trapperNumber} –{" "}
                {appointmentToCancel?.trapperFirstName}{" "}
                {appointmentToCancel?.trapperLastName}
              </strong>
              ? This action cannot be undone.
            </>
          }
          onConfirm={confirmCancelAppointment}
          onClose={() => setShowCancelModal(false)}
          isSubmitting={isDeletingIndividual}
        />

        {/* Group Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteAllModal}
          title="Confirm Release All"
          message={
            <>
              Are you sure you want to release{" "}
              <strong>all {groupToDelete?.serviceType}</strong> appointments for{" "}
              <strong>
                {groupToDelete?.trapperNumber} –{" "}
                {groupToDelete?.trapperFirstName}{" "}
                {groupToDelete?.trapperLastName}
              </strong>{" "}
              for this day? This action cannot be undone.
            </>
          }
          onConfirm={confirmDeleteAllAppointments}
          onClose={() => setShowDeleteAllModal(false)}
          isSubmitting={isDeletingGroup}
        />

        {/* The new AppointmentModal for creating appointments */}
        <AppointmentModal
          isOpen={showAppointmentModal}
          onClose={handleCloseAppointmentModal}
          appointment={null}
          onSave={async (data) => {
            await handleSaveAppointment(data);
          }}
          initialDate={initialDateForCreate || selectedDate}
        />

        {showCapacityModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute w-screen h-screen bg-slate-900 opacity-60"></div>
            <div className="bg-white p-6 rounded-xl shadow-xl z-100 max-w-sm w-full">
              <h2 className="text-lg font-bold mb-4 text-primary-dark-purple">
                Edit {editingServiceType} Capacity for{" "}
                {selectedDate?.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>

              <input
                type="number"
                min="0"
                value={newCapacityValue}
                onChange={(e) => setNewCapacityValue(e.target.value)}
                className="input w-full mb-4"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCapacityModal(false);
                    setEditingServiceType(null);
                    setNewCapacityValue("");
                  }}
                  className="outline-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCapacity}
                  className="button mt-4"
                  disabled={savingCapacity}
                >
                  {savingCapacity ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
