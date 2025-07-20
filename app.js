/** @typedef {import('pear-interface')} */ /* global Pear */
document.querySelector('h1').addEventListener('click', (e) => { e.target.innerHTML = '🍐' })

import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
// import process from 'bare-process'

const swarm = new Hyperswarm()
Pear.teardown(() => swarm.destroy())

// Keep track of all connections and console.log incoming data
const conns = []
swarm.on('connection', conn => {
  const name = b4a.toString(conn.remotePublicKey, 'hex')
  console.log('* got a connection from:', name, '*')
  conns.push(conn)
  conn.once('close', () => conns.splice(conns.indexOf(conn), 1))
  conn.on('data', data => console.log(`${name}: ${data}`))
  conn.on('error', e => console.log(`Connection error: ${e}`))
})

// // Broadcast stdin to all connections
// process.stdin.on('data', d => {
//   for (const conn of conns) {
//     conn.write(d)
//   }
// })

const topicName = "some-common-topic-name"
// Join a common topic
// const topic = Pear.config.args[0] ? b4a.from(Pear.config.args[0], 'hex') : crypto.randomBytes(32)

// Hash the topic name to get a consistent 32-byte value
const topic = crypto.hash(b4a.from(topicName, 'utf-8'))
const discovery = swarm.join(topic, { client: true, server: true })

// The flushed promise will resolve when the topic has been fully announced to the DHT
discovery.flushed().then(() => {
  console.log('joined topic:', b4a.toString(topic, 'hex'))
})
