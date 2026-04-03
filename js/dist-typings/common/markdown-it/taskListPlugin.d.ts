/**
 * Wraps checkboxPlugin: renames `list_item_open`/`list_item_close` tokens to
 * `task_item_open`/`task_item_close` when they contain a `list_checkbox` child,
 * and carries the `checked` attr across. Removes the `list_checkbox` tokens so
 * the MarkdownParser never sees an unknown token type.
 */
export default function taskListPlugin(md: any): void;
