export default function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 animate-fade-in">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-border" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <span className="text-sm text-muted font-medium">{text}</span>
    </div>
  );
}
