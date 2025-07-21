import * as d3 from 'd3'

export default class MessageGraph {
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