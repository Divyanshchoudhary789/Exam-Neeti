import { Diagnostics } from "./diagnostics";

interface ProgramsProps {
  onOpenAuth: (type: "login" | "join") => void;
}

export function Programs({ onOpenAuth }: ProgramsProps) {
  // We can reuse the complete Diagnostics module here which has all the dashboard cards and dialog popups
  return <Diagnostics onOpenAuth={onOpenAuth} />;
}
