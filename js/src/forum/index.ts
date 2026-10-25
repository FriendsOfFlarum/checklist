import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import type Post from 'flarum/common/models/Post';
import configureRichText from '../common/configureRichText';

app.initializers.add('fof-checklist', () => {
  extend(CommentPost.prototype, 'oncreate', processChecklists);
  extend(CommentPost.prototype, 'onupdate', processChecklists);

  if ('fof-rich-text' in flarum.extensions) {
    configureRichText();
  }
});

function processChecklists(this: InstanceType<typeof CommentPost>): void {
  const post = this.attrs.post;
  const strikeOut = !!app.forum.attribute('fof-checklist.cross_out_completed_items');
  const selector = 'li:has(> p > input[data-task-id]), li:has(> input[data-task-id])';

  const boxes = this.$('input[data-task-id]');

  this.$(selector).each(function () {
    const li = $(this);
    const input = li.find('input[data-task-id]')[0] as HTMLInputElement;
    if (!input) return;

    const checked = input.checked;

    if (strikeOut) {
      li.find('p')
        .addBack()
        .contents()
        .filter(function () {
          return this.nodeType === Node.TEXT_NODE && this.textContent!.trim() !== '';
        })
        .wrap(`<span class="fof-task-label${checked ? ' fof-checked' : ''}">`);
    }

    if (!post.canEdit()) return;

    input.disabled = false;
    input.onchange = () => toggleTask(post, input, boxes);
  });
}

/**
 * Save the clicked task by its id, which the server finds in the post's stored
 * XML. The post's boxes wait for the save, one at a time, and the click is
 * undone if it fails, so a box always shows what was saved.
 */
function toggleTask(post: Post, input: HTMLInputElement, boxes: JQuery<HTMLElement>): void {
  const checked = input.checked;

  boxes.prop('disabled', true);

  app
    .request({
      method: 'POST',
      url: `${app.forum.attribute('apiUrl')}/fof/checklist/tasks`,
      body: { postId: post.id(), taskId: input.dataset.taskId, checked },
    })
    .then((payload) => app.store.pushPayload(payload as any))
    .catch(() => {
      input.checked = !checked;
    })
    .finally(() => {
      boxes.prop('disabled', false);
      m.redraw();
    });
}
