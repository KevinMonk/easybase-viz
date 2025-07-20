/** @typedef {import('pear-interface')} */ /* global Pear */
document.querySelector('h1').addEventListener('click', (e) => { e.target.innerHTML = '🍐' })

import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import Corestore from 'corestore'
import Autobase from 'autobase'

class View {
  open (store) {
    const core = store.get('view')
    return core
  }

  async apply (nodes, view, host) {
    for (const node of nodes) {
      const value = JSON.parse(node.value)

      if (value.add) {
        await host.addWriter(Buffer.from(value.add, 'hex'))
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

      await view.append(JSON.stringify({ echo: value }))
    }
  }

  close (view) {
    return view.close()
  }
}

// const swarm = new Hyperswarm()
Pear.teardown(() => swarm.destroy())

// // Keep track of all connections and console.log incoming data
// const conns = []
// swarm.on('connection', conn => {
//   const name = b4a.toString(conn.remotePublicKey, 'hex')
//   console.log('* got a connection from:', name, '*')
//   conns.push(conn)
//   conn.once('close', () => conns.splice(conns.indexOf(conn), 1))
//   conn.on('data', data => console.log(`${name}: ${data}`))
//   conn.on('error', e => console.log(`Connection error: ${e}`))
// })

// const topicName = "some-common-topic-name"

// Hash the topic name to get a consistent 32-byte value
// const topic = crypto.hash(b4a.from(topicName, 'utf-8'))
// const discovery = swarm.join(topic, { client: true, server: true })

// The flushed promise will resolve when the topic has been fully announced to the DHT
// discovery.flushed().then(() => {
//   console.log('joined topic:', b4a.toString(topic, 'hex'))
// })

let nameString
if (Pear.config.args[0]) {
  nameString = Pear.config.args[0]
  console.log('nameString:', nameString)
} else {
  console.log('no nameString provided')
  // exit out of the application
  process.exit(1)
}

const store = new Corestore('store/' + nameString)

const ns = await Autobase.getLocalKey(store)
const sharedBaseKeyName = 'shared-base-key-test'
const key = crypto.hash(b4a.from(sharedBaseKeyName, 'utf-8'))

const base = new Autobase(store.namespace(ns), key, new View())

await base.ready()
console.log('Base key', base.key.toString('hex'))
console.log('Local key', base.local.key.toString('hex'))

const swarm = new Hyperswarm({
  keyPair: base.local.keyPair
})

const conns = []
swarm.on('connection', (conn) => {
  const name = b4a.toString(conn.remotePublicKey, 'hex')
  console.log('* got a connection from:', name, '*')
  conns.push(conn)
  conn.once('close', () => conns.splice(conns.indexOf(conn), 1))
  // conn.on('data', data => console.log(`${name}: ${data}`))
  conn.on('error', e => console.log(`Connection error: ${e}`))
  base.replicate(conn)
})

const discovery = swarm.join(base.discoveryKey, { client: true, server: true })

discovery.flushed().then(() => {
  console.log('joined discovery:', b4a.toString(base.discoveryKey, 'hex'), 'with key', base.local.key.toString('hex'))
})

console.log('base.discoveryKey', base.discoveryKey.toString('hex'))
console.log('base.local.key', base.local.key.toString('hex'))

setInterval(async function () {
  console.log('base stats:',
    'length=', base.length,
    'indexed-length=', base.indexedLength,
    'signed-length=', base.signedLength,
    'members=', base._applyState.system.members, '(', base.linearizer.indexers.length, ')',
    'peers=', base.core.peers.length
  )
  const seq = base.view.length - 1
  if (seq < 0) return
  const last = await base.view.get(seq)
  console.log('last message (', seq, ') is', JSON.parse(last))
}, 2000)

if (base.writable) {
  await onwritable()
} else {
  console.log('waiting to become writable...')
  base.once('writable', onwritable)
}

async function onwritable () {
  console.log('we are writable!')

  if (args.flags.add) {
    await base.append(JSON.stringify({ add: args.flags.add }))
  }

  if (pace) {
    while (true) {
      for (let i = 0; i < n; i++) await append()
      await new Promise(resolve => setTimeout(resolve, pace))
    }
  }

  async function append () {
    if (Math.random() < 0.2) {
      const gets = []
      const len = Math.floor(Math.random() * 20)

      for (let i = 0; i < len; i++) {
        gets.push(Math.floor(Math.random() * base.view.length))
      }

      await base.append(JSON.stringify({ gets }))
      return
    }

    await base.append(JSON.stringify({ hello: 'world', time: Date.now(), from: name }))
  }
}
