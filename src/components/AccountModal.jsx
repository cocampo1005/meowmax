import { Plus, SquarePen } from "lucide-react";
import { useEffect, useState } from "react";

export default function AccountModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    role: "trapper",
    trapperNumber: "",
    trapperRegion: [],
    code: "",
    equipment: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        email: initialData.email || "",
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
        role: initialData.role || "trapper",
        trapperNumber: initialData.trapperNumber || "",
        trapperRegion: initialData.trapperRegion || [],
        code: initialData.code || "",
        equipment: initialData.equipment || "",
      });
    } else {
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        address: "",
        role: "trapper",
        trapperNumber: "",
        trapperRegion: [],
        code: "",
        equipment: "",
      });
    }
    setErrors({});
    setIsSuccess(false);
  }, [initialData, isOpen]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegionChange = (e) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const currentRegions = prev.trapperRegion || [];
      return {
        ...prev,
        trapperRegion: checked
          ? [...currentRegions, value]
          : currentRegions.filter((region) => region !== value),
      };
    });
  };

  const validateForm = () => {
    let newErrors = {};

    if (!formData.email.trim()) newErrors.email = "Email is required.";
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required.";
    if (!formData.lastName.trim())
      newErrors.lastName = "Last name is required.";
    if (!formData.role.trim()) newErrors.role = "Role is required.";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required.";
    if (!formData.address.trim()) newErrors.address = "Address is required.";

    if (formData.role === "trapper" && !formData.trapperNumber.trim()) {
      newErrors.trapperNumber = "Trapper number is required for trappers.";
    }

    if (!formData.trapperRegion || formData.trapperRegion.length === 0) {
      newErrors.trapperRegion = "At least one region must be selected.";
    }

    if (!formData.equipment.trim()) {
      newErrors.equipment = "Equipment value is required.";
    } else if (!/^\d+$/.test(formData.equipment)) {
      newErrors.equipment = "Equipment must be a number.";
    }

    if (!formData.code.trim()) {
      newErrors.code = "Four-digit code is required.";
    } else if (!/^\d{4}$/.test(formData.code)) {
      newErrors.code = "Code must be exactly four digits.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setIsSuccess(false);

    try {
      await onSave(formData);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error creating/updating account:", error);
      alert("Failed to save account. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-100 p-4">
      <div className="bg-primary-white rounded-3xl w-full max-w-xl text-primary-dark-purple max-h-[95vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex items-center textaccent-purple gap-4 px-6 sm:px-16 pt-6 sm:pt-12 pb-4 flex-shrink-0">
          {initialData ? (
            <SquarePen size="36px" className="flex-shrink-0" />
          ) : (
            <Plus className="flex-shrink-0" />
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-dark-purple font-accent">
            {initialData ? "Edit User Account" : "Add User Account"}
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 sm:px-16 flex-1">
          <div className="space-y-4 pb-4">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <p className="text-success-green font-semibold text-lg mb-4">
                  ✅ Account successfully saved!
                </p>
                <button type="button" onClick={onClose} className="button">
                  Okay
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
                  <div>
                    <label>
                      Number <span className="text-error-red">*</span>
                    </label>
                    {errors.trapperNumber && (
                      <p className="text-error-red text-xs">
                        {errors.trapperNumber}
                      </p>
                    )}
                    <input
                      type="text"
                      name="trapperNumber"
                      value={formData.trapperNumber}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>

                  <div>
                    <label>
                      Code <span className="text-error-red">*</span>
                    </label>
                    {errors.code && (
                      <p className="text-error-red text-xs">{errors.code}</p>
                    )}
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>

                  <div>
                    <label>
                      Role <span className="text-error-red">*</span>
                    </label>
                    {errors.role && (
                      <p className="text-error-red text-xs">{errors.role}</p>
                    )}
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="trapper">Trapper</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <label>
                      First Name <span className="text-error-red">*</span>
                    </label>
                    {errors.firstName && (
                      <p className="text-error-red text-xs">
                        {errors.firstName}
                      </p>
                    )}
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>

                  <div>
                    <label>
                      Last Name <span className="text-error-red">*</span>
                    </label>
                    {errors.lastName && (
                      <p className="text-error-red text-xs">
                        {errors.lastName}
                      </p>
                    )}
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label>
                    Email <span className="text-error-red">*</span>
                  </label>
                  {errors.email && (
                    <p className="text-error-red text-xs">{errors.email}</p>
                  )}
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input"
                    disabled={false}
                  />
                </div>

                <div>
                  <label>
                    Phone <span className="text-error-red">*</span>
                  </label>
                  {errors.phone && (
                    <p className="text-error-red text-xs">{errors.phone}</p>
                  )}
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>

                <div>
                  <label>
                    Address <span className="text-error-red">*</span>
                  </label>
                  {errors.address && (
                    <p className="text-error-red text-xs">{errors.address}</p>
                  )}
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <label className="block">
                      Trapping Region <span className="text-error-red">*</span>
                    </label>
                    {errors.trapperRegion && (
                      <p className="text-error-red text-xs">
                        {errors.trapperRegion}
                      </p>
                    )}
                    <div className="space-y-1 mt-2">
                      {["Miami-Dade", "Broward"].map((region) => (
                        <label
                          key={region}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            name="trapperRegion"
                            value={region}
                            checked={formData.trapperRegion.includes(region)}
                            onChange={handleRegionChange}
                            className="accent-secondary-purple"
                          />
                          <span>{region}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label>
                      Equipment Capacity{" "}
                      <span className="text-error-red">*</span>
                    </label>
                    {errors.equipment && (
                      <p className="text-error-red text-xs">
                        {errors.equipment}
                      </p>
                    )}
                    <input
                      type="number"
                      name="equipment"
                      value={formData.equipment}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                </div>

                {initialData && (
                  <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded-md text-sm">
                    <strong>Note:</strong> If you change this user's{" "}
                    <strong>email</strong> or <strong>code</strong>, it will
                    also update their login credentials. Be sure to notify the
                    trapper of these changes.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer - Fixed (only show when not success) */}
        {!isSuccess && (
          <div className="px-6 sm:px-16 py-4 sm:py-6 border-t border-gray-200 flex-shrink-0">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:space-x-4 sm:gap-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 font-bold border-2 border-accent-purple text-accent-purple rounded-lg hover:bg-primary-light-purple w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className={`bg-accent-purple text-primary-white px-4 py-2 rounded-lg flex items-center justify-center w-full sm:w-auto ${
                  isSubmitting
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-secondary-purple"
                }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : initialData ? (
                  "Save Changes"
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
