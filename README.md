# 🧩 Mazr

A browser-based maze escape game built with pure HTML, CSS, and JavaScript. No server required!

## How to Play

1. Open `index.html` in any modern web browser
2. Use the **arrow keys** (↑ ↓ ← →) to navigate through the maze
3. Find the **green exit** (🚪) to complete the level
4. Each new level generates a larger, more challenging maze!

## Features

- **Procedurally Generated Mazes**: Every level creates a unique maze using the recursive backtracking algorithm
- **Progressive Difficulty**: Mazes grow larger as you advance through levels
- **Stats Tracking**: Monitor your moves and time for each level
- **Clean, Modern UI**: Dark theme with smooth visual effects
- **No Dependencies**: Pure vanilla JavaScript - just open and play!

## Game Controls

| Key | Action |
|-----|--------|
| ↑ | Move up |
| ↓ | Move down |
| ← | Move left |
| → | Move right |

## File Structure

```
mazer/
├── index.html      # Main HTML file
├── README.md       # This file
├── css/
│   └── styles.css  # Game styling
└── js/
    ├── maze.js     # Maze generation algorithm
    └── game.js     # Game logic and rendering
```

## Technical Details

### Maze Generation
The game uses the **Recursive Backtracking** algorithm to generate perfect mazes (mazes with exactly one path between any two points). This ensures every maze is solvable while still being challenging.

### Rendering
The maze is rendered on an HTML5 Canvas element, with:
- Glowing player marker (blue)
- Glowing exit marker (green)
- Clean wall rendering with rounded corners

## Browser Compatibility

Works on all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Running the Game

Simply open `index.html` in your browser:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

Or just double-click the `index.html` file!

## License

MIT License - Feel free to modify and share!
