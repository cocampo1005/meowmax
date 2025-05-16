import LocationSVG from "../assets/icons/location-icon.svg";
import ServiceSVG from "../assets/icons/service-icon.svg";
import NotesSVG from "../assets/icons/notes-icon.svg";

export function LocationIcon() {
  return <img src={LocationSVG} alt="Location Icon" />;
}

export function ServiceIcon() {
  return <img src={ServiceSVG} alt="Service Icon" />;
}

export function NotesIcon() {
  return <img src={NotesSVG} alt="Notes Icon" />;
}

export function ChevronDown() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ChevronUp() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

export function AppointmentListItemIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 mr-2 text-secondary-purple"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5 4.585A10.014 10.014 0 0112 21a10 10 0 01-5.879-2.911m11.718 0c1.542-.84 2.991-1.935 4.24-3.145a18.564 18.564 0 00-4.24-3.145m6.592.406a10.014 10.014 0 011.89-4.175m0 0l-1.5-1.5m1.5 1.5l1.5 1.5"
      />
    </svg>
  );
}
