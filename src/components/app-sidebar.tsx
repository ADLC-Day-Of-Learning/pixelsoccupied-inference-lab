import { Calculator, Gamepad2, Sparkles } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

export type AppView = "play" | "calculator" | "lab"

interface AppSidebarProps {
  currentView: AppView
  onSelectView: (view: AppView) => void
}

export function AppSidebar({ currentView, onSelectView }: AppSidebarProps) {
  const isLabActive = currentView === "calculator" || currentView === "lab"
  const isPlayActive = currentView === "play"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight">
                Inference Lab
              </span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                v0.1
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">
              LLM Serving Playground
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isPlayActive}
                  onClick={() => onSelectView("play")}
                  tooltip="Play"
                >
                  <Gamepad2 />
                  <span>Play</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isLabActive}
                  onClick={() => onSelectView("calculator")}
                  tooltip="Lab"
                >
                  <Calculator />
                  <span>Lab</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3 group-data-[collapsible=icon]:hidden">
        <p className="text-xs text-muted-foreground">
          Static educational tool. 1 GB = 1e9 bytes.
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
