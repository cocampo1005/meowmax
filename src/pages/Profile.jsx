import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { auth } from "../firebase";
import { LogoutIcon } from "../svgs/Icons";

export default function Profile() {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  // Handle user logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      console.log("User logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentUser) {
    navigate("/login");
    return null;
  }

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
        <div className="pt-4 border-t border-gray-200 md:justify-end flex">
          {" "}
          {/* Separator */}
          <button onClick={handleLogout} className="red-button w-full md:w-40">
            <LogoutIcon />
            <p>Logout</p>
          </button>
        </div>
      </div>
    </div>
  );
}
