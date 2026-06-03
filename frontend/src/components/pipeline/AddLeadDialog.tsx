// "Add New Lead" modal — validated with zod, dispatches to leads store.
//
// First/Last name and Company drive a client-search dropdown (GET /clients).
// Picking a suggestion prepopulates the fields and captures the hidden epr id
// (identity_people_roles), which is sent back with the create payload.

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Plus } from "lucide-react";
import type { LeadSource, TaxYear } from "@/types/crm";
import { useLeadsStore } from "@/store/leadsStore";
import { useUsersStore } from "@/store/usersStore";
import { userFullName } from "@/services/users";
import { clientsApi, type ClientContactRow } from "@/services/clients";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { ALL_TAX_YEARS } from "@/types/crm";

const SOURCES: LeadSource[] = ["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"];

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  company: z.string().trim().min(1, "Required").max(160),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(7, "Invalid phone").max(40),
  source: z.enum(["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"]),
  // The sales rep is always the authenticated user (the field is disabled);
  // the backend forces salesperson = caller regardless of what's sent.
  rep: z.string().trim().min(1, "Required"),
});

type FormState = z.infer<typeof schema>;

const initial: FormState = {
  firstName: "", lastName: "", company: "", email: "", phone: "",
  source: "Website", rep: "",
};

// Fields that drive the client-search dropdown.
type SearchKey = "firstName" | "lastName" | "company";

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initial);
  const [years, setYears] = useState<TaxYear[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const addLead = useLeadsStore((s) => s.addLead);
  const me = useUsersStore((s) => s.me);
  const users = useUsersStore((s) => s.users);
  const ensureUsers = useUsersStore((s) => s.ensureLoaded);

  // Client autocomplete: the picked epr id (hidden), current matches, and UI flags.
  const [eprId, setEprId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<ClientContactRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  // Set right after a pick so the field updates don't re-trigger a search.
  const skipNextSearch = useRef(false);

  // Alternate emails/phones of the picked client — offered when there's >1.
  const [emailOptions, setEmailOptions] = useState<string[]>([]);
  const [phoneOptions, setPhoneOptions] = useState<string[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);

  // Load the user list once, and default the (disabled) rep to the signed-in user.
  useEffect(() => { void ensureUsers(); }, [ensureUsers]);
  useEffect(() => {
    if (me) setForm((f) => (f.rep ? f : { ...f, rep: me.email }));
  }, [me]);

  // Debounced client search whenever a name/company field changes.
  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    const { firstName, lastName, company } = form;
    if (!firstName.trim() && !lastName.trim() && !company.trim()) {
      setSuggestions([]); setSearchOpen(false); setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await clientsApi.search({ firstName, lastName, company });
        if (!active) return;
        setSuggestions(rows);
        setSearchOpen(true);
      } catch {
        if (active) { setSuggestions([]); setSearchOpen(false); }
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [form.firstName, form.lastName, form.company]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Editing a search field by hand invalidates any previously picked client.
  const setSearchField = (k: SearchKey, v: string) => {
    setEprId(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const pickSuggestion = (row: ClientContactRow) => {
    skipNextSearch.current = true;
    const emails = row.emails ?? [];
    const phones = row.phones ?? [];
    setForm((f) => ({
      ...f,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.entity_name,
      email: emails[0] ?? f.email,
      phone: phones[0] ?? f.phone,
    }));
    setEprId(row.identity_people_roles);
    setSuggestions([]);
    setSearchOpen(false);
    // Offer the remaining contact options when the client has more than one.
    setEmailOptions(emails);
    setPhoneOptions(phones);
    setEmailOpen(emails.length > 1);
    setPhoneOpen(phones.length > 1);
  };

  const toggleYear = (y: TaxYear) =>
    setYears((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort((a, b) => a - b)));

  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setForm({ ...initial, rep: me ? me.email : "" });
    setYears([]);
    setErrors({});
    setEprId(null);
    setSuggestions([]);
    setSearchOpen(false);
    setEmailOptions([]);
    setPhoneOptions([]);
    setEmailOpen(false);
    setPhoneOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as keyof FormState] = issue.message;
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await addLead({ ...parsed.data, eprId, taxYears: years });
      toast.success("Lead added", {
        description: `${parsed.data.firstName} ${parsed.data.lastName} · ${parsed.data.company}`,
      });
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't add lead", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated">
          <Plus className="mr-1.5 h-4 w-4" /> Add New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-navy">Add New Lead</DialogTitle>
          <DialogDescription>
            {eprId !== null ? "Existing client" : "Create a new lead and assign a representative."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {/* Name + company drive the client-search dropdown (spans full width). */}
          <div className="relative">
            <div className="grid grid-cols-3 gap-3">
              <Field label="First Name" error={errors.firstName}>
                <Input
                  value={form.firstName}
                  onChange={(e) => setSearchField("firstName", e.target.value)}
                  onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  placeholder="Jane"
                  autoComplete="off"
                />
              </Field>
              <Field label="Last Name" error={errors.lastName}>
                <Input
                  value={form.lastName}
                  onChange={(e) => setSearchField("lastName", e.target.value)}
                  onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  placeholder="Doe"
                  autoComplete="off"
                />
              </Field>
              <Field label="Company / Entity" error={errors.company}>
                <Input
                  value={form.company}
                  onChange={(e) => setSearchField("company", e.target.value)}
                  onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  placeholder="Acme Inc."
                  autoComplete="off"
                />
              </Field>
            </div>

            {searchOpen && (searching || suggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover py-1 shadow-elevated">
                {searching && suggestions.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </div>
                ) : (
                  suggestions.map((row) => (
                    <button
                      key={row.identity_people_roles}
                      type="button"
                      // Keep the input focused so onBlur doesn't close before onClick.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(row)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium text-navy">
                        {row.first_name} {row.last_name}
                      </span>
                      <span className="truncate text-muted-foreground">{row.entity_name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={errors.email}>
              <ContactPicker
                options={emailOptions}
                open={emailOpen}
                setOpen={setEmailOpen}
                selected={form.email}
                onPick={(v) => set("email", v)}
              >
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  onFocus={() => emailOptions.length > 1 && setEmailOpen(true)}
                  onBlur={() => window.setTimeout(() => setEmailOpen(false), 120)}
                  placeholder="jane@acme.com"
                  autoComplete="off"
                />
              </ContactPicker>
            </Field>
            <Field label="Phone" error={errors.phone}>
              <ContactPicker
                options={phoneOptions}
                open={phoneOpen}
                setOpen={setPhoneOpen}
                selected={form.phone}
                onPick={(v) => set("phone", v)}
              >
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  onFocus={() => phoneOptions.length > 1 && setPhoneOpen(true)}
                  onBlur={() => window.setTimeout(() => setPhoneOpen(false), 120)}
                  placeholder="(555) 123-4567"
                  autoComplete="off"
                />
              </ContactPicker>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead Source">
              <Select value={form.source} onValueChange={(v) => set("source", v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assigned Sales Representative">
              <Select value={form.rep}>
                <SelectTrigger><SelectValue placeholder="Loading…" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.iduser} value={u.email}>{userFullName(u) || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Engagement Years">
            <MultiYearSelect
              value={years}
              onToggle={toggleYear}
              onSelectAll={() => setYears([...ALL_TAX_YEARS])}
              onClear={() => setYears([])}
            />
          </Field>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-navy text-navy-foreground hover:bg-navy/90">{submitting ? "Adding…" : "Add Lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Wraps an input and, when the picked client carries more than one email/phone,
// shows the alternates as a dropdown sized to the field.
function ContactPicker({
  options, open, setOpen, selected, onPick, children,
}: {
  options: string[];
  open: boolean;
  setOpen: (v: boolean) => void;
  selected: string;
  onPick: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {open && options.length > 1 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover py-1 shadow-elevated">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              // Keep the input focused so onBlur doesn't close before onClick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(opt); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{opt}</span>
              {opt === selected && <Check className="h-3.5 w-3.5 shrink-0 text-cyan" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
