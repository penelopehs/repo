// Follow-up calls API service — maps the backend's per-lead follow-up-call
// endpoints onto the frontend `FollowUpCall` shape used by the client profile.
//
//   GET   /leads/{lead_id}/follow-up-calls
//   POST  /leads/{lead_id}/follow-up-calls
//   PATCH /leads/{lead_id}/follow-up-calls/{call_id}

import { api } from "@/services/api";
import type { FollowUpCall, LeadStatus } from "@/types/crm";

interface ApiFollowUpCall {
  id: number;
  scheduled_date: string; // ISO date "YYYY-MM-DD"
  scheduled_time: string | null;
  notes: string | null;
  call_type: string | null; // backend PipelineStatus value, e.g. "Intro Call"
  assigned_rep_name: string | null;
  completed: boolean;
}

// Backend Title Case PipelineStatus value → frontend snake_case LeadStatus.
const CALL_TYPE_FROM_API: Record<string, LeadStatus> = {
  "Intro Call": "intro_call",
  "Feasibility Call": "feasibility_call",
  "Tax Preparer Coordination": "tax_preparer_coordination",
  Closed: "closed",
};

function mapCall(leadId: string, c: ApiFollowUpCall): FollowUpCall {
  return {
    id: String(c.id),
    clientId: leadId,
    date: c.scheduled_date,
    time: c.scheduled_time ?? "",
    notes: c.notes ?? "",
    assignedRepName: c.assigned_rep_name,
    completed: c.completed,
    callType: c.call_type ? CALL_TYPE_FROM_API[c.call_type] : undefined,
  };
}

export interface FollowUpCallCreateInput {
  date: string;
  time?: string;
  notes?: string;
  callType?: string;
  assignedRepName?: string;
}

// callType is decoupled from the read model's LeadStatus: the dialog sends a
// free-text call type (e.g. "Intro Call") that the backend maps onto its enum.
export type FollowUpCallPatch = Partial<
  Pick<FollowUpCall, "date" | "time" | "notes" | "assignedRepName" | "completed">
> & { callType?: string };

export const followUpCallsApi = {
  async list(leadId: string): Promise<FollowUpCall[]> {
    const rows = await api.get<ApiFollowUpCall[]>(`/leads/${leadId}/follow-up-calls`);
    return rows.map((r) => mapCall(leadId, r));
  },

  async create(leadId: string, input: FollowUpCallCreateInput): Promise<FollowUpCall> {
    const row = await api.post<ApiFollowUpCall>(`/leads/${leadId}/follow-up-calls`, {
      scheduled_date: input.date,
      scheduled_time: input.time || null,
      notes: input.notes || null,
      call_type: input.callType || null,
      assigned_rep_name: input.assignedRepName || null,
    });
    return mapCall(leadId, row);
  },

  async update(leadId: string, callId: string, patch: FollowUpCallPatch): Promise<FollowUpCall> {
    const body: Record<string, unknown> = {};
    if (patch.date !== undefined) body.scheduled_date = patch.date;
    if (patch.time !== undefined) body.scheduled_time = patch.time || null;
    if (patch.notes !== undefined) body.notes = patch.notes;
    if (patch.callType !== undefined) body.call_type = patch.callType || null;
    if (patch.assignedRepName !== undefined) body.assigned_rep_name = patch.assignedRepName || null;
    if (patch.completed !== undefined) body.completed = patch.completed;
    const row = await api.patch<ApiFollowUpCall>(
      `/leads/${leadId}/follow-up-calls/${callId}`,
      body,
    );
    return mapCall(leadId, row);
  },
};
