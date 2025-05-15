import LogoV from "../assets/logos/logo-v.svg";
import LogoH from "../assets/logos/logo-h.svg";

export function LogoVertical() {
  return <img src={LogoV} alt="Logo Vertical" className="h-30 w-30" />;
}

export function LogoHorizontal() {
  return <img src={LogoH} alt="Logo Horizontal" className="h-16" />;
}
