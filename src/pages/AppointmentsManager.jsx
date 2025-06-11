import { useState, useEffect, useCallback } from "react";
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
// IMPORTANT: Please ensure these paths are correct relative to where AppointmentsManager.jsx is located.
// For example, if AppointmentsManager.jsx is in 'src/pages/', then 'firebase.js' should be in 'src/'.
// Also, verify the file extensions (.js, .jsx, .ts, .tsx) and casing match your file system exactly.
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmationModal from "../components/ConfirmationModal";
import { ChevronDown, ChevronUp, NotebookPen } from "lucide-react";

// Clinic Data (copied from Appointments.jsx and BookAppointment.jsx)
const CLINIC = {
  id: "clinicA",
  name: "Street Cat Clinic",
  address: "500 NE 167th St, Miami, FL 33162",
};

export default function AppointmentsManager() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("upcoming"); // 'upcoming' or 'history'
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);

  // States for confirmation modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);

  const [isDeletingIndividual, setIsDeletingIndividual] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Function to fetch ALL appointments from Firestore (no userId filter)
  const fetchAllAppointments = useCallback(async (currentView) => {
    setLoading(true);
    try {
      const appointmentsCollectionRef = collection(db, "appointments");
      let q;
      const nowTimestamp = Timestamp.now();

      // Query all appointments based on view (upcoming vs history)
      if (currentView === "upcoming") {
        q = query(
          appointmentsCollectionRef,
          where("appointmentTime", ">=", nowTimestamp),
          orderBy("appointmentTime", "asc")
        );
      } else {
        // history
        q = query(
          appointmentsCollectionRef,
          where("appointmentTime", "<", nowTimestamp),
          orderBy("appointmentTime", "desc")
        );
      }

      const querySnapshot = await getDocs(q);
      const fetchedAppointments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAppointments(fetchedAppointments);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching all appointments:", error);
      setLoading(false);
      // TODO: Display an error message to the user
    }
  }, []); // Empty dependency array means this function is created once

  // Fetch appointments when the component mounts or the view changes
  useEffect(() => {
    fetchAllAppointments(view);
    setExpandedGroupKey(null);
    setExpandedAppointmentId(null);
  }, [view, fetchAllAppointments]);

  // Function to group appointments by date, clinic, and trapper for manager view
  const groupAppointmentsForManager = (appointmentsList) => {
    const groupedMap = new Map();

    appointmentsList.forEach((appointment) => {
      if (
        !appointment.appointmentTime ||
        !appointment.appointmentTime.toDate ||
        !appointment.clinicAddress ||
        !appointment.trapperNumber
      ) {
        console.warn(
          "Skipping appointment with missing essential data (date, clinic, trapper):",
          appointment
        );
        return;
      }

      const appointmentDate = appointment.appointmentTime.toDate();
      const dateKey = `${appointmentDate.getFullYear()}-${appointmentDate.getMonth()}-${appointmentDate.getDate()}`;
      const clinicAddress = appointment.clinicAddress;
      const trapperNumber = appointment.trapperNumber;

      // Unique key for the group (Date + Clinic Address + Trapper Number)
      const groupKey = `${dateKey}-${clinicAddress}-${trapperNumber}`;

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
          dateKey: dateKey,
          displayDate: appointmentDate,
          clinicAddress: clinicAddress,
          clinicName: CLINIC.name, // Assuming one clinic for simplicity as per BookAppointment.jsx
          trapperNumber: trapperNumber,
          trapperName: `${appointment.trapperFirstName || ""} ${
            appointment.trapperLastName || ""
          }`.trim(),
          tnvrCount: appointment.serviceType === "TNVR" ? 1 : 0,
          fosterCount: appointment.serviceType === "Foster" ? 1 : 0,
          appointments: [appointment],
        };
        groupedMap.set(groupKey, newGroup);
      }
    });

    const groupedArray = Array.from(groupedMap.values());

    // Sort groups by date, then by clinic, then by trapper number
    groupedArray.sort((a, b) => {
      const dateComparison = a.displayDate.getTime() - b.displayDate.getTime();
      if (dateComparison !== 0) return dateComparison;

      const clinicComparison = a.clinicAddress.localeCompare(b.clinicAddress);
      if (clinicComparison !== 0) return clinicComparison;

      return a.trapperNumber.localeCompare(b.trapperNumber);
    });

    // Sort appointments within each group by service type (TNVR before Foster)
    groupedArray.forEach((group) => {
      group.appointments.sort((a, b) => {
        if (a.serviceType === "TNVR" && b.serviceType !== "TNVR") return -1;
        if (a.serviceType !== "TNVR" && b.serviceType === "TNVR") return 1;
        return 0;
      });
    });

    return groupedArray;
  };

  const toggleExpandedGroup = (groupKey) => {
    setExpandedGroupKey((prevKey) => (prevKey === groupKey ? null : groupKey));
    setExpandedAppointmentId(null);
  };

  const toggleExpandedAppointment = (appointmentId) => {
    setExpandedAppointmentId((prevId) =>
      prevId === appointmentId ? null : appointmentId
    );
  };

  // Handle individual appointment deletion (Release)
  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setShowCancelModal(true);
  };

  const confirmCancelAppointment = async () => {
    if (appointmentToCancel) {
      setIsDeletingIndividual(true);
      try {
        await deleteDoc(doc(db, "appointments", appointmentToCancel.id));
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
        alert("Failed to cancel appointment. Please try again."); // User-friendly error
      } finally {
        setShowCancelModal(false);
        setAppointmentToCancel(null);
        setExpandedAppointmentId(null);
        setIsDeletingIndividual(false);
      }
    }
  };

  // Handle deleting all appointments for a group (Date + Clinic + Trapper)
  const handleDeleteAllAppointments = (group) => {
    setGroupToDelete(group);
    setShowDeleteAllModal(true);
  };

  const confirmDeleteAllAppointments = async () => {
    if (groupToDelete) {
      setIsDeletingGroup(true);
      try {
        const batch = writeBatch(db);
        groupToDelete.appointments.forEach((appointment) => {
          const appointmentRef = doc(db, "appointments", appointment.id);
          batch.delete(appointmentRef);
        });
        await batch.commit();

        setAppointments(
          appointments.filter(
            (appointment) =>
              !groupToDelete.appointments.some(
                (deletedApp) => deletedApp.id === appointment.id
              )
          )
        );
        console.log(
          "All appointments for group successfully deleted:",
          groupToDelete.dateKey,
          groupToDelete.clinicAddress,
          groupToDelete.trapperNumber
        );
      } catch (error) {
        console.error("Error deleting all appointments for group:", error);
        alert(
          "Failed to delete all appointments for this group. Please try again."
        );
      } finally {
        setShowDeleteAllModal(false);
        setGroupToDelete(null);
        setExpandedGroupKey(null);
        setExpandedAppointmentId(null);
        setIsDeletingGroup(false);
      }
    }
  };

  const handleCloseModal = () => {
    setShowCancelModal(false);
    setAppointmentToCancel(null);
    setShowDeleteAllModal(false);
    setGroupToDelete(null);
  };

  return (
    <>
      <header className="w-full flex justify-between border-b-2 border-tertiary-purple p-8">
        <h1 className="font-bold text-2xl text-primary-dark-purple flex items-center gap-2">
          Manage Appointments
        </h1>
        {/* No 'Book Appointment' button here, as this is for management */}
      </header>

      <div className="px-4 pt-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          {/* Tabs for Upcoming/History */}
          <div className="flex bg-primary-white rounded-lg overflow-hidden shadow-md">
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
        </div>

        <div className="flex-grow overflow-visible">
          {loading ? (
            <LoadingSpinner />
          ) : appointments.length > 0 ? (
            <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {groupAppointmentsForManager(appointments).map((group) => {
                const groupKey = `${group.dateKey}-${group.clinicAddress}-${group.trapperNumber}`;
                const isGroupExpanded = expandedGroupKey === groupKey;

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
                  <div key={groupKey} className="bg-white rounded-lg shadow-md">
                    {isDateValid && (
                      <div
                        onClick={() => toggleExpandedGroup(groupKey)}
                        className="bg-secondary-purple cursor-pointer rounded-t-lg text-white px-4 py-3 flex justify-between items-center"
                      >
                        <div className="flex-grow">
                          <h3 className="text-lg font-semibold">
                            {formattedDateHeader}
                          </h3>
                          <span className="text-md">
                            {dayOfWeek} | Trapper: {group.trapperName} (
                            {group.trapperNumber})
                          </span>
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
                                      toggleExpandedAppointment(appointment.id)
                                    }
                                  >
                                    <div className="flex w-full items-center justify-between">
                                      <div className="flex items-center">
                                        {/* You can add a specific icon for service type here, e.g., a cat icon for TNVR */}
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
                                      <p className="text-gray-700 mb-2">
                                        <strong>Booked by:</strong>{" "}
                                        {appointment.trapperFirstName}{" "}
                                        {appointment.trapperLastName} (
                                        {appointment.trapperNumber})
                                      </p>
                                      <p className="text-gray-700 mb-2">
                                        <strong>Clinic:</strong>{" "}
                                        {group.clinicName} (
                                        {group.clinicAddress})
                                      </p>
                                      <div className="flex items-center text-gray-700 mb-2">
                                        <NotebookPen
                                          size={18}
                                          className="mr-2"
                                        />
                                        <span className="font-semibold">
                                          Notes:
                                        </span>
                                      </div>
                                      <p className="text-gray-600 ml-6 break-words">
                                        {appointment.notes ||
                                          "No notes provided."}
                                      </p>
                                      {view === "upcoming" &&
                                        appointment.status !== "Canceled" && (
                                          <div className="flex justify-end mt-4">
                                            <button
                                              className="red-button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCancelAppointment(
                                                  appointment
                                                );
                                              }}
                                            >
                                              Delete Appointment
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
                              className="red-button text-sm w-full mt-4"
                              onClick={() => handleDeleteAllAppointments(group)}
                            >
                              Delete All for this Group
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
                            "No slots booked"}{" "}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-600 mt-8">
              No {view} appointments found.
            </div>
          )}
        </div>

        {/* Individual Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCancelModal}
          title="Confirm Deletion"
          message={`Are you sure you want to delete this ${appointmentToCancel?.serviceType} appointment? This action cannot be undone.`}
          onConfirm={confirmCancelAppointment}
          onClose={handleCloseModal}
          isSubmitting={isDeletingIndividual}
        />

        {/* Delete All Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteAllModal}
          title="Confirm Group Deletion"
          message={`Are you sure you want to delete all appointments for Trapper ${
            groupToDelete?.trapperName
          } on ${groupToDelete?.displayDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })} at ${groupToDelete?.clinicName}? This action cannot be undone.`}
          onConfirm={confirmDeleteAllAppointments}
          onClose={handleCloseModal}
          isSubmitting={isDeletingGroup}
        />
      </div>
    </>
  );
}
