import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import i18n from "../i18n";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Clean up a previous user-doc listener if we switch accounts/log out
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", user.uid);

      unsubscribeUserDoc = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data() || {};
          // Merge the auth user basics with the Firestore profile
          const merged = { uid: user.uid, email: user.email, ...data };
          setCurrentUser(merged);
          setLoading(false);

          // Keep i18n in sync with the profile
          if (merged.language && i18n.language !== merged.language) {
            i18n.changeLanguage(merged.language);
            localStorage.setItem("lang", merged.language);
          }
        },
        (err) => {
          console.error("AuthContext user snapshot error:", err);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, []);

  const value = { currentUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
