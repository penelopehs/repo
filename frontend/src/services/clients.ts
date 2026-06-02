import { api } from "./api";

interface ClientResult {
  idclients: number;
  client_name: string;
}

export async function searchClients(query: string): Promise<ClientResult[]> {
  const qs = query.trim();
  const path = qs ? `/clients?name=${encodeURIComponent(qs)}` : "/clients";
  return api.get<ClientResult[]>(path);
}
