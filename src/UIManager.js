export default class UIManager {
  constructor(userName) {
    this.userName = userName
    this.displayedMessages = new Set()
    this.messageGraph = null // Will be set externally
    
    // DOM elements
    this.statusEl = document.getElementById('connection-status')
    this.userNameEl = document.getElementById('user-name')
    this.peerCountEl = document.getElementById('peer-count')
    this.baseKeyEl = document.getElementById('base-key')
    this.messagesEl = document.getElementById('messages')
    this.messageInput = document.getElementById('message-input')
    this.sendButton = document.getElementById('send-button')
    
    this.userNameEl.textContent = userName
    this.statusEl.textContent = 'Connecting...'
    
    // Callback functions - will be set externally
    this.onSendMessage = null
  }
  
  setMessageGraph(messageGraph) {
    this.messageGraph = messageGraph
  }
  
  displayMessage(value, sequence = null) {
    // Create a unique key for deduplication
    const messageKey = `${value.from}-${value.time}-${value.message}`
    if (this.displayedMessages.has(messageKey)) {
      return // Already displayed
    }
    this.displayedMessages.add(messageKey)
    
    // Add to graph visualization if sequence is provided
    if (sequence !== null && this.messageGraph) {
      this.messageGraph.addMessage(value, sequence)
    }
    
    const messageEl = document.createElement('div')
    messageEl.className = 'message'

    if (value.from === this.userName) {
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

    this.messagesEl.appendChild(messageEl)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }
  
  updatePeerCount(count) {
    this.peerCountEl.textContent = `${count} peer${count !== 1 ? 's' : ''}`
  }
  
  updateBaseKey(baseKey) {
    this.baseKeyEl.textContent = `Key: ${baseKey}`
    this.baseKeyEl.title = 'Click to copy'
    
    // Add click to copy functionality
    this.baseKeyEl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(baseKey)
        // Provide visual feedback
        const originalText = this.baseKeyEl.textContent
        const originalTitle = this.baseKeyEl.title
        this.baseKeyEl.textContent = 'Copied!'
        this.baseKeyEl.title = 'Key copied to clipboard'
        
        setTimeout(() => {
          this.baseKeyEl.textContent = originalText
          this.baseKeyEl.title = originalTitle
        }, 1000)
      } catch (err) {
        console.error('Failed to copy to clipboard:', err)
        // Fallback - select the text
        const range = document.createRange()
        range.selectNodeContents(this.baseKeyEl)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      }
    })
  }
  
  setWritable(isWritable = true) {
    if (isWritable) {
      this.statusEl.textContent = 'Connected'
      this.messageInput.disabled = false
      this.sendButton.disabled = false
      this.setupMessageInput()
    } else {
      this.statusEl.textContent = 'Waiting for write access...'
      this.messageInput.disabled = true
      this.sendButton.disabled = true
    }
  }
  
  setupMessageInput() {
    // Send message function
    const sendMessage = async () => {
      const message = this.messageInput.value.trim()
      if (!message) return

      if (this.onSendMessage) {
        await this.onSendMessage({
          message,
          from: this.userName,
          time: Date.now()
        })
      }

      this.messageInput.value = ''
    }

    // Send on button click
    this.sendButton.addEventListener('click', sendMessage)

    // Send on Enter key
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendMessage()
      }
    })
  }
  
  addSystemMessage(messageData, sequence) {
    if (this.messageGraph) {
      if (messageData.add) {
        // Show add-writer operations in the graph
        this.messageGraph.addMessage({ add: messageData.add, from: 'system' }, sequence)
      } else {
        // Show other system operations
        this.messageGraph.addMessage({ system: true, from: 'system' }, sequence)
      }
    }
  }
  
  // Helper method to get DOM elements for external access if needed
  getElements() {
    return {
      status: this.statusEl,
      userName: this.userNameEl,
      peerCount: this.peerCountEl,
      baseKey: this.baseKeyEl,
      messages: this.messagesEl,
      messageInput: this.messageInput,
      sendButton: this.sendButton
    }
  }
}