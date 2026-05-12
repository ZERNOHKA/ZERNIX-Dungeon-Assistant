import { UserRound } from "lucide-react";
import type { MouseEventHandler } from "react";
import { DungeonCard } from "../DungeonCard";
import { HeaderBar } from "../HeaderBar";
import { IconByName } from "../IconByName";
import { PageFade } from "../PageFade";
import type { AppContentJson } from "../../types/content";
import type { AppRoute } from "../../types/routes";

interface HomeScreenProps {
  data: Pick<AppContentJson, "meta" | "navigation">;
  onOpenCard: (route: AppRoute) => void;
  onPressProfile?: MouseEventHandler<HTMLButtonElement>;
}

export function HomeScreen({ data, onOpenCard, onPressProfile }: HomeScreenProps) {
  const { meta, navigation } = data;

  return (
    <PageFade>
      <HeaderBar
        badge="home"
        leading={
          <button
            type="button"
            onClick={onPressProfile}
            className="flex size-11 items-center justify-center rounded-xl border border-gold/35 text-gold transition hover:border-gold/60 hover:bg-gold/5 lg:size-12"
            aria-label="Профиль"
          >
            <UserRound className="size-5 lg:size-6" strokeWidth={1.5} />
          </button>
        }
        centerBrand={
          <div className="space-y-1">
            <p className="font-serif text-2xl tracking-[0.35em] text-gold lg:text-3xl xl:text-4xl">{meta.title}</p>
            <p className="text-[11px] font-sans uppercase tracking-[0.22em] text-zinc-500">{meta.subtitle}</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:gap-5 lg:pb-10 xl:gap-6">
        {navigation.homeCards.map((card, index) => (
          <DungeonCard
            key={card.id}
            glow={index === 0}
            onClick={() => onOpenCard(card.route)}
            className="flex gap-5 p-5 lg:flex-col lg:items-start lg:gap-4 lg:p-6 xl:flex-row xl:items-center xl:gap-6"
          >
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-black/35 text-gold shadow-innerGold lg:size-[4.5rem] xl:size-20">
              <IconByName name={card.icon} className="size-9 lg:size-11 xl:size-[3.25rem]" strokeWidth={1.35} />
            </div>
            <div className="min-w-0 flex flex-col gap-2 text-left">
              <p className="font-serif text-lg text-gold">{card.titleRu}</p>
              <p className="font-sans text-sm leading-snug text-zinc-400">{card.subtitleRu}</p>
            </div>
          </DungeonCard>
        ))}
      </div>
    </PageFade>
  );
}
