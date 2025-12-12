# Snowflake Creator

A browser-based TypeScript application for designing symmetrical snowflakes with laser-cutter compatible SVG export. Draw in a 30° wedge and watch your design replicate with twelve-fold rotational symmetry (mirrored and rotated) in real-time.

![Snowflake Creator](https://img.shields.io/badge/TypeScript-5.3-blue) ![Vite](https://img.shields.io/badge/Vite-5.0-purple)

## 🚀 Live Demo

**[Try it now!](https://thulrus.github.io/SnowflakeCreator/)**

## Features

- ✨ **Twelve-fold symmetry**: Draw in a 30° wedge with automatic mirroring and six-fold rotation
- 🎨 **Freehand & line tools**: Draw freely or create straight lines with precision
- 🧲 **Endpoint snapping**: Paths automatically snap together when endpoints are close (within 5px)
- 🔧 **Laser-cutter ready**: Export to SVG with optimal settings for laser cutting software
- 🖱️ **Intuitive controls**: Draw, undo, clear with simple toolbar buttons
- 🔍 **Zoom and pan**: Mouse wheel zoom and middle-click pan for precision
- ⌨️ **Keyboard shortcuts**: Efficient workflow with hotkeys
- 📦 **No backend required**: Fully client-side application

## Project Structure

```
/
├── src/
│   ├── main.ts           # Application entry point
│   ├── drawing.ts        # Stroke capture and path generation
│   ├── symmetry.ts       # Twelve-fold symmetry logic (mirroring + rotation)
│   ├── export.ts         # SVG export for laser cutting
│   ├── ui.ts             # UI interactions and event handling
│   └── styles.css        # Application styling
├── index.html            # Main HTML file
├── vite.config.ts        # Vite build configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. **Clone or navigate to the project directory:**

   ```bash
   cd /path/to/SnowflakeCreator
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

### Development

Run the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use). The page will automatically reload when you make changes to the source code.

### Building for Production

Create an optimized production build:

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Usage

### Drawing

1. Click and drag in the visible 30° wedge to draw paths
2. Your strokes will automatically be mirrored and replicated with twelve-fold symmetry
3. Path endpoints will automatically snap together when within 15 pixels for cleaner cuts
4. Use the stroke width selector to adjust line thickness
5. Toggle "Show Fill" to visualize which areas will be paper vs. cut holes

### Controls

#### Toolbar Buttons

- **Draw**: Enable drawing mode (default)
- **Undo**: Remove the last stroke
- **Clear**: Remove all strokes (with confirmation)
- **Stroke**: Adjust stroke width (Thin/Medium/Thick)
- **Export SVG**: Download the snowflake as an SVG file

#### Keyboard Shortcuts

- `Ctrl/Cmd + Z`: Undo last stroke
- `Ctrl/Cmd + E`: Export to SVG
- `Shift + Delete`: Clear all (with confirmation)
- `Escape`: Reset zoom and pan to default
- `Shift + Drag`: Pan the canvas
- `Mouse Wheel`: Zoom in/out

#### Mouse Controls

- **Left Click + Drag**: Draw in the wedge
- **Shift + Drag**: Pan the canvas
- **Mouse Wheel**: Zoom in/out (zooms toward cursor position)

### Exporting

Click the **Export SVG** button to download your snowflake design. The exported file:

- Contains all twelve-fold symmetry paths with transforms baked in (no wedge outline)
- Uses red stroke color (`#FF0000`) at 0.1mm width—standard for laser cutting
- Has all transforms (rotation and mirroring) baked into coordinates for compatibility
- Is ready to import into laser cutting software like LightBurn, RDWorks, or similar

## Deployment

### GitHub Pages

1. **Build the project:**

   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder:**

   You can use [gh-pages](https://www.npmjs.com/package/gh-pages):

   ```bash
   npm install -g gh-pages
   gh-pages -d dist
   ```

   Or manually:
   - Create a `gh-pages` branch
   - Copy contents of `dist/` to the root
   - Push to GitHub
   - Enable GitHub Pages in repository settings

3. **Alternative: GitHub Actions**

   Create `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

### Other Static Hosts

The `dist/` folder can be deployed to any static hosting service:

- **Netlify**: Drag and drop the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)
- **Vercel**: Import the GitHub repo or use the Vercel CLI
- **Cloudflare Pages**: Connect your repository or upload the `dist` folder
- **AWS S3**: Upload `dist/` contents to an S3 bucket with static hosting enabled

## Architecture

### Modules

- **drawing.ts**: Captures pointer events, validates points are within the 30° wedge, and converts strokes into SVG path elements using quadratic curves for smoothness.

- **symmetry.ts**: Manages the snowflake layer with twelve-fold symmetry. For each stroke in the wedge, creates a mirrored version, then rotates both the original and mirror at 60° intervals (0°, 60°, 120°, 180°, 240°, 300°) for a total of twelve copies. Provides methods to add, update, remove, and export all symmetry paths with real-time updates.

- **export.ts**: Generates laser-cutter compatible SVG files. Bakes rotation and mirroring transforms into path coordinates, applies optimal stroke styling (red, 0.1mm), and triggers browser downloads.

- **ui.ts**: Wires up toolbar buttons, handles zoom/pan interactions, and manages keyboard shortcuts. Coordinates between drawing, symmetry, and export modules.

- **main.ts**: Application entry point. Initializes all modules and sets up inter-module communication.

### Coordinate System

- **Canvas**: 1000×1000 SVG viewBox
- **Center**: (500, 500)
- **Wedge**: 30° sector from center, spanning 0° to 30° (0° is straight up)
- **Symmetry**: Twelve copies (mirrored + rotated) at 0°, 60°, 120°, 180°, 240°, 300° for both original and mirrored versions

## Laser Cutting Notes

### Compatibility

The exported SVG files are designed for compatibility with common laser cutting software:

- **LightBurn**: Import directly. Paths will be recognized as cut lines.
- **RDWorks**: Import as vectors. May need to adjust stroke color in software.
- **LaserWeb**: Compatible with standard SVG import.
- **Inkscape**: Can be edited before sending to laser cutter.

### Export Settings

- **Stroke Color**: Red (`#FF0000`) — common standard for cut lines
- **Stroke Width**: 0.1mm hairline — prevents double-cutting
- **Fill**: None — laser cutters typically ignore fills
- **Transforms**: Baked into coordinates — ensures consistent rendering

### Best Practices

- Keep designs within the circular boundary for balanced snowflakes
- Avoid very thin or complex paths that may be difficult to cut
- Test with a small piece of material first
- Adjust laser power/speed based on material and design complexity

## Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Mobile: ⚠️ Limited (touch events not fully implemented)

## Development Notes

### Technology Stack

- **TypeScript**: Type-safe JavaScript for robust code
- **Vite**: Fast build tool with HMR (Hot Module Replacement)
- **SVG DOM**: Direct manipulation of SVG elements (no canvas)
- **Vanilla JS**: No heavy frameworks, minimal dependencies

### Code Style

- Modular architecture with clear separation of concerns
- Comprehensive JSDoc comments for all public APIs
- Strict TypeScript configuration for type safety
- Event-driven communication between modules

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Export Issues

If exported SVGs don't work in your laser software:

1. Open the SVG in a text editor and verify:
   - Stroke color is `#FF0000`
   - No `transform` attributes remain on paths
   - Paths use `d` attribute with coordinates

2. Try opening in Inkscape first:
   - Check that paths are visible
   - Use "Stroke to Path" if needed
   - Re-export as "Plain SVG"

### Performance

For complex designs with many strokes:

- Use the Clear button periodically to start fresh
- Avoid extremely long continuous strokes
- Export and reload if the application becomes sluggish

## License

This project is open source and available for educational and personal use.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

Built with modern web technologies for the maker community. Inspired by the natural beauty of snowflakes and the precision of laser cutting.

---

**Happy snowflake designing! ❄️**
