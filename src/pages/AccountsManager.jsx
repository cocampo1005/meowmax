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
import { useTranslation, Trans } from "react-i18next";

export default function AccountsManager() {
  const { currentUser } = useAuth();
  const { i18n, t } = useTranslation();

  // State for managing users and filters
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // New state for account modal
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

  const roleKey = (selectedUserDetails?.role || "").toLowerCase();
  const roleLabel = t(
    `roles.${roleKey}`,
    roleKey ? roleKey[0].toUpperCase() + roleKey.slice(1) : ""
  );

  const regionDisplay = Array.isArray(selectedUserDetails?.trapperRegion)
    ? selectedUserDetails.trapperRegion.join(", ")
    : selectedUserDetails?.trapperRegion || t("common.na");

  const fosterLabels = selectedUserDetails?.fosterCapability
    ? Object.entries(selectedUserDetails.fosterCapability)
        .filter(([, val]) => val === true)
        .map(([key]) => t(`profile.fosterTypes.${key}`))
        .join(", ")
    : null;

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
        <h1 className="font-bold text-2xl pb-4 md:pb-0 text-primary-dark-purple">
          {t("accounts.manageTitle")}
        </h1>
        <button onClick={handleAdd} className="button">
          <Plus />
          <span>{t("accounts.addUser")}</span>
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
          title={t("accounts.deleteUserTitle")}
          isDeleting={isDeleting}
          message={
            <>
              <p>
                <Trans i18nKey="accounts.deleteUserMessage" />
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
          <article className="rounded-xl px-4 sm:px-8 py-4 sm:py-6 bg-primary-light-purple text-primary-dark-purple">
            <div className="flex justify-between gap-4 sm:gap-8">
              <div className="flex-1">
                {/* Header */}
                <h2 className="text-xl sm:text-2xl font-bold mb-4">
                  {selectedUserDetails.trapperNumber} -{" "}
                  {selectedUserDetails.firstName} {selectedUserDetails.lastName}
                </h2>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
                  {/* Contact Info */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 text-accent-purple">
                      {t("accounts.sections.contactInfo")}
                    </h3>
                    <div className="space-y-2 text-sm sm:text-base">
                      <p>
                        <strong>{t("profile.email")}:</strong>{" "}
                        {selectedUserDetails.email}
                      </p>
                      <p>
                        <strong>{t("accounts.fields.role")}:</strong>{" "}
                        {roleLabel || t("common.na")}
                      </p>
                      <p>
                        <strong>{t("profile.phone")}:</strong>{" "}
                        {selectedUserDetails.phone
                          ? formatPhoneNumber(selectedUserDetails.phone)
                          : t("common.na")}
                      </p>
                      <p>
                        <strong>{t("profile.address")}:</strong>{" "}
                        {selectedUserDetails.address || t("common.na")}
                      </p>
                    </div>
                  </div>

                  {/* Trapper Info */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 text-accent-purple">
                      {t("accounts.sections.trapperInfo")}
                    </h3>
                    <div className="space-y-2 text-sm sm:text-base">
                      <p>
                        <strong>{t("accounts.fields.code")}:</strong>{" "}
                        {selectedUserDetails.code}
                      </p>
                      <p>
                        <strong>{t("accounts.fields.equipment")}:</strong>{" "}
                        {selectedUserDetails.equipment ?? t("common.na")}
                      </p>
                      <p>
                        <strong>{t("accounts.fields.trapperRegion")}:</strong>{" "}
                        {regionDisplay}
                      </p>
                      <p>
                        <strong>
                          {t("accounts.fields.recoverySpaceLimit")}:
                        </strong>{" "}
                        {selectedUserDetails.recoverySpaceLimit ??
                          t("common.na")}
                      </p>
                      <p>
                        <strong>
                          {t("accounts.fields.fosterCapability")}:
                        </strong>{" "}
                        {fosterLabels || t("profile.none")}
                      </p>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-accent-purple">
                        {t("accounts.metrics.title")}
                      </h3>
                      <button
                        onClick={handleEditMetricsClick}
                        disabled={!selectedUserId}
                        className={`group p-2 rounded-lg flex items-center gap-0 transition-all duration-300 overflow-hidden ${
                          selectedUserId
                            ? "bg-secondary-purple text-white hover:bg-accent-purple hover:gap-2 hover:px-3"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                        aria-label={t("accounts.metrics.edit")}
                        title={t("accounts.metrics.edit")}
                      >
                        <ChartSpline className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium max-w-0 group-hover:max-w-xs transition-all duration-300 whitespace-nowrap overflow-hidden">
                          {t("accounts.metrics.edit")}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-2 text-sm sm:text-base">
                      {selectedUserDetails.performanceMetrics ? (
                        <>
                          <p>
                            <strong>
                              {t("accounts.metrics.commitmentScore")}:
                            </strong>{" "}
                            {selectedUserDetails.performanceMetrics
                              .commitmentScore || 0}
                          </p>
                          <p>
                            <strong>{t("accounts.metrics.strikes")}:</strong>{" "}
                            {selectedUserDetails.performanceMetrics.strikes ||
                              0}
                          </p>
                          <p>
                            <strong>{t("profile.appointmentsBooked")}:</strong>{" "}
                            {selectedUserDetails.performanceMetrics
                              .totalAppointmentsBooked || 0}
                          </p>
                          <p>
                            <strong>
                              {t("profile.appointmentsCompleted")}:
                            </strong>{" "}
                            {selectedUserDetails.performanceMetrics
                              .totalAppointmentsCompleted || 0}
                          </p>
                          <p>
                            <strong>{t("accounts.metrics.overbooked")}:</strong>{" "}
                            {selectedUserDetails.performanceMetrics
                              .totalAppointmentsOverBooked || 0}
                          </p>
                          <p>
                            <strong>
                              {t("accounts.metrics.underbooked")}:
                            </strong>{" "}
                            {selectedUserDetails.performanceMetrics
                              .totalAppointmentsUnderBooked || 0}
                          </p>
                        </>
                      ) : (
                        <p>{t("accounts.noMetrics")}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Action Buttons - Right side */}
              <div className="hidden sm:flex flex-col justify-between items-end gap-4">
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="text-secondary-purple hover:text-error-red transition-colors"
                  aria-label="Delete Account"
                >
                  <Trash2 />
                </button>
                <button
                  onClick={() => handleEdit(selectedUserDetails)}
                  className="text-secondary-purple hover:text-accent-purple transition-colors"
                  aria-label="Edit Account"
                >
                  <SquarePen />
                </button>
              </div>
            </div>

            {/* Mobile Action Buttons - Fixed at bottom */}
            <div className="flex sm:hidden gap-3 pt-4 border-t border-accent-purple/20">
              <button
                onClick={() => handleEdit(selectedUserDetails)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-secondary-purple text-white rounded-lg hover:bg-accent-purple transition-colors"
                aria-label="Edit Account"
              >
                <SquarePen className="w-4 h-4" />
                <span className="text-sm font-medium">Edit</span>
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-error-red text-white rounded-lg hover:bg-red-700 transition-colors"
                aria-label="Delete Account"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Delete</span>
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
              placeholder={t("accounts.filters.searchPlaceholder")}
              aria-label={t("accounts.filters.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 border outline-accent-purple rounded-lg w-full pl-10"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-dark-purple"
              size={20}
              aria-hidden="true"
            />
          </div>

          {/* Equipment Filter */}
          <input
            type="number"
            placeholder={t("accounts.filters.equipmentMinPlaceholder")}
            aria-label={t("accounts.filters.equipmentMinPlaceholder")}
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className="p-2 border outline-accent-purple rounded-lg w-full md:w-auto md:min-w-[180px]"
          />

          {/* Region Filter */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="p-2 border outline-accent-purple rounded-lg w-full md:w-auto md:min-w-[140px]"
            aria-label={t("accounts.filters.region.label")}
          >
            <option value="">{t("accounts.filters.region.all")}</option>
            <option value="Broward">
              {t("accounts.filters.region.broward")}
            </option>
            <option value="Miami-Dade">
              {t("accounts.filters.region.miamiDade")}
            </option>
          </select>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 cursor-pointer bg-secondary-purple text-white rounded-lg hover:bg-accent-purple flex items-center justify-center gap-2 w-full md:w-auto md:whitespace-nowrap"
            aria-label={t("accounts.filters.reset")}
            title={t("accounts.filters.reset")}
          >
            <RotateCcw size={18} />
            <span>{t("accounts.filters.reset")}</span>
          </button>
        </div>

        <div
          className={`w-full rounded-xl relative overflow-x-auto overflow-y-auto flex-grow`}
        >
          <div className="rounded-xl">
            <table className="w-full min-w-full divide-y rounded-xl divide-tertiary-purple">
              <thead className="sticky top-0 z-10 bg-secondary-purple text-primary-white">
                <tr>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.number")}
                  </th>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.name")}
                  </th>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.role")}
                  </th>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.code")}
                  </th>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.phone")}
                  </th>
                  <th className="px-6 py-3 text-left">
                    {t("accounts.table.region")}
                  </th>
                  <th className="px-6 py-3 text-right">
                    {t("accounts.table.equipmentShort")}
                  </th>
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
                    <td className="px-6 py-4">
                      {Array.isArray(user.trapperRegion)
                        ? user.trapperRegion.join(", ")
                        : user.trapperRegion || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {Number.isFinite(Number(user.equipment)) &&
                      Number(user.equipment) >= 0
                        ? Number(user.equipment)
                        : 0}
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
