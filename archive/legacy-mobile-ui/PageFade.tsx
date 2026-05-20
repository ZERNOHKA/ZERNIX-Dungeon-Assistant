interface PageFadeProps {
  children: React.ReactNode;
}

export function PageFade({ children }: PageFadeProps) {
  return <div className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">{children}</div>;
}
