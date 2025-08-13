import HomeUpcomingAppointments from "../components/HomeUpcomingAppointments"; // Adjust path
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container flex flex-col h-full mx-auto p-8">
      <h1 className="text-2xl text-center font-bold mb-4">{`Welcome ${currentUser.firstName}!`}</h1>
      <HomeUpcomingAppointments />
      <div className="mt-8 mb-16 md:hidden">
        <Link to="/book-appointment" className="button">
          Book Appointment
        </Link>
      </div>
    </div>
  );
}
