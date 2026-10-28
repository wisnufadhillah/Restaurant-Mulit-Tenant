import { MENU_ITEMS, MenuItem } from "./restaurant-data";

const API_BASE = process.env.NEXT_PUBLIC_RESTAURANT_API_BASE_URL ?? "http://127.0.0.1:3001";
type ApiMenuItem = Omit<MenuItem, "icon" | "isFavorite" | "spicyLevel">;
export type ApiDiningTable = { id: string; tableNumber: string; capacity: number; area: string; status: "available" | "reserved" | "maintenance" };
export type ApiOpeningHour = { dayOfWeek: number; openMinutes: number; closeMinutes: number; isOpen: boolean };

function toMenuItem(item: ApiMenuItem): MenuItem {
  const fallback = MENU_ITEMS.find((candidate) => candidate.name === item.name);
  const categories: MenuItem["category"][] = ["utama", "gulai", "sambal", "minuman", "kudapan"];
  const category = categories.includes(item.category as MenuItem["category"]) ? item.category as MenuItem["category"] : "utama";
  return { ...item, category, icon: fallback?.icon ?? "🍽️", isFavorite: fallback?.isFavorite, spicyLevel: fallback?.spicyLevel };
}

export async function fetchRestaurantCatalogue(slug = "demo-padang"): Promise<{ menuItems: MenuItem[]; diningTables: ApiDiningTable[]; openingHours: ApiOpeningHour[] }> {
  const response = await fetch(`${API_BASE}/api/v1/public/tenants/${slug}/restaurant`, { cache: "no-store" });
  if (!response.ok) throw new Error("Restaurant catalogue unavailable");
  const body = await response.json() as { data?: { outlets?: Array<{ menuItems?: ApiMenuItem[]; diningTables?: ApiDiningTable[]; openingHours?: ApiOpeningHour[] }> } };
  const outlet = body.data?.outlets?.[0];
  if (!Array.isArray(outlet?.menuItems) || !Array.isArray(outlet.diningTables) || !Array.isArray(outlet.openingHours)) throw new Error("Restaurant catalogue is invalid");
  return { menuItems: outlet.menuItems.map(toMenuItem), diningTables: outlet.diningTables, openingHours: outlet.openingHours };
}

export async function fetchRestaurantMenu(slug = "demo-padang"): Promise<MenuItem[]> {
  return (await fetchRestaurantCatalogue(slug)).menuItems;
}

async function staffRequest(path: string, init: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error("Staff request failed");
  return response.json();
}

export function staffLogin(email: string, password: string, tenantSlug = "demo-padang") {
  return staffRequest("/api/v1/staff/login", { method: "POST", body: JSON.stringify({ tenantSlug, email, password }) });
}

export function updateMenu(id: string, changes: Partial<MenuItem>, tenantSlug = "demo-padang") {
  return staffRequest(`/api/v1/staff/${tenantSlug}/menu/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
}

export function updateTable(id: string, changes: { status?: string; capacity?: number }, tenantSlug = "demo-padang") {
  return staffRequest(`/api/v1/staff/${tenantSlug}/tables/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
}

export function updateHours(dayOfWeek: number, changes: Pick<ApiOpeningHour, "isOpen" | "openMinutes" | "closeMinutes">, tenantSlug = "demo-padang") {
  return staffRequest(`/api/v1/staff/${tenantSlug}/hours/${dayOfWeek}`, { method: "PUT", body: JSON.stringify(changes) });
}
