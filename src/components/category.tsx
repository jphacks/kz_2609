import { Aperture, Landmark, MapPin, Trees, Utensils, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/constants";

// カテゴリのアイコン（8.1 の対応表）
export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  nature: Trees,
  gourmet: Utensils,
  history: Landmark,
  photogenic: Aperture,
  other: MapPin,
};
