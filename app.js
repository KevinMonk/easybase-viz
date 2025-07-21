/** @typedef {import('pear-interface')} */ /* global Pear */

import Autobase from 'autobase'
import Corestore from 'corestore'
import b4a from 'b4a'

import View from './src/View.js'
import MessageGraph from './src/MessageGraph.js'
import NetworkManager from './src/NetworkManager.js'
import UIManager from './src/UIManager.js'
import { CONFIG, parseArgs } from './src/config.js'

class EasybaseVizApp {
  constructor() {
    this.args = parseArgs()
    this.base = null
    this.networkManager = null
    this.uiManager = null
    this.messageGraph = null
    this.writableHandled = false
    
    this.init()
  }
  
  async init() {
    console.log('Pear config:', typeof Pear !== 'undefined' ? Pear.config : 'Not in Pear environment')
    console.log('Using name:', this.args.name)
    
    // Initialize UI
    this.uiManager = new UIManager(this.args.name)
    this.uiManager.onSendMessage = this.sendMessage.bind(this)
    
    // Initialize message graph
    this.messageGraph = new MessageGraph()
    this.uiManager.setMessageGraph(this.messageGraph)
    
    // Initialize Autobase
    await this.setupAutobase()
    
    // Initialize networking
    this.setupNetworking()
    
    // Setup Pear teardown if available
    if (typeof Pear !== 'undefined') {
      Pear.teardown(() => this.networkManager.destroy())
    }
    
    // Start the application
    await this.start()
  }
  
  async setupAutobase() {
    const store = new Corestore('store/' + this.args.name)
    const localKey = await Autobase.getLocalKey(store)

    let autobaseKey = this.args.autobaseKey
    if (this.args.autobaseKey) {
      autobaseKey = b4a.from(this.args.autobaseKey, 'hex')
      console.log("You provided an autobase key, so we will use it:", b4a.toString(autobaseKey, 'hex'))
    } else {
      console.log("You didn't provide a key, so we bootstrapped autobase for:", this.args.name)
      console.log("This is your Autobase key:", b4a.toString(localKey, 'hex'))
      autobaseKey = localKey
    }

    this.base = new Autobase(
      store.namespace(localKey), 
      autobaseKey, 
      new View(CONFIG.VERBOSE_LOGGING)
    )

    await this.base.ready()
    
    console.log('Base key', this.base.key.toString('hex'))
    console.log('Local key', this.base.local.key.toString('hex'))
    console.log('Is writable:', this.base.writable)
  }
  
  setupNetworking() {
    this.networkManager = new NetworkManager(this.base, {
      verbose: CONFIG.VERBOSE_LOGGING,
      onPeerCountChange: (count) => this.uiManager.updatePeerCount(count)
    })
  }
  
  async start() {
    // Setup base event handlers
    this.base.on('member-add', (key) => this.handleMemberAdd(key))
    this.base.view.on('append', () => this.handleViewAppend())
    
    // Join network
    this.networkManager.join()
    
    // Check initial writability
    if (this.base.writable) {
      await this.handleWritable()
    } else {
      this.base.once('writable', () => this.handleWritable())
      this.startWritabilityPolling()
    }
    
    // Load existing messages
    setTimeout(() => this.loadExistingMessages(), CONFIG.MESSAGE_LOAD_DELAY)
    
    // Start stats logging if verbose
    if (CONFIG.VERBOSE_LOGGING) {
      this.startStatsLogging()
    }
  }
  
  handleMemberAdd(key) {
    if (CONFIG.VERBOSE_LOGGING) {
      console.log('Member added event:', key.toString('hex'))
    }
    
    // Check if this is us becoming writable
    if (key.equals(this.base.local.key)) {
      if (CONFIG.VERBOSE_LOGGING) console.log('We just became a writer!')
      setTimeout(() => {
        if (this.base.writable && !this.writableHandled) {
          if (CONFIG.VERBOSE_LOGGING) {
            console.log('Becoming writable after member-add event!')
          }
          this.handleWritable()
        }
      }, CONFIG.WRITABLE_CHECK_DELAY)
    }
  }
  
  async handleViewAppend() {
    const seq = this.base.view.length - 1
    if (seq < 0) return

    try {
      const data = await this.base.view.get(seq)
      const value = JSON.parse(data)

      if (value.echo && value.echo.message) {
        this.uiManager.displayMessage(value.echo, seq)
      } else if (value.echo && value.echo.add) {
        this.uiManager.addSystemMessage({ add: value.echo.add }, seq)
      } else {
        this.uiManager.addSystemMessage({ system: true }, seq)
      }
    } catch (err) {
      console.error('Error reading message:', err)
    }
  }
  
  async handleWritable() {
    if (this.writableHandled) return
    this.writableHandled = true

    if (CONFIG.VERBOSE_LOGGING) console.log('we are writable!')
    this.uiManager.setWritable(true)
  }
  
  async sendMessage(messageData) {
    await this.base.append(JSON.stringify(messageData))
  }
  
  async loadExistingMessages() {
    console.log('Loading existing messages, view length:', this.base.view.length)
    const merkletree = await this.base.view.treeHash()
    console.log('Merkle tree:', merkletree)
    
    if (CONFIG.VERBOSE_LOGGING) {
      console.log('Loading existing messages, view length:', this.base.view.length)
    }
    
    for (let i = 0; i < this.base.view.length; i++) {
      try {
        const data = await this.base.view.get(i)
        const value = JSON.parse(data)

        if (value.echo && value.echo.message) {
          this.uiManager.displayMessage(value.echo, i)
        } else if (value.echo && value.echo.add) {
          this.uiManager.addSystemMessage({ add: value.echo.add }, i)
        } else {
          this.uiManager.addSystemMessage({ system: true }, i)
        }
      } catch (err) {
        console.error('Error reading message at', i, ':', err)
      }
    }
  }
  
  startWritabilityPolling() {
    const checkWritable = setInterval(async () => {
      if (this.base.writable) {
        if (CONFIG.VERBOSE_LOGGING) console.log('Became writable!')
        clearInterval(checkWritable)
        this.handleWritable()
      } else {
        try {
          const members = this.base._applyState.system.members
          const indexers = this.base.linearizer.indexers.length
          if (CONFIG.VERBOSE_LOGGING) {
            console.log(`Still not writable. Members: ${members}, Indexers: ${indexers}`)
          }

          await this.base.update()

          if (this.base.linearizer && this.base.linearizer.update) {
            try {
              await this.base.linearizer.update()
            } catch (err) {
              // Expected to sometimes fail
            }
          }
        } catch (err) {
          console.log('Error checking writable state:', err.message)
        }
      }
    }, CONFIG.WRITABILITY_CHECK_INTERVAL)
  }
  
  startStatsLogging() {
    setInterval(async () => {
      console.log('base stats:',
        'length=', this.base.length,
        'indexed-length=', this.base.indexedLength,
        'signed-length=', this.base.signedLength,
        'members=', this.base._applyState.system.members, '(', this.base.linearizer.indexers.length, ')',
        'peers=', this.base.core.peers.length,
        'writable=', this.base.writable
      )

      const networkStats = this.networkManager.getStats()
      console.log('Writers:', networkStats.writers.map(k => k.slice(0, 8) + '...'))

      if (this.base._applyState && this.base._applyState.system && 
          this.base._applyState.system.members > this.base.linearizer.indexers.length) {
        console.log('Note: System shows', this.base._applyState.system.members, 
                   'members but only', this.base.linearizer.indexers.length, 'indexers')
      }

      const seq = this.base.view.length - 1
      if (seq >= 0) {
        const last = await this.base.view.get(seq)
        console.log('last message (', seq, ') is', JSON.parse(last))
      }
    }, CONFIG.STATS_INTERVAL)
  }
}

// Start the application
const app = new EasybaseVizApp()