# Easybase-Viz Simple Example

A Pear desktop application that visualizes Autobase MerkleDAG operations in real-time, featuring a chat interface and subway map-style visualization of P2P data structures.

## Overview

This application demonstrates how to visualize the underlying MerkleDAG operations in Autobase (part of the hypercore ecosystem) by creating a multi-instance chat application where each message operation is tracked and displayed as a subway map visualization.

### Key Features

- **Real-time P2P Chat**: Multi-user chat using Autobase for distributed consensus
- **MerkleDAG Visualization**: Live subway map-style visualization of Autobase operations
- **Multi-Writer Support**: Each instance can be a writer with color-coded visualization lanes
- **Cross-Instance Synchronization**: Operations from different instances visible in real-time
- **Pear Integration**: Native desktop application with proper window controls

## Architecture

### Technology Stack
- **Runtime**: [Pear](https://pears.com/) - P2P desktop application platform
- **P2P Database**: [Autobase](https://github.com/holepunchto/autobase) - Multi-writer database built on hypercore
- **Storage**: [Corestore](https://github.com/holepunchto/corestore) - Hypercore storage management
- **Networking**: [Hyperswarm](https://github.com/holepunchto/hyperswarm) - P2P networking
- **Visualization**: [D3.js](https://d3js.org/) - Data-driven document visualization
- **UI**: Native HTML/CSS/JS with Pear-specific components

### Key Components
- `app.js` - Main application logic and Autobase setup
- `src/View.js` - Custom Autobase view for intercepting DAG operations
- `src/MessageGraph.js` - D3.js subway map visualization
- `src/NetworkManager.js` - P2P networking and swarm management
- `src/UIManager.js` - Chat interface and UI state management
- `src/config.js` - Application configuration and command-line parsing

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [Pear](https://pears.com/) - Install from the official website

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd easybase-viz
```

2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
pear run --dev . [name] [optional-autobase-key]
```

This starts the application in development mode using Pear's runtime.

## Usage

### Starting a New Instance

Run with a custom name:
```bash
pear run --dev . alice
```

### Joining an Existing Autobase

To join an existing autobase network, use the autobase key from another instance:
```bash
pear run --dev . bob 617c0c99e32b08f7dd8ef5df1e4084b811281896386e1a840c6aa825b4788d4b
```

The autobase key is displayed in the console when the first instance starts.

### Multi-Instance Demo

1. Start the first instance:
```bash
pear run --dev . alice
```
Look in the console for output like "This is your Autobase key: 617c0c99e32b08f7dd8ef5df1e4084b811281896386e1a840c6aa825b4788d4b"

2. Start additional instances with the same autobase key:
```bash
pear run --dev . bob 617c0c99e32b08f7dd8ef5df1e4084b811281896386e1a840c6aa825b4788d4b
pear run --dev . charlie 617c0c99e32b08f7dd8ef5df1e4084b811281896386e1a840c6aa825b4788d4b
```

3. Send messages in any instance and observe:
   - Messages appear in all connected instances
   - DAG visualization shows operations as colored subway lines
   - Each writer gets their own color-coded lane

## Visualization

### Subway Map Concept

The MerkleDAG visualization uses a subway map metaphor where:
- **Lines**: Each writer has their own colored track/line
- **Stations**: Individual operations/messages are stations on the lines
- **Intersections**: Dependencies and merges show where lines connect
- **Time Flow**: Operations flow chronologically from left to right

### Real-time Updates

The visualization updates in real-time as:
- New messages are sent
- Writers join or leave the network
- Consensus operations occur in the background

## Development

### Configuration

Key settings can be modified in `src/config.js`:
- `VERBOSE_LOGGING`: Enable detailed console output
- `MESSAGE_LOAD_DELAY`: Delay before loading existing messages
- `STATS_INTERVAL`: Interval for logging network statistics

### Testing

Run the test suite:
```bash
npm test
```

Tests use the [Brittle](https://github.com/holepunchto/brittle) testing framework.

### Debugging

Enable verbose logging by modifying the `VERBOSE_LOGGING` setting in `src/config.js` and then run:
```bash
pear run --dev . debug
```

## Technical Implementation

### MerkleDAG Interception

The application intercepts Autobase operations through a custom View class that wraps the standard Autobase view and captures all `apply` operations, which are the perfect interception point for MerkleDAG visualization.

### P2P Networking

Uses Hyperswarm for peer discovery and connection management, with automatic reconnection and peer counting.

### Data Flow

1. User sends message via chat interface
2. Message appended to local Autobase
3. Autobase consensus distributes to all writers
4. Custom View intercepts the operation
5. MessageGraph visualization updates in real-time
6. All connected instances see the update

## Troubleshooting

### Common Issues

**"Not writable" state**:
- Ensure all instances use the same autobase key
- Check network connectivity
- Wait for consensus to establish (can take 10-30 seconds)

**Messages not appearing**:
- Verify autobase key is correct
- Check firewall/network settings
- Enable verbose logging to see detailed status

**Visualization not updating**:
- Check browser console for D3.js errors
- Ensure SVG container is properly sized
- Verify MessageGraph is receiving data

### Logs

Enable verbose logging to see detailed information about:
- Autobase operations and consensus
- Network connections and peer discovery
- Message processing and validation
- DAG structure and operations

## Contributing

This is an experimental visualization tool for the hypercore ecosystem. Contributions welcome for:
- Enhanced subway map visualizations
- Performance optimizations
- Additional Autobase operation tracking
- UI/UX improvements

## License

Apache-2.0
