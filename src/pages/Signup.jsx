import { useState, useRef } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { LogoVertical } from "../svgs/Logos";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const navigate = useNavigate();

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const password = `MM${pin.join("")}`;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        email,
        firstName: "",
        lastName: "",
        phone: "",
        address: "",
        role: "trapper",
        notificationsEnabled: false,
        fcmToken: [],
        createdAt: serverTimestamp(),
        isActive: true,
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <LogoVertical />
      <p className="mt-[-10px] text-secondary-purple font-semibold text-sm">
        Cat Solutions 305
      </p>
      <form onSubmit={handleSignup} className="flex flex-col gap-4 p-8 w-full">
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-4 gap-2">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              className="input text-center"
              type="password"
              maxLength="1"
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
            />
          ))}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="button" type="submit">
          Sign Up
        </button>
      </form>
    </div>
  );
}
