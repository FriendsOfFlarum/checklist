export default function checkboxEditorPlugin(): any {
  const { Plugin } = flarum.extensions['fof-rich-text'] as any;

  return new Plugin({
    props: {
      nodeViews: {
        list_checkbox: (node: any, view: any, getPos: any) => new CheckBoxNodeView(node, view, getPos),
        list_item: (node: any, view: any, getPos: any) => new ListItemNodeView(node, view, getPos),
      },
    },
  });
}

class CheckBoxNodeView {
  dom: HTMLInputElement;

  constructor(node: any, view: any, getPos: () => number) {
    const dom = document.createElement('input');
    dom.setAttribute('type', 'checkbox');
    if (node.attrs.checked) dom.setAttribute('checked', '');

    dom.onclick = () => {
      view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, { checked: !node.attrs.checked }));
    };

    this.dom = dom;
  }
}

class ListItemNodeView {
  dom: HTMLLIElement;
  contentDOM: HTMLLIElement;

  constructor(node: any, _view: any, _getPos: any) {
    this.dom = this.contentDOM = document.createElement('li');
    this.update(node);
  }

  update(node: any): boolean {
    const firstChild = node.content.firstChild;
    if (firstChild?.type.name === 'list_checkbox') {
      this.contentDOM.setAttribute('data-task-id', '');
      this.contentDOM.setAttribute('data-task-state', firstChild.attrs.checked ? 'checked' : 'unchecked');
    } else {
      this.contentDOM.removeAttribute('data-task-id');
      this.contentDOM.removeAttribute('data-task-state');
    }
    return true;
  }
}
