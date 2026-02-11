

## Fix Login Page Overflow and Input Placeholders

### Problem
The login screen appears "zoomed in" / overflowing on the right side in Telegram Mini Apps and mobile. Input field placeholders are not clearly visible -- icons overlap them.

### Root Causes
1. The card's `max-w-md` (448px) plus `p-6` internal padding and `p-4` outer padding can exceed narrow Telegram viewports (typically 360-390px wide)
2. No `overflow-hidden` on the card or form container, so content bleeds out
3. The `text-3xl` title ("Sterling Gate Properties") is quite wide and may push the card wider

### Changes

#### 1. Fix Auth page layout (`src/pages/Auth.tsx`)
- Add `overflow-hidden` to the Card component
- Reduce the title size on small screens: change `text-3xl` to `text-2xl sm:text-3xl`
- Reduce logo height on small screens: `h-14 sm:h-20`
- Ensure the outer wrapper constrains properly with `max-w-full`
- Update placeholder text to be clearer: "Enter your email" and "Enter your password" (more readable than the current ones, especially with icon overlap)

#### 2. Add global overflow safety (`src/index.css`)
- Add `overflow-x: hidden` to the `#root` or `html` element to prevent any horizontal scroll on mobile/Telegram

### Files to Change
- `src/pages/Auth.tsx` -- responsive sizing, overflow-hidden on card, better placeholders
- `src/index.css` -- global overflow-x hidden on html/root

