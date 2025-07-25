<img width="294" height="82" alt="Image" src="https://github.com/user-attachments/assets/71a1f1fe-ce6b-4765-9847-c826dac5b1c4" />

# 🐾 Meow Max – Appointment Scheduling App for Cat Solutions 305

**Meow Max** is a custom-built, mobile-first appointment scheduling platform created for **Cat Solutions 305**, a nonprofit dedicated to TNR (Trap-Neuter-Return) and foster care for stray cats. Designed for ease of use by over 80 active trappers and administrative staff, the app brings structure, clarity, and scalability to a chaotic scheduling process.

---

## 🚀 Tech Stack

- **Frontend**: React (with Vite)
- **Styling**: Tailwind CSS with a custom purple theme
- **Backend**: Firebase (Authentication, Firestore, Functions, Hosting)
- **Scheduling Logic**: Firestore transactions, slot validation, and capacity mapping
- **Cloud Functions**: For secure user management and automated appointment status updates

---

## 🧠 Engineering Highlights

### 🏠 At-a-Glance Dashboard for Trappers

The Home and Appointments pages provide quick, easy-to-digest summaries of a trapper’s clinic activity:

- Upcoming Appointments are front and center ont the homepage and Appointments page, clearly labeled by date and service type.
- Trappers can see individual details and notes for each appointment, as well as release them individually or all at once.
- Completed Appointments are set to "Completed" automatically after the its set date with a cloud function chron job and sent to the History tab to let users keep track of past visits and notes.

<p>
<img src="https://github.com/user-attachments/assets/867c0d42-4e26-46ed-8d50-ea747f19bd71" width="150" />
<img src="https://github.com/user-attachments/assets/1d586e44-b4da-4813-8aa3-03deac9a3b67" width="150" />
<img src="https://github.com/user-attachments/assets/202e4425-3784-4821-91c1-5204e234039e" width="150" />
<img src="https://github.com/user-attachments/assets/c05b04db-2979-407b-8f28-3850fd4a81f1" width="150" />
<img src="https://github.com/user-attachments/assets/aa08a90e-a690-4472-8fc3-8f31adb96fff" width="150" />
<img src="https://github.com/user-attachments/assets/8f4ad400-5afc-491e-82bb-04ae8827aea7" width="150" />
</p>

---

### 📅 Intuitive Slot Booking Experience

- Users select a **date from a calendar**, then specify how many TNR or Foster **service slots** they need.
- **Dynamic progress bars** visualize how full each category is, helping users understand remaining capacity at a glance.
- Supports **real-time availability**, slot type differentiation (TNR vs Foster), and admin overrides.

<p>
<img src="https://github.com/user-attachments/assets/9a5ba35a-5b4f-4296-b94b-0a87d0af260f" width="250" />
<img src="https://github.com/user-attachments/assets/25e76b77-6ec7-459d-ac50-57c0eeee2d0b" width="250" />
<img src="https://github.com/user-attachments/assets/85ea30f6-d5eb-46a2-a3f9-0f8d57c6bdfb" width="250" />
</p>

---

### 📊 Admin Dashboard

- Powerful calendar interface for managing daily appointments
- Grouped views by trapper, type (TNR or Foster), and notes
- Editable capacities, bulk booking and cancellations for trappers, and performance metrics

<p>
<img src="https://github.com/user-attachments/assets/b5231fab-228d-4a50-9914-80243a30a63c" width="500" />
<img src="https://github.com/user-attachments/assets/1a022048-1f90-481a-80ee-c076c9ec0a0c" width="500" />
</p>

---

### 🔐 Role-Based Access Control

- Trappers: can view availability, book, and cancel their own appointments
- Admins: can add, edit, and delete **any** user or appointment
- Admin-only Firestore Cloud Functions for secure account creation, deletion, and password updates

![Accounts Manager](https://github.com/user-attachments/assets/2fc54a4b-7396-4e46-a65e-1389840d5d0f)

---

## 🛠️ Problem Solving & Design Decisions

- **Capacity-First Booking Model**: Appointments can't be booked unless an admin explicitly sets capacity for that day — preventing accidental overbooking.
- **Transactional Safety**: All bookings occur inside Firestore transactions to ensure atomic updates across capacity documents and appointment records.
- **Performance Metrics**: Trapper-level data like appointments completed, over/underbooked rates, and strike counts tracked per user.
- **Scalable Schema**: Daily slot capacities are stored by date ID (`YYYY-MM-DD`), minimizing Firestore reads for monthly and daily queries.

---

## 📣 Why Meow Max Stands Out

This project reflects the challenges and craftsmanship of building a real-world operational tool from scratch:

- Custom UX that anticipates user behavior on mobile
- Admin-grade tools for batch editing and performance insight
- Robust error handling, permission control, and backend logic
- Designed for long-term maintainability and data integrity
