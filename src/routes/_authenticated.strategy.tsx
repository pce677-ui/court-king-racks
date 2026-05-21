import { createFileRoute } from "@tanstack/react-router";
import { StrategyBoard } from "@/components/app/StrategyBoard";

export const Route = createFileRoute("/_authenticated/strategy")({
  component: StrategyPage,
});

function StrategyPage() {
  return <StrategyBoard />;
}