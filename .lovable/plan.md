

## Fix Zoomed-In Display on Mobile and Telegram Mini Apps

### Problem
The app appears zoomed in when opened on mobile devices and inside Telegram Mini Apps. This is caused by the viewport meta tag missing zoom-prevention attributes, allowing the browser/Telegram WebView to auto-zoom the content.

### Changes

#### 1. Update viewport meta tag (`index.html`)
Add `maximum-scale=1.0` and `user-scalable=no` to the existing viewport meta tag. This prevents the WebView from auto-zooming and ensures the app renders at 1:1 scale.

**Before:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**After:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

#### 2. Add CSS zoom reset (`src/index.css`)
Add `text-size-adjust` properties to the `html` element to prevent mobile browsers from auto-inflating text sizes, which can contribute to the zoomed-in appearance:

```css
html {
  -webkit-text-size-adjust: 100%;
  -moz-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

### Files to Change
- `index.html` -- add maximum-scale and user-scalable to viewport meta
- `src/index.css` -- add text-size-adjust to html element

