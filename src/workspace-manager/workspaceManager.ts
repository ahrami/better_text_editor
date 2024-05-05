import { Folder, Page } from "@src/database/model"
import { PubSub } from "@src/pubSub"

export class WorkspaceManager {

  pubSub = PubSub.getInstance()

  queue: (() => Promise<void> | void)[] = []
  executing = false

  constructor() {
    this.pubSub.subscribe("change-page-folder", async (child: number, parent: number | null) => {
      const res = await window.invoke("db:changePageFolder", child, parent)
      if (res.status) this.pubSub.emit("page-moved", child)
      //else console.error(res.value)
    })

    this.pubSub.subscribe("change-folder-folder", async (child: number, parent: number | null) => {
      const res = await window.invoke("db:changeFolderFolder", child, parent)
      if (res.status) this.pubSub.emit("folder-moved", child)
      //else console.error(res.value)
    })
    this.addToQueue(this.init)
  }

  async init() {

  }

  addToQueue(foo: typeof this.queue[number]) {
    this.queue.unshift(foo)
    this.executeQueue()
  }

  async executeQueue() {
    if (this.executing) return
    while (true) {
      const foo = this.queue.pop()
      if (!foo) break
      await foo()
    }
    this.executing = false
  }
}