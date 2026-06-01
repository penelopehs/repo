// Review Request page — preview-style summary before sending.

import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Send, Mail, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YearChips } from "@/components/MultiYearSelect";
import { useDocumentsStore } from "@/store/documentsStore";
import { useDocConfigStore, useDocContactsStore } from "@/store/docConfigStore";
import { formatDate } from "@/utils/format";

const EMPTY_SELECTIONS: string[] = [];

export function ReviewRequestPage() {
  const { engagementId } = useParams({ from: "/documents/review/$engagementId" });
  const navigate = useNavigate();
  const request = useDocumentsStore((s) => s.requests.find((r) => r.engagementId === engagementId));
  const contacts = useDocContactsStore((s) => s.contacts);
  const reset = useDocConfigStore((s) => s.reset);

  const selections = useDocConfigStore((s) => s.selectionsByEngagement[engagementId] ?? EMPTY_SELECTIONS);
  const selectedIds = useDocConfigStore((s) => s.contactsByEngagement[engagementId] ?? EMPTY_SELECTIONS);
  const dueDate = useDocConfigStore((s) => s.dueDateByEngagement[engagementId] ?? "");
  const notes = useDocConfigStore((s) => s.notesByEngagement[engagementId] ?? "");
  const selectedContacts = contacts.filter((c) => selectedIds.includes(c.id));

  if (!request) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-navy">Engagement not found.</p>
        <Button asChild className="mt-4"><Link to="/documents">Back to Documents</Link></Button>
      </div>
    );
  }

  const send = () => {
    toast.success("Document request sent", { description: `${request.clientName} · ${selections.length} documents to ${selectedContacts.length} contact(s)` });
    reset(engagementId);
    navigate({ to: "/documents" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Documents</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Review Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the email request preview before sending it to your client.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/documents">
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      {/* Email preview */}
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <header className="border-b border-border bg-gradient-frost px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-navy/30 text-navy font-mono">{request.engagementId}</Badge>
            <Badge variant="outline" className="border-cyan/30 text-cyan font-mono">{request.id}</Badge>
          </div>
          <h2 className="mt-2 text-xl font-bold text-navy">Document Request — {request.clientName}</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold">To: </span>
            {selectedContacts.map((c) => `${c.name} <${c.email}>`).join(", ") || "—"}
          </p>
        </header>

        <div className="space-y-6 px-6 py-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Engagement</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="font-medium text-navy">{request.clientName}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Tax Years</p>
                <div className="mt-1"><YearChips years={request.taxYears} /></div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> Due Date</p>
                <p className="font-medium text-navy">{dueDate ? formatDate(dueDate) : "Not set"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Recipients</p>
                <p className="font-medium text-navy">{selectedContacts.length}</p>
              </div>
            </div>
          </section>

          <section>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3 w-3" /> Selected Documents ({selections.length})
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {selections.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-navy">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" /> {d}
                </li>
              ))}
              {selections.length === 0 && <li className="text-sm text-muted-foreground">None selected.</li>}
            </ul>
          </section>

          <section>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Mail className="h-3 w-3" /> Contacts
            </p>
            <ul className="mt-2 space-y-1">
              {selectedContacts.map((c) => (
                <li key={c.id} className="text-sm text-navy">
                  {c.name} <span className="text-muted-foreground">· {c.role} · {c.email}</span>
                </li>
              ))}
              {selectedContacts.length === 0 && <li className="text-sm text-muted-foreground">None selected.</li>}
            </ul>
          </section>

          {notes && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Notes</p>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm text-navy">{notes}</p>
            </section>
          )}
        </div>
      </article>

      <div className="flex justify-between gap-3">
        <Button asChild variant="ghost">
          <Link to="/documents">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <Button onClick={send} className="bg-green text-green-foreground hover:bg-green/90 shadow-elevated">
          <Send className="mr-1.5 h-4 w-4" /> Send Document Request
        </Button>
      </div>
    </div>
  );
}
