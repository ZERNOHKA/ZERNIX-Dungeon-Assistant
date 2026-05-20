import { HeaderBar } from "../HeaderBar";
import { PageFade } from "../PageFade";

interface PlaceholderScreenProps {
  title: string;
  description: string;
  onBack: () => void;
}

export function PlaceholderScreen({ title, description, onBack }: PlaceholderScreenProps) {
  return (
    <PageFade>
      <HeaderBar title={title} onBack={onBack} subtitle="Секция будет подключена к БД позже." />
      <p className="mt-16 text-center text-sm leading-relaxed text-zinc-400">{description}</p>
    </PageFade>
  );
}
