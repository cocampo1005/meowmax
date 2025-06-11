import { useEffect, useState } from "react";
import { doc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db, auth, functions } from "../firebase"; // adjust import as needed, assuming auth is also from firebase.js
import ConfirmationModal from "../components/ConfirmationModal"; // Assuming ConfirmationModal is in the same directory
import AccountModal from "../components/AccountModal"; // Assuming AccountModal is in the same directory
import { Trash2, SquarePen, Plus } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../contexts/AuthContext"; // Assuming AuthContext is used for current user
import { formatPhoneNumber } from "../utils/phoneNumberReformatter";

export default function AccountsManager() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch users from Firestore
  const fetchUsers = async () => {
    const usersCol = collection(db, "users");
    const snapshot = await getDocs(usersCol);
    const userList = snapshot.docs.map((doc) => ({
      id: doc.id,
      uid: doc.data().uid, // Make sure 'uid' is included in your user documents
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
        alert("User created successfully!");

        fetchUsers();
      } catch (error) {
        console.error("Error creating user:", error);
        alert("Failed to create user. See console for details.");
      }
    }

    setAccountModalOpen(false);
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
        uid: selectedUserDetails.uid,
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
                </div>
                <div>
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
              <tbody className="bg-primary-white divide-y divide-gray-300 overflow-y-auto max-h-[calc(100vh-350px) text-primary-dark-purple">
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
