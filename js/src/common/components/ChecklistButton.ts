export default function getChecklistButton() {
  const { CommandButton } = (flarum.extensions['fof-rich-text'] as any).components;

  return class ChecklistButton extends CommandButton {
    onEditorUpdate(): void {
      const path = this.state.editorView.state.selection.$anchor.path as any[];
      const listItemType = this.state.getSchema().nodes.list_item;
      const checkboxType = this.state.getSchema().nodes.list_checkbox;

      let active = false;
      for (let i = path.length - 1; i >= 0; i--) {
        if (path[i].type && path[i].type === listItemType) {
          const firstChild = path[i].content.content[0];
          active = !!(firstChild && firstChild.type === checkboxType);
          break;
        }
      }

      this.$().toggleClass('active', active);
    }
  };
}
