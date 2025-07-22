import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";
import { getMessaging, onMessage } from "firebase/messaging";
import { onBackgroundMessage } from "firebase/messaging/sw";

const firebaseConfig = {
  apiKey: "AIzaSyD3Tu4kKnW-AXKNBra_df-i88dHBc_Owl8",
  authDomain: "meow-max.firebaseapp.com",
  projectId: "meow-max",
  storageBucket: "meow-max.firebasestorage.app",
  messagingSenderId: "836948152314",
  appId: "1:836948152314:web:a1c98ffa94ef49bd14de43",
};

// Initialize the Firebase app in the service worker
const firebaseApp = initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging for the service worker
const messaging = getMessaging(firebaseApp);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  // Customize notification here
  const notificationTitle =
    payload.notification.title || "Background Message Title";
  const notificationOptions = {
    body: payload.notification.body || "Background message body.",
    icon: payload.notification.icon || "/firebase-logo.png", // Use a relevant icon path
    // Add other options as needed, e.g., image, click_action
    // The 'link' option in the server payload (fcm_options.link) is handled automatically
    // by the browser when the user clicks the notification.
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification clicks (customize behavior)
// Note: If you want to define customized behavior in the service worker when the notification is clicked,
// make sure to handle 'notificationclick' before you import FCM functions or libraries.
// Otherwise, FCM may overwrite the custom behavior.
/*
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  event.notification.close(); // Close the notification

  const clickedNotification = event.notification;
  const origin = self.location.origin; // Get the origin of the service worker

  // Example: Open a specific URL when the notification is clicked
  // You would typically get the URL from the notification payload if available
  // For messages sent with fcm_options.link, the browser handles this automatically.
  // This is more for customizing behavior for data messages or adding analytics.
  const urlToOpen = origin; // Default to opening the origin

  // You might parse the payload data to get a specific URL
  // const messageData = clickedNotification.data; // Access data payload if sent
  // if (messageData && messageData.url) {
  //   urlToOpen = messageData.url;
  // }


  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus(); // Focus existing tab if open
        }
      }
      // Otherwise, open a new tab
      if (self.clients.openWindow) {
         return self.clients.openWindow(urlToOpen);
      }
      return null; // Cannot open window
    })
  );
});
*/

// Remove the getToken call from here. It should be called from the main app
// after the user grants permission.
