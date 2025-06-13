import { useState, useEffect } from "react";

export default function PerformanceMetricsModal({
  isOpen,
  onClose,
  user,
  onSaveMetrics, // Prop for saving only metrics
}) {
  const [editableMetrics, setEditableMetrics] = useState({});

  useEffect(() => {
    // Initialize editableMetrics with the user's current performanceMetrics
    if (user && user.performanceMetrics) {
      setEditableMetrics(user.performanceMetrics);
    } else {
      // Set default values if performanceMetrics doesn't exist
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
      [name]: parseFloat(value) || 0, // Ensure value is a number
    }));
  };

  const handleSubmit = () => {
    if (user && user.id) {
      onSaveMetrics(user.id, editableMetrics); // Pass user ID and updated metrics
      onClose();
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-50">
      <div className="bg-primary-white rounded-3xl py-12 px-16 w-full max-w-xl text-primary-dark-purple">
        <h2 className="text-xl font-bold mb-4">
          Edit Performance Metrics for {user.firstName} {user.lastName}
        </h2>

        {/* Input for commitmentScore */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Commitment Score:
          </label>
          <input
            type="number"
            name="commitmentScore"
            value={editableMetrics.commitmentScore || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        {/* Input for strikes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Strikes:
          </label>
          <input
            type="number"
            name="strikes"
            value={editableMetrics.strikes || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        {/* Input for totalAppointmentsBooked */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Total Appointments Booked:
          </label>
          <input
            type="number"
            name="totalAppointmentsBooked"
            value={editableMetrics.totalAppointmentsBooked || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        {/* Input for totalAppointmentsCompleted */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Total Appointments Completed:
          </label>
          <input
            type="number"
            name="totalAppointmentsCompleted"
            value={editableMetrics.totalAppointmentsCompleted || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        {/* Input for totalAppointmentsOverBooked */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Total Appointments Overbooked:
          </label>
          <input
            type="number"
            name="totalAppointmentsOverBooked"
            value={editableMetrics.totalAppointmentsOverBooked || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        {/* Input for totalAppointmentsUnderBooked */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Total Appointments Underbooked:
          </label>
          <input
            type="number"
            name="totalAppointmentsUnderBooked"
            value={editableMetrics.totalAppointmentsUnderBooked || 0}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button onClick={onClose} className="outline-button">
            Cancel
          </button>
          <button onClick={handleSubmit} className="button mt-4">
            Save Metrics
          </button>
        </div>
      </div>
    </div>
  );
}
