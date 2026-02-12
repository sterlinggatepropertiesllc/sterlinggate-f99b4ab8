

## Shift+Click Range Selection for Checkboxes

Add the ability to select a range of rows by clicking one checkbox, then holding Shift and clicking another -- all rows in between will be selected automatically, just like in Gmail or file managers.

### How It Works
1. Click a checkbox on any row -- that row is selected and remembered as the "last clicked" row
2. Hold **Shift** and click another checkbox -- all rows between the two (inclusive) are toggled on
3. Clicking without Shift works as normal (single toggle) and resets the anchor point

### Technical Details

In `src/components/maintenance/MaintenanceDashboard.tsx`:

- Add a `useRef` to track the index of the last-clicked checkbox (the "anchor")
- Update the `toggleOne` function to accept the row index and the click event
- When `event.shiftKey` is true and an anchor exists, select all rows between the anchor index and the clicked index (inclusive)
- When Shift is not held, just toggle the single row and update the anchor
- Pass the updated handler to each checkbox's `onCheckedChange` in the table body, wrapping it to capture the native click event via `onClick` on the checkbox or its parent cell

No database or backend changes needed -- this is purely a UI interaction enhancement.

