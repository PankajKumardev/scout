import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="group flex items-center gap-3">
          <span className="flex w-5 flex-col gap-[3px]" aria-hidden="true">
            <span className="h-0.5 w-5 bg-foreground transition-[width] duration-200 group-hover:w-3" />
            <span className="h-0.5 w-3.5 bg-foreground" />
            <span className="h-0.5 w-2 bg-score transition-[width] duration-200 group-hover:w-5" />
          </span>
          <p className="text-base font-medium tracking-[-0.03em]">SCOUT</p>
        </div>
        <Badge variant="secondary">C-Powered Research</Badge>
      </header>
      <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 sm:px-6">
        <SearchBox />
      </main>
    </div>
  );
}
