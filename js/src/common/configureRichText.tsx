import app from 'flarum/common/app';
import { extend } from 'flarum/common/extend';
import type TiptapEditorDriver from 'ext:fof/rich-text/common/tiptap/TiptapEditorDriver';
import type MarkdownParserBuilder from 'ext:fof/rich-text/common/tiptap/markdown/MarkdownParserBuilder';
import type MarkdownSerializerBuilder from 'ext:fof/rich-text/common/tiptap/markdown/MarkdownSerializerBuilder';
import type TiptapMenu from 'ext:fof/rich-text/common/components/TiptapMenu';
import type CommandButton from 'ext:fof/rich-text/common/components/CommandButton';
import taskListPlugin from './markdown-it/taskListPlugin';

export default function configureRichText(): void {
  flarum.reg.onLoad('fof-rich-text', 'common/tiptap/tiptap', ({ ListItem }: typeof import('ext:fof/rich-text/common/tiptap/tiptap')) => {
    /**
     * Extends StarterKit's ListItem with a nullable `checked` attribute.
     * null  = plain list item (no checkbox rendered)
     * true/false = task item (checkbox rendered via NodeView)
     *
     * Using ListItem.extend() ensures our additions are properly merged into
     * the same node type — no duplicate name warnings, no schema conflicts.
     */
    const CheckableListItem = ListItem.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          checked: {
            default: null as boolean | null,
            parseHTML: (el: Element) => {
              if (!el.hasAttribute('data-task')) return null;
              return el.getAttribute('data-checked') === '' ? true : false;
            },
            renderHTML: (attrs: any) => {
              if (attrs.checked === null) return {};
              return { 'data-task': '', 'data-checked': attrs.checked ? '' : null };
            },
          },
        };
      },

      addNodeView() {
        return ({ node, getPos, editor }: any) => {
          const li = document.createElement('li');

          if (node.attrs.checked === null) {
            // Plain list item — contentDOM is the li itself
            return { dom: li, contentDOM: li };
          }

          // Task item — set attribute so CSS can target it
          li.setAttribute('data-task', '');

          const label = document.createElement('label');
          label.contentEditable = 'false';

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = node.attrs.checked;
          input.addEventListener('mousedown', (e) => e.preventDefault());
          input.addEventListener('change', (e: Event) => {
            const checked = (e.target as HTMLInputElement).checked;
            if (editor.isEditable && typeof getPos === 'function') {
              editor
                .chain()
                .focus(undefined, { scrollIntoView: false })
                .command(({ tr }: any) => {
                  const pos = getPos();
                  if (typeof pos !== 'number') return false;
                  tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked });
                  return true;
                })
                .run();
            }
          });

          const content = document.createElement('div');
          label.append(input);
          li.append(label, content);

          return {
            dom: li,
            contentDOM: content,
            update: (updatedNode: any) => {
              if (updatedNode.type !== node.type) return false;
              input.checked = updatedNode.attrs.checked ?? false;
              return true;
            },
          };
        };
      },
    });

    extend('ext:fof/rich-text/common/tiptap/TiptapEditorDriver', 'buildExtensions', function (this: TiptapEditorDriver, items: any) {
      // Replace StarterKit's listItem with our extended version.
      // StarterKit is added as 'starterKit' — we configure it to disable its
      // built-in listItem and add ours separately so Tiptap sees one definition.
      const starterKit = items.get('starterKit');
      items.add('starterKit', starterKit.configure({ ...starterKit.options, listItem: false }));
      items.add('listItem', CheckableListItem);
    });
  });

  extend('ext:fof/rich-text/common/tiptap/markdown/MarkdownParserBuilder', 'buildTokenizer', function (this: MarkdownParserBuilder, tokenizer: any) {
    tokenizer.use(taskListPlugin);
  });

  extend('ext:fof/rich-text/common/tiptap/markdown/MarkdownParserBuilder', 'buildTokens', function (this: MarkdownParserBuilder, tokens: any) {
    Object.assign(tokens, {
      task_item: {
        block: 'listItem',
        getAttrs: (tok: any) => ({ checked: tok.attrGet('checked') === 'true' }),
      },
    });
  });

  extend('ext:fof/rich-text/common/tiptap/markdown/MarkdownSerializerBuilder', 'buildNodes', function (this: MarkdownSerializerBuilder, nodes: any) {
    const originalListItem = nodes.listItem;
    nodes.listItem = function (state: any, node: any) {
      if (node.attrs.checked !== null) {
        state.text(node.attrs.checked ? '[x] ' : '[ ] ', false);
      }
      originalListItem(state, node);
    };
  });

  extend('ext:fof/rich-text/common/components/TiptapMenu', 'items', function (this: TiptapMenu, items: any) {
    const CommandButtonClass: typeof CommandButton = flarum.reg.get('fof-rich-text', 'common/components/CommandButton');

    items.add(
      'check_list',
      <CommandButtonClass
        type="check_list"
        icon="fas fa-check-square"
        tooltip={app.translator.trans('fof-checklist.lib.composer.checklist_tooltip')}
        editor={this.attrs.editor}
        command={(editor: any) => toggleChecklist(editor)}
      />,
      10
    );
  });
}

function toggleChecklist(editor: any): void {
  const { state, view } = editor;
  const { $from } = state.selection;

  const listItemType = state.schema.nodes.listItem;
  if (!listItemType) return;

  // Find nearest listItem ancestor
  let nodeDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type === listItemType) {
      nodeDepth = d;
      break;
    }
  }

  if (nodeDepth < 0) {
    // Not in a list — create a bullet list then convert the new item
    editor.chain().focus().toggleBulletList().run();

    const state2 = editor.state;
    const { $from: $from2 } = state2.selection;
    for (let d = $from2.depth; d >= 0; d--) {
      if ($from2.node(d).type === state2.schema.nodes.listItem) {
        const pos = $from2.before(d);
        editor.view.dispatch(state2.tr.setNodeMarkup(pos, undefined, { checked: false }));
        return;
      }
    }
    return;
  }

  const nodePos = $from.before(nodeDepth);
  const currentChecked = $from.node(nodeDepth).attrs.checked;

  if (currentChecked === null) {
    view.dispatch(state.tr.setNodeMarkup(nodePos, undefined, { checked: false }));
  } else {
    view.dispatch(state.tr.setNodeMarkup(nodePos, undefined, { checked: null }));
  }
}
