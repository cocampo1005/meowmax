import { useEffect, useState } from "react";
import {
  doc,
  collection,
  getDocs,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db, functions } from "../firebase";
import ConfirmationModal from "../components/ConfirmationModal";
import AccountModal from "../components/AccountModal";
import PerformanceMetricsModal from "../components/PerformanceMetricsModal";
import {
  Trash2,
  SquarePen,
  Plus,
  ChartSpline,
  Search,
  RotateCcw,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../contexts/AuthContext";
import { formatPhoneNumber } from "../utils/phoneNumberReformatter";

export default function AccountsManager() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New state for performance metrics modal
  const [isMetricsModalOpen, setMetricsModalOpen] = useState(false);
  const [selectedUserForMetrics, setSelectedUserForMetrics] = useState(null);

  // New states for filters
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // New state for search term

  // Fetch users from Firestore
  const fetchUsers = async () => {
    const usersRef = collection(db, "users");
    // Start with a base query ordered by trapperNumber
    let q = query(usersRef, orderBy("trapperNumber", "asc"));

    const querySnapshot = await getDocs(q);
    const userList = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const numA = parseInt(a.trapperNumber, 10);
        const numB = parseInt(b.trapperNumber, 10);
        return numA - numB;
      });
    setUsers(userList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Effect to filter users whenever the users list or filter criteria change
  useEffect(() => {
    let currentFilteredUsers = users;

    if (searchTerm) {
      currentFilteredUsers = currentFilteredUsers.filter(
        (user) =>
          user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.trapperNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (equipmentFilter) {
      const minCapacity = parseInt(equipmentFilter, 10);
      if (!isNaN(minCapacity)) {
        currentFilteredUsers = currentFilteredUsers.filter(
          (user) =>
            user.equipment && parseInt(user.equipment, 10) >= minCapacity
        );
      }
    }

    if (regionFilter) {
      currentFilteredUsers = currentFilteredUsers.filter(
        (user) =>
          user.trapperRegion && user.trapperRegion.includes(regionFilter)
      );
    }
    setFilteredUsers(currentFilteredUsers);
  }, [users, equipmentFilter, regionFilter, searchTerm]);

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
    if (!currentUser) {
      console.error("User is not authenticated. Cannot create/update user.");
      alert("Authentication error. Please log in again.");
      return;
    }

    if (selectedUser) {
      // Editing an existing user
      const userRef = doc(db, "users", selectedUser.id);
      try {
        if (userData.email !== selectedUser.email) {
          const changeUserEmail = httpsCallable(functions, "changeUserEmail");
          try {
            await changeUserEmail({
              uid: selectedUser.id,
              newEmail: userData.email,
            });
            console.log("Email updated via Cloud Function.");
          } catch (emailError) {
            console.error("Failed to update email:", emailError);
            alert(`Email change failed: ${emailError.message}`);
          }
        }

        if (userData.code !== selectedUser.code && userData.code) {
          const changeUserPassword = httpsCallable(
            functions,
            "changeUserPassword"
          );

          try {
            await changeUserPassword({
              uid: selectedUser.id,
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
    if (!currentUser) {
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

  // Function to reset all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setEquipmentFilter("");
    setRegionFilter("");
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-2xl font-bold text-error-red">
          You do not have permission to access this page.
        </h1>
      </div>
    );
  }

  return (
    <>
      <header className="w-full flex flex-col md:flex-row justify-between border-b-2 border-tertiary-purple p-8">
        <h1 className="font-bold text-2xl pb-4 md:pb-0 text-primary-dark-purple">
          Manage Accounts
        </h1>
        <button onClick={handleAdd} className="button">
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

      <section className="p-8 flex mb-16 md:mb-0 flex-col gap-8 overflow-y-auto md:max-h-[calc(100vh-10.5rem)]">
        {selectedUserDetails && (
          <article className="rounded-xl flex justify-between flex-shrink-0 gap-8 px-8 p-4 bg-primary-light-purple text-primary-dark-purple">
            <div>
              <h2 className="text-2xl font-bold mb-4">
                {selectedUserDetails.trapperNumber} -{" "}
                {selectedUserDetails.firstName} {selectedUserDetails.lastName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Contact Info:</h3>
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
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Trapper Info:</h3>
                  <p>
                    <strong>Code:</strong> {selectedUserDetails.code}
                  </p>
                  <p>
                    <strong>Equipment:</strong> {selectedUserDetails.equipment}
                  </p>
                  <p>
                    <strong>Trapper Region:</strong>{" "}
                    {selectedUserDetails.trapperRegion || "N/A"}
                  </p>
                  <p>
                    <strong>Recovery Space Limit:</strong>{" "}
                    {selectedUserDetails.recoverySpaceLimit ?? "N/A"}
                  </p>
                  <p>
                    <strong>Foster Capability:</strong>{" "}
                    {selectedUserDetails.fosterCapability
                      ? Object.entries(selectedUserDetails.fosterCapability)
                          .filter(([_, val]) => val === true)
                          .map(
                            ([key]) =>
                              key.charAt(0).toUpperCase() + key.slice(1)
                          )
                          .join(", ") || "None"
                      : "N/A"}
                  </p>
                </div>
                {/* Performance Metrics */}
                <div>
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-semibold mb-2">
                      Performance Metrics:
                    </h3>
                    {/* Button to open Performance Metrics Modal */}
                    <button
                      onClick={handleEditMetricsClick}
                      disabled={!selectedUserId}
                      className={`px-3 py-1 text-sm rounded-lg flex gap-2 items-center ${
                        selectedUserId
                          ? "bg-secondary-purple text-white hover:cursor-pointer hover:bg-accent-purple"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <ChartSpline className="w-4 h-4" />
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

        {/* Filter Inputs */}
        <div className="space-y-3 md:space-y-0 md:flex md:gap-4">
          {/* Search Input */}
          <div className="relative md:flex-grow">
            <input
              type="text"
              placeholder="Search by Name or Number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 border outline-accent-purple rounded-lg w-full pl-10"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-dark-purple"
              size={20}
            />
          </div>

          {/* Equipment Filter */}
          <input
            type="number"
            placeholder="Min Equipment Capacity"
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className="p-2 border outline-accent-purple rounded-lg w-full md:w-auto md:min-w-[180px]"
          />

          {/* Region Filter */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="p-2 border outline-accent-purple rounded-lg w-full md:w-auto md:min-w-[140px]"
          >
            <option value="">All Regions</option>
            <option value="Broward">Broward</option>
            <option value="Miami-Dade">Miami-Dade</option>
          </select>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 cursor-pointer bg-secondary-purple text-white rounded-lg hover:bg-accent-purple flex items-center justify-center gap-2 w-full md:w-auto md:whitespace-nowrap"
          >
            <RotateCcw size={18} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div
          className={`w-full rounded-xl relative overflow-x-auto overflow-y-auto flex-grow`}
        >
          <div className="rounded-xl">
            <table className="w-full min-w-full divide-y rounded-xl divide-tertiary-purple">
              <thead className="sticky top-0 z-10 bg-secondary-purple text-primary-white">
                <tr>
                  <th className="px-6 py-3 text-left">Number</th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Phone</th>
                  <th className="px-6 py-3 text-left">Region</th>
                  <th className="px-6 py-3 text-right">Eqpt</th>
                </tr>
              </thead>
              <tbody className="bg-primary-white divide-y divide-gray-300 text-primary-dark-purple hover:cursor-pointer">
                {filteredUsers?.map((user) => (
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
                    <td className="px-6 py-4">{user.trapperRegion || "N/A"}</td>
                    <td className="px-6 py-4 text-right">
                      {user.equipment ?? "N/A"}
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
