import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";
import { format, setMonth, setYear } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function CustomCaption(props: CaptionProps) {
  const { goToMonth, currentMonth } = useNavigation();
  const currentYear = currentMonth.getFullYear();
  
  // Generate year range: 10 years before and 10 years after current year
  const startYear = currentYear - 10;
  const endYear = currentYear + 10;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  const handleMonthChange = (monthValue: string) => {
    const newMonth = parseInt(monthValue, 10);
    goToMonth(setMonth(currentMonth, newMonth));
  };

  const handleYearChange = (yearValue: string) => {
    const newYear = parseInt(yearValue, 10);
    goToMonth(setYear(currentMonth, newYear));
  };

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <Select
        value={currentMonth.getMonth().toString()}
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="h-8 w-[110px] text-sm font-serif border-border/50 hover:border-primary/50 focus:ring-primary/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {months.map((month, index) => (
            <SelectItem key={month} value={index.toString()} className="text-sm">
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentMonth.getFullYear().toString()}
        onValueChange={handleYearChange}
      >
        <SelectTrigger className="h-8 w-[85px] text-sm font-serif border-border/50 hover:border-primary/50 focus:ring-primary/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {years.map((year) => (
            <SelectItem key={year} value={year.toString()} className="text-sm">
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-8 w-8 bg-transparent p-0 border border-border/50 rounded-lg",
          "text-muted-foreground hover:text-primary hover:border-primary/50",
          "transition-all duration-200 flex items-center justify-center",
          "hover:bg-primary/5"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell: "text-primary/70 rounded-md w-10 font-medium text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: cn(
          "h-10 w-10 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-lg",
          "[&:has([aria-selected].day-outside)]:bg-primary/10",
          "[&:has([aria-selected])]:bg-primary/10",
          "first:[&:has([aria-selected])]:rounded-l-lg",
          "last:[&:has([aria-selected])]:rounded-r-lg",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-10 w-10 p-0 font-normal rounded-lg transition-all duration-200",
          "hover:bg-primary/10 hover:text-primary hover:scale-105",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-gradient-to-br from-primary to-primary/80",
          "text-primary-foreground font-medium",
          "shadow-lg shadow-primary/25",
          "hover:from-primary hover:to-primary/70",
          "hover:text-primary-foreground hover:scale-105",
          "focus:from-primary focus:to-primary/80 focus:text-primary-foreground"
        ),
        day_today: cn(
          "bg-accent/50 text-accent-foreground font-semibold",
          "ring-1 ring-primary/30"
        ),
        day_outside: cn(
          "day-outside text-muted-foreground/40",
          "aria-selected:bg-primary/5 aria-selected:text-muted-foreground/60"
        ),
        day_disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent hover:scale-100",
        day_range_middle: "aria-selected:bg-primary/10 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
