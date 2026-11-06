import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { HistoryModal } from "@/components/history-modal";
import { Landing } from "@/components/landing";

const HistoryComponent = () => {
  const navigate = useNavigate();

  return (
    <>
      <Landing />
      <HistoryModal
        onClose={() => {
          void navigate({ replace: true, to: "/" });
        }}
      />
    </>
  );
};

export const Route = createFileRoute("/history")({
  component: HistoryComponent,
});
