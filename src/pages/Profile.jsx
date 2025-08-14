import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { formatPhoneNumber } from "../utils/phoneNumberReformatter";
import { LogoutIcon } from "../svgs/Icons";
import { Globe, SquarePen } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import { useTranslation } from "react-i18next";
import usFlag from "../assets/flags/us-flag.svg";
import esFlag from "../assets/flags/es-flag.svg";

export default function Profile() {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        trapperRegion: currentUser.trapperRegion || [],
        equipment: currentUser.equipment || "",
        recoverySpaceLimit: currentUser.recoverySpaceLimit || "",
        fosterCapability: currentUser.fosterCapability || {
          neonate: false,
          medical: false,
          shortTerm: false,
          longTerm: false,
          senior: false,
        },
        language:
          currentUser.language ||
          (i18n.language?.startsWith("es") ? "es" : "en"),
      });
    }
  }, [currentUser, i18n.language]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleCheckboxChange = (field) => {
    setFormData((prev) => ({
      ...prev,
      fosterCapability: {
        ...prev.fosterCapability,
        [field]: !prev.fosterCapability[field],
      },
    }));
  };

  const handleRegionChange = (region) => {
    setFormData((prev) => {
      const updated = prev.trapperRegion.includes(region)
        ? prev.trapperRegion.filter((r) => r !== region)
        : [...prev.trapperRegion, region];
      return { ...prev, trapperRegion: updated };
    });
  };

  const handleLanguageChange = (e) => {
    const selectedLanguage = e.target.value;
    setFormData((prev) => ({ ...prev, language: selectedLanguage }));
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        trapperRegion: formData.trapperRegion,
        equipment: Math.max(0, parseInt(formData.equipment, 10)),
        recoverySpaceLimit: Math.max(
          0,
          parseInt(formData.recoverySpaceLimit, 10)
        ),
        fosterCapability: formData.fosterCapability,
        language: formData.language,
      });

      // Update i18n language and localStorage when saving
      await i18n.changeLanguage(formData.language);

      setEditing(false);
    } catch (error) {
      console.error("Failed to update user:", error);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formData) return <LoadingSpinner />;
  if (!currentUser) {
    navigate("/login");
    return null;
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    address,
    trapperNumber,
    performanceMetrics,
    language,
  } = currentUser;

  return (
    <div className="container mx-auto relative p-8 mb-16 md:mb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-center md:text-left text-accent-purple">
          {trapperNumber
            ? `${trapperNumber} - ${firstName} ${lastName}`
            : `${firstName} ${lastName}`}
        </h1>

        <div className=" hidden md:flex">
          <button onClick={handleLogout} className="red-button gap-2">
            <LogoutIcon />
            {t("profile.logout")}
          </button>
        </div>
      </div>

      {/* Card Content */}

      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Basic Info */}
          <section>
            <h2 className="text-xl font-semibold text-primary-dark-purple mb-3">
              {t("profile.yourInformation")}
            </h2>
            <div className="space-y-2">
              <p>
                <strong>{t("profile.email")}:</strong> {email || "N/A"}
              </p>
              <p>
                <strong>{t("profile.phone")}:</strong>{" "}
                {formatPhoneNumber(phone) || "N/A"}
              </p>
              <p>
                <strong>{t("profile.address")}:</strong> {address || "N/A"}
              </p>
              <div>
                <strong>{t("profile.regions")}:</strong>{" "}
                {editing ? (
                  <div className="flex gap-4 mt-2">
                    {["Miami-Dade", "Broward"].map((region) => (
                      <label key={region} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.trapperRegion.includes(region)}
                          onChange={() => handleRegionChange(region)}
                          className="accent-secondary-purple"
                        />
                        {region}
                      </label>
                    ))}
                  </div>
                ) : (
                  formData.trapperRegion.join(", ") || "N/A"
                )}
              </div>
              <p>
                <strong>{t("profile.equipmentCapacity")}:</strong>{" "}
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    className="input w-24"
                    value={formData.equipment}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setFormData((prev) => ({ ...prev, equipment: value }));
                      } else if (e.target.value === "") {
                        setFormData((prev) => ({ ...prev, equipment: "" }));
                      }
                    }}
                  />
                ) : (
                  formData.equipment ?? "N/A"
                )}
              </p>
              <p>
                <strong>{t("profile.recoverySpaceLimit")}:</strong>{" "}
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    className="input w-24"
                    value={formData.recoverySpaceLimit}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setFormData((prev) => ({
                          ...prev,
                          recoverySpaceLimit: value,
                        }));
                      } else if (e.target.value === "") {
                        setFormData((prev) => ({
                          ...prev,
                          recoverySpaceLimit: "",
                        }));
                      }
                    }}
                  />
                ) : (
                  formData.recoverySpaceLimit ?? "N/A"
                )}
              </p>
            </div>
          </section>

          {/* Foster Capability */}
          <section>
            <h2 className="text-xl font-semibold text-primary-dark-purple mb-3">
              {t("profile.fosterCapability")}
            </h2>

            {editing ? (
              <div className="space-y-4">
                {Object.entries(formData.fosterCapability).map(
                  ([key, value]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handleCheckboxChange(key)}
                        className="accent-secondary-purple"
                      />
                      {t(`profile.fosterTypes.${key}`)}
                    </label>
                  )
                )}
              </div>
            ) : (
              <ul className="list-none pl-1 space-y-1">
                {Object.entries(formData.fosterCapability)
                  .filter(([_, value]) => value)
                  .map(([key]) => (
                    <li
                      key={key}
                      className="flex items-center text-sm text-gray-700"
                    >
                      <span className="text-success-green mr-2">✓</span>
                      {t(`profile.fosterTypes.${key}`)}
                    </li>
                  ))}
                {
                  // If none are true
                  Object.values(formData.fosterCapability).every((v) => !v) && (
                    <li className="text-sm text-gray-500 italic">
                      {t("profile.none")}
                    </li>
                  )
                }
              </ul>
            )}
          </section>

          {/* Appointment Metrics */}
          <section>
            <h2 className="text-xl font-semibold text-primary-dark-purple mb-3">
              {t("profile.appointmentMetrics")}
            </h2>
            <p>
              <strong>{t("profile.appointmentsBooked")}:</strong>{" "}
              {performanceMetrics?.totalAppointmentsBooked ?? 0}
            </p>
            <p>
              <strong>{t("profile.appointmentsCompleted")}:</strong>{" "}
              {performanceMetrics?.totalAppointmentsCompleted ?? 0}
            </p>
          </section>

          {/* Language */}
          <section>
            <h2 className="text-xl font-semibold text-primary-dark-purple mb-3">
              {t("profile.language")}
            </h2>
            {editing ? (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-secondary-purple" />
                <select
                  value={formData.language}
                  onChange={handleLanguageChange}
                  className="input px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {language === "en" ? (
                  <>
                    <img src={usFlag} alt="English" className="w-6 h-4" />
                    <span>English</span>
                  </>
                ) : (
                  <>
                    <img src={esFlag} alt="Español" className="w-6 h-4" />
                    <span>Español</span>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        {/* Edit Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="outline-button"
                disabled={saving}
              >
                {t("profile.cancel")}
              </button>
              <button
                onClick={handleSave}
                className="button mt-4"
                disabled={saving}
              >
                {saving ? <LoadingSpinner size="sm" /> : t("profile.save")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="button flex items-center gap-2"
            >
              <SquarePen className="w-4 h-4" />
              {t("profile.edit")}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Logout Button */}
      <div className="md:hidden">
        <button onClick={handleLogout} className="red-button mt-4 w-full gap-2">
          <LogoutIcon />
          {t("profile.logout")}
        </button>
      </div>
    </div>
  );
}
