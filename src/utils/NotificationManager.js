import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore"; // Assuming you use Firestore
import { db } from "./firebase"; // Your firebase initialization file

// Get messaging instance (make sure messaging is exported from your firebase.js)
import { messaging } from "./firebase";

// Function to handle the entire notification setup process
const setupUserNotifications = async (userId) => {
  // Check current permission status
  const permission = Notification.permission;

  if (permission === "granted") {
    try {
      const currentToken = await getToken(messaging, {
        vapidKey:
          "BHzeVLrUh1rQz3q5KVuZSpwp8wtaRvRTwtid3U55dHVPpelSgIglc7AsiyTW5QlWXFtJ4BpGDNMxiu0S7h2PtR0",
      });

      if (currentToken) {
        console.log("FCM registration token:", currentToken);
        // Now, update the user's document in Firestore
        const userRef = doc(db, "users", userId);

        // Get the current tokens to avoid duplicates
        const userDoc = await getDoc(userRef); // Assuming you have getDoc from firestore
        const existingTokens = userDoc.exists()
          ? userDoc.data().fcmTokens || []
          : [];

        // Check if the token is already in the array
        if (!existingTokens.includes(currentToken)) {
          // Add the new token to the array
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(currentToken), // Use arrayUnion to atomically add the token
            notificationsEnabled: true, // Enable notifications when a token is added
          });
          console.log("New FCM token added to user document.");
        } else {
          console.log("Token already exists for this user.");
          // You might still want to ensure notificationsEnabled is true here
          if (!userDoc.data().notificationsEnabled) {
            await updateDoc(userRef, {
              notificationsEnabled: true,
            });
          }
        }
      } else {
        console.log("No registration token available.");
      }
    } catch (err) {
      console.error("Error getting or saving FCM token:", err);
    }
  } else {
    // Handle permission denied - update notificationsEnabled to false
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      notificationsEnabled: false,
    });
  }
};

// Function to request permission and get token after user interaction
const requestNotificationPermissionAndGetToken = async (userId) => {
  console.log("Requesting notification permission...");
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      const currentToken = await getToken(messaging, {
        vapidKey: "YOUR_PUBLIC_VAPID_KEY_HERE", // Your VAPID key
      });

      if (currentToken) {
        console.log("FCM registration token:", currentToken);
        // Save the token to the user's document
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          fcmToken: currentToken, // Or add to an array of tokens
          notificationsEnabled: true,
        });
        console.log("FCM token saved to user document.");
      } else {
        console.log("No registration token available.");
      }
    } else {
      console.log("Notification permission denied.");
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        notificationsEnabled: false,
      });
    }
  } catch (err) {
    console.error(
      "An error occurred while requesting notification permission or retrieving token.",
      err
    );
    // Handle the error
  }
};

// In your component (e.g., SettingsPage.jsx or a component displayed after onboarding)
// import { setupUserNotifications, requestNotificationPermissionAndGetToken } from './NotificationManager';
// import { useAuthState } from 'react-firebase-hooks/auth'; // Example hook to get current user

// const [user, loading, error] = useAuthState(auth); // Get authenticated user

// useEffect(() => {
//   if (user) {
//     // When the user loads, check their notification status and potentially prompt
//     setupUserNotifications(user.uid);
//   }
// }, [user]);

// In your UI, you could have a button:
// <button onClick={() => requestNotificationPermissionAndGetToken(user.uid)}>
//   Enable Notifications
// </button>
