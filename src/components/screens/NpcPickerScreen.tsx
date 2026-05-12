import { UserSquare2 } from "lucide-react";
import { useState } from "react";
import type { AppContentJson } from "../../types/content";
import { resolveNpcCard, type NpcSummonForm, type ResolvedNpcCard } from "../../lib/npcSummon";
import { DungeonCard } from "../DungeonCard";
import { GoldButton } from "../GoldButton";
import { HeaderBar } from "../HeaderBar";
import { PageFade } from "../PageFade";
import { SelectField } from "../SelectField";

export type { ResolvedNpcCard, NpcSummonForm };

interface NpcPickerScreenProps {
  npc: AppContentJson["npc"];
  onBack: () => void;
  onReveal: (card: ResolvedNpcCard, form: NpcSummonForm) => void;
}

export function NpcPickerScreen({ npc, onBack, onReveal }: NpcPickerScreenProps) {
  const [race, setRace] = useState(npc.races[0]?.value ?? "human");
  const [occupation, setOccupation] = useState(npc.occupations[0]?.value ?? "merchant");
  const [role, setRole] = useState(npc.roles[0]?.value ?? "ally");
  const [genderId, setGenderId] = useState(npc.genderSegment[2]?.id ?? "random");

  const occupationLabel =
    npc.occupations.find((occupationOpt) => occupationOpt.value === occupation)?.labelRu ?? "";

  const summon = async () => {
    const form: NpcSummonForm = { race, occupationValue: occupation, role, genderId };
    const card = await resolveNpcCard(npc, form);
    if (!card) return;
    onReveal(card, form);
  };

  return (
    <PageFade>
      <HeaderBar
        onBack={onBack}
        title="ZERNIX Dungeon Assistant"
        subtitle="Создать NPC · набросок истории для сессии"
      />

      <div className="flex flex-col gap-5 pb-28 lg:pb-10">
        <SelectField label="Раса" value={race} onChange={(e) => setRace(e.target.value)}>
          {npc.races.map((raceOption) => (
            <option key={raceOption.value} value={raceOption.value}>
              {raceOption.labelRu}
            </option>
          ))}
        </SelectField>

        <SelectField label="Роль во встрече" value={role} onChange={(e) => setRole(e.target.value)}>
          {npc.roles.map((roleOption) => (
            <option key={roleOption.value} value={roleOption.value}>
              {roleOption.labelRu}
            </option>
          ))}
        </SelectField>

        <SelectField label="Ремесло / занятие" value={occupation} onChange={(event) => setOccupation(event.target.value)}>
          {npc.occupations.map((occ) => (
            <option key={occ.value} value={occ.value}>
              {occ.labelRu}
            </option>
          ))}
        </SelectField>

        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Пол</p>
          <div className="flex gap-3">
            {npc.genderSegment.map((segment) => {
              const chosen = genderId === segment.id;
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setGenderId(segment.id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                    chosen
                      ? "border-gold bg-gold/12 text-gold shadow-goldGlow"
                      : "border-gold/20 bg-black/30 text-zinc-300 hover:border-gold/35"
                  }`}
                  aria-pressed={chosen}
                >
                  {segment.labelRu}
                </button>
              );
            })}
          </div>
        </div>

        <DungeonCard glow className="p-6">
          <GoldButton variant="summon" onClick={summon} icon={<UserSquare2 className="size-5 lg:size-6 xl:size-7" />}>
            Призвать персонажа
          </GoldButton>
          {occupationLabel ? (
            <p className="mt-4 text-center text-[11px] leading-snug text-zinc-500">
              При наличии в данных шаблона с расой и занятием «{occupationLabel}» берётся он; иначе — шаблон с той же
              расой и выбранной ролью, затем любой с той же расой.
            </p>
          ) : null}
        </DungeonCard>
      </div>
    </PageFade>
  );
}
