# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Thunder Lizard" is a browser-based roguelike game built with TypeScript, Vite, and ROT.js. The game features dinosaurs in a procedurally generated world with water, lava, and various terrain types. Players control a dinosaur while AI-controlled dinosaurs exhibit behaviors like herding, territorial control, and predator-prey dynamics.

## Common Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Build with TypeScript error checking
npm run build_with_error_check

# Run tests
npm run test

# Preview production build
npm run preview
```

## Architecture Overview

### Core Systems

The game uses a hybrid architecture combining traditional object-oriented patterns with Entity Component System (ECS) architecture via bitECS:

- **Traditional OOP**: Used for core game entities (`Entity`, `Dino`, terrain classes)
- **ECS**: Used for AI behaviors and systems (`Movement`, `Awareness`, `Pursue`, `Flee`, `Herding`, `Territorial`)

### Key Components

1. **Game Loop**: Three independent loops run concurrently:
   - `mainLoop()`: Core game systems (100ms tick)
   - `waterLoop()`: Water animation system (200ms tick)
   - `lavaloop()`: Lava spreading cellular automata (70ms tick)

2. **Rendering**: Uses ROT.js Display with custom viewport system that starts small and expands during gameplay

3. **AI Systems**: 
   - `awarenessSystem`: Handles entity perception and decision-making
   - `movementSystem`: Processes movement for all entities
   - `deplacementSystem`: Handles terrain displacement effects

4. **Map Generation**: Uses Simplex noise with multiple octaves to create realistic terrain distribution

### Important Files

- `src/main.ts`: Entry point and audio handling
- `src/game.ts`: Main game class, handles display and input
- `src/level.ts`: Core game logic, world management, and game loops
- `src/entity.ts`: Base entity class with quadtree spatial indexing
- `src/components.ts`: ECS component definitions
- `src/systems/`: ECS systems for AI behaviors
- `src/entities/`: Entity classes (Dino, Player, Terrain types)

### Key Technologies

- **ROT.js**: Roguelike toolkit for display, pathfinding, noise generation
- **bitECS**: Entity Component System for AI behaviors
- **Quadtree**: Spatial partitioning for efficient collision detection
- **Vite**: Build tool and development server
- **TypeScript**: Type safety with strict configuration
- **Tailwind CSS**: Styling (minimal usage)

### Development Notes

- The game supports both desktop (keyboard) and mobile (touch) controls
- Debug mode can be enabled by setting `DEBUG` constant in `src/debug.ts`
- Terrain displacement system creates visual effects when dinosaurs move through grass/water
- Lava spreads using cellular automata with different spread rates for different terrain types
- Dinosaur AI uses A* pathfinding for pursuit behaviors
- The viewport system creates a "zoom in" effect at game start

## Claude Code Workflow

When working on this repository, follow the structured workflow documented in `.claude-code/workflow.md`:

1. **Before starting**: Update `.claude-code/claude_log.md` with INTERPRET section
2. **During work**: Log decisions in SELECT and REFINE sections  
3. **After implementation**: Document changes in IMPLEMENT section
4. **Before commit**: Use COMMIT section to generate git message

This ensures all Claude Code changes are well-documented and easily reviewable by the repository owner.