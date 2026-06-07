import Image from "next/image";

interface ReLoopLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function ReLoopLogo({
  size = 40,
  showWordmark = true,
  className = "",
}: ReLoopLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <Image
        src="/reloop-logo.jpeg"
        alt="ReLoop AI"
        width={size}
        height={size}
        className="rounded-lg object-cover shrink-0"
        priority
      />
      {showWordmark && (
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            ReLoop <span className="text-emerald-400">AI</span>
          </h1>
        </div>
      )}
    </div>
  );
}
