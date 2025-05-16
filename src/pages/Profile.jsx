import { useAuth } from "../contexts/AuthContext"; // Import your useAuth hook
import { useNavigate } from "react-router-dom"; // To redirect after logout
import LoadingSpinner from "../components/LoadingSpinner"; // Adjust path as needed
import { auth } from "../firebase"; // Import your firebase auth instance
import { LogoutIcon } from "../svgs/Icons";

export default function Profile() {
  const { currentUser, loading } = useAuth(); // Get currentUser and loading state from useAuth
  const navigate = useNavigate();

  // Handle user logout
  const handleLogout = async () => {
    try {
      await auth.signOut(); // Sign out the user using Firebase auth
      console.log("User logged out successfully");
      navigate("/login"); // Redirect to the login page after logout
      // Or navigate to '/' if your home page is accessible without login
    } catch (error) {
      console.error("Error logging out:", error);
      // Optionally display an error message to the user
    }
  };

  // Show loading spinner while auth state is loading
  if (loading) {
    return <LoadingSpinner />;
  }

  // If no user is logged in after loading, redirect to login
  // This might happen if the user tries to access /profile directly when not authenticated
  if (!currentUser) {
    navigate("/login"); // Redirect to login if not authenticated
    return null; // Return null to prevent rendering before redirection
  }

  // Assuming currentUser now includes profile data fetched in AuthContext
  // based on our previous refactoring
  const { firstName, lastName, email, phone, address, trapperNumber } =
    currentUser;

  return (
    <div className="container mx-auto h-full overflow-y-auto p-4">
      {" "}
      {/* Added padding top */}
      <h1 className="text-2xl font-bold mb-6 text-center text-accent-purple">
        {trapperNumber
          ? `${trapperNumber} - ${firstName} ${lastName}`
          : `${firstName} ${lastName}`}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
        {/* User Information Display */}
        <div>
          <h2 className="text-xl font-semibold text-primary-dark-purple mb-3">
            Your Information
          </h2>
          <div className="space-y-2">
            <p>
              <strong>Email:</strong> {email || "N/A"}
            </p>
            <p>
              <strong>Phone:</strong> {phone || "N/A"}
            </p>
            <p>
              <strong>Address:</strong> {address || "N/A"}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-4 border-t border-gray-200">
          {" "}
          {/* Separator */}
          <button onClick={handleLogout} className="red-button w-full">
            <LogoutIcon />
            <p>Logout</p>
          </button>
        </div>
      </div>
      {/* Suggestions for other Profile Page features */}
      {/* <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-primary-dark-purple">
          More Profile Options (Future Ideas)
        </h3>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>
            View past appointment history (Link to Appointments page filtered by
            history)
          </li>
          <li>
            View pending appointment requests (If applicable to your workflow)
          </li>
          <li>Manage notification preferences</li>
          <li>Link to organization's policies or resources</li>
          <li>FAQ or Help section link</li> */}
      {/* Add other relevant links or information */}
      {/* </ul>
        <p className="mt-3 text-sm text-gray-600">
          Note: Account details like email and password updates are handled by
          administrators.
        </p>
      </div> */}
    </div>
  );
}
