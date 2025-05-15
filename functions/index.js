const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");
admin.initializeApp();

const firestore = admin.firestore();

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
