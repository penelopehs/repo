// Inline edit-request dialog — opened from "Edit Request" on a request card.
// New requests use the dedicated /documents/configure full page instead.

import { useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Building2, Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { YearChips } from "@/components/MultiYearSelect";
import { useDocumentsStore } from "@/store/documentsStore";
import { useEngagementsStore } from "@/store/engagementsStore";
import { useDocConfigStore, useDocContactsStore, DOC_CATEGORIES } from "@/store/docConfigStore";
import { AddPersonDialog } from "@/components/documents/AddPersonDialog";
import { cn } from "@/lib/utils";
import { useState } from "react";

const EMPTY_SELECTIONS: string[] = [];

interface EditRequestDialogProps {
  trigger: ReactNode;
  engagementId: string;
}

export function EditRequestDialog({ trigger, engagementId }: EditRequestDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto">
        <EditRequestBody engagementId={engagementId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditRequestBody({ engagementId, onClose }: { engagementId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const request = useDocumentsStore((s) => s.requests.find((r) => r.engagementId === engagementId));
  const entities = useEngagementsStore((s) => s.entities);

  const clientEntities = useMemo(
    () => (request ? entities.filter((e) => e.clientId === request.clientId) : []),
    [entities, request],
  );

  const contacts = useDocContactsStore((s) => s.contacts);
  const selections = useDocConfigStore(
    (s) => s.selectionsByEngagement[engagementId] ?? EMPTY_SELECTIONS,
  );
  const selectedContacts = useDocConfigStore(
    (s) => s.contactsByEngagement[engagementId] ?? EMPTY_SELECTIONS,
  );
  const dueDate = useDocConfigStore((s) => s.dueDateByEngagement[engagementId] ?? "");
  const notes = useDocConfigStore((s) => s.notesByEngagement[engagementId] ?? "");
  const toggleItem = useDocConfigStore((s) => s.toggleItem);
  const setCategoryAll = useDocConfigStore((s) => s.setCategoryAll);
  const toggleContact = useDocConfigStore((s) => s.toggleContact);
  const setDueDate = useDocConfigStore((s) => s.setDueDate);
  const setNotes = useDocConfigStore((s) => s.setNotes);

  if (!request) {
    return (
      <div className="py-10 text-center">
        <p className="text-navy">Engagement not found.</p>
      </div>
    );
  }

  const saveChanges = () => {
    toast.success("Request updated", {
      description: `${request.id} · ${selections.length} documents · ${selectedContacts.length} contact(s)`,
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-navy">Edit Request — {request.clientName}</DialogTitle>
        <DialogDescription>
          Update documents, recipients, due date and notes for this engagement.
        </DialogDescription>
      </DialogHeader>

      {/* Engagement summary */}
      <section className="rounded-2xl border border-border bg-gradient-frost p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-navy/30 text-navy font-mono">
            {request.engagementId}
          </Badge>
          <Badge variant="outline" className="border-cyan/30 text-cyan font-mono">
            {request.id}
          </Badge>
        </div>
        <h2 className="mt-2 text-xl font-bold text-navy">{request.clientName}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tax Years (All)
            </p>
            <div className="mt-1.5">
              <YearChips years={request.taxYears} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entities in Scope
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-navy">
              {clientEntities.length === 0 && (
                <li className="text-muted-foreground">No entities on file.</li>
              )}
              {clientEntities.map((e) => (
                <li key={e.id} className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-cyan" /> {e.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Documents Requested
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-navy">{selections.length}</p>
          </div>
        </div>
      </section>

      {/* Document categories */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-navy">Document Categories</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {DOC_CATEGORIES.map((cat) => {
            const allOn = cat.items.every((i) => selections.includes(i));
            const someOn = !allOn && cat.items.some((i) => selections.includes(i));
            return (
              <div
                key={cat.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <header className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-semibold text-navy">{cat.title}</h3>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allOn ? true : someOn ? "indeterminate" : false}
                      onCheckedChange={(v) => setCategoryAll(engagementId, cat.id, !!v)}
                    />
                    Select All
                  </label>
                </header>
                <ul className="mt-3 space-y-2">
                  {cat.items.map((item) => {
                    const on = selections.includes(item);
                    return (
                      <li key={item}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-accent/40">
                          <Checkbox
                            checked={on}
                            onCheckedChange={() => toggleItem(engagementId, item)}
                            className="mt-0.5"
                          />
                          <span
                            className={cn("text-sm", on ? "text-navy" : "text-muted-foreground")}
                          >
                            {item}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Send Request To */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">Send Request To</h2>
          <AddPersonDialog onAdded={(c) => toggleContact(engagementId, c.id)} />
        </header>
        <ul className="grid gap-2 sm:grid-cols-2">
          {contacts.map((c) => {
            const on = selectedContacts.includes(c.id);
            return (
              <li key={c.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    on ? "border-cyan bg-cyan/5" : "border-border hover:bg-accent/40",
                  )}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => toggleContact(engagementId, c.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" /> {c.email}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Request options */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-navy">Request Options</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(engagementId, e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(engagementId, e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Optional notes for the recipient..."
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={saveChanges}
          variant="outline"
          className="border-cyan text-cyan hover:bg-cyan/10"
        >
          <Save className="mr-1.5 h-4 w-4" /> Save Changes
        </Button>
        <Button
          onClick={() => {
            onClose();
            navigate({ to: "/documents/review/$engagementId", params: { engagementId } });
          }}
          disabled={selections.length === 0 || selectedContacts.length === 0}
          className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
        >
          Review Request <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
