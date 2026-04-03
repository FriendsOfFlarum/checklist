export default function keymap(schema: any): Record<string, any> {
  const { liftListItem, splitListItem, Selection } = flarum.extensions['fof-rich-text'] as any;

  return {
    Enter: splitListItemCheckbox(schema.nodes.list_item, schema.nodes.list_checkbox, liftListItem, splitListItem, Selection),
  };
}

function splitListItemCheckbox(listItemNode: any, checkboxNode: any, liftListItem: any, splitListItem: any, Selection: any) {
  return function (state: any, dispatch: any, view: any): boolean {
    const path = state.selection.$anchor.path as any[];

    let i = path.length - 1;
    for (; i >= 0; i--) {
      if (path[i].type && path[i].type === listItemNode) break;
    }

    const prevCheckbox = path[i]?.content.content[0];
    if (!prevCheckbox || prevCheckbox.type !== checkboxNode) return false;

    const prevParagraph = path[i].content.content[1];
    if (prevParagraph && !prevParagraph.content.content.length) {
      dispatch(view.state.tr.delete(path[i + 2] - 1, view.state.selection.to));
      dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(state.selection.from - 1))));
      return liftListItem(listItemNode)(state, dispatch);
    }

    if (!splitListItem(listItemNode)(state, dispatch)) return false;

    const listItemPos = view.state.selection.$from.before(-1);
    dispatch(view.state.tr.insert(listItemPos + 1, checkboxNode.create({ checked: false })));

    return true;
  };
}
