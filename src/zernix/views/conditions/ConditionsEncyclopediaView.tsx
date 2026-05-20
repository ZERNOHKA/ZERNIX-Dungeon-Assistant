import { Shield, Skull, Sparkles, Wind } from "lucide-react";

type ConditionsProps = {
  conditionKey: string;
  onPickCondition: (k: string) => void;
};

const CONDITIONS = [
  { key: "frightened", title: "Испуг", Icon: Skull },
  { key: "restrained", title: "Схвачен", Icon: Shield },
  { key: "charm", title: "Очарован", Icon: Sparkles },
] as const;

export function ConditionsEncyclopediaView({ conditionKey, onPickCondition }: ConditionsProps) {
  return (
    <div className="zernix-page">
      <div className="zernix-conditions-list">
        {CONDITIONS.map(({ key, title, Icon }) => (
          <button
            key={key}
            type="button"
            className={`zernix-condition-row ${conditionKey === key ? "is-active" : ""}`}
            onClick={() => onPickCondition(key)}
          >
            <Icon className="zernix-condition-icon" strokeWidth={1.2} aria-hidden />
            <div>
              <div className="zernix-condition-title">{title}</div>
              <div className="zernix-condition-hint">Нажмите, чтобы открыть в кодексе</div>
            </div>
            <Wind className="zernix-list-chevron" strokeWidth={1.15} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
