// src/pages/AppointmentsListPage.jsx
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { Link } from "react-router-dom";
import {
  AppointmentListItemIcon,
  ChevronDown,
  ChevronUp,
  NotesIcon,
} from "../svgs/Icons";
import ConfirmationModal from "../components/ConfirmationModal";
import { DateTime } from "luxon";

// Clinic Data
const CLINIC = {
  id: "clinicA",
  name: "Street Cat Clinic",
  address: "500 NE 167th St, Miami, FL 33162",
};

// Pagination constants
const HISTORY_CHUNK_MONTHS = 1;

export default function Appointments() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState("upcoming");
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);

  // Pagination state for history
  const [historyCursor, setHistoryCursor] = useState(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Function to fetch upcoming appointments (no pagination needed)
  const fetchUpcomingAppointments = async (userId) => {
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      const clinicZone = "America/New_York";
      const todayStart = DateTime.now()
        .setZone(clinicZone)
        .startOf("day")
        .toJSDate();

      const q = query(
        appointmentsCollectionRef,
        where("userId", "==", userId),
        where("appointmentTime", ">=", Timestamp.fromDate(todayStart)),
        orderBy("appointmentTime", "asc")
      );

      const querySnapshot = await getDocs(q);
      const fetchedAppointments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return fetchedAppointments;
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      throw error;
    }
  };

  // Function to fetch history appointments with pagination
  const fetchHistoryAppointments = async (
    userId,
    cursor = null,
    isLoadMore = false
  ) => {
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      const clinicZone = "America/New_York";

      // Determine the date range for this fetch
      const endDate =
        cursor || DateTime.now().setZone(clinicZone).startOf("day");
      const startDate = endDate.minus({ months: HISTORY_CHUNK_MONTHS });

      const q = query(
        appointmentsCollectionRef,
        where("userId", "==", userId),
        where(
          "appointmentTime",
          ">=",
          Timestamp.fromDate(startDate.toJSDate())
        ),
        where("appointmentTime", "<", Timestamp.fromDate(endDate.toJSDate())),
        orderBy("appointmentTime", "desc")
      );

      const querySnapshot = await getDocs(q);
      const fetchedAppointments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Update date range for display
      if (!isLoadMore) {
        setDateRange({
          start: startDate,
          end: endDate,
        });
      } else if (fetchedAppointments.length > 0) {
        setDateRange((prev) => ({
          start: startDate,
          end: prev.end,
        }));
      }

      // Check if there are more appointments to load
      const hasMore = fetchedAppointments.length > 0;

      return {
        appointments: fetchedAppointments,
        nextCursor: startDate,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching history appointments:", error);
      throw error;
    }
  };

  // Function to fetch appointments based on view
  const fetchAppointments = async (userId, currentView, isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      if (currentView === "upcoming") {
        const fetchedAppointments = await fetchUpcomingAppointments(userId);
        setAppointments(fetchedAppointments);
        // Reset pagination state when switching to upcoming
        setHistoryCursor(null);
        setHasMoreHistory(true);
        setDateRange({ start: null, end: null });
      } else {
        // History view
        const cursor = isLoadMore ? historyCursor : null;
        const result = await fetchHistoryAppointments(
          userId,
          cursor,
          isLoadMore
        );

        if (isLoadMore) {
          // Merge new appointments with existing ones
          setAppointments((prev) => [...prev, ...result.appointments]);
        } else {
          setAppointments(result.appointments);
        }

        setHistoryCursor(result.nextCursor);
        setHasMoreHistory(result.hasMore);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      // TODO: Display an error message to the user
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Function to load more history appointments
  const loadMoreHistory = async () => {
    if (currentUser && !loadingMore && hasMoreHistory) {
      await fetchAppointments(currentUser.uid, "history", true);
    }
  };

  // Fetch appointments when the component mounts or the view changes
  useEffect(() => {
    if (currentUser) {
      fetchAppointments(currentUser.uid, view);
    }
    setExpandedGroupKey(null);
    setExpandedAppointmentId(null);
  }, [currentUser, view]);

  // Function to group appointments by date AND clinic using a map and sort by service type
  const groupAppointmentsByDateAndClinic = (appointmentsList) => {
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

      // Convert appointmentTime to Date object and set to Miami's time zone
      const appointmentDate = DateTime.fromJSDate(
        appointment.appointmentTime.toDate()
      ).setZone("America/New_York");

      const dateKey = appointmentDate.toFormat("yyyy-MM-dd");
      const clinicAddress = appointment.clinicAddress;

      // Create a unique key for the group (Date + Clinic Address)
      const groupKey = `${dateKey}-${clinicAddress}`;

      if (groupedMap.has(groupKey)) {
        // If the group already exists, add the appointment to its list
        const existingGroup = groupedMap.get(groupKey);
        existingGroup.appointments.push(appointment);
        // Update counts
        if (appointment.serviceType === "TNVR") {
          existingGroup.tnvrCount++;
        } else if (appointment.serviceType === "Foster") {
          existingGroup.fosterCount++;
        }
      } else {
        // If the group doesn't exist, create a new group object
        const newGroup = {
          dateKey: dateKey,
          displayDate: appointmentDate,
          clinicAddress: clinicAddress,
          clinicName: CLINIC.name,
          tnvrCount: appointment.serviceType === "TNVR" ? 1 : 0,
          fosterCount: appointment.serviceType === "Foster" ? 1 : 0,
          appointments: [appointment],
        };
        groupedMap.set(groupKey, newGroup);
      }
    });

    // Convert the map values to an array and sort by date for consistent display order
    const groupedArray = Array.from(groupedMap.values());

    // Sort the groups by date
    if (view === "upcoming") {
      groupedArray.sort(
        (a, b) => a.displayDate.toMillis() - b.displayDate.toMillis()
      );
    } else {
      // For history, sort by date descending (most recent first)
      groupedArray.sort(
        (a, b) => b.displayDate.toMillis() - a.displayDate.toMillis()
      );
    }

    // Sort the appointments within each group by service type (TNVR before Foster)
    groupedArray.forEach((group) => {
      group.appointments.sort((a, b) => {
        if (a.serviceType === "TNVR" && b.serviceType !== "TNVR") {
          return -1;
        }
        if (a.serviceType !== "TNVR" && b.serviceType === "TNVR") {
          return 1;
        }
        return 0;
      });
    });

    return groupedArray;
  };

  // Function to toggle expanded state of a single group card
  const toggleExpandedGroup = (groupKey) => {
    setExpandedGroupKey((prevKey) => (prevKey === groupKey ? null : groupKey));
    setExpandedAppointmentId(null);
  };

  // Function to toggle expanded state of a single appointment within a group
  const toggleExpandedAppointment = (appointmentId) => {
    setExpandedAppointmentId((prevId) =>
      prevId === appointmentId ? null : appointmentId
    );
  };

  // Function to handle individual appointment cancellation
  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setShowCancelModal(true);
  };

  // Function to confirm individual appointment cancellation
  const confirmCancelAppointment = async () => {
    if (appointmentToCancel) {
      try {
        await deleteDoc(doc(db, "appointments", appointmentToCancel.id));
        // Remove the canceled appointment from the state
        setAppointments(
          appointments.filter(
            (appointment) => appointment.id !== appointmentToCancel.id
          )
        );
        console.log(
          "Appointment successfully canceled:",
          appointmentToCancel.id
        );
      } catch (error) {
        console.error("Error canceling appointment:", error);
        // TODO: Display an error message to the user
      } finally {
        setShowCancelModal(false);
        setAppointmentToCancel(null);
        setExpandedAppointmentId(null);
      }
    }
  };

  // Function to handle deleting all appointments for a date
  const handleDeleteAllAppointments = (group) => {
    console.log("Preparing to delete all appointments for group:", group);
    setGroupToDelete(group);
    setShowDeleteAllModal(true);
  };

  // Function to confirm deleting all appointments for a date
  const confirmDeleteAllAppointments = async () => {
    if (groupToDelete) {
      try {
        const batch = writeBatch(db);
        groupToDelete.appointments.forEach((appointment) => {
          const appointmentRef = doc(db, "appointments", appointment.id);
          batch.delete(appointmentRef);
        });
        await batch.commit();

        // Remove the deleted group's appointments from the state
        setAppointments(
          appointments.filter(
            (appointment) =>
              !groupToDelete.appointments.some(
                (deletedApp) => deletedApp.id === appointment.id
              )
          )
        );
        console.log(
          "All appointments for date and clinic successfully deleted:",
          groupToDelete.dateKey,
          groupToDelete.clinicAddress
        );
      } catch (error) {
        console.error("Error deleting all appointments:", error);
        // TODO: Display an error message to the user
      } finally {
        setShowDeleteAllModal(false);
        setGroupToDelete(null);
        setExpandedGroupKey(null);
        setExpandedAppointmentId(null);
      }
    }
  };

  // Function to close the modals
  const handleCloseModal = () => {
    setShowCancelModal(false);
    setAppointmentToCancel(null);
    setShowDeleteAllModal(false);
    setGroupToDelete(null);
  };

  return (
    <>
      <header className="w-full hidden md:flex justify-between border-b-2 border-tertiary-purple p-8">
        <h1 className="font-bold text-2xl text-primary-dark-purple">
          Appointments
        </h1>
        {/* Book Appointment Button for Desktop */}
        <Link to="/book-appointment" className="button">
          Book Appointment
        </Link>
      </header>

      <div
        className={`px-8 ${
          view === "history" ? "pt-42" : "pt-36"
        } pb-40 flex flex-grow flex-col md:p-9`}
      >
        <div className="hidden md:flex justify-between items-center mb-6">
          {/* Tabs for Upcoming/History for Desktop */}
          <div className="flex bg-primary-white rounded-lg overflow-hidden">
            <button
              className={`px-6 py-3 text-lg font-semibold transition-colors duration-200 
                        ${
                          view === "upcoming"
                            ? "bg-secondary-purple text-white shadow-md"
                            : "text-primary-dark-purple hover:bg-accent-purple hover:text-white"
                        }`}
              onClick={() => setView("upcoming")}
            >
              Upcoming
            </button>
            <button
              className={`px-6 py-3 text-lg font-semibold transition-colors duration-200 
                        ${
                          view === "history"
                            ? "bg-secondary-purple text-white shadow-md"
                            : "text-primary-dark-purple hover:bg-accent-purple hover:text-white"
                        }`}
              onClick={() => setView("history")}
            >
              History
            </button>
          </div>

          {/* Date Range Indicator for History */}
          {view === "history" && dateRange.start && dateRange.end && (
            <div className="text-sm text-gray-600">
              Showing appointments from{" "}
              {dateRange.start.toFormat("MMM d, yyyy")} to{" "}
              {dateRange.end.toFormat("MMM d, yyyy")}
            </div>
          )}
        </div>

        {/* Tabs for Upcoming/History for Mobile */}
        <div className="fixed bg-primary-light-purple top-16 right-0 left-0 flex flex-col w-full p-4 flex-shrink-0 md:hidden shadow-md z-40">
          <h1 className="font-bold text-2xl text-primary-dark-purple text-center mb-2">
            Appointments
          </h1>

          <div className="flex">
            <button
              className={`flex-1 text-center px-6 py-3 text-lg font-semibold transition-colors duration-200 rounded-tl-lg rounded-bl-lg
        ${
          view === "upcoming"
            ? "bg-secondary-purple text-white shadow-md"
            : "text-primary-dark-purple bg-primary-white active:bg-accent-purple active:text-white"
        }`}
              onClick={() => setView("upcoming")}
            >
              Upcoming
            </button>
            <button
              className={`flex-1 text-center px-6 py-3 text-lg font-semibold transition-colors duration-200 rounded-tr-lg rounded-br-lg
        ${
          view === "history"
            ? "bg-secondary-purple text-white shadow-md"
            : "text-primary-dark-purple bg-primary-white active:bg-accent-purple active:text-white"
        }`}
              onClick={() => setView("history")}
            >
              History
            </button>
          </div>

          {/* Date Range Indicator for History - Mobile */}
          {view === "history" && dateRange.start && dateRange.end && (
            <div className="text-xs text-gray-600 text-center mt-2">
              {dateRange.start.toFormat("MMM d, yyyy")} -{" "}
              {dateRange.end.toFormat("MMM d, yyyy")}
            </div>
          )}
        </div>

        <div className="flex-grow overflow-visible">
          {loading ? (
            <LoadingSpinner />
          ) : appointments.length > 0 ? (
            <>
              <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                {groupAppointmentsByDateAndClinic(appointments).map((group) => {
                  const groupKey = `${group.dateKey}-${group.clinicAddress}`;
                  const isGroupExpanded = expandedGroupKey === groupKey;

                  const displayDate = group.displayDate;
                  const isDateValid = displayDate?.isValid;

                  const formattedDateHeader = isDateValid
                    ? displayDate.toLocaleString({
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Invalid Date";

                  const dayOfWeek = isDateValid
                    ? displayDate.toLocaleString({ weekday: "long" })
                    : "";

                  return (
                    <div
                      key={groupKey}
                      className="bg-white rounded-lg shadow-md"
                    >
                      {isDateValid && (
                        <div
                          onClick={() => toggleExpandedGroup(groupKey)}
                          className="bg-secondary-purple cursor-pointer rounded-t-lg text-white px-4 py-3 flex justify-between items-center"
                        >
                          <div className="flex-grow">
                            <h3 className="text-lg font-semibold">
                              {formattedDateHeader}
                            </h3>
                            <span className="text-md">{dayOfWeek}</span>
                          </div>
                          <div className="flex items-center ml-2">
                            {isGroupExpanded ? <ChevronUp /> : <ChevronDown />}
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-3">
                        {isGroupExpanded ? (
                          <>
                            <ul className="space-y-3">
                              {group.appointments.map((appointment) => {
                                const isAppointmentExpanded =
                                  expandedAppointmentId === appointment.id;
                                return (
                                  <li
                                    key={appointment.id}
                                    className="border-b pb-3 last:border-b-0 last:pb-0"
                                  >
                                    <div
                                      className="flex justify-between items-center text-gray-700 cursor-pointer"
                                      onClick={() =>
                                        toggleExpandedAppointment(
                                          appointment.id
                                        )
                                      }
                                    >
                                      <div className="flex w-full items-center justify-between">
                                        <div className="flex items-center">
                                          <AppointmentListItemIcon />
                                          <span className="mr-2">
                                            {appointment.serviceType}
                                          </span>
                                        </div>
                                        {appointment.status && (
                                          <span
                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                              appointment.status === "Completed"
                                                ? "bg-tertiary-purple text-primary-dark-purple"
                                                : appointment.status ===
                                                  "Canceled"
                                                ? "bg-red-100 text-red-800"
                                                : "bg-gray-100 text-gray-600"
                                            }`}
                                          >
                                            {appointment.status}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isAppointmentExpanded && (
                                      <div className="mt-3 p-3 bg-gray-100 rounded-md">
                                        <div className="flex items-center text-gray-700 mb-2">
                                          <NotesIcon />
                                          <span className="ml-2 font-semibold">
                                            Notes:
                                          </span>
                                        </div>
                                        <p className="text-gray-600 ml-6 break-words">
                                          {appointment.notes ||
                                            "No notes provided."}
                                        </p>
                                        {view === "upcoming" &&
                                          appointment.status !== "Canceled" && (
                                            <div className="flex justify-end">
                                              <button
                                                className="red-button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCancelAppointment(
                                                    appointment
                                                  );
                                                }}
                                              >
                                                Release Appointment
                                              </button>
                                            </div>
                                          )}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                            {view === "upcoming" && (
                              <button
                                className="red-button text-sm w-full"
                                onClick={() =>
                                  handleDeleteAllAppointments(group)
                                }
                              >
                                Release All Appointments for this Date
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex gap-2 items-center justify-center text-lg">
                            {group.tnvrCount > 0 && (
                              <>
                                TNVR{" "}
                                <span className="ml-1 font-bold text-secondary-purple">
                                  {group.tnvrCount}
                                </span>
                                {group.fosterCount > 0 && (
                                  <span className="mx-2">|</span>
                                )}{" "}
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
                              "No slots booked"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button for History */}
              {view === "history" && hasMoreHistory && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMoreHistory}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-secondary-purple text-white rounded-lg hover:bg-accent-purple transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Loading...
                      </div>
                    ) : (
                      "Load Earlier Appointments"
                    )}
                  </button>
                </div>
              )}

              {/* No More History Indicator */}
              {view === "history" &&
                !hasMoreHistory &&
                appointments.length > 0 && (
                  <div className="mt-8 text-center text-gray-500">
                    <p>No earlier appointments found</p>
                  </div>
                )}
            </>
          ) : (
            <div className="text-center text-gray-600 mt-8">
              No {view} appointments found.
            </div>
          )}
        </div>

        {/* Book Appointment Button for Mobile */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 p-4 bg-primary-light-purple z-40">
          <Link to="/book-appointment" className="button">
            Book Appointment
          </Link>
        </div>

        {/* Individual Cancel Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCancelModal}
          title="Confirm Release"
          message={
            <>
              Are you sure you want to cancel this{" "}
              <strong>{appointmentToCancel?.serviceType}</strong> appointment
              for{" "}
              <strong>
                {appointmentToCancel?.appointmentTime
                  ?.toDate()
                  .toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
              </strong>
              ?
            </>
          }
          onConfirm={confirmCancelAppointment}
          onClose={handleCloseModal}
        />

        {/* Delete All Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteAllModal}
          title="Confirm Release All"
          message={
            <>
              Are you sure you want to delete <strong>all appointments</strong>{" "}
              for{" "}
              <strong>
                {groupToDelete?.displayDate.toLocaleString({
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>{" "}
              at Street Cat Clinic? This action cannot be undone.
            </>
          }
          onConfirm={confirmDeleteAllAppointments}
          onClose={handleCloseModal}
        />
      </div>
    </>
  );
}
