export function formatPhoneNumber(phone) {
  if (!phone) return "";

  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Check if it has exactly 10 digits
  if (cleaned.length !== 10) return phone;

  const areaCode = cleaned.slice(0, 3);
  const central = cleaned.slice(3, 6);
  const line = cleaned.slice(6);

  return `(${areaCode}) ${central}-${line}`;
}
