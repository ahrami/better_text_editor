import { Folder, Page } from "@src/database/model"
import { PubSub } from "@src/pubSub"

export type StructurePage = {
  id: number
}

export type StructureFolder = {
  id: number
  content: Array<StructurePage | StructureFolder>
}

export type StructureHierarchy = Array<StructurePage | StructureFolder>

export interface IWorkspaceStructure {
  getPageMap(): Map<number, Page>
  getFolderMap(): Map<number, Folder>
  getPageIDs(): number[]
  getPageIDsSorted(): number[]
  getStructure(): StructureHierarchy
}

export class WorkspaceStructure implements IWorkspaceStructure {

  pages = new Map<number, Page>()
  pages_trash = new Map<number, Page>()
  folders = new Map<number, Folder>()

  structure: StructureHierarchy = []

  pubSub = PubSub.getInstance()

  queue: (() => Promise<void> | void)[] = []
  executing = false
  recalculate = false

  constructor() {
    this.addToQueue(this.init)

    this.pubSub.subscribe("page-saved", (id: number) => {
      this.addToQueue(async () => {
        await this.pageSaved(id)
      })
    })

    this.pubSub.subscribe("page-moved", (id: number) => {
      this.addToQueue(async () => {
        await this.pageMoved(id)
      })
    })

    this.pubSub.subscribe("page-trashed", (id: number) => {
      this.addToQueue(async () => {
        await this.pageTrashed(id)
      })
    })

    this.pubSub.subscribe("page-restored", (id: number) => {
      this.addToQueue(async () => {
        await this.pageRestored(id)
      })
    })

    this.pubSub.subscribe("page-deleted", (id: number) => {
      this.addToQueue(async () => {
        await this.pageDeleted(id)
      })
    })

    this.pubSub.subscribe("folder-created", (id: number) => {
      this.addToQueue(async () => {
        await this.folderCreated(id)
      })
    })

    this.pubSub.subscribe("folder-saved", (id: number) => {
      this.addToQueue(async () => {
        await this.folderSaved(id)
      })
    })

    this.pubSub.subscribe("folder-deleted", (id: number) => {
      this.addToQueue(async () => {
        await this.folderDeleted(id)
      })
    })

    this.pubSub.subscribe("folder-moved", (id: number) => {
      this.addToQueue(async () => {
        await this.folderMoved(id)
      })
    })

    this.pubSub.subscribe("workspace-structure-update", (id: number) => {
      this.addToQueue(async () => {
        await this.update()
      })
    })
  }

  private async init() {
    const pages = await window.invoke("db:getAllPages", false)
    const folders = await window.invoke("db:getAllFolders")

    if (!pages.status) return
    if (!folders.status) return

    pages.value.forEach(page => {
      this.pages.set(page.id, page)
    })
    folders.value.forEach(folder => {
      this.folders.set(folder.id, folder)
    })

    this.recalculateStructure(false)

    this.pubSub.emit("workspace-structure-init-end", this.structure)
  }

  private async update() {
    const pages = await window.invoke("db:getAllPages", false)
    const folders = await window.invoke("db:getAllFolders")

    if (!pages.status) return
    if (!folders.status) return

    this.pages.clear()
    this.folders.clear()

    pages.value.forEach(page => {
      this.pages.set(page.id, page)
    })
    folders.value.forEach(folder => {
      this.folders.set(folder.id, folder)
    })

    this.recalculateStructure(true)
  }

  private addToQueue(foo: typeof this.queue[number]) {
    this.queue.unshift(foo)
    this.executeQueue()
  }

  private async executeQueue() {
    if (this.executing) return
    while (true) {
      const foo = this.queue.pop()
      if (!foo) break
      await foo.call(this)
    }
    if (this.recalculate) {
      this.recalculateStructure(true)
      this.recalculate = false
    }
    this.executing = false
  }

  private calculateContent(folderid: number | null) {
    const str: StructureHierarchy = []
    this.pages.forEach(page => {
      if (page.folder == folderid) str.push({ 
        id: page.id 
      })
    })
    this.folders.forEach(folder => {
      if (folder.folder == folderid) str.push({ 
        id: folder.id, 
        content: this.calculateContent(folder.id) 
      })
    })
    str.sort((a, b) => {
      const names: Array<string | null> = [null, null]
      if ("content" in a) {
        names[0] = this.folders.get(a.id)?.name || null
      } else {
        names[0] = this.pages.get(a.id)?.title || null
      }
      if ("content" in b) {
        names[1] = this.folders.get(b.id)?.name || null
      } else {
        names[1] = this.pages.get(b.id)?.title || null
      }
      if (names[0] !== null && names[1] !== null) {
        if (names[0] < names[1]) return -1
        if (names[0] > names[1]) return 1
        return 0
      } else {
        if (names[0] !== null) return -1
        if (names[1] !== null) return 1
        return 0
      }
    })
    return str
  }

  private recalculateStructure(emit: boolean) {
    this.structure = this.calculateContent(null)
    if(emit) this.pubSub.emit("workspace-structure-changed", this.structure)
  }

  private async pageSaved(id: number) {
    const page = await window.invoke("db:getPage", id)
    if (!page.status) return
    if (page.value) this.pages.set(id, page.value)
    else this.pages.delete(id)
    this.pubSub.emit("workspace-pages-changed")
    this.recalculate = true
  }

  private async pageMoved(id: number) {
    const page = await window.invoke("db:getPage", id)
    if (!page.status) throw "Page not found, could not update structure"
    if (page.value) this.pages.set(id, page.value)
    else this.pages.delete(id)
    this.recalculate = true
  }

  private async pageTrashed(id: number) {
    this.pages.delete(id)
    this.recalculate = true
  }

  private async pageRestored(id: number) {
    const page = await window.invoke("db:getPage", id)
    if (!page.status) return
    if (page.value) this.pages.set(id, page.value)
    else this.pages.delete(id)
    this.recalculate = true
  }

  private async pageDeleted(id: number) {
    this.pages.delete(id)
    this.recalculate = true
  }

  private async folderCreated(id: number) {
    const folder = await window.invoke("db:getFolder", id)
    if (!folder.status) throw "Could not acquire created folder"
    if (folder.value) this.folders.set(id, folder.value)
    else throw "Created folder does not exist"
    this.recalculate = true
  }

  private async folderSaved(id: number) {
    const folder = await window.invoke("db:getFolder", id)
    if (!folder.status) return
    if (folder.value) this.folders.set(id, folder.value)
    else this.folders.delete(id)
    this.pubSub.emit("workspace-folders-changed")
    this.recalculate = true
  }

  private async folderMoved(id: number) {
    const folder = await window.invoke("db:getFolder", id)
    if (!folder.status) throw "Folder not found, could not update structure"
    if (folder.value) this.folders.set(id, folder.value)
    else this.folders.delete(id)
    this.recalculate = true
  }

  private async folderDeleted(id: number) {
    this.folders.delete(id)
    this.folders.forEach(item => {
      if (item.folder == id) item.folder = null
    })
    this.pages.forEach(item => {
      if (item.folder == id) item.folder = null
    })
    this.recalculate = true
  }

  getPageIDs(): number[] {
    return Array.from(this.pages.keys())
  }

  getPageIDsSorted(): number[] {
    return Array.from(this.pages.keys()).sort((a, b) => {
      const names: Array<string | null> = [null, null]
      names[0] = this.pages.get(a)?.title || null
      names[1] = this.pages.get(b)?.title || null
      if (names[0] !== null && names[1] !== null) {
        if (names[0] < names[1]) return -1
        if (names[0] > names[1]) return 1
        return 0
      } else {
        if (names[0] !== null) return -1
        if (names[1] !== null) return 1
        return 0
      }
    })
  }

  getStructure(): StructureHierarchy {
    return this.structure
  }

  getPageMap(): Map<number, Page> {
    return this.pages
  }

  getFolderMap(): Map<number, Folder> {
    return this.folders
  }

}