import { EditorState, type EditorStateConfig, Plugin } from "prosemirror-state"
import { type DirectEditorProps, EditorView } from "prosemirror-view"

import { Node, Schema } from "prosemirror-model"

// import { history } from "prosemirror-history"
// import {
//   dragPlugin,
//   keymapPlugin,
//   menuPlugin,
//   wordCountPlugin,
//   dropCursor,
//   gapCursor,
//   hintPlugin,
//   titlePlaceholderPlugin,
//   tableEditing,
//   titleUpdatePlugin,
//   tabInterceptPlugin,
//   stateUpdatePlugin,
//   listFixPlugin,
//   posPlugin,
//   addParagraphPlugin
// } from "./plugins"

import { schema } from "./schema"

import { Menu } from "./menu"
import { Commands } from "./commands"
import { CheckView, PageLinkView } from "./nodeViews"
import { TableView, columnResizing } from "prosemirror-tables"
import { DocumentJson, EditorStateJson } from "@src/database/model"

export class Editor {
  plugins: Plugin[]
  schema: Schema
  commands: Commands
  // menu: Menu
  view: EditorView | null = null

  private static _instance: Editor

  static getInstance(): Editor {
    if (this._instance) return this._instance
    this._instance = new this()
    return this._instance
  };

  private constructor() {

    if (Editor._instance) throw "Can not create more editors"

    this.schema = schema
    this.commands = new Commands(schema)

    // this.menu = new Menu(schema, this.commands)

    this.plugins = [
      // gapCursor(),
      // keymapPlugin(this.commands),
      // menuPlugin(this.menu),
      // wordCountPlugin(this.wordCounter),
      // dropCursor(),
      // titlePlaceholderPlugin("Untitled"),
      // hintPlugin("Write something, '/' for commands..."),
      // titleUpdatePlugin(this.emitTitleUpdate),
      // stateUpdatePlugin(this.emitStateUpdate),
      // dragPlugin(),
      // listFixPlugin(),
      // addParagraphPlugin(),
      // columnResizing(),
      // tableEditing({ allowTableNodeSelection: true }),
      // history(),
      // tabInterceptPlugin(),
      // posPlugin(this.rectangles),
    ]

    document.execCommand('enableObjectResizing', false, 'false')
    document.execCommand('enableInlineTableEditing', false, 'false')
  };

  createState(doc: Node | null): EditorState {
    const config: EditorStateConfig = {
      schema: this.schema,
      plugins: this.plugins,
    }
    if (doc) config.doc = doc
    return EditorState.create(config)
  };

  createView(element: Element): EditorView {
    const cmd = this.commands

    const props: DirectEditorProps = {
      state: this.createState(null),
      nodeViews: {
        check(node, view, getPos) { return new CheckView(node, view, getPos, cmd) },
        table(node) { return new TableView(node, 40) },
        page_link(node, view, getPos) { return new PageLinkView(node, view, getPos, cmd) },
      },
    }

    return new EditorView(element, props)
  };

  getTitle(): string | null {
    if (!this.view) return null;
    let maybeTitle = this.view.state.doc.firstChild;
    if (maybeTitle && maybeTitle.type.name == "title") {
      return maybeTitle.textContent || null;
    }
    return null;
  };

  putPage(document: DocumentJson, editor_state: EditorStateJson): void {
    if (!this.view) return;

    this.view.state = this.createState(this.schema.nodeFromJSON(document));
    this.view.dispatch(this.view.state.tr);
  };

  getPageData(): { document: DocumentJson, editor_state: EditorStateJson } | null {
    if (!this.view) return null
    const state = this.view.state.toJSON()
    return {
      document: state.doc,
      editor_state: {},
    }
  }

  newPageData(): { document: DocumentJson, editor_state: EditorStateJson } {
    const state = this.createState(null).toJSON()
    return {
      document: state.doc,
      editor_state: {},
    }
  }

}