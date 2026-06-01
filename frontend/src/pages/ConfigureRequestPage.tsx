// Configure Request — full-page form to create a new document request.
// Replaces the previous "Add New" modal popup with a dedicated route.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, FileText, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/leadsStore";
import { useEngagementsStore } from "@/store/engagementsStore";
import { useDocumentsStore } from "@/store/documentsStore";

type RequestType = "Tax Returns" | "Financial Records" | "R&D Documentation" | "Corporate & Entity" | "Payroll & HR";
type Priority = "Low" | "Medium" | "High" | "Urgent";

const REQUEST_TYPES: RequestType[] = [
  "Tax Returns", "Financial Records", "R&D Documentation", "Corporate & Entity", "Payroll & HR",
];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];
const REVIEWERS = ["Michael Williams", "Sandra Wu", "David Kim, CPA", "Amanda Torres"];

export function ConfigureRequestPage() {
  const navigate = useNavigate();
  const leads = useLeadsStore((s) => s.leads);
  const engagements = useEngagementsStore((s) => s.engagements);
  const addRequest = useDocumentsStore((s) => s.addRequest);

  const activeLeads = useMemo(
    () => leads.filter((l) => l.status === "active_engagement"),
    [leads],
  );

  const [clientId, setClientId] = useState<string>("");
  const [engagementId, setEngagementId] = useState<string>("");
  const [requestType, setRequestType] = useState<RequestType | "">("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [reviewer, setReviewer] = useState<string>(REVIEWERS[0]);
  const [notes, setNotes] = useState<string>("");

  const clientEngagements = useMemo(
    () => engagements.filter((e) => e.clientId === clientId),
    [engagements, clientId],
  );

  const selectedClient = activeLeads.find((l) => l.id === clientId);
  const canSubmit = clientId && engagementId && requestType && dueDate;

  const handleClientChange = (id: string) => {
    setClientId(id);
    setEngagementId("");
  };

  const handleSaveDraft = () => {
    toast.success("Draft saved", {
      description: selectedClient ? `${selectedClient.company} — ${requestType || "Untitled"}` : "Configuration draft saved.",
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || !selectedClient) return;
    const eng = clientEngagements.find((e) => e.id === engagementId);
    addRequest({
      engagementId: eng?.id ?? engagementId,
      clientId: selectedClient.id,
      clientName: selectedClient.company,
      recipientName: selectedClient.fullName,
      recipientEmail: selectedClient.email,
      taxYears: eng?.years ?? [],
      sentDate: new Date().toISOString().slice(0, 10),
      dueDate,
    });
    toast.success("Request submitted", {
      description: `${selectedClient.company} · ${requestType} · ${priority}`,
    });
    navigate({ to: "/documents" });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Documents</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Configure Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new document request for an active engagement.
          </p>
        </div>
        <Button asChild variant="outline" className="border-cyan text-cyan hover:bg-cyan/10">
          <Link to="/documents">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Overview
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <header className="mb-5 flex items-center gap-2 border-b border-border pb-3">
          <FileText className="h-4 w-4 text-cyan" />
          <h2 className="text-base font-semibold text-navy">Request Details</h2>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
              <SelectContent>
                {activeLeads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Engagement</Label>
            <Select value={engagementId} onValueChange={setEngagementId} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Select engagement..." : "Select a client first"} />
              </SelectTrigger>
              <SelectContent>
                {clientEngagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.type} · {e.years.join(", ")}
                  </SelectItem>
                ))}
                {clientId && clientEngagements.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No engagements for this client.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Request Type</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
              <SelectTrigger><SelectValue placeholder="Select request type..." /></SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned Reviewer</Label>
            <Select value={reviewer} onValueChange={setReviewer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REVIEWERS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Optional notes visible only to the internal team..."
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: "/documents" })}>Cancel</Button>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          className="border-cyan text-cyan hover:bg-cyan/10"
        >
          <Save className="mr-1.5 h-4 w-4" /> Save Draft
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
        >
          <Send className="mr-1.5 h-4 w-4" /> Submit Request
        </Button>
      </div>
    </div>
  );
}
