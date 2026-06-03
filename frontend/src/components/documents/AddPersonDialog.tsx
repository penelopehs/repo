// "New Contact" modal — used in Configure Request page.

import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useDocContactsStore, type DocContact } from "@/store/docConfigStore";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  role: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
});

export function AddPersonDialog({ onAdded }: { onAdded: (c: DocContact) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const addContact = useDocContactsStore((s) => s.addContact);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[i.path[0] as string] = i.message;
      setErrors(fe);
      return;
    }
    const created = addContact(parsed.data);
    toast.success("Contact added", { description: created.name });
    onAdded(created);
    setForm({ name: "", role: "", email: "" });
    setErrors({});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-cyan text-cyan hover:bg-cyan/10">
          <UserPlus className="mr-1.5 h-4 w-4" /> Add Person
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy">New Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div>
            <Label>Full Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Doe"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Label>Role / Title</Label>
            <Input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Controller"
            />
            {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role}</p>}
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@client.com"
            />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-orange text-white hover:bg-orange/90">
              Add and Select
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
