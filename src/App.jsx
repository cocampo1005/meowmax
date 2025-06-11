import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./pages/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Appointments from "./pages/Appointments";
import BookAppointment from "./pages/BookAppointment";
import Profile from "./pages/Profile";
import AccountsManager from "./pages/AccountsManager";
import AppointmentsManager from "./pages/AppointmentsManager";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/book-appointment" element={<BookAppointment />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/accounts-manager" element={<AccountsManager />} />
        <Route path="/appointments-manager" element={<AppointmentsManager />} />
      </Route>
    </Routes>
  );
}

export default App;
