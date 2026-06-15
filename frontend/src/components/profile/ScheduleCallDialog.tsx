// Schedule / edit follow-up call modal — assigned rep, date/time and notes.
// The call type isn't user-editable; it's derived from the pipeline stage
// (defaultCallType) on add and preserved from the existing call on edit.

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
import type { FollowUpCall } from "@/types/crm";

interface Props {
  clientId: string;
  /** When provided, the dialog edits this call instead of creating a new one. */
  call?: FollowUpCall | null;
  /** Default call type for new calls (e.g. "Intro Call"). */
  defaultCallType?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ScheduleCallDialog({ clientId, call, defaultCallType, open, onOpenChange }: Props) {
  const add = useFollowUpCallsStore((s) => s.add);
  const update = useFollowUpCallsStore((s) => s.update);
  const me = useUsersStore((s) => s.me);
  const users = useUsersStore((s) => s.users);
  const ensureUsers = useUsersStore((s) => s.ensureLoaded);
  const isEditing = !!call;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [callType, setCallType] = useState(defaultCallType ?? "Follow-up Call");
  const [assignedRep, setAssignedRep] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void ensureUsers(); }, [ensureUsers]);

  useEffect(() => {
    if (!open) return;
    setDate(call?.date || new Date().toISOString().slice(0, 10));
    setTime((call?.time || "10:00").slice(0, 5));
    setNotes(call?.notes || "");
    setCallType(call?.callType || defaultCallType || "Follow-up Call");
    setAssignedRep(call?.assignedRepName || (me ? (userFullName(me) || me.email) : ""));
  }, [open, call, defaultCallType, me]);

  const submit = async () => {
    setSaving(true);
    try {
      if (call) {
        await update(clientId, call.id, { date, time, notes, callType, assignedRepName: assignedRep });
        toast.success("Call updated", { description: `${date} at ${time}` });
      } else {
        await add(clientId, { date, time, notes, callType, assignedRepName: assignedRep });
        toast.success("Call scheduled", { description: `${date} at ${time}` });
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(isEditing ? "Couldn't update call" : "Couldn't schedule call", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy flex items-center gap-2">
            <Phone className="h-4 w-4" /> {isEditing ? "Edit Call" : "Schedule Call"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this follow-up call's details."
              : "Add a follow-up call to this client."}
          </DialogDescription>
        </DialogHeader>
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
                    <SelectItem key={u.iduser} value={name}>{name}</SelectItem>
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
            <Label className="mb-1.5 block">Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, prep notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-orange text-white hover:bg-orange/90"
          >
            {saving
              ? isEditing
                ? "Saving…"
                : "Scheduling…"
              : isEditing
                ? "Save Changes"
                : "Schedule Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
