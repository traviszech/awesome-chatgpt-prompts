"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { analyticsPrompt } from "@/lib/analytics";
import { isTrending } from "@/lib/trending";
import { cn } from "@/lib/utils";

const DURATIONS = [1, 3, 7, 14];

interface TrendingPromptButtonProps {
  promptId: string;
  trendingUntil: Date | string | null;
  className?: string;
}

export function TrendingPromptButton({ promptId, trendingUntil: initialUntil, className }: TrendingPromptButtonProps) {
  const t = useTranslations("prompts");
  const format = useFormatter();
  const router = useRouter();
  const [trendingUntil, setTrendingUntil] = useState(initialUntil);
  const [isLoading, setIsLoading] = useState(false);
  const trending = isTrending(trendingUntil);

  const update = async (days: number | null) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/prompts/${promptId}/trending`, {
        method: days === null ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: days === null ? undefined : JSON.stringify({ days }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTrendingUntil(data.trendingUntil);
      if (days === null) {
        analyticsPrompt.clearTrending(promptId);
      } else {
        analyticsPrompt.setTrending(promptId, days);
      }
      router.refresh();
    } catch {
      toast.error(t("trendingUpdateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={trending ? "default" : "outline"}
          size="sm"
          disabled={isLoading}
          className={cn("gap-1.5", className)}
        >
          <Flame className={cn("h-4 w-4", trending && "fill-current")} />
          {trending && trendingUntil
            ? t("trendingUntil", { date: format.dateTime(new Date(trendingUntil), { dateStyle: "medium", timeStyle: "short" }) })
            : t("markTrending")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {DURATIONS.map((days) => (
          <DropdownMenuItem key={days} onClick={() => update(days)}>
            {t("trendingForDays", { count: days })}
          </DropdownMenuItem>
        ))}
        {trending && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => update(null)}>{t("stopTrending")}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
