import React from "react";

const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center min-h-screen w-full">
      <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-accent-purple rounded-full animate-spin"></div>
    </div>
  );
};

export default LoadingSpinner;
