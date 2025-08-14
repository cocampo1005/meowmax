import HomeUpcomingAppointments from "../components/HomeUpcomingAppointments";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { currentUser } = useAuth();
  const { t } = useTranslation();

  if (!currentUser) {
    return <div>{t("home.loading")}</div>;
  }

  return (
    <div className="container flex flex-col h-full mx-auto p-8">
      <h1 className="text-2xl text-center font-bold mb-4">
        {t("home.welcome", { name: currentUser.firstName })}
      </h1>
      <HomeUpcomingAppointments />
      <div className="mt-8 mb-16 md:hidden">
        <Link to="/book-appointment" className="button">
          {t("appointments.bookAppointment")}
        </Link>
      </div>
    </div>
  );
}
