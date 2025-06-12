const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK if not already initialized
// This check prevents re-initialization in a hot-reloading environment
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const auth = admin.auth();

// Scheduled function to update past appointment statuses for History Tab
exports.updatePastAppointmentsStatus = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/New_York",
  },
  async (context) => {
    logger.info(
      "Scheduled function to update past appointment statuses started.",
      context
    );

    const now = admin.firestore.Timestamp.now();

    try {
      const appointmentsRef = firestore.collection("appointments");
      const querySnapshot = await appointmentsRef
        .where("appointmentTime", "<", now)
        .where("status", "==", "Upcoming")
        .get();

      if (querySnapshot.empty) {
        logger.info(
          'No past appointments with status "Upcoming" found. Exiting.'
        );
        return;
      }

      logger.info(
        `Found ${querySnapshot.size} past appointments with status "Upcoming". Initiating updates.`
      );

      const batch = firestore.batch();

      querySnapshot.forEach((doc) => {
        const appointmentRef = appointmentsRef.doc(doc.id);
        batch.update(appointmentRef, {
          status: "Completed",
          updatedAt: admin.firestore.Timestamp.now(),
        });
      });

      await batch.commit();

      logger.info(
        `Successfully updated statuses for ${querySnapshot.size} past appointments.`
      );
      return;
    } catch (error) {
      logger.error("Error updating past appointment statuses:", error);
      throw error;
    }
  }
);

// Function to create a new user
exports.createNewUser = onCall(async (request) => {
  logger.info("createNewUser function invoked.");

  // 1. Authentication Check: Ensure the caller is authenticated
  if (!request.auth) {
    logger.error("Unauthenticated call to createNewUser.");
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // 2. Authorization Check: Ensure the caller is an admin by checking Firestore role
  const callerUid = request.auth.uid;
  let callerRole = null;
  try {
    const callerDoc = await firestore.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      logger.error(
        `Caller user document not found in Firestore for UID: ${callerUid}`
      );
      throw new HttpsError("unauthenticated", "User profile not found.");
    }
    callerRole = callerDoc.data().role;
  } catch (error) {
    logger.error(
      `Error fetching caller's role from Firestore: ${error.message}`
    );
    throw new HttpsError(
      "internal",
      "Could not retrieve caller's authorization details."
    );
  }

  if (callerRole !== "admin") {
    logger.error("Permission denied: Caller is not an admin.", {
      uid: callerUid,
      role: callerRole,
    });
    throw new HttpsError(
      "permission-denied",
      "Only admin users can create new accounts."
    );
  }
  logger.info(
    `Admin user ${callerUid} (role: ${callerRole}) is creating a new user.`
  );

  // 3. Destructure and Validate Input Data (from request.data)
  const {
    email,
    firstName,
    lastName,
    phone,
    address,
    role,
    trapperNumber,
    equipment,
    code,
  } = request.data;

  if (!email || !firstName || !lastName || !role) {
    logger.error("Missing required user fields.", {
      email,
      firstName,
      lastName,
      role,
    });
    throw new HttpsError(
      "invalid-argument",
      "Missing required user fields (email, firstName, lastName, role)."
    );
  }

  if (role === "trapper" && (!trapperNumber || !code)) {
    logger.error("Trapper role requires trapperNumber and code.", {
      trapperNumber,
      code,
    });
    throw new HttpsError(
      "invalid-argument",
      "Trapper role requires trapperNumber and code."
    );
  }
  if (code && !/^\d{4}$/.test(code)) {
    logger.error("Invalid code format. Must be four digits.", { code });
    throw new HttpsError(
      "invalid-argument",
      "Code must be exactly four digits."
    );
  }

  // Construct the actual password for Firebase Auth
  const firebaseAuthPassword = `MM${code}`;

  try {
    // 4. Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      emailVerified: false,
      disabled: false,
      password: firebaseAuthPassword,
      displayName: `${firstName} ${lastName}`,
    });

    const uid = userRecord.uid;
    logger.info(`Firebase Auth user created: ${uid}`);

    // 5. Set custom claims for the user's role (important for role-based access control)
    await auth.setCustomUserClaims(uid, { role: role });
    logger.info(`Custom claims set for user ${uid}: role ${role}`);

    // 6. Store additional user data in Firestore
    const userDataToStore = {
      email: email,
      firstName: firstName,
      lastName: lastName,
      phone: phone || null,
      address: address || null,
      role: role,
      trapperNumber: trapperNumber || null,
      code: code || null,
      equipment: equipment || null,
      isActive: true,
      notificationsEnabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performanceMetrics: {
        totalAppointmentsBooked: 0,
        totalAppointmentsCompleted: 0,
        totalAppointmentsOverBooked: 0,
        totalAppointmentsUnderBooked: 0,
        commitmentScore: 0,
        strikes: 0,
      },
      bookingAccessRestricted: false,
      restrictionReason: null,
      fcmToken: null,
    };

    await firestore.collection("users").doc(uid).set(userDataToStore);
    logger.info(`Firestore document created for user: ${uid}`);

    return { success: true, message: "User created successfully", uid: uid };
  } catch (error) {
    logger.error("Error creating new user:", error);

    // If an auth user was created but firestore failed, clean up the auth user (optional, but good practice)
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "The email address is already in use by an existing user."
      );
    } else if (error.code === "auth/invalid-password") {
      throw new HttpsError(
        "invalid-argument",
        "The generated password for Firebase Authentication is invalid."
      );
    }

    // For other errors, rethrow as a callable error
    throw new HttpsError(
      "internal",
      error.message || "An unknown error occurred while creating the user."
    );
  }
});

// Callable Cloud Function to delete a user (refactored to V2 https.onCall)
exports.deleteFirebaseUser = onCall(async (request) => {
  logger.info("deleteFirebaseUser function invoked.");

  // Authentication Check: Only authenticated users (admins) can delete users
  if (!request.auth) {
    logger.error("Unauthenticated call to deleteFirebaseUser.");
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerUid = request.auth.uid;
  let callerRole = null;
  try {
    const callerDoc = await firestore.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      logger.error(
        `Caller user document not found in Firestore for UID: ${callerUid}`
      );
      throw new HttpsError("unauthenticated", "User profile not found.");
    }
    callerRole = callerDoc.data().role;
  } catch (error) {
    logger.error(
      `Error fetching caller's role from Firestore for delete: ${error.message}`
    );
    throw new HttpsError(
      "internal",
      "Could not retrieve caller's authorization details."
    );
  }

  if (callerRole !== "admin") {
    logger.error(
      "Permission denied: Caller is not an admin for delete operation.",
      {
        uid: callerUid,
        role: callerRole,
      }
    );
    throw new HttpsError(
      "permission-denied",
      "Only admin users can delete accounts."
    );
  }
  logger.info(
    `Admin user ${callerUid} (role: ${callerRole}) is attempting to delete a user.`
  );

  const { uid } = request.data;

  if (!uid) {
    logger.error("Missing user UID to delete.");
    throw new HttpsError(
      "invalid-argument",
      "UID is required to delete a user."
    );
  }

  try {
    // Delete the user from Firebase Authentication
    await auth.deleteUser(uid);
    logger.info(`Successfully deleted Firebase Auth user: ${uid}`);

    // Delete the user's document from Firestore
    await firestore.collection("users").doc(uid).delete();
    logger.info(`Successfully deleted Firestore user document: ${uid}`);

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    logger.error(`Error deleting user ${uid}:`, error);

    // Error messages
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "User not found.");
    } else {
      throw new HttpsError(
        "internal",
        error.message || "An unknown error occurred while deleting the user."
      );
    }
  }
});

// Function to change a user's password if their code is Updated
exports.changeUserPassword = onCall(async (request) => {
  logger.info("changeUserPassword function invoked.");

  // Authentication Check: Only authenticated users (admins) can change other users' passwords
  if (!request.auth) {
    logger.error("Unauthenticated call to changeUserPassword.");
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerUid = request.auth.uid;
  let callerRole = null;
  try {
    const callerDoc = await firestore.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      logger.error(
        `Caller user document not found in Firestore for UID: ${callerUid}`
      );
      throw new new HttpsError("unauthenticated", "User profile not found.")();
    }
    callerRole = callerDoc.data().role;
  } catch (error) {
    logger.error(
      `Error fetching caller's role from Firestore for password change: ${error.message}`
    );
    throw new HttpsError(
      "internal",
      "Could not retrieve caller's authorization details."
    );
  }

  if (callerRole !== "admin") {
    logger.error(
      "Permission denied: Caller is not an admin for password change.",
      {
        uid: callerUid,
        role: callerRole,
      }
    );
    throw new HttpsError(
      "permission-denied",
      "Only admin users can change other users' passwords."
    );
  }
  logger.info(
    `Admin user ${callerUid} (role: ${callerRole}) is changing a user's password.`
  );

  const { uid, newCode } = request.data;

  if (!uid || !newCode) {
    logger.error("UID and new code are required for password change.");
    throw new HttpsError("invalid-argument", "UID and new code are required.");
  }

  if (!/^\d{4}$/.test(newCode)) {
    logger.error("New code must be exactly four digits.", { newCode });
    throw new HttpsError(
      "invalid-argument",
      "New code must be exactly four digits."
    );
  }

  // Construct the actual password for Firebase Auth by prepending "MM"
  const firebaseAuthPassword = `MM${newCode}`;

  try {
    // 1. Update the user's password in Firebase Authentication
    await auth.updateUser(uid, {
      password: firebaseAuthPassword, // Use the 'MM' prefixed password
    });
    logger.info(`Successfully changed password for user: ${uid}`);

    // 2. Update the 'code' field in the user's Firestore document
    await firestore.collection("users").doc(uid).update({
      code: newCode, // Store ONLY the 4-digit code in Firestore
    });
    logger.info(`Successfully updated Firestore code for user: ${uid}`);

    return {
      success: true,
      message: "User password and code updated successfully",
    };
  } catch (error) {
    logger.error(`Error changing password for user ${uid}:`, error);

    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "User not found.");
    } else if (error.code === "auth/invalid-password") {
      throw new HttpsError(
        "invalid-argument",
        "The generated password for Firebase Authentication is invalid (should not happen if code is 4 digits)."
      );
    } else {
      throw new HttpsError(
        "internal",
        error.message ||
          "An unknown error occurred while changing the password."
      );
    }
  }
});
