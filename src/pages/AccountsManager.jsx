import { useEffect, useState } from "react";
import {
  doc,
  collection,
  getDocs,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth, functions } from "../firebase";
import ConfirmationModal from "../components/ConfirmationModal";
import AccountModal from "../components/AccountModal";
import PerformanceMetricsModal from "../components/PerformanceMetricsModal";
import { Trash2, SquarePen, Plus, ChartSpline } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../contexts/AuthContext";
import { formatPhoneNumber } from "../utils/phoneNumberReformatter";

export default function AccountsManager() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New state for performance metrics modal
  const [isMetricsModalOpen, setMetricsModalOpen] = useState(false);
  const [selectedUserForMetrics, setSelectedUserForMetrics] = useState(null);

  // Fetch users from Firestore
  const fetchUsers = async () => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("trapperNumber", "asc"));
    const querySnapshot = await getDocs(q);
    const userList = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setUsers(userList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const selectedUserDetails = users.find((user) => user.id === selectedUserId);

  const handleUserClick = (userId) => {
    setSelectedUserId((prevId) => (prevId === userId ? null : userId));
  };

  // Opens the modal for adding a new user
  const handleAdd = () => {
    setSelectedUser(null);
    setAccountModalOpen(true);
  };

  // Opens the modal for editing an existing user
  const handleEdit = (user) => {
    setSelectedUser(user);
    setAccountModalOpen(true);
  };

  // Saves a new user or updates an existing one
  const handleSaveUser = async (userData) => {
    // --- DIAGNOSTIC LOG ---
    console.log(
      "Current user before calling Cloud Function:",
      auth.currentUser
    );
    // ----------------------

    if (!auth.currentUser) {
      console.error("User is not authenticated. Cannot create/update user.");
      alert("Authentication error. Please log in again.");
      return;
    }

    if (selectedUser) {
      // Editing an existing user
      const userRef = doc(db, "users", selectedUser.id);
      try {
        if (userData.code !== selectedUser.code && userData.code) {
          const changeUserPassword = httpsCallable(
            functions,
            "changeUserPassword"
          );

          try {
            await changeUserPassword({
              uid: selectedUser.uid,
              newCode: userData.code,
            });
            console.log("User password (code) updated via Cloud Function.");
          } catch (passwordError) {
            console.error(
              "Error changing user password via Cloud Function:",
              passwordError
            );
            alert(
              `Failed to update user password: ${passwordError.message}. Other user details might be saved.`
            );
          }
        }

        await updateDoc(userRef, userData);
        fetchUsers();
      } catch (error) {
        console.error("Error updating user:", error);
        alert("Failed to update user. See console for details.");
      }
    } else {
      // Creating a new user
      try {
        const createNewUser = httpsCallable(functions, "createNewUser");

        const result = await createNewUser({
          ...userData,
        });

        console.log("User created successfully:", result.data);

        fetchUsers();
      } catch (error) {
        console.error("Error creating user:", error);
        alert("Failed to create user. See console for details.");
      }
    }

    setAccountModalOpen(false);
  };

  // Function to open the metrics modal
  const handleEditMetricsClick = () => {
    const userToEdit = users.find((user) => user.id === selectedUserId);
    setSelectedUserForMetrics(userToEdit);
    setMetricsModalOpen(true);
  };

  // Function to handle saving user metrics data
  const handleSaveMetrics = async (userId, metricsData) => {
    if (!userId) return;

    const userDocRef = doc(db, "users", userId);
    try {
      // Use dot notation to update the entire performanceMetrics map
      await updateDoc(userDocRef, {
        performanceMetrics: metricsData,
      });
      console.log("User performance metrics updated successfully!");
      fetchUsers(); // Re-fetch users to update the UI
    } catch (error) {
      console.error("Error updating user performance metrics:", error);
      // Handle error (e.g., show an error message to the user)
    }
  };

  const confirmDelete = async () => {
    if (!auth.currentUser) {
      console.error("User is not authenticated. Cannot delete user.");
      alert("Authentication error. Please log in again.");
      return;
    }
    setIsDeleting(true);

    try {
      const deleteFirebaseUser = httpsCallable(functions, "deleteFirebaseUser");
      await deleteFirebaseUser({
        uid: selectedUserDetails.id,
      });

      fetchUsers();
      setSelectedUserId(null);
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(`Failed to delete user: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <header className="w-full flex justify-between border-b-2 border-tertiary-purple p-8">
        <h1 className="font-bold text-2xl text-primary-dark-purple">
          Manage Accounts
        </h1>
        <button
          onClick={handleAdd}
          className="flex gap-2 bg-accent-purple hover:bg-secondary-purple text-primary-white py-2 px-4 rounded-lg"
        >
          <Plus />
          <span>Add User</span>
        </button>
      </header>

      {/* Account Modal for Adding and Editing */}
      {isAccountModalOpen && (
        <AccountModal
          isOpen={isAccountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          onSave={handleSaveUser}
          initialData={selectedUser} // Null for new, existing data for editing
        />
      )}

      {/* NEW: Performance Metrics Modal */}
      <PerformanceMetricsModal
        isOpen={isMetricsModalOpen}
        onClose={() => setMetricsModalOpen(false)}
        user={selectedUserForMetrics}
        onSaveMetrics={handleSaveMetrics} // Pass the new save handler
      />

      {/* Confirmation Modal for Deleting */}
      {isDeleteModalOpen && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="Delete User"
          isDeleting={isDeleting}
          message={
            <>
              <p>
                Are you sure you want to delete this user account? This action
                cannot be undone.
              </p>
              <p className="text-center py-2">
                <strong>
                  {selectedUserDetails?.trapperNumber} -{" "}
                  {selectedUserDetails?.firstName}{" "}
                  {selectedUserDetails?.lastName}
                </strong>
              </p>
            </>
          }
        />
      )}

      <section className="p-8 max-h-screen flex flex-col gap-8">
        {selectedUserDetails && (
          <article className="rounded-xl flex justify-between flex-shrink-0 gap-8 px-8 p-4 bg-primary-light-purple text-primary-dark-purple">
            <div>
              <h2 className="text-2xl font-bold mb-4">
                {selectedUserDetails.firstName} {selectedUserDetails.lastName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h3 className="text-xl font-semibold mb-2">User Info:</h3>
                  <p>
                    <strong>Email:</strong> {selectedUserDetails.email}
                  </p>
                  <p>
                    <strong>Role:</strong>{" "}
                    {selectedUserDetails.role.charAt(0).toUpperCase() +
                      selectedUserDetails.role.slice(1)}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {selectedUserDetails.phone
                      ? formatPhoneNumber(selectedUserDetails.phone)
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Address:</strong> {selectedUserDetails.address}
                  </p>
                  <p>
                    <strong>Code:</strong> {selectedUserDetails.code}
                  </p>
                  <p>
                    <strong>Equipment:</strong> {selectedUserDetails.equipment}
                  </p>
                </div>
                {/* NEW: Display Performance Metrics */}
                <div>
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-semibold mb-2">
                      Performance Metrics:
                    </h3>
                    {/* NEW: Button to open Performance Metrics Modal */}
                    <button
                      onClick={handleEditMetricsClick}
                      disabled={!selectedUserId}
                      className={`mr-2 px-4 py-2 rounded-md flex items-center ${
                        selectedUserId
                          ? "bg-accent-purple text-white hover:cursor-pointer hover:bg-secondary-purple"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <ChartSpline className="w-5 h-5 mr-2" />
                      Edit Metrics
                    </button>
                  </div>
                  {selectedUserDetails.performanceMetrics ? (
                    <>
                      <p>
                        <strong>Commitment Score:</strong>{" "}
                        {selectedUserDetails.performanceMetrics
                          .commitmentScore || 0}
                      </p>
                      <p>
                        <strong>Strikes:</strong>{" "}
                        {selectedUserDetails.performanceMetrics.strikes || 0}
                      </p>
                      <p>
                        <strong>Appointments Booked:</strong>{" "}
                        {selectedUserDetails.performanceMetrics
                          .totalAppointmentsBooked || 0}
                      </p>
                      <p>
                        <strong>Appointments Completed:</strong>{" "}
                        {selectedUserDetails.performanceMetrics
                          .totalAppointmentsCompleted || 0}
                      </p>
                      <p>
                        <strong>Appointments Overbooked:</strong>{" "}
                        {selectedUserDetails.performanceMetrics
                          .totalAppointmentsOverBooked || 0}
                      </p>
                      <p>
                        <strong>Appointments Underbooked:</strong>{" "}
                        {selectedUserDetails.performanceMetrics
                          .totalAppointmentsUnderBooked || 0}
                      </p>
                    </>
                  ) : (
                    <p>No performance metrics available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between items-end gap-4">
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="text-secondary-purple hover:cursor-pointer hover:text-error-red"
              >
                <Trash2 />
              </button>
              <button
                onClick={() => handleEdit(selectedUserDetails)}
                className="text-secondary-purple hover:cursor-pointer hover:text-accent-purple"
              >
                <SquarePen />
              </button>
            </div>
          </article>
        )}

        <div
          className={`w-full overflow-x-auto overflow-y-auto flex-grow ${
            selectedUserDetails
              ? "max-h-[calc(100vh-355px)"
              : "max-h-[calc(100vh-170px)"
          }`}
        >
          <div className="rounded-xl overflow-hidden">
            <table className="w-full min-w-full divide-y divide-tertiary-purple rounded-xl">
              <thead className="sticky top-0 z-10 bg-secondary-purple rounded-xl text-primary-white">
                <tr>
                  <th className="px-6 py-3 text-left">Number</th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Phone</th>
                </tr>
              </thead>
              <tbody className="bg-primary-white divide-y divide-gray-300 overflow-y-auto max-h-[calc(100vh-350px) text-primary-dark-purple hover:cursor-pointer">
                {users?.map((user) => (
                  <tr
                    key={user.id}
                    className={`group hover:bg-primary-light-purple ${
                      selectedUserId === user.id ? "bg-tertiary-purple" : ""
                    }`}
                    onClick={() => handleUserClick(user.id)}
                  >
                    <td className="px-6 py-4">{user?.trapperNumber}</td>
                    <td className="px-6 py-4">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-6 py-4 capitalize">{user.role}</td>
                    <td className="px-6 py-4">{user.code}</td>
                    <td className="px-6 py-4">
                      {user.phone ? formatPhoneNumber(user.phone) : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
