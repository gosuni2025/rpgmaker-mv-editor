# Deploy

After completing your game, you can deploy to various platforms from the **File → Deploy** menu.

![Deploy Dialog](../images/deploy-dialog.png)

## Deployment Targets

| Tab | Description |
|------|------|
| **itch.io** | Upload directly to itch.io via butler CLI |
| **Netlify** | Deploy to a Netlify site |
| **GitHub Pages** | Push to a GitHub Pages branch |
| **Local Folder** | Export as ZIP or folder |

## itch.io Deployment

The itch.io tab uploads the game directly via the butler CLI.

- **Prerequisites**: butler must be installed and logged in
- **Username / Project**: Set your itch.io account and project URL
- **Channel**: Deployment channel (for HTML5 games: `html5`)
- **Create New Game**: Automatically create a new project on itch.io if none exists

## Deployment Options

### SW Bundling

Bundles images, audio, and data into a ZIP. The browser caches the bundle via a Service Worker to improve loading speed.

### Cache Busting

Cache busting can be selected per category: source code, images, audio, video, and data. Updated resources are immediately reflected without browser cache.

### PNG → WebP Conversion

Automatically converts images to WebP format to reduce file size.

### Exclude Unused Assets

Excludes image and audio files that are not actually used in the project from the deployment to minimize file size.
