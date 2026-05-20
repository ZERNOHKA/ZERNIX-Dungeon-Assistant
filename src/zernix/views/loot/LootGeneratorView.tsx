import {
  ClipboardCopy,
  Coins,
  Gem,
  Heart,
  Package,
  ScrollText,
  Sparkles,
  Wand2,
} from "lucide-react";

import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import { useAppContent } from "../../../hooks/useAppContent";
import { LOOT_LOCATION_OPTIONS } from "../../../lib/zernixLocationCatalog";
import { lootCardIcon } from "../../components/LootCard";
import { useZernixGenerators } from "../../ZernixGeneratorsContext";
import { ZernixLootResultsSkeleton } from "../../ZernixSkeletonBlocks";
import { useIdleGlow } from "../../useIdleGlow";
import {
  formatLootCompact,
  formatLootDiscord,
  formatLootMarkdown,
  writeClipboard,
} from "../../zernixCopyExport";

export function LootGeneratorView() {
  const { data: content } = useAppContent();
  const {
    isFavorite,
    toggleLootFavorite,
    pushDmTimeline,
    showToast,
    getNoteBody,
    setNoteBody,
    appendPrepDmNote,
  } = useZernixUserData();
  const {
    lootCards,
    lootBusy,
    lootError,
    selectedLootId,
    setSelectedLootId,
    lootForm,
    setLootForm,
    generateLoot,
    contentReady,
    lootMarkdown,
    lootNarrativeBlock,
    lootDigest,
  } = useZernixGenerators();
  const noteGlow = useIdleGlow();

  const types = content?.loot.types ?? [];

  const primaryLoot = lootCards.find((c) => c.id === selectedLootId) ?? lootCards[0] ?? null;

  async function copyLoot(kind: "md" | "compact" | "discord") {
    const text =
      kind === "md"
        ? formatLootMarkdown(lootMarkdown, lootNarrativeBlock)
        : kind === "compact"
          ? formatLootCompact(primaryLoot, lootMarkdown)
          : formatLootDiscord(lootMarkdown, lootNarrativeBlock);
    const ok = await writeClipboard(text);
    if (ok) showToast("Скопировано");
  }

  function toggleLootType(id: string) {
    const prev = lootForm.selectedTypeIds;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    setLootForm({ selectedTypeIds: next });
  }

  const featuredNoteKey = primaryLoot ? `loot:${primaryLoot.id}` : "";
  const featuredFavRef = primaryLoot ? `loot:${primaryLoot.id}` : "";
  const featuredFavorited = primaryLoot ? isFavorite("loot", featuredFavRef) : false;
  const FeaturedIcon = primaryLoot ? lootCardIcon(primaryLoot) : Gem;
  const rarityClass = primaryLoot
    ? `is-${primaryLoot.rarityLabel
        .toLowerCase()
        .replace(/[ё]/g, "е")
        .replace(/очень редк\w*/, "very-rare")
        .replace(/легендарн\w*/, "legendary")
        .replace(/редк\w*/, "rare")
        .replace(/необычн\w*/, "uncommon")
        .replace(/обычн\w*/, "common")
        .replace(/[^a-z-]/g, "") || "default"}`
    : "";

  return (
    <div className="zx-loot">
      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  SETTINGS — compact premium panel                             ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-block" aria-labelledby="zx-loot-cfg-label">
        <header className="zx-block-head">
          <span className="zx-block-head__rule" aria-hidden />
          <h2 id="zx-loot-cfg-label" className="zx-block-head__title">Параметры добычи</h2>
          <span className="zx-block-head__rule" aria-hidden />
        </header>

        <div className="zx-loot-cfg">
          <label className="zx-loot-field">
            <span className="zx-loot-field__label">Уровень группы</span>
            <select
              className="zx-loot-input zx-loot-input--select"
              value={lootForm.partyLevel}
              onChange={(e) => setLootForm({ partyLevel: Number(e.target.value) })}
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="zx-loot-field">
            <span className="zx-loot-field__label">Игроки</span>
            <select
              className="zx-loot-input zx-loot-input--select"
              value={lootForm.playerCount}
              onChange={(e) => setLootForm({ playerCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="zx-loot-field">
            <span className="zx-loot-field__label">Сложность</span>
            <select
              className="zx-loot-input zx-loot-input--select"
              value={lootForm.difficultyUi}
              onChange={(e) => setLootForm({ difficultyUi: e.target.value as typeof lootForm.difficultyUi })}
            >
              <option value="low">Низкая</option>
              <option value="medium">Средняя</option>
              <option value="high">Высокая</option>
            </select>
          </label>

          <label className="zx-loot-field">
            <span className="zx-loot-field__label">Локация</span>
            <select
              className="zx-loot-input zx-loot-input--select"
              value={lootForm.environmentUi}
              onChange={(e) => setLootForm({ environmentUi: e.target.value as typeof lootForm.environmentUi })}
            >
              {LOOT_LOCATION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.labelRu}
                </option>
              ))}
            </select>
          </label>

          <label className="zx-loot-field">
            <span className="zx-loot-field__label"><Coins width={11} height={11} strokeWidth={1.5} aria-hidden /> Золото (зм)</span>
            <input
              type="number"
              min={1}
              className="zx-loot-input"
              value={lootForm.goldGp}
              onChange={(e) => setLootForm({ goldGp: Number(e.target.value) })}
            />
          </label>

          <label className="zx-loot-field">
            <span className="zx-loot-field__label"><Package width={11} height={11} strokeWidth={1.5} aria-hidden /> Сундуки</span>
            <input
              type="number"
              min={0}
              max={24}
              className="zx-loot-input"
              value={lootForm.chestCount}
              onChange={(e) => setLootForm({ chestCount: Number(e.target.value) })}
            />
          </label>

          <label className="zx-loot-field zx-loot-field--span-2 zx-loot-toggle-field">
            <span className="zx-loot-field__label"><Wand2 width={11} height={11} strokeWidth={1.5} aria-hidden /> Только магия</span>
            <button
              type="button"
              className={`zx-loot-toggle${lootForm.magicOnly ? " is-on" : ""}`}
              aria-pressed={lootForm.magicOnly}
              onClick={() => setLootForm({ magicOnly: !lootForm.magicOnly })}
            >
              <span className="zx-loot-toggle__track">
                <span className="zx-loot-toggle__knob" />
              </span>
              <span className="zx-loot-toggle__caption">{lootForm.magicOnly ? "Да" : "Нет"}</span>
            </button>
          </label>
        </div>

        <div className="zx-loot-cats">
          <div className="zx-loot-cats__label">Категории добычи</div>
          <div className="zx-loot-cats__chips">
            {types.map((t) => {
              const active = lootForm.selectedTypeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`zx-loot-cat${active ? " is-on" : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleLootType(t.id)}
                  disabled={!contentReady}
                >
                  <Sparkles width={11} height={11} strokeWidth={1.5} aria-hidden />
                  {t.labelRu}
                </button>
              );
            })}
          </div>
        </div>

        {lootError ? (
          <p className="zx-loot-error">{lootError}</p>
        ) : null}

        <button
          type="button"
          className="zx-cta zx-cta--gold zx-loot-generate"
          disabled={lootBusy || !contentReady}
          aria-busy={lootBusy}
          onClick={async () => {
            const card = await generateLoot();
            if (card) {
              pushDmTimeline({
                kind: "loot",
                title: card.title,
                subtitle: `${card.rarityLabel} · ${card.kindLabel}`,
                lootId: card.id,
              });
            }
          }}
        >
          <Gem width={18} height={18} strokeWidth={1.4} aria-hidden />
          <span>{lootBusy ? "Собираем добычу…" : "Сгенерировать добычу"}</span>
        </button>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  TREASURY — featured loot showcase                            ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-block" aria-labelledby="zx-loot-tre-label">
        <header className="zx-block-head zx-block-head--with-actions">
          <span className="zx-block-head__rule" aria-hidden />
          <h2 id="zx-loot-tre-label" className="zx-block-head__title">Сокровищница</h2>
          <div className="zx-loot-copy-row">
            <button type="button" className="zx-loot-copy-pill" disabled={lootBusy || !primaryLoot} onClick={() => void copyLoot("md")}>Markdown</button>
            <button type="button" className="zx-loot-copy-pill" disabled={lootBusy || !primaryLoot} onClick={() => void copyLoot("compact")}>Кратко</button>
            <button type="button" className="zx-loot-copy-pill" disabled={lootBusy || !primaryLoot} onClick={() => void copyLoot("discord")}>Discord</button>
          </div>
          <span className="zx-block-head__rule" aria-hidden />
        </header>

        {lootBusy && lootCards.length === 0 ? (
          <div className="zx-loot-skel-shell">
            <ZernixLootResultsSkeleton />
          </div>
        ) : null}

        {!lootBusy && lootCards.length === 0 ? (
          <div className="zx-loot-empty">
            <div className="zx-loot-empty__crest" aria-hidden>
              <Gem strokeWidth={1.1} />
            </div>
            <h3 className="zx-loot-empty__title">Сундук пуст</h3>
            <p className="zx-loot-empty__lead">
              Настройте параметры выше и нажмите «Сгенерировать добычу» — найденные предметы появятся здесь как в журнале приключений.
            </p>
          </div>
        ) : null}

        {primaryLoot ? (
          <div className={`zx-loot-showcase ${rarityClass}${lootBusy ? " is-busy" : ""}`}>
            <div className="zx-loot-showcase__hero">
              <div className="zx-loot-showcase__icon-wrap">
                <div className="zx-loot-showcase__icon-frame" aria-hidden />
                <FeaturedIcon className="zx-loot-showcase__icon" strokeWidth={1.1} aria-hidden />
                <div className="zx-loot-showcase__icon-glow" aria-hidden />
              </div>

              <div className="zx-loot-showcase__head">
                <div className="zx-loot-showcase__eyebrow">
                  <span className="zx-loot-showcase__rarity-dot" aria-hidden />
                  <span>{primaryLoot.kindLabel}</span>
                </div>
                <h3 className="zx-loot-showcase__title">{primaryLoot.title}</h3>
                <div className="zx-loot-showcase__rarity-badge">{primaryLoot.rarityLabel}</div>
              </div>

              <p className="zx-loot-showcase__desc">{primaryLoot.description}</p>

              {lootDigest?.goldLine ? (
                <div className="zx-loot-showcase__meta">
                  <Coins width={14} height={14} strokeWidth={1.4} aria-hidden />
                  <span>{lootDigest.goldLine}</span>
                </div>
              ) : null}

              {lootNarrativeBlock ? (
                <div className="zx-loot-showcase__narrative">
                  <div className="zx-loot-showcase__narrative-label">Контекст</div>
                  <p className="zx-loot-showcase__narrative-text">
                    {lootNarrativeBlock.length > 320 ? `${lootNarrativeBlock.slice(0, 317)}…` : lootNarrativeBlock}
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="zx-loot-showcase__rail">
              <div className="zx-loot-showcase__actions">
                <button
                  type="button"
                  className={`zx-loot-action zx-loot-action--fav${featuredFavorited ? " is-on" : ""}`}
                  onClick={() => toggleLootFavorite(primaryLoot)}
                >
                  <Heart width={15} height={15} strokeWidth={1.4} fill={featuredFavorited ? "currentColor" : "none"} aria-hidden />
                  <span>{featuredFavorited ? "В избранном" : "В избранное"}</span>
                </button>
                <button
                  type="button"
                  className="zx-loot-action"
                  onClick={() => {
                    appendPrepDmNote(`[Loot] ${primaryLoot.title}: ${primaryLoot.displayLine}`);
                    showToast("Сохранено в сессию");
                  }}
                >
                  <ScrollText width={15} height={15} strokeWidth={1.4} aria-hidden />
                  <span>Сохранить в сессию</span>
                </button>
                <button
                  type="button"
                  className="zx-loot-action"
                  onClick={async () => {
                    const text = `${primaryLoot.title}\n${primaryLoot.displayLine}\n${primaryLoot.description}`;
                    const ok = await writeClipboard(text);
                    if (ok) showToast("Скопировано");
                  }}
                >
                  <ClipboardCopy width={15} height={15} strokeWidth={1.4} aria-hidden />
                  <span>Копировать</span>
                </button>
              </div>

              <div className={`zx-loot-notes${noteGlow.glow ? " is-glow" : ""}`}>
                <div className="zx-loot-notes__label">
                  <ScrollText width={12} height={12} strokeWidth={1.4} aria-hidden />
                  Заметки к карточке
                </div>
                <textarea
                  className="zx-loot-notes__input"
                  rows={5}
                  value={getNoteBody(featuredNoteKey)}
                  onChange={(e) => {
                    setNoteBody(featuredNoteKey, e.target.value);
                    noteGlow.bump();
                  }}
                  placeholder="Владелец, сцена, модификаторы…"
                />
                <button
                  type="button"
                  className="zx-loot-notes__save"
                  onClick={() => {
                    showToast("Saved!");
                    noteGlow.bump();
                  }}
                >
                  Сохранить заметку
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {lootCards.length > 1 ? (
          <>
            <header className="zx-block-head zx-block-head--sub">
              <span className="zx-block-head__rule" aria-hidden />
              <h3 id="zx-loot-coll-label" className="zx-block-head__title zx-block-head__title--sm">
                Коллекция · {lootCards.length}
              </h3>
              <span className="zx-block-head__rule" aria-hidden />
            </header>

            <div className={`zx-loot-collection${lootBusy ? " is-busy" : ""}`}>
              {lootCards.map((card) => {
                const CardIcon = lootCardIcon(card);
                const selected = selectedLootId === card.id;
                const fav = isFavorite("loot", `loot:${card.id}`);
                const rarityChip = card.rarityLabel
                  .toLowerCase()
                  .replace(/[ё]/g, "е")
                  .replace(/очень редк\w*/, "very-rare")
                  .replace(/легендарн\w*/, "legendary")
                  .replace(/редк\w*/, "rare")
                  .replace(/необычн\w*/, "uncommon")
                  .replace(/обычн\w*/, "common")
                  .replace(/[^a-z-]/g, "");
                return (
                  <div key={card.id} className={`zx-loot-tile is-${rarityChip || "default"}${selected ? " is-selected" : ""}`}>
                    <button
                      type="button"
                      className="zx-loot-tile__body"
                      onClick={() => setSelectedLootId(card.id)}
                      aria-pressed={selected}
                    >
                      <div className="zx-loot-tile__icon">
                        <CardIcon strokeWidth={1.15} aria-hidden />
                      </div>
                      <div className="zx-loot-tile__title">{card.title}</div>
                      <div className="zx-loot-tile__rarity">{card.rarityLabel}</div>
                    </button>
                    <button
                      type="button"
                      className={`zx-loot-tile__fav${fav ? " is-on" : ""}`}
                      aria-label={fav ? "Убрать из избранного" : "В избранное"}
                      aria-pressed={fav}
                      onClick={(e) => { e.stopPropagation(); toggleLootFavorite(card); }}
                    >
                      <Heart width={14} height={14} strokeWidth={1.4} fill={fav ? "currentColor" : "none"} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
