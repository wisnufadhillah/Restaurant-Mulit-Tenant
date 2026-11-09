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
    if (card.type === "knowledge") {
      if (!Array.isArray(card.data) || card.data.length > 3) throw new ServiceUnavailableException();
      return { type: "knowledge", data: card.data.map(rawItem => {
        const item = record(rawItem);
        if (Object.keys(item).sort().join() !== "documentId,position,revision,text,title" || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1 || !Number.isInteger(item.position) || (item.position as number) < 0 || (item.position as number) > 99) throw new ServiceUnavailableException();
        const documentId = text(item.documentId, 36);
        if (!/^[a-f0-9-]{36}$/i.test(documentId)) throw new ServiceUnavailableException();
        return { documentId, revision: item.revision as number, position: item.position as number, title: text(item.title, 200), text: text(item.text, 2000) };
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

export function validatedChatActions(value: unknown) {
  if (!Array.isArray(value) || value.length > 3) throw new ServiceUnavailableException();
  return value.map(raw => {
    const action = record(raw);
    const type = action.type;
    if (type === "navigate") {
      if (Object.keys(action).sort().join() !== "id,label,target,type" || !["#menu", "#reservasi"].includes(String(action.target))) throw new ServiceUnavailableException();
      return { id: text(action.id, 40), type: "navigate" as const, label: text(action.label, 80), target: action.target as "#menu" | "#reservasi" };
    }
    if (type === "prompt") {
      if (Object.keys(action).sort().join() !== "id,label,message,type" || !["Jam buka hari ini kapan?", "Apa kebijakan restoran lain yang perlu saya tahu?"].includes(String(action.message))) throw new ServiceUnavailableException();
      return { id: text(action.id, 40), type: "prompt" as const, label: text(action.label, 80), message: action.message as string };
    }
    throw new ServiceUnavailableException();
  });
}
