

## Fix Performed Date Picker in Add Maintenance Dialog

### Problem
The "Performed Date" field currently uses a native HTML `<Input type="date">`, which shows the browser's default calendar icon and requires clicking that tiny icon to open the picker. It also has no default value, showing "mm/dd/yyyy" placeholder text.

### Solution
Replace the native date input with a custom Popover + Calendar date picker (using the existing Shadcn components already in the project). The entire button area will be clickable, no separate calendar icon, and today's date will be pre-selected by default.

### Changes to `src/components/maintenance/AddMaintenanceDialog.tsx`

1. **Update the Zod schema**: Change `performed_date` from `z.string()` to accept a `Date` object internally, then format to string on submit
2. **Add a `selectedDate` state** initialized to `new Date()` (today), and set the form default for `performed_date` to today's date string (e.g. `format(new Date(), 'yyyy-MM-dd')`)
3. **Replace the `<Input type="date">` block** (lines 131-135) with a Popover containing:
   - A `Button` (variant="outline") showing the formatted date (e.g. "Feb 11, 2026") or "Pick a date" -- the entire button is clickable
   - A `Calendar` (mode="single") inside `PopoverContent` with `pointer-events-auto`
   - On select, update both the local state and the form value via `setValue('performed_date', format(date, 'yyyy-MM-dd'))`
4. **Add imports**: `format` from `date-fns`, `Calendar` from `@/components/ui/calendar`, `Popover/PopoverTrigger/PopoverContent` from `@/components/ui/popover`, `CalendarIcon` from `lucide-react`, `cn` from `@/lib/utils`

### Visual Result
- Full-width clickable button showing today's date by default
- Opens a styled calendar popover on click (matching app's dark theme)
- No native browser calendar icon
- Consistent with the rest of the design system
