// Intake notes API service — maps the backend's per-lead intake-note endpoints
// onto the frontend `ProfileNote` shape used by the client profile.
//
//   GET    /leads/{lead_id}/intake-notes            (newest-first)
//   POST   /leads/{lead_id}/intake-notes            (author = authenticated caller)
//   PATCH  /leads/{lead_id}/intake-notes/{note_id}
//   DELETE /leads/{lead_id}/intake-notes/{note_id}

import { api } from "@/services/api";
import type { ProfileNote } from "@/types/crm";

interface ApiIntakeNote {
  id: number;
  note: string;
  created_by_iduser: number | null;
  created_by_name: string | null;
  created_at: string | null; // ISO datetime
  updated_at: string | null;
}

function mapNote(n: ApiIntakeNote): ProfileNote {
  return {
    id: String(n.id),
    text: n.note,
    createdAt: n.created_at ?? new Date().toISOString(),
    author: n.created_by_name ?? undefined,
  };
}

export const intakeNotesApi = {
  async list(leadId: string): Promise<ProfileNote[]> {
    const rows = await api.get<ApiIntakeNote[]>(`/leads/${leadId}/intake-notes`);
    return rows.map(mapNote);
  },

  async create(leadId: string, text: string): Promise<ProfileNote> {
    const row = await api.post<ApiIntakeNote>(`/leads/${leadId}/intake-notes`, { note: text });
    return mapNote(row);
  },

  async update(leadId: string, noteId: string, text: string): Promise<ProfileNote> {
    const row = await api.patch<ApiIntakeNote>(`/leads/${leadId}/intake-notes/${noteId}`, {
      note: text,
    });
    return mapNote(row);
  },

  async remove(leadId: string, noteId: string): Promise<void> {
    await api.delete<void>(`/leads/${leadId}/intake-notes/${noteId}`);
  },
};
