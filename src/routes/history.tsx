import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HistoryModal } from "@/components/history-modal";
import { Landing } from "@/components/landing";

export const Route = createFileRoute("/history")({
  component: HistoryComponent,
});

function HistoryComponent() {
  const navigate = useNavigate();
  return (
    <>
      <Landing />
      <HistoryModal onClose={() => navigate({ to: "/" })} />
    </>
  );
}
