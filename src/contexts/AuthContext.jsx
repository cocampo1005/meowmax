// src/contexts/AuthContext.js
import React, { useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import LoadingSpinner from "../components/LoadingSpinner";

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up the Firebase auth state observer
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Cleanup the listener on component unmount
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    auth,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {loading && <LoadingSpinner />}
    </AuthContext.Provider>
  );
}
