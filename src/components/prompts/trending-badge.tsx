import { useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TrendingBadgeProps {
  className?: string;
}

export function TrendingBadge({ className }: TrendingBadgeProps) {
  const t = useTranslations("prompts");

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400", className)}
    >
      <Flame className="h-3 w-3 fill-current" />
      {t("trending")}
    </Badge>
  );
}
