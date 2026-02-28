import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export function PlantStatus({ playerName }: { playerName?: string }) {
  const [plantId, setPlantId] = useState<string | null>(null);
  const [lastWatered, setLastWatered] = useState<Date | null>(null);
  const [lastWateredBy, setLastWateredBy] = useState<string | null>(null);
  const [plantLoading, setPlantLoading] = useState(false);
  const [watering, setWatering] = useState(false);

  const fetchPlant = async () => {
    setPlantLoading(true);
    const { data, error } = await (supabase as any)
      .from("plants")
      .select("id,last_watered_at,last_watered_by_name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setPlantLoading(false);
    if (error) {
      console.error("Failed to fetch plant:", error);
      return;
    }
    setPlantId(data?.id ?? null);
    setLastWatered(data?.last_watered_at ? new Date(data.last_watered_at) : null);
    setLastWateredBy(data?.last_watered_by_name ?? null);
  };

  useEffect(() => { fetchPlant(); }, []);

  // Realtime: re-fetch when plant row changes
  useEffect(() => {
    const channel = supabase
      .channel("plant_status_rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "plants" }, () => {
        fetchPlant();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleWaterPlant = async () => {
    if (!plantId || !playerName) return;

    const now = new Date();
    setLastWatered(now);
    setLastWateredBy(playerName);
    setWatering(true);
    setTimeout(() => setWatering(false), 300);

    const safeName = (playerName ?? "").trim();

    const { error } = await (supabase as any)
      .from("plants")
      .update({
        last_watered_at: now.toISOString(),
        last_watered_by_name: safeName,
      })
      .eq("id", plantId);

    if (error) {
      console.error("Failed to update plant:", error);
    }
  };

  // Calculate days since last watered
  const daysSinceWatered = lastWatered
    ? Math.floor((Date.now() - lastWatered.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let plantIcon = "/good.png";
  if (lastWatered) {
    const days = (Date.now() - lastWatered.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 7 && days < 10) plantIcon = "/medium.png";
    if (days >= 10) plantIcon = "/bad.png";
  }

  const tooltip = (
    <>
      Bianca is the only living plant in the office, located in Workshop and proudly named after her most loyal
      caretaker.
      <br />
      If this digital plant looks unhappy, it means she needs water.
      <br />
      Please water the plant and click the watering can icon to reset the timer.
      {lastWateredBy && (
        <>
          <br />
          Last watered by: {lastWateredBy}
        </>
      )}
    </>
  );

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <img
                src={plantIcon}
                alt="Plant status"
                className={`h-[clamp(72px,5.12vw,123px)] w-auto ${plantLoading ? "opacity-60" : ""}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              {tooltip}
            </TooltipContent>
          </Tooltip>

          {playerName && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleWaterPlant}
                  className={`h-[clamp(24px,1.7vw,40px)] w-auto transition-transform duration-200 ease-out active:scale-90 ${
                    watering ? "scale-110" : ""
                  }`}
                >
                  <img src="/water.png" alt="Water plant" className="h-full w-auto" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
