import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import Post from 'flarum/common/models/Post';
import configureRichText from '../common/configureRichText';

app.initializers.add('fof/checklist', () => {
  extend(CommentPost.prototype, 'oncreate', processChecklists);
  extend(CommentPost.prototype, 'onupdate', processChecklists);

  if ('fof-rich-text' in flarum.extensions) {
    configureRichText();
  }
});

function processChecklists(this: InstanceType<typeof CommentPost>): void {
  const post = this.attrs.post;
  const strikeOut = !!app.forum.attribute('fof-checklist.cross_out_completed_items');

  this.$('li[data-task-state]').each(function () {
    const li = $(this);
    const checked = li.attr('data-task-state') === 'checked';

    if (strikeOut) {
      li.contents()
        .filter(function () {
          return this.nodeType === Node.TEXT_NODE && this.textContent!.trim() !== '';
        })
        .wrap(`<span class="fof-task-label${checked ? ' fof-checked' : ''}">`);
    }

    if (!post.canEdit()) return;

    const input = li.find('> input[type="checkbox"]')[0] as HTMLInputElement;
    if (!input) return;

    input.disabled = false;
    input.onchange = () => toggleCheckbox(post, li.index('[data-task-state]'), input.checked);
  });
}

function toggleCheckbox(post: Post, index: number, checked: boolean): void {
  let match: RegExpExecArray | null;
  let remaining = index;
  const checkListRegex = /([\-\*]|[0-9]+\.) (\[[ xX]\])/g;
  const currContent = post.content();
  if (!currContent) return;

  while ((match = checkListRegex.exec(currContent))) {
    if (remaining === 0) {
      const valIndex = match.index + match[0].length - 2;
      const content = currContent.substring(0, valIndex) + (checked ? 'x' : ' ') + currContent.substring(valIndex + 1);

      post.save({ content }).then(() => m.redraw());
      return;
    }
    remaining--;
  }
}
