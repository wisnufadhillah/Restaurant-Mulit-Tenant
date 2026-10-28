interface Hours { weekday: number; openMinute: number | null; closeMinute: number | null; }
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}.${String(value % 60).padStart(2, "0")}`;
export default async function OpeningHours() {
  let rows: Hours[] = [], timezone = "", unavailable = false;
  try {
    const response = await fetch("http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/hours", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Schedule unavailable");
    const result = await response.json(); rows = result.data; timezone = result.timezone;
  } catch { unavailable = true; }
  return <div><h3>Jam buka</h3>{unavailable ? <p role="status">Jadwal belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p> : <><p className="senja-note">Jadwal mingguan dari restoran · {timezone}</p><dl className="sela-hours">{[1, 2, 3, 4, 5, 6, 0].map(day => {
    const row = rows.find(item => item.weekday === day);
    return <div key={day}><dt>{days[day]}</dt><dd>{!row ? "Belum diatur" : row.openMinute === null || row.closeMinute === null ? "Tutup" : `${time(row.openMinute)}–${time(row.closeMinute)}`}</dd></div>;
  })}</dl><p className="senja-note">Jadwal tanggal khusus belum tersedia. Daftar mingguan ini bukan konfirmasi restoran buka pada hari libur atau meja tersedia.</p></>}</div>;
}
