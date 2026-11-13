import * as React from "react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        ...defaultClassNames,
        root: cn(defaultClassNames.root, "w-fit"),
        months: cn(defaultClassNames.months, "flex flex-col gap-4"),
        month: cn(defaultClassNames.month, "space-y-3"),
        month_caption: cn(defaultClassNames.month_caption, "relative flex h-8 items-center justify-center"),
        caption_label: cn(defaultClassNames.caption_label, "text-sm font-medium"),
        nav: cn(defaultClassNames.nav, "flex items-center gap-1"),
        button_previous: cn(
          defaultClassNames.button_previous,
          buttonVariants({ variant: "outline", size: "icon-xs" }),
          "absolute left-0 top-0 cursor-pointer",
        ),
        button_next: cn(
          defaultClassNames.button_next,
          buttonVariants({ variant: "outline", size: "icon-xs" }),
          "absolute right-0 top-0 cursor-pointer",
        ),
        weekdays: cn(defaultClassNames.weekdays, "flex"),
        weekday: cn(defaultClassNames.weekday, "w-9 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground"),
        month_grid: cn(defaultClassNames.month_grid, "w-full border-collapse"),
        week: cn(defaultClassNames.week, "mt-1 flex w-full"),
        day: cn(defaultClassNames.day, "relative size-9 p-0 text-center text-sm focus-within:z-10"),
        day_button: cn(
          defaultClassNames.day_button,
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 cursor-pointer p-0 font-normal",
        ),
        selected: cn(defaultClassNames.selected, "rounded-md bg-primary text-primary-foreground"),
        today: cn(defaultClassNames.today, "rounded-md bg-accent text-accent-foreground"),
        outside: cn(defaultClassNames.outside, "text-muted-foreground opacity-50"),
        disabled: cn(defaultClassNames.disabled, "text-muted-foreground opacity-50"),
        hidden: cn(defaultClassNames.hidden, "invisible"),
        ...classNames,
      }}
      {...props}
    />
  )
}

export { Calendar }
