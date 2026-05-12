import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  Clock3,
  EyeOff,
  FlaskConical,
  Gem,
  Heart,
  HelpCircle,
  Home,
  Layers,
  Link2,
  Map,
  Moon,
  Package,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  ScrollText,
  Skull,
  Sword,
  VenetianMask,
} from "lucide-react";

const registry: Record<string, LucideIcon> = {
  chest: Package,
  hood: VenetianMask,
  tome: BookMarked,
  home: Home,
  history: Clock3,
  star: Star,
  help: HelpCircle,
  sword: Sword,
  shield: Shield,
  potion: FlaskConical,
  scroll: ScrollText,
  sparkle: Sparkles,
  gem: Gem,
  map: Map,
  layers: Layers,
  book: BookOpen,
  "eye-off": EyeOff,
  heart: Heart,
  skull: Skull,
  "shield-alert": ShieldAlert,
  link: Link2,
  moon: Moon,
};

const fallback = Package;

interface IconByNameProps {
  name?: string;
  className?: string;
  strokeWidth?: number;
}

export function IconByName({ name, className, strokeWidth = 1.5 }: IconByNameProps) {
  const Cmp = name && registry[name] ? registry[name] : fallback;
  return <Cmp className={className} strokeWidth={strokeWidth} aria-hidden />;
}
