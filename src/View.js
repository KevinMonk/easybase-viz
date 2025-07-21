export default class View {
  constructor(verbose = false) {
    this.VERBOSE_LOGGING = verbose
  }

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
        if (this.VERBOSE_LOGGING) console.log('Processing add writer command for:', value.add)
        // Add as both writer AND indexer
        await host.addWriter(Buffer.from(value.add, 'hex'), { indexer: true })
        if (this.VERBOSE_LOGGING) console.log('Writer and indexer added successfully:', value.add)
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