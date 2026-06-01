// Schedule follow-up call modal.

import { useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEngagementsStore } from "@/store/engagementsStore";

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ScheduleCallDialog({ clientId, open, onOpenChange }: Props) {
  const add = useEngagementsStore((s) => s.addCall);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  const submit = () => {
    add({ clientId, date, time, notes });
    toast.success("Call scheduled", { description: `${date} at ${time}` });
    onOpenChange(false);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy flex items-center gap-2"><Phone className="h-4 w-4" /> Schedule Call</DialogTitle>
          <DialogDescription>Add a follow-up call to this client.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
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
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, prep notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-navy text-navy-foreground hover:bg-navy/90">Schedule Call</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
