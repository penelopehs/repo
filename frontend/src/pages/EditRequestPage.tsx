// Edit Request — full page version (replaces the previous modal).
// Mirrors the dialog body but rendered as a routed page under /documents/edit/$engagementId.

import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Building2, Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { YearChips } from "@/components/MultiYearSelect";
import { useDocumentsStore } from "@/store/documentsStore";
import { useEngagementsStore } from "@/store/engagementsStore";
import { useDocConfigStore, useDocContactsStore, DOC_CATEGORIES } from "@/store/docConfigStore";
import { AddPersonDialog } from "@/components/documents/AddPersonDialog";
import { cn } from "@/lib/utils";

const EMPTY_SELECTIONS: string[] = [];

export function EditRequestPage() {
  const { engagementId } = useParams({ from: "/documents/edit/$engagementId" });
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
  const seedIfEmpty = useDocConfigStore((s) => s.seedIfEmpty);

  // Ensure shared store is seeded from the request snapshot even when the
  // user navigates directly to /documents/edit/:engagementId. Seed only with
  // catalog-valid names so Overview and Edit Request reference an identical,
  // editable selection set at all times.
  useEffect(() => {
    if (!request) return;
    const validNames = new Set(DOC_CATEGORIES.flatMap((c) => c.items));
    seedIfEmpty(
      request.engagementId,
      request.items.map((it) => it.type).filter((t) => validNames.has(t)),
    );
  }, [request, seedIfEmpty]);

  if (!request) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-navy">Engagement not found.</p>
        <Button asChild variant="outline" className="mt-4 border-cyan text-cyan hover:bg-cyan/10">
          <Link to="/documents">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Documents
          </Link>
        </Button>
      </div>
    );
  }

  const saveChanges = () => {
    toast.success("Request updated", {
      description: `${request.id} · ${selections.length} documents · ${selectedContacts.length} contact(s)`,
    });
    navigate({ to: "/documents" });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 text-muted-foreground hover:text-navy"
          >
            <Link to="/documents">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Documents
            </Link>
          </Button>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Documents</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Edit Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update documents, recipients, due date and notes for this engagement.
          </p>
        </div>
      </div>

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
        <Button asChild variant="ghost">
          <Link to="/documents">Cancel</Link>
        </Button>
        <Button
          onClick={saveChanges}
          variant="outline"
          className="border-cyan text-cyan hover:bg-cyan/10"
        >
          <Save className="mr-1.5 h-4 w-4" /> Save Changes
        </Button>
        <Button
          onClick={() =>
            navigate({ to: "/documents/review/$engagementId", params: { engagementId } })
          }
          disabled={selections.length === 0 || selectedContacts.length === 0}
          className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
        >
          Review Request <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
