// src/components/ConfirmationModal.jsx
import React from "react";

export default function ConfirmationModal({
  show,
  title,
  message,
  confirmButtonText,
  onConfirm,
  onCancel,
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute w-screen h-screen bg-gray-900 opacity-50"></div>
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 z-50">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-4 text-gray-700">{message}</p>
        <div className="flex justify-end gap-4">
          <button className="gray-button" onClick={onCancel}>
            Never Mind
          </button>
          <button className="red-button" onClick={onConfirm}>
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
