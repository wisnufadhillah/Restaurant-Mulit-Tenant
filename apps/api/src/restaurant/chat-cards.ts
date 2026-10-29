import { ServiceUnavailableException } from "@nestjs/common";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ServiceUnavailableException();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max) throw new ServiceUnavailableException();
  return value;
}
export function validatedChatCards(value: unknown) {
  if (!Array.isArray(value) || value.length > 3) throw new ServiceUnavailableException();
  return value.map(raw => {
    const card = record(raw);
    if (Object.keys(card).sort().join() !== "data,type") throw new ServiceUnavailableException();
    if (card.type === "menu") {
      if (!Array.isArray(card.data) || card.data.length > 100) throw new ServiceUnavailableException();
      return { type: "menu", data: card.data.map(rawItem => {
        const item = record(rawItem);
        if (Object.keys(item).sort().join() !== "description,id,isAvailable,name,price" || !Number.isInteger(item.price) || (item.price as number) < 0 || (item.price as number) > 100000000 || typeof item.isAvailable !== "boolean") throw new ServiceUnavailableException();
        return { id: text(item.id, 80), name: text(item.name, 120), description: text(item.description, 1000), price: item.price as number, isAvailable: item.isAvailable };
      }) };
    }
    if (card.type === "restaurant") {
      const profile = record(card.data);
      if (Object.keys(profile).sort().join() !== "name,outlets,slug" || !Array.isArray(profile.outlets) || profile.outlets.length > 1 || profile.slug !== "demo-padang") throw new ServiceUnavailableException();
      return { type: "restaurant", data: { name: text(profile.name, 200), outlets: profile.outlets.map(rawOutlet => {
        const outlet = record(rawOutlet);
        return { name: text(outlet.name, 200), address: text(outlet.address, 2000), contactPhone: text(outlet.contactPhone, 100) };
      }) } };
    }
    throw new ServiceUnavailableException();
  });
}
