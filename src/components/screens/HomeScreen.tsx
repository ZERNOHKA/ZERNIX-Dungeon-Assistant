import { UserRound } from "lucide-react";
import type { MouseEventHandler } from "react";
import type { AppContentJson, DashboardJson } from "../../types/content";
import type { AppRoute } from "../../types/routes";
import { CharacterRow } from "../dashboard/CharacterRow";
import { HeaderBar } from "../HeaderBar";
import { IconByName } from "../IconByName";
import { PageFade } from "../PageFade";
import { OrnateFrame } from "../ui/OrnateFrame";

interface HomeScreenProps {
  data: Pick<AppContentJson, "meta" | "navigation">;
  dashboard?: DashboardJson;
  onOpenCard: (route: AppRoute) => void;
  onSessionCta?: (route: AppRoute) => void;
  onPressProfile?: MouseEventHandler<HTMLButtonElement>;
}

export function HomeScreen({ data, dashboard, onOpenCard, onSessionCta, onPressProfile }: HomeScreenProps) {
  const { meta, navigation } = data;
  const tagline = dashboard?.tagline?.trim() || meta.subtitle;
  const session = dashboard?.activeSession;
  const notes = dashboard?.recentNotes ?? [];
  const favorites = dashboard?.favorites ?? [];

  return (
    <PageFade>
      <HeaderBar
        badge="home"
        leading={
          <button
            type="button"
            onClick={onPressProfile}
            className="flex size-11 shrink-0 items-center justify-center rounded-zernix border border-gold/38 text-gold shadow-innerGold transition hover:border-gold/55 hover:bg-gold/[0.06] lg:size-12"
            aria-label="Профиль"
          >
            <UserRound className="size-5 lg:size-6" strokeWidth={1.5} />
          </button>
        }
        centerBrand={
          <div className="space-y-1.5 px-2">
            <p className="font-serif text-xl tracking-[0.22em] text-gold lg:text-2xl xl:text-[2rem]">{meta.title}</p>
            <p className="text-[10px] font-sans uppercase leading-relaxed tracking-[0.2em] text-[#a8a29e] lg:text-[11px]">
              {tagline}
            </p>
          </div>
        }
      />

      <div className="space-y-8 pb-8 lg:space-y-10 lg:pb-12">
        <section aria-labelledby="home-quick-label">
          <h2 id="home-quick-label" className="sr-only">
            Быстрый старт
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
            {navigation.homeCards.map((card, index) => (
              <OrnateFrame
                key={card.id}
                radialGlow={index === 0}
                className="text-left transition hover:brightness-[1.03] sm:text-left"
                contentClassName="p-0"
              >
                <button
                  type="button"
                  onClick={() => onOpenCard(card.route)}
                  className="flex w-full flex-row items-center gap-5 p-5 text-left transition active:scale-[0.99] lg:flex-col lg:items-center lg:justify-center lg:gap-4 lg:p-7 lg:text-center"
                >
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-zernix border border-gold/32 bg-black/50 text-gold shadow-innerGold lg:size-[4.75rem] xl:size-20">
                    <IconByName name={card.icon} className="size-9 lg:size-11 xl:size-[3.25rem]" strokeWidth={1.35} />
                  </div>
                  <div className="min-w-0 flex flex-col gap-2 lg:items-center">
                    <p className="font-serif text-lg tracking-wide text-gold">{card.titleRu}</p>
                    <p className="font-sans text-sm leading-snug text-[#a8a29e]">{card.subtitleRu}</p>
                  </div>
                </button>
              </OrnateFrame>
            ))}
          </div>
        </section>

        {session ? (
          <section aria-labelledby="home-session-label" className="grid gap-4 lg:grid-cols-2 lg:gap-5 xl:gap-6">
            <h2 id="home-session-label" className="sr-only">
              Текущая сессия и заметки
            </h2>

            <OrnateFrame contentClassName="flex flex-col p-4 lg:p-5">
              <div className="mb-3 border-b border-gold/12 pb-3">
                <p className="font-serif text-lg tracking-wide text-gold">{session.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {session.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-gold/25 bg-gold/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d1d1d1]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {session.members.map((m) => (
                  <CharacterRow
                    key={m.name}
                    name={m.name}
                    subtitle={m.subtitle}
                    level={m.level}
                    hpCurrent={m.hpCurrent}
                    hpMax={m.hpMax}
                    avatarUrl={m.avatarUrl}
                  />
                ))}
              </div>
              {onSessionCta ? <SessionCtaButton label={session.ctaLabel} onClick={() => onSessionCta(session.ctaRoute)} /> : null}
            </OrnateFrame>

            <div className="flex flex-col gap-4">
              <OrnateFrame contentClassName="p-4 lg:p-5">
                <p className="mb-3 font-serif text-sm tracking-wide text-gold lg:text-base">Недавние заметки</p>
                <ul className="space-y-3">
                  {notes.length === 0 ? (
                    <li className="text-sm text-zinc-500">Нет записей — добавьте в JSON блок dashboard.recentNotes.</li>
                  ) : (
                    notes.map((n) => (
                      <li key={`${n.time}-${n.text.slice(0, 12)}`} className="flex gap-3 border-b border-gold/8 pb-3 last:border-b-0 last:pb-0">
                        <IconByName name={n.icon} className="mt-0.5 size-5 shrink-0 text-gold/90" strokeWidth={1.35} />
                        <div className="min-w-0">
                          <p className="text-[13px] leading-snug text-[#d1d1d1]">{n.text}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">{n.time}</p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </OrnateFrame>

              <OrnateFrame contentClassName="p-4 lg:p-5">
                <p className="mb-3 font-serif text-sm tracking-wide text-gold lg:text-base">Избранное</p>
                <ul className="space-y-2.5">
                  {favorites.length === 0 ? (
                    <li className="text-sm text-zinc-500">Пусто — задайте dashboard.favorites в app-content.json.</li>
                  ) : (
                    favorites.map((f) => (
                      <li
                        key={f.labelRu}
                        className="flex items-center gap-3 rounded-zernix border border-gold/12 bg-black/30 px-3 py-2"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold/22 bg-black/40 text-gold">
                          <IconByName name={f.icon} className="size-5" strokeWidth={1.35} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#e8e4dc]">{f.labelRu}</p>
                          {f.sublabelRu ? <p className="truncate text-[11px] text-zinc-500">{f.sublabelRu}</p> : null}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </OrnateFrame>
            </div>
          </section>
        ) : null}
      </div>
    </PageFade>
  );
}

function SessionCtaButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-none border border-gold/45 bg-gradient-to-b from-gold/15 to-black/40 px-4 py-3.5 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-gold shadow-goldGlow transition hover:brightness-110 active:scale-[0.99]"
    >
      {label}
    </button>
  );
}
