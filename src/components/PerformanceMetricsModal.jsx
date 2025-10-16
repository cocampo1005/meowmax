import { useState, useEffect } from "react";

export default function PerformanceMetricsModal({
  isOpen,
  onClose,
  user,
  onSaveMetrics,
}) {
  const [editableMetrics, setEditableMetrics] = useState({});

  useEffect(() => {
    if (user && user.performanceMetrics) {
      setEditableMetrics(user.performanceMetrics);
    } else {
      setEditableMetrics({
        commitmentScore: 0,
        strikes: 0,
        totalAppointmentsBooked: 0,
        totalAppointmentsCompleted: 0,
        totalAppointmentsOverBooked: 0,
        totalAppointmentsUnderBooked: 0,
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableMetrics((prevMetrics) => ({
      ...prevMetrics,
      [name]: parseFloat(value) || 0,
    }));
  };

  const handleSubmit = () => {
    if (user && user.id) {
      onSaveMetrics(user.id, editableMetrics);
      onClose();
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-100 p-4">
      <div className="bg-primary-white rounded-3xl w-full max-w-xl text-primary-dark-purple max-h-[95svh] flex flex-col">
        {/* Header - Fixed */}
        <div className="px-6 sm:px-16 pt-6 sm:pt-12 pb-4 flex-shrink-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-dark-purple">
            Edit Performance Metrics
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            {user.firstName} {user.lastName}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 sm:px-16 flex-1">
          <div className="space-y-4 pb-4">
            {/* Commitment Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commitment Score:
              </label>
              <input
                type="number"
                name="commitmentScore"
                value={editableMetrics.commitmentScore || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            {/* Strikes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strikes:
              </label>
              <input
                type="number"
                name="strikes"
                value={editableMetrics.strikes || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            {/* Total Appointments Booked */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Appointments Booked:
              </label>
              <input
                type="number"
                name="totalAppointmentsBooked"
                value={editableMetrics.totalAppointmentsBooked || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            {/* Total Appointments Completed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Appointments Completed:
              </label>
              <input
                type="number"
                name="totalAppointmentsCompleted"
                value={editableMetrics.totalAppointmentsCompleted || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            {/* Total Appointments Overbooked */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Appointments Overbooked:
              </label>
              <input
                type="number"
                name="totalAppointmentsOverBooked"
                value={editableMetrics.totalAppointmentsOverBooked || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            {/* Total Appointments Underbooked */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Appointments Underbooked:
              </label>
              <input
                type="number"
                name="totalAppointmentsUnderBooked"
                value={editableMetrics.totalAppointmentsUnderBooked || 0}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 sm:px-16 py-4 sm:py-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              className="py-2 px-4 font-bold border-2 border-accent-purple text-accent-purple rounded-lg hover:bg-primary-light-purple w-full sm:w-auto"
            >
              Cancel
            </button>
            <button onClick={handleSubmit} className="button w-full sm:w-auto">
              Save Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
