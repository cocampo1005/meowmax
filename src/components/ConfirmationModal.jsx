import { Trash2 } from "lucide-react";

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  isDeleting = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-50">
      <div className="bg-white mx-4 rounded-3xl flex flex-col gap-6 shadow-lg py-12 px-16 max-w-lg w-full">
        <div className="flex items-center text-errorRed">
          <div className="text-error-red">
            <Trash2 />
          </div>
          <h2 className="text-3xl pl-2 font-accent font-bold">{title}</h2>
        </div>
        <div className="text-gray-700">{message}</div>
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="outline-button"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`red-button ${
              isDeleting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-600 hover:cursor-pointer"
            }`}
            disabled={isDeleting}
          >
            {isDeleting ? (
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
                Deleting...
              </>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
