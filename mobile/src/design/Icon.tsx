import React from "react";
import {
  Archive,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ellipsis,
  HardHat,
  Layers,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Square,
  Trash2,
  TriangleAlert,
  User,
  Users,
  X,
  CalendarDays,
  type LucideIcon,
} from "lucide-react-native";
import { colors } from "./tokens";

// Íconos de la app: trazo único (contorno redondeado de 1.8, tamaño 24). Los nombres son los de la función, no los del
// dibujo: si cambia la librería o el dibujo, solo cambia este mapa. Lucide tiene licencia ISC.
const ICONS = {
  home: Navigation,
  projects: HardHat,
  records: CalendarDays,
  team: Users,
  more: Ellipsis,
  pin: MapPin,
  search: Search,
  layers: Layers,
  locate: LocateFixed,
  add: Plus,
  check: Check,
  next: ChevronRight,
  back: ChevronLeft,
  play: Play,
  stop: Square,
  alert: TriangleAlert,
  user: User,
  shield: ShieldCheck,
  building: Building2,
  exit: LogOut,
  clock: Clock,
  share: Share2,
  close: X,
  edit: Pencil,
  delete: Trash2,
  archive: Archive,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
