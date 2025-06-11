import { useState, useRef, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { LogoVertical } from "../svgs/Logos";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { currentUser, loading } = useAuth();
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

  const handleLogin = async (e) => {
    e.preventDefault();
    const password = `MM${pin.join("")}`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!loading && currentUser) {
      navigate("/"); // Redirect to home if logged in and not loading
    }
  }, [currentUser, loading, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <LogoVertical />
      <p className="mt-[-10px] text-secondary-purple font-semibold text-sm">
        Cat Solutions 305
      </p>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 p-8 w-full">
        <input
          className="input-login"
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
              className="input-login text-center"
              type="password"
              maxLength="1"
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
            />
          ))}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="button" type="submit">
          Log In
        </button>
      </form>
    </div>
  );
}
