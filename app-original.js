/** @typedef {import('pear-interface')} */ /* global Pear */

import Autobase from 'autobase'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import * as d3 from 'd3'

class View {
  open (store) {
    const core = store.get('view')
    return core
  }

  async apply (nodes, view, host) {
    console.log('Apply called with nodes:', nodes.length)
    for (const node of nodes) {
      const value = JSON.parse(node.value)

      // DAG Entry Debug - show each operation in the MerkleDAG
      const writerKey = node.from?.key?.toString('hex') || 'unknown'
      const nodeIndex = node.length !== undefined ? node.length : 'unknown'
      const dependencies = node.heads ? node.heads.length : 0
      console.log(`DAG Entry - Writer: ${writerKey.slice(0,8)}... Index: ${nodeIndex} Dependencies: ${dependencies} Type: ${value?.message ? 'message' : value?.add ? 'add-writer' : value?.gets ? 'gets' : 'echo'}`)

      if (value.add) {
        if (VERBOSE_LOGGING) console.log('Processing add writer command for:', value.add)
        // Add as both writer AND indexer
        await host.addWriter(Buffer.from(value.add, 'hex'), { indexer: true })
        if (VERBOSE_LOGGING) console.log('Writer and indexer added successfully:', value.add)
      }

      if (value.gets) {
        const all = []
        for (const delta of value.gets) {
          const seq = view.length - delta
          if (seq < 0 || view.length <= seq) continue
          // console.log('waiting for a block', seq, view.length, view.signedLength)
          const val = JSON.parse(await view.get(seq))
          // console.log('got it!')
          all.push({ seq, value })
        }

        await view.append(JSON.stringify({ gets: all }))
      }

      // Store all messages in the view
      await view.append(JSON.stringify({ echo: value }))
    }
  }

  close (view) {
    return view.close()
  }
}

// Configuration
const VERBOSE_LOGGING = false // Toggle detailed console output

// Parse Pear desktop app arguments
// Usage examples:
//   pear run . alice --swarm                    # Start alice with swarm
//   pear run . bob --swarm --add=<writer-key>   # Start bob and add a writer
//   pear run . alice --spam=10                  # Spam 10 messages per second
// Flags are passed with --flag=value or --flag (for boolean)
const args = Pear.config.args || []

const name = args[0] || 'a'
let argAutobaseKey = args[1] || null
const spam = 0
const pace = 0
const n = Math.max(1, Math.ceil(spam / 100))

console.log('Pear config:', Pear.config)
console.log('Using name:', name)

// UI Elements
const statusEl = document.getElementById('connection-status')
const userNameEl = document.getElementById('user-name')
const peerCountEl = document.getElementById('peer-count')
const messagesEl = document.getElementById('messages')
const messageInput = document.getElementById('message-input')
const sendButton = document.getElementById('send-button')

userNameEl.textContent = name

// Initialize D3.js message graph visualization
class MessageGraph {
  constructor() {
    this.messages = []
    this.svg = d3.select('#dag-svg')
    this.width = 0
    this.height = 0
    this.simulation = null
    this.writerColors = new Map()
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10)
    
    this.initializeGraph()
    this.setupResize()
  }
  
  initializeGraph() {
    const container = document.getElementById('dag-viewer')
    this.width = container.clientWidth
    this.height = container.clientHeight
    
    this.svg
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('background', 'rgba(15, 18, 27, 0.8)')
    
    // Create groups for different elements
    this.linkGroup = this.svg.append('g').attr('class', 'links')
    this.nodeGroup = this.svg.append('g').attr('class', 'nodes')
    this.labelGroup = this.svg.append('g').attr('class', 'labels')
  }
  
  setupResize() {
    const resizeObserver = new ResizeObserver(() => {
      const container = document.getElementById('dag-viewer')
      this.width = container.clientWidth
      this.height = container.clientHeight
      this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`)
      this.updateLayout()
    })
    resizeObserver.observe(document.getElementById('dag-viewer'))
  }
  
  addMessage(messageData, sequence) {
    const writer = messageData.from || 'system'
    
    // Assign color to writer if not already assigned
    if (!this.writerColors.has(writer)) {
      this.writerColors.set(writer, this.colorScale(this.writerColors.size))
    }
    
    const message = {
      id: `msg-${sequence}`,
      sequence,
      writer,
      content: messageData.message || messageData.add || 'system',
      timestamp: messageData.time || Date.now(),
      type: messageData.message ? 'message' : messageData.add ? 'add-writer' : 'system',
      x: this.width * 0.1 + (sequence * (this.width * 0.8) / Math.max(10, this.messages.length + 1)),
      y: this.height * 0.5,
      color: this.writerColors.get(writer)
    }
    
    this.messages.push(message)
    this.updateVisualization()
  }
  
  updateVisualization() {
    if (this.messages.length === 0) return
    
    // Create links between consecutive messages
    const links = []
    for (let i = 1; i < this.messages.length; i++) {
      links.push({
        source: this.messages[i - 1],
        target: this.messages[i]
      })
    }
    
    // Update positions based on sequence and writer
    const writerLanes = new Map()
    let laneIndex = 0
    
    this.messages.forEach(msg => {
      if (!writerLanes.has(msg.writer)) {
        writerLanes.set(msg.writer, laneIndex++)
      }
      
      const lane = writerLanes.get(msg.writer)
      const laneHeight = this.height / Math.max(3, writerLanes.size + 1)
      
      msg.x = this.width * 0.1 + (msg.sequence * (this.width * 0.8) / Math.max(10, this.messages.length))
      msg.y = laneHeight * (lane + 1)
    })
    
    // Draw links
    const linkSelection = this.linkGroup
      .selectAll('.link')
      .data(links, d => `${d.source.id}-${d.target.id}`)
    
    linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .style('stroke', '#4777B8')
      .style('stroke-width', 2)
      .style('opacity', 0.6)
      .merge(linkSelection)
      .transition()
      .duration(500)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
    
    linkSelection.exit().remove()
    
    // Draw nodes
    const nodeSelection = this.nodeGroup
      .selectAll('.node')
      .data(this.messages, d => d.id)
    
    const nodeEnter = nodeSelection.enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', 0)
      .style('fill', d => d.color)
      .style('stroke', '#CBCCC6')
      .style('stroke-width', 2)
      .style('cursor', 'pointer')
    
    nodeEnter
      .append('title')
      .text(d => `${d.writer}: ${d.content} (${new Date(d.timestamp).toLocaleTimeString()})`)
    
    nodeEnter.merge(nodeSelection)
      .transition()
      .duration(500)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.type === 'add-writer' ? 12 : 8)
      .style('fill', d => d.color)
    
    nodeSelection.exit()
      .transition()
      .duration(300)
      .attr('r', 0)
      .remove()
    
    // Draw labels
    const labelSelection = this.labelGroup
      .selectAll('.label')
      .data(this.messages, d => d.id)
    
    const labelEnter = labelSelection.enter()
      .append('text')
      .attr('class', 'label')
      .style('fill', '#CBCCC6')
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .style('opacity', 0)
    
    labelEnter.merge(labelSelection)
      .text(d => d.sequence)
      .transition()
      .duration(500)
      .attr('x', d => d.x)
      .attr('y', d => d.y - 15)
      .style('opacity', 0.8)
    
    labelSelection.exit().remove()
    
    // Add writer legend
    this.updateLegend(writerLanes)
  }
  
  updateLegend(writerLanes) {
    const legend = this.svg.selectAll('.legend').data([...writerLanes.keys()])
    
    const legendEnter = legend.enter()
      .append('g')
      .attr('class', 'legend')
    
    legendEnter.append('circle')
      .attr('r', 6)
    
    legendEnter.append('text')
      .style('fill', '#CBCCC6')
      .style('font-size', '12px')
      .attr('dx', 15)
      .attr('dy', 4)
    
    legend.merge(legendEnter)
      .attr('transform', (d, i) => `translate(20, ${30 + i * 25})`)
      .select('circle')
      .style('fill', d => this.writerColors.get(d))
    
    legend.merge(legendEnter)
      .select('text')
      .text(d => d)
    
    legend.exit().remove()
  }
  
  updateLayout() {
    if (this.messages.length > 0) {
      this.updateVisualization()
    }
  }
}

const messageGraph = new MessageGraph()

const store = new Corestore('store/' + name)
const localKey = await Autobase.getLocalKey(store)

let autobaseKey = argAutobaseKey
// if you are alice then we will create the first Autobase key based on your name
if (argAutobaseKey) {
  autobaseKey = b4a.from(argAutobaseKey, 'hex')
  console.log("You provided an autobase key, so we will use it:", b4a.toString(autobaseKey, 'hex'))
} else {
  // there is no key provided, so we will bootstrap autobase
  // then you are the first writer and you create the key
  console.log("You didn't provide a key, so we bootstrapped autobase for:", name)
  console.log("This is your Autobase key:", b4a.toString(localKey, 'hex'))
  autobaseKey = localKey
}

const base = new Autobase(store.namespace(localKey), autobaseKey, new View())

await base.ready()

// Listen for member events
base.on('member-add', (key) => {
  if (VERBOSE_LOGGING) console.log('Member added event:', key.toString('hex'))
  // Check if this is us becoming writable
  if (key.equals(base.local.key)) {
    if (VERBOSE_LOGGING) console.log('We just became a writer!')
    // Give it a moment then check writability
    setTimeout(() => {
      if (base.writable && !writableHandled) {
        if (VERBOSE_LOGGING) console.log('Becoming writable after member-add event!')
        onwritable()
      }
    }, 500)
  }
})

// Track connected peers
let connectedPeers = 0
const displayedMessages = new Set()

// Function to display a message in the UI
function displayMessage(value, sequence = null) {
  // Create a unique key for deduplication
  const messageKey = `${value.from}-${value.time}-${value.message}`
  if (displayedMessages.has(messageKey)) {
    return // Already displayed
  }
  displayedMessages.add(messageKey)
  
  // Add to graph visualization if sequence is provided
  if (sequence !== null) {
    messageGraph.addMessage(value, sequence)
  }
  const messageEl = document.createElement('div')
  messageEl.className = 'message'

  if (value.from === name) {
    messageEl.classList.add('own')
  }

  const authorEl = document.createElement('div')
  authorEl.className = 'message-author'
  authorEl.textContent = value.from || 'Unknown'

  const timeEl = document.createElement('span')
  timeEl.className = 'message-time'
  timeEl.textContent = new Date(value.time).toLocaleTimeString()

  const contentEl = document.createElement('div')
  contentEl.textContent = value.message

  authorEl.appendChild(timeEl)
  messageEl.appendChild(authorEl)
  messageEl.appendChild(contentEl)

  messagesEl.appendChild(messageEl)
  messagesEl.scrollTop = messagesEl.scrollHeight
}

// Load existing messages
async function loadExistingMessages() {
  console.log('Loading existing messages, view length:', base.view.length)
  const merkletree = await base.view.treeHash()
  console.log('Merkle tree:', merkletree)
  // debugger
  if (VERBOSE_LOGGING) console.log('Loading existing messages, view length:', base.view.length)
  for (let i = 0; i < base.view.length; i++) {
    try {
      const data = await base.view.get(i)
      const value = JSON.parse(data)

      if (value.echo && value.echo.message) {
        displayMessage(value.echo, i)
      } else if (value.echo && value.echo.add) {
        // Show add-writer operations in the graph
        messageGraph.addMessage({ add: value.echo.add, from: 'system' }, i)
      } else {
        // Show other system operations
        messageGraph.addMessage({ system: true, from: 'system' }, i)
      }
    } catch (err) {
      console.error('Error reading message at', i, ':', err)
    }
  }
}

// Load existing messages after a short delay to ensure view is ready
setTimeout(loadExistingMessages, 1000)

// Listen for new messages from the view
base.view.on('append', async () => {
  const seq = base.view.length - 1
  if (seq < 0) return

  try {
    const data = await base.view.get(seq)
    const value = JSON.parse(data)

    if (value.echo && value.echo.message) {
      displayMessage(value.echo, seq)
    } else if (value.echo && value.echo.add) {
      // Show add-writer operations in the graph
      messageGraph.addMessage({ add: value.echo.add, from: 'system' }, seq)
    } else {
      // Show other system operations
      messageGraph.addMessage({ system: true, from: 'system' }, seq)
    }
  } catch (err) {
    console.error('Error reading message:', err)
  }
})

const swarm = new Hyperswarm({
  keyPair: base.local.keyPair
})
swarm.on('connection', c => {
  base.replicate(c)
  connectedPeers++
  peerCountEl.textContent = `${connectedPeers} peer${connectedPeers !== 1 ? 's' : ''}`

  console.log('New peer connected (swarm key):', c.remotePublicKey.toString('hex'))

  // Listen for the peer's autobase key exchange
  c.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString())
      if (message.type === 'exchange-key' && message.localKey) {
        const peerAutobaseKey = message.localKey
        if (VERBOSE_LOGGING) console.log('Received peer autobase key:', peerAutobaseKey)

        // Only add if we're writable and peer isn't already a writer
        if (base.writable) {
          setTimeout(async () => {
            const currentWriters = base.linearizer.indexers.map(w => {
              if (!w) return null
              if (w.key) return w.key.toString('hex')
              if (w.core && w.core.key) return w.core.key.toString('hex')
              return null
            }).filter(Boolean)

            if (VERBOSE_LOGGING) console.log('Current writers:', currentWriters.map(k => k.slice(0, 8) + '...'))

            if (!currentWriters.includes(peerAutobaseKey)) {
              if (VERBOSE_LOGGING) console.log('Auto-adding peer autobase key as writer:', peerAutobaseKey)
              try {
                await base.append(JSON.stringify({ add: peerAutobaseKey }))
                if (VERBOSE_LOGGING) console.log('Successfully sent add writer command for:', peerAutobaseKey)
              } catch (err) {
                console.error('Failed to add writer:', err)
              }
            } else {
              if (VERBOSE_LOGGING) console.log('Peer already a writer:', peerAutobaseKey)
            }
          }, 1000)
        }
      }
    } catch (err) {
      // Not a JSON message, ignore
    }
  })

  // Send our autobase key to the peer
  setTimeout(() => {
    const keyExchange = JSON.stringify({
      type: 'exchange-key',
      localKey: base.local.key.toString('hex')
    })
    c.write(keyExchange)
    if (VERBOSE_LOGGING) console.log('Sent our autobase key to peer')
  }, 500)

  c.on('close', () => {
    connectedPeers--
    peerCountEl.textContent = `${connectedPeers} peer${connectedPeers !== 1 ? 's' : ''}`
  })
})
swarm.join(base.discoveryKey)

if (VERBOSE_LOGGING) console.log('Joining swarm with discovery key:', base.discoveryKey.toString('hex'))

Pear.teardown(() => swarm.destroy())

console.log('Base key', base.key.toString('hex'))
console.log('Local key', base.local.key.toString('hex'))
console.log('Is writable:', base.writable)
console.log()

// Show stats periodically when verbose logging is enabled
if (VERBOSE_LOGGING) {
  setInterval(async function () {
    console.log('base stats:',
      'length=', base.length,
      'indexed-length=', base.indexedLength,
      'signed-length=', base.signedLength,
      'members=', base._applyState.system.members, '(', base.linearizer.indexers.length, ')',
      'peers=', base.core.peers.length,
      'writable=', base.writable
    )

    // Show current writers with more detail
    console.log('Writers:', base.linearizer.indexers.map(w => {
      if (!w) return 'null'
      if (w.key) return w.key.toString('hex').slice(0, 8) + '...'
      if (w.core && w.core.key) return w.core.key.toString('hex').slice(0, 8) + '...'
      return 'unknown structure'
    }))

    // Also check system members
    if (base._applyState && base._applyState.system && base._applyState.system.members > base.linearizer.indexers.length) {
      console.log('Note: System shows', base._applyState.system.members, 'members but only', base.linearizer.indexers.length, 'indexers')
    }

    const seq = base.view.length - 1
    if (seq < 0) return
    const last = await base.view.get(seq)
    console.log('last message (', seq, ') is', JSON.parse(last))
  }, 2000)
}

// Define the onwritable function before using it
let writableHandled = false
async function onwritable () {
  if (writableHandled) return
  writableHandled = true

  if (VERBOSE_LOGGING) console.log('we are writable!')
  statusEl.textContent = 'Connected'
  messageInput.disabled = false
  sendButton.disabled = false

  // Send message function
  async function sendMessage() {
    const message = messageInput.value.trim()
    if (!message) return

    await base.append(JSON.stringify({
      message,
      from: name,
      time: Date.now()
    }))

    messageInput.value = ''
    // Don't display here - let the view append handler do it
  }

  // Send on button click
  sendButton.addEventListener('click', sendMessage)

  // Send on Enter key
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  })

}

// Check writability after defining the function
if (base.writable) {
  await onwritable()
} else {
  if (VERBOSE_LOGGING) console.log('waiting to become writable...')
  statusEl.textContent = 'Waiting for write access...'
  base.once('writable', onwritable)

  // Also check periodically in case the event is missed
  const checkWritable = setInterval(async () => {
    if (base.writable) {
      if (VERBOSE_LOGGING) console.log('Became writable!')
      clearInterval(checkWritable)
      onwritable()
    } else {
      // Check if we're in the members list
      try {
        const members = base._applyState.system.members
        const indexers = base.linearizer.indexers.length
        if (VERBOSE_LOGGING) console.log(`Still not writable. Members: ${members}, Indexers: ${indexers}`)

        // Force a check by updating base state
        await base.update()

        // Also try updating the linearizer directly
        if (base.linearizer && base.linearizer.update) {
          try {
            await base.linearizer.update()
          } catch (err) {
            // Expected to sometimes fail
          }
        }
      } catch (err) {
        console.log('Error checking writable state:', err.message)
      }
    }
  }, 1000)
}
