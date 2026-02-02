# App Icon Setup

## Current Status
Placeholder icons have been created. **You should replace these with proper app icons** for a professional look.

## Create Proper Icons

### Option 1: Use an Online Tool (Recommended)
1. Go to [https://www.favicon-generator.org/](https://www.favicon-generator.org/) or [https://realfavicongenerator.net/](https://realfavicongenerator.net/)
2. Upload your app logo/icon (square image, at least 512x512px)
3. Download the generated icons
4. Replace these files in `public/`:
   - `icon-192.png` (192x192px)
   - `icon-512.png` (512x512px)
   - `favicon.ico` (optional)

### Option 2: Create Icons Manually
1. Design your app icon (square, 512x512px minimum)
2. Export two versions:
   - 192x192px as `icon-192.png`
   - 512x512px as `icon-512.png`
3. Place them in the `public/` folder

## Icon Guidelines
- **Square format** (1:1 aspect ratio)
- **Simple design** - will be displayed small on mobile
- **High contrast** - visible on both light and dark backgrounds
- **No text** - logos/symbols work best
- **PNG format** with transparency

## Quick Icon Ideas
- Letter "H" in a circle (for Hicu)
- Chat bubble icon
- Lock/security icon (emphasizing encryption)
- Combination of chat + lock

## Testing Icons
After adding your icons:
1. Build the app: `npm run build`
2. Deploy: `firebase deploy --only hosting`
3. Open the app on mobile
4. Tap "Add to Home Screen" to see your icon
