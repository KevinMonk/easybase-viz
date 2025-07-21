import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

export default class NetworkManager {
  constructor(base, options = {}) {
    this.base = base
    this.verbose = options.verbose || false
    this.connectedPeers = 0
    this.onPeerCountChange = options.onPeerCountChange || (() => {})
    
    this.swarm = new Hyperswarm({
      keyPair: base.local.keyPair
    })
    
    this.setupSwarmHandlers()
  }
  
  setupSwarmHandlers() {
    this.swarm.on('connection', (connection) => {
      this.handleNewConnection(connection)
    })
  }
  
  handleNewConnection(c) {
    this.base.replicate(c)
    this.connectedPeers++
    this.onPeerCountChange(this.connectedPeers)

    console.log('New peer connected (swarm key):', c.remotePublicKey.toString('hex'))

    // Listen for the peer's autobase key exchange
    c.on('data', (data) => {
      this.handlePeerMessage(data, c)
    })

    // Send our autobase key to the peer
    setTimeout(() => {
      this.sendKeyExchange(c)
    }, 500)

    c.on('close', () => {
      this.connectedPeers--
      this.onPeerCountChange(this.connectedPeers)
    })
  }
  
  handlePeerMessage(data, connection) {
    try {
      const message = JSON.parse(data.toString())
      if (message.type === 'exchange-key' && message.localKey) {
        this.handleKeyExchange(message.localKey)
      }
    } catch (err) {
      // Not a JSON message, ignore
    }
  }
  
  async handleKeyExchange(peerAutobaseKey) {
    if (this.verbose) console.log('Received peer autobase key:', peerAutobaseKey)

    // Only add if we're writable and peer isn't already a writer
    if (this.base.writable) {
      setTimeout(async () => {
        const currentWriters = this.getCurrentWriters()

        if (this.verbose) {
          console.log('Current writers:', currentWriters.map(k => k.slice(0, 8) + '...'))
        }

        if (!currentWriters.includes(peerAutobaseKey)) {
          if (this.verbose) {
            console.log('Auto-adding peer autobase key as writer:', peerAutobaseKey)
          }
          try {
            await this.base.append(JSON.stringify({ add: peerAutobaseKey }))
            if (this.verbose) {
              console.log('Successfully sent add writer command for:', peerAutobaseKey)
            }
          } catch (err) {
            console.error('Failed to add writer:', err)
          }
        } else {
          if (this.verbose) console.log('Peer already a writer:', peerAutobaseKey)
        }
      }, 1000)
    }
  }
  
  getCurrentWriters() {
    return this.base.linearizer.indexers.map(w => {
      if (!w) return null
      if (w.key) return w.key.toString('hex')
      if (w.core && w.core.key) return w.core.key.toString('hex')
      return null
    }).filter(Boolean)
  }
  
  sendKeyExchange(connection) {
    const keyExchange = JSON.stringify({
      type: 'exchange-key',
      localKey: this.base.local.key.toString('hex')
    })
    connection.write(keyExchange)
    if (this.verbose) console.log('Sent our autobase key to peer')
  }
  
  join() {
    this.swarm.join(this.base.discoveryKey)
    if (this.verbose) {
      console.log('Joining swarm with discovery key:', this.base.discoveryKey.toString('hex'))
    }
  }
  
  destroy() {
    return this.swarm.destroy()
  }
  
  getStats() {
    return {
      connectedPeers: this.connectedPeers,
      discoveryKey: this.base.discoveryKey.toString('hex'),
      writers: this.getCurrentWriters()
    }
  }
}