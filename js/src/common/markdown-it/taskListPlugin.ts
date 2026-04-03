import checkboxPlugin from './checkboxPlugin';

/**
 * Wraps checkboxPlugin: renames `list_item_open`/`list_item_close` tokens to
 * `task_item_open`/`task_item_close` when they contain a `list_checkbox` child,
 * and carries the `checked` attr across. Removes the `list_checkbox` tokens so
 * the MarkdownParser never sees an unknown token type.
 */
export default function taskListPlugin(md: any): void {
  md.use(checkboxPlugin);

  md.core.ruler.push('fof-checklist-task-item-tokens', (state: any): void => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'list_checkbox') continue;

      const checked = tokens[i].attrGet('checked') === '';

      // Find the enclosing list_item_open / list_item_close pair
      for (let j = i - 1; j >= 0; j--) {
        if (tokens[j].type === 'list_item_open') {
          tokens[j].type = 'task_item_open';
          tokens[j].attrSet('checked', checked ? 'true' : 'false');
          break;
        }
      }
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'list_item_close') {
          tokens[j].type = 'task_item_close';
          break;
        }
      }

      // Remove the list_checkbox token
      tokens.splice(i, 1);
      i--;
    }
  });
}
