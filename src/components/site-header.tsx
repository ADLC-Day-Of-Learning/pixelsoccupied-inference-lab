import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"

interface SiteHeaderProps {
  title: string
  subtitle?: string
}

export function SiteHeader({ title, subtitle }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <span className="hidden text-xs text-muted-foreground sm:inline-block">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="hidden text-xs md:inline-flex">
          1 GB = 1e9 bytes
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  )
}
