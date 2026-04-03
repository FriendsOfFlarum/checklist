export default function checkboxPlugin(md: any): void {
  md.core.ruler.push('fof-checklist-checkbox', (state: any): boolean => {
    let edited = false;
    const tokens = state.tokens;

    for (let i = tokens.length - 3; i >= 0; i--) {
      if (tokens[i].type !== 'list_item_open' || tokens[i + 1].type !== 'paragraph_open' || tokens[i + 2].type !== 'inline') continue;

      const inlineToken = tokens[i + 2];
      const match = /^\[([ xX])\]\s?/.exec(inlineToken.content);
      if (!match) continue;

      const checked = match[1] === 'x' || match[1] === 'X';
      inlineToken.content = inlineToken.content.slice(match[0].length);
      if (inlineToken.children?.[0]) inlineToken.children[0].content = inlineToken.content;

      const checkboxToken = new state.Token('list_checkbox', 'input', 0);
      checkboxToken.hidden = true;
      checkboxToken.attrPush(['type', 'checkbox']);
      if (checked) checkboxToken.attrPush(['checked', '']);

      tokens.splice(i + 1, 0, checkboxToken);
      edited = true;
    }

    return edited;
  });
}
