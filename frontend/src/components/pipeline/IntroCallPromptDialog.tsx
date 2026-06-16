// Shown immediately after a lead is created — prompts the rep to schedule an
// intro call. Skipping leaves a yellow reminder on the client profile.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFollowUpCallsStore } from "@/store/followUpCallsStore";
import { useUsersStore } from "@/store/usersStore";
import { userFullName } from "@/services/users";
import type { Lead } from "@/types/crm";

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function IntroCallPromptDialog({ lead, open, onOpenChange }: Props) {
  const add = useFollowUpCallsStore((s) => s.add);
  const me = useUsersStore((s) => s.me);
  const users = useUsersStore((s) => s.users);
  const ensureUsers = useUsersStore((s) => s.ensureLoaded);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [assignedRep, setAssignedRep] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void ensureUsers();
  }, [ensureUsers]);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setTime("10:00");
    setNotes("");
    // Default to the rep assigned to the lead; fall back to the signed-in user
    // only when the lead has no rep yet.
    if (lead.rep && lead.rep !== "Unassigned") setAssignedRep(lead.rep);
    else if (me) setAssignedRep(userFullName(me) || me.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me, lead]);

  const schedule = async () => {
    setSaving(true);
    try {
      await add(lead.id, {
        date,
        time,
        notes,
        callType: "Intro Call",
        assignedRepName: assignedRep,
      });
      toast.success("Intro call scheduled", { description: `${date} at ${time}` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't schedule call", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const skip = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-cyan/10 text-cyan ring-1 ring-cyan/20">
            <Phone className="h-5 w-5" />
          </div>
          <DialogTitle className="text-navy text-xl">Schedule an intro call?</DialogTitle>
          <DialogDescription>
            You just added a new lead. Would you like to schedule an introductory call now to kick
            off the engagement?
          </DialogDescription>
        </DialogHeader>

        {/* Lead chip */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-navy">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-white text-xs font-bold">
            {lead.fullName
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span>
            {lead.fullName}
            {lead.company ? ` — ${lead.company}` : ""}
          </span>
        </div>

        <div className="grid gap-4">
          <div>
            <Label className="mb-1.5 block">Assigned rep</Label>
            <Select value={assignedRep} onValueChange={setAssignedRep}>
              <SelectTrigger>
                <SelectValue placeholder="Select rep…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => {
                  const name = userFullName(u) || u.email;
                  return (
                    <SelectItem key={u.iduser} value={name}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Notes <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Discuss R&D eligibility for 2024–2026…"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={skip}
            disabled={saving}
          >
            Skip for now
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={skip} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={schedule}
              disabled={saving || !date}
              className="bg-cyan text-white hover:bg-cyan/90"
            >
              {saving ? "Scheduling…" : "Schedule call"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
