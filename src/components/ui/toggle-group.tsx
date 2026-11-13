import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

interface ToggleGroupContextValue extends VariantProps<typeof toggleVariants> {
  spacing?: number
  role?: string
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: "default",
  variant: "default",
  spacing: 0,
})

type ToggleGroupProps = Omit<
  ToggleGroupPrimitive.Props,
  "value" | "defaultValue" | "onValueChange"
> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    type?: "single" | "multiple"
    value?: string | readonly string[]
    defaultValue?: string | readonly string[]
    onValueChange?:
      | ((
          value: string,
          eventDetails?: ToggleGroupPrimitive.ChangeEventDetails
        ) => void)
      | ((
          value: string[],
          eventDetails?: ToggleGroupPrimitive.ChangeEventDetails
        ) => void)
  }

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  spacing = 0,
  type = "single",
  multiple,
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  role,
  children,
  ...props
}: ToggleGroupProps) {
  const isMultiple = multiple ?? type === "multiple"
  const resolvedRole = role ?? (isMultiple ? "group" : "radiogroup")

  const normalizedValue = React.useMemo(() => {
    if (value === undefined) return undefined
    if (typeof value === "string") return [value]
    return value
  }, [value])

  const normalizedDefaultValue = React.useMemo(() => {
    if (defaultValue === undefined) return undefined
    if (typeof defaultValue === "string") return [defaultValue]
    return defaultValue
  }, [defaultValue])

  const handleValueChange = React.useCallback(
    (groupValue: string[], eventDetails: ToggleGroupPrimitive.ChangeEventDetails) => {
      if (!onValueChange) return
      if (!isMultiple) {
        ;(
          onValueChange as (
            value: string,
            eventDetails?: ToggleGroupPrimitive.ChangeEventDetails
          ) => void
        )(groupValue[0] ?? "", eventDetails)
      } else {
        ;(
          onValueChange as (
            value: string[],
            eventDetails?: ToggleGroupPrimitive.ChangeEventDetails
          ) => void
        )(groupValue, eventDetails)
      }
    },
    [isMultiple, onValueChange]
  )

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      data-horizontal={orientation === "horizontal" ? "" : undefined}
      data-vertical={orientation === "vertical" ? "" : undefined}
      orientation={orientation}
      multiple={isMultiple}
      role={resolvedRole}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      onValueChange={handleValueChange}
      className={cn(
        "cn-toggle-group group/toggle-group flex items-center justify-center",
        spacing === 0 ? "gap-0" : "gap-1",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, role: resolvedRole }}
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
  role,
  render,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  const resolvedRole =
    role ?? (context.role === "radiogroup" ? "radio" : "button")

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "cn-toggle-group-item group-data-[spacing=0]/toggle-group:-ml-px group-data-[spacing=0]/toggle-group:first:ml-0 group-data-[spacing=0]/toggle-group:focus-visible:z-10 aria-pressed:z-10 data-[state=on]:z-10",
        className
      )}
      render={(buttonProps, state) => {
        const mergedProps = {
          ...buttonProps,
          role: resolvedRole,
          ...(resolvedRole === "radio"
            ? { "aria-checked": state.pressed }
            : {}),
          "data-state": state.pressed ? "on" : "off",
        }
        if (typeof render === "function") {
          return render(mergedProps, state)
        }
        if (render) {
          return React.cloneElement(render, mergedProps)
        }
        return <button {...mergedProps} />
      }}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
