# Truck SimScale Centring

A 3D interactive web application for simulating and visualizing truck positioning on weighing scales using sensor detection and visualization. Built with React, Three.js, and TypeScript.

## Overview

This tool allows users to:

- **Visualize truck dynamics** on a weigh scale in real-time 3D
- **Test sensor configurations** with different beam widths, heights, and tilt angles
- **Experiment with truck profiles** of various sizes (4-wheeled to 4-axle container trucks)
- **Simulate weight distribution** detection across sensors
- **Interact with the scene** using keyboard controls and mouse-based 3D navigation

## Features

### 3D Visualization

- Real-time 3D rendering using Three.js via React Three Fiber
- Interactive camera controls (OrbitControls) for scene navigation
- Grid background for spatial reference
- Lighting and shadows for depth perception

### Truck Profiles

Pre-configured truck dimensions:

- **Truk CDE (4 roda)** - 3m × 1.8m × 2.2m (compact 4-wheel)
- **Truk CDD (6 roda)** - 4.5m × 2.0m × 2.5m (medium 6-wheel)
- **Truk Fuso** - 7m × 2.4m × 2.8m (standard medium truck)
- **Truk Tronton (3 Sumbu)** - 9m × 2.5m × 3.0m (3-axle trailer)
- **Truk Trinton (4 Sumbu)** - 12m × 2.5m × 3.0m (4-axle trailer)
- **Truk Kontainer** - 16m × 2.5m × 4.0m (container truck)
- **Truk Gandeng** - 20m × 2.5m × 3.5m (tandem container)

### Sensor Configurations

- **JSN-SR04T** - Standard ultrasonic sensor (2.5m height, 50° beam width)
- **High 6m Tilted** - Long-range tilted sensor (6m height, 10° beam width, 25° tilt)
- Create custom sensor profiles with configurable:
  - Height
  - Beam width
  - Tilt angle
  - Position along truck

### Interactive Controls

- **Keyboard**: Arrow keys or WASD to move truck forward/backward
- **Mouse**: Drag to rotate camera, scroll to zoom
- **UI buttons**: On-screen controls for truck movement
- **Click selection**: Select road, scale, or other scene entities for info

### Data Persistence

- Custom truck profiles saved to browser localStorage
- Custom sensor profiles saved to browser localStorage
- Settings persisted across sessions

## Technology Stack

- **React 19** - UI framework
- **TypeScript 5.8** - Type safety
- **Three.js 0.184** - 3D graphics
- **React Three Fiber 9.6** - React renderer for Three.js
- **Zustand 5.0** - State management
- **Tailwind CSS 4.1** - Utility-first styling
- **Vite 6.2** - Build tool and dev server
- **Lucide React 0.546** - Icon library

## Project Structure

```
src/
├── App.tsx                 # Main application component
├── main.tsx               # Entry point
├── index.css              # Global styles
├── types.ts               # TypeScript type definitions
├── store.ts               # Zustand state management
└── components/
    ├── SceneEntities.tsx   # 3D scene elements (road, truck, scale, sensors)
    ├── Sidebar.tsx         # Control panel for configurations
    └── StatsPanel.tsx      # Real-time sensor statistics display
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Create .env file if you need environment-specific settings
touch .env
```

### Development

```bash
# Start development server
npm run dev

# Server runs at http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Utilities

```bash
# Type checking
npm run lint

# Clean build artifacts
npm run clean
```

## Usage

1. **Select a truck profile** or use the default Fuso truck
2. **Configure sensors** by choosing preset profiles or creating custom ones
3. **Move the truck** using keyboard arrow keys or on-screen buttons
4. **Observe sensor readings** in the stats panel to see detection patterns
5. **Rotate the view** by dragging the mouse to inspect from different angles
6. **Save custom profiles** (automatically saved to localStorage)

## Sensor Calculation Logic

The application performs advanced calculations to determine:

- **Beam footprint** on the truck based on sensor height, beam width, and tilt
- **Overlap percentage** between sensor beam and truck at current position
- **Distance readings** from sensors to truck surfaces
- **Z-axis coverage** of each sensor pair

This enables realistic simulation of how ultrasonic or optical sensors would detect truck presence and position.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Any modern browser supporting WebGL

## Performance

- Optimized for 60 FPS rendering
- Efficient state updates using Zustand selectors
- Memoized 3D components to prevent unnecessary re-renders
- GPU-accelerated 3D graphics via Three.js

## Contributing

1. Follow TypeScript strict mode practices
2. Use Tailwind CSS utilities for styling
3. Maintain component modularity
4. Add types for all props and state

## License

[Specify your license here]

## Future Enhancements

- [ ] Multiple truck lane simulation
- [ ] Weight distribution visualization
- [ ] Sensor data export/import
- [ ] Scenario recording and playback
- [ ] Performance metrics dashboard
- [ ] Real sensor device integration
- [ ] Mobile responsive view

## Support

For issues or questions, please open an issue or contact the development team.
