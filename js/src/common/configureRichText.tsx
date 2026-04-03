import app from 'flarum/common/app';
import { extend, override } from 'flarum/common/extend';
import getChecklistButton from './components/ChecklistButton';
import checkboxPlugin from './markdown-it/checkboxPlugin';
import checkboxEditorPlugin from './proseMirror/checkboxEditorPlugin';
import insertChecklistCommand from './proseMirror/insertChecklistCommand';
import checklistKeymap from './proseMirror/keymap';

export default function configureRichText(): void {
  const rt = flarum.extensions['fof-rich-text'] as any;
  const { ProseMirrorMenu } = rt.components;
  const { ProseMirrorEditorDriver, markdown } = rt.proseMirror;
  const { MarkdownSerializerBuilder, MarkdownParserBuilder, SchemaBuilder } = markdown;
  const { InputRule, keymap: richTextKeymap } = rt;
  const ChecklistButton = getChecklistButton();

  extend(ProseMirrorMenu.prototype, 'items', function (items) {
    const { bullet_list, list_item, list_checkbox } = this.attrs.state.getSchema().nodes;

    items.add(
      'check_list',
      <ChecklistButton
        type="check_list"
        icon="fas fa-check-square"
        tooltip={app.translator.trans('fof-checklist.lib.composer.checklist_tooltip')}
        state={this.attrs.state}
        command={insertChecklistCommand(bullet_list, list_item, list_checkbox)}
      />,
      10
    );
  });

  extend(MarkdownSerializerBuilder.prototype, 'buildNodes', function (nodes) {
    nodes.list_checkbox = function (state: any, node: any) {
      state.text(node.attrs.checked ? '[x] ' : '[ ] ', false);
    };
  });

  extend(MarkdownParserBuilder.prototype, 'buildTokens', function (tokens) {
    Object.assign(tokens, {
      list_checkbox: { node: 'list_checkbox', getAttrs: (tok: any) => ({ checked: tok.attrGet('checked') === '' }) },
    });
  });

  extend(MarkdownParserBuilder.prototype, 'buildTokenizer', function (tokenizer) {
    tokenizer.use(checkboxPlugin);
  });

  override(SchemaBuilder.prototype, 'buildNodes', function (original) {
    const nodes = original();

    return nodes
      .update('list_item', { ...nodes.get('list_item'), content: 'list_checkbox? paragraph block*' })
      .addBefore('list_item', 'list_checkbox', {
        defining: true,
        group: 'list_checkbox',
        attrs: {
          checked: { default: false },
        },
        parseDOM: [
          {
            tag: 'input[type=checkbox]',
            getAttrs: (dom: Element) => ({ checked: dom.hasAttribute('checked') }),
          },
        ],
        toDOM(node: any) {
          const attrs: Record<string, string> = { type: 'checkbox' };
          if (node.attrs.checked) attrs.checked = '';
          return ['input', attrs];
        },
      });
  });

  extend(ProseMirrorEditorDriver.prototype, 'buildPluginItems', function (items) {
    items.add('checkboxEditorPlugin', checkboxEditorPlugin());
    items.add('checkListKeymap', richTextKeymap(checklistKeymap(this.schema)), 10);
  });

  extend(ProseMirrorEditorDriver.prototype, 'buildInputRules', function (items) {
    items.push(
      new InputRule(/^\[([ x]?)\] $/, function (state: any, match: RegExpMatchArray, start: number, end: number) {
        const $from = state.selection.$from;
        if ($from.depth >= 3 && $from.node(-1).type.name === 'list_item' && $from.index(-1) === 0) {
          const attrs = { checked: match[1] === 'x' };
          const listItemPos = $from.before(-1);
          return state.tr.delete(start, end).insert(listItemPos + 1, state.schema.nodes.list_checkbox.create(attrs));
        }
        return null;
      })
    );
  });
}
