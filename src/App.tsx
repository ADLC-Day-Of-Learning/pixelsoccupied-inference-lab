import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar, type AppView } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CalculatorPage } from "@/pages/calculator-page"
import { PlayPage } from "@/pages/play-page"

export function App() {
  const [currentView, setCurrentView] = React.useState<AppView>("play")

  const viewTitles: Record<AppView, { title: string; subtitle: string }> = {
    lab: {
      title: "Lab",
      subtitle: "Memory, KV cache capacity & request concurrency",
    },
    play: {
      title: "Inference Play",
      subtitle: "Interactive levels for learning LLM serving mechanics",
    },
  }

  const { title, subtitle } = viewTitles[currentView]

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        currentView={currentView}
        onSelectView={setCurrentView}
      />
      <SidebarInset>
        <SiteHeader title={title} subtitle={subtitle} />
        <main className="flex flex-1 flex-col">
          {currentView === "lab" ? (
            <CalculatorPage />
          ) : (
            <PlayPage />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
