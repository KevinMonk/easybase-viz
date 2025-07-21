// Configuration constants for the easybase-viz application

export const CONFIG = {
  // Logging
  VERBOSE_LOGGING: false, // Toggle detailed console output
  
  // Timing
  MESSAGE_LOAD_DELAY: 1000, // Delay before loading existing messages (ms)
  WRITABILITY_CHECK_INTERVAL: 1000, // How often to check if base becomes writable (ms)
  STATS_INTERVAL: 2000, // Stats logging interval when verbose (ms)
  
  // Network
  KEY_EXCHANGE_DELAY: 500, // Delay before sending key exchange (ms)
  WRITER_ADD_DELAY: 1000, // Delay before adding peer as writer (ms)
  WRITABLE_CHECK_DELAY: 500, // Delay before checking writability after member-add (ms)
}

export const UI_CONFIG = {
  // Theme colors (matching CSS)
  BACKGROUND: '#1F2430',
  TEXT: '#CBCCC6',
  ACCENT: '#73D0FF',
  PRIMARY: '#4777B8',
  
  // Graph colors
  LINK_COLOR: '#4777B8',
  NODE_STROKE: '#CBCCC6',
  LABEL_COLOR: '#CBCCC6',
}

export const GRAPH_CONFIG = {
  // Node sizes
  MESSAGE_NODE_RADIUS: 8,
  SYSTEM_NODE_RADIUS: 12,
  
  // Animation
  TRANSITION_DURATION: 500,
  EXIT_DURATION: 300,
  
  // Layout
  MARGIN: 0.1, // Fraction of width/height for margins
  MIN_LAYOUT_SIZE: 10, // Minimum layout denominator
}

// Utility function to get CLI arguments
export function parseArgs() {
  const args = (typeof Pear !== 'undefined' && Pear.config?.args) || []
  
  return {
    name: args[0] || 'a',
    autobaseKey: args[1] || null,
    spam: 0, // Could be parsed from args if needed
    pace: 0  // Could be parsed from args if needed
  }
}

// Usage examples for CLI
export const USAGE_EXAMPLES = [
  'pear run . alice --swarm                    # Start alice with swarm',
  'pear run . bob --swarm --add=<writer-key>   # Start bob and add a writer',
  'pear run . alice --spam=10                  # Spam 10 messages per second'
]