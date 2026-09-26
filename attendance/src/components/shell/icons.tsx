import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  House,
  MessagesSquare,
  Nfc,
  Presentation,
  Settings,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "./nav";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  attendance: Nfc,
  students: GraduationCap,
  classes: BookOpen,
  myclasses: Presentation,
  reports: ClipboardList,
  discipline: ShieldAlert,
  messages: MessagesSquare,
  calendar: CalendarDays,
  analytics: BarChart3,
  ai: Sparkles,
  settings: Settings,
};
