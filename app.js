/** @typedef {import('pear-interface')} */ /* global Pear */
document.querySelector('h1').addEventListener('click', (e) => { e.target.innerHTML = '🍐' })

import Autobase from 'autobase'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

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

const swarm = new Hyperswarm({
  keyPair: base.local.keyPair
})
swarm.on('connection', c => base.replicate(c))
swarm.join(base.discoveryKey)

Pear.teardown(() => swarm.destroy())

console.log('Base key', base.key.toString('hex'))
console.log('Local key', base.local.key.toString('hex'))
console.log()

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

  // await base.append(JSON.stringify({ add: flags.add }))

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
