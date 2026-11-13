import { Gamepad2, Layers, Cpu, Database, Zap } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const UPCOMING_LEVELS = [
  {
    icon: Zap,
    title: "Sampling & Temperature",
    description: "Learn how greedy search vs top-p sampling shapes outputs.",
  },
  {
    icon: Cpu,
    title: "Prefill vs. Decode",
    description: "Explore why prompt processing is compute-bound while token generation is memory-bound.",
  },
  {
    icon: Database,
    title: "KV Cache Mechanics",
    description: "Understand memory growth token-by-token and paged attention.",
  },
  {
    icon: Layers,
    title: "Continuous Batching",
    description: "See how dynamic request scheduling keeps GPUs saturated.",
  },
]

export function PlayPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <Card className="border-dashed">
        <CardHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">Play Mode</CardTitle>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardDescription className="mt-1">
                Interactive, hands-on micro-levels teaching core LLM serving
                concepts one by one.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {UPCOMING_LEVELS.map((level) => {
              const Icon = level.icon
              return (
                <div
                  key={level.title}
                  className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm leading-snug">
                      {level.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {level.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
