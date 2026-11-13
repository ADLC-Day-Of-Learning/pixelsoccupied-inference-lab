"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<{
  size?: VariantProps<typeof toggleVariants>["size"]
  variant?: VariantProps<typeof toggleVariants>["variant"]
  spacing?: number
  type?: "single" | "multiple"
  value?: string[]
}>({
  size: "default",
  variant: "default",
  spacing: 0,
  type: "single",
  value: [],
})

interface ToggleGroupProps
  extends Omit<
      ToggleGroupPrimitive.Props,
      "value" | "defaultValue" | "onValueChange"
    >,
    VariantProps<typeof toggleVariants> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: ((value: string) => void) | ((value: string[]) => void)
  spacing?: number
}

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  spacing = 0,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const normalizedValue = React.useMemo(() => {
    if (value === undefined) return undefined
    if (Array.isArray(value)) return value
    return value ? [value] : []
  }, [value])

  const normalizedDefaultValue = React.useMemo(() => {
    if (defaultValue === undefined) return undefined
    if (Array.isArray(defaultValue)) return defaultValue
    return defaultValue ? [defaultValue] : []
  }, [defaultValue])

  const handleValueChange = (
    newValues: string[],
    _eventDetails: ToggleGroupPrimitive.ChangeEventDetails
  ) => {
    if (!onValueChange) return
    if (type === "single") {
      const val = newValues[newValues.length - 1] ?? ""
      ;(onValueChange as (value: string) => void)(val)
    } else {
      ;(onValueChange as (value: string[]) => void)(newValues)
    }
  }

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-spacing={spacing}
      data-size={size}
      data-orientation="horizontal"
      data-horizontal=""
      role={props.role ?? (type === "single" ? "radiogroup" : "group")}
      multiple={type === "multiple"}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      onValueChange={handleValueChange}
      className={cn(
        "cn-toggle-group group/toggle-group inline-flex items-center",
        spacing === 0 ? "gap-0" : "gap-1",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{
          variant,
          size,
          spacing,
          type,
          value: normalizedValue,
        }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value,
  role,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  const isPressed = value !== undefined && context.value?.includes(value)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-spacing={context.spacing}
      data-state={isPressed ? "on" : "off"}
      value={value}
      role={role ?? (context.type === "single" ? "radio" : undefined)}
      aria-checked={
        context.type === "single" ? (isPressed ? "true" : "false") : undefined
      }
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "cn-toggle-group-item",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
