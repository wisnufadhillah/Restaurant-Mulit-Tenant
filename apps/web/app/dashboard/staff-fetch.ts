let invalid = false;
let generation = 0;
export const STAFF_SESSION_ENDED = "staff-session-ended";
export function staffSessionInvalid() { return invalid; }
export function endStaffSession() {
  if (invalid) return;
  invalid = true; generation++;
  window.dispatchEvent(new Event(STAFF_SESSION_ENDED));
}
export async function staffFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (invalid) throw new Error("Sesi berakhir. Masuk kembali.");
  const current = generation;
  const response = await fetch(input, init);
  if (response.status === 401 || response.status === 403) endStaffSession();
  if (current !== generation) throw new Error("Sesi berakhir. Masuk kembali.");
  return response;
}
