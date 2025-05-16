// src/contexts/AuthContext.js
import React, { useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
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
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      // Make the callback async
      if (user) {
        // User is signed in, fetch their profile data
        try {
          const userDocRef = doc(db, "users", user.uid); // Assuming your user data is in a "users" collection
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            // Combine auth user data with profile data
            setCurrentUser({ ...user, ...userDocSnap.data() });
          } else {
            // User document doesn't exist, just use auth data
            console.warn(`User document not found for UID: ${user.uid}`);
            setCurrentUser(user);
          }
        } catch (error) {
          console.error("Error fetching user document:", error);
          // Fallback to just using auth data on error
          setCurrentUser(user);
        } finally {
          setLoading(false);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setLoading(false);
      }
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
