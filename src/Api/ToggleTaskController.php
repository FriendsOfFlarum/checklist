<?php

/*
 * This file is part of fof/checklist
 *
 *  Copyright (c) FriendsOfFlarum.
 *
 *  For detailed copyright and license information, please view the
 *  LICENSE file that was distributed with this source code.
 */

namespace FoF\Checklist\Api;

use Carbon\Carbon;
use Flarum\Api\Client;
use Flarum\Foundation\DispatchEventsTrait;
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Revised;
use Flarum\Post\Exception\FloodingException;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use s9e\TextFormatter\Plugins\TaskLists\Helper;

/**
 * Checks or unchecks one task in a post, found by the id TaskLists gave it in
 * the stored XML (the checkbox's `data-task-id`).
 *
 * Counting checkboxes in the markdown source cannot find the right one: code
 * fences, indented code and BBCode lists make the source and the rendered list
 * disagree. The XML is what the checkboxes were rendered from, and TaskLists'
 * Helper changes the one task in it. It is saved as an edit, without parsing
 * the post again, so the other tasks keep their ids.
 */
class ToggleTaskController implements RequestHandlerInterface
{
    use DispatchEventsTrait;

    /** Toggles allowed per user per minute: room to work down a list, not to flood edits. */
    public const PER_MINUTE = 60;

    public function __construct(
        protected Client $api,
        protected Cache $cache,
        protected Dispatcher $events,
        protected TranslatorInterface $translator
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $body = (array) $request->getParsedBody();

        $postId = filter_var(Arr::get($body, 'postId'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $taskId = Arr::get($body, 'taskId');
        $checked = Arr::get($body, 'checked');

        if ($postId === false || !is_string($taskId) || !is_bool($checked)) {
            throw new ValidationException(['checklist' => $this->translator->trans('fof-checklist.api.invalid_request')]);
        }

        /** @var CommentPost $post */
        $post = CommentPost::query()->whereVisibleTo($actor)->findOrFail($postId);

        $actor->assertCan('edit', $post);

        $xml = (string) $post->parsed_content;

        if (!in_array($taskId, self::taskIds($xml), true)) {
            throw new ValidationException(['checklist' => $this->translator->trans('fof-checklist.api.task_not_found')]);
        }

        $this->throttle($actor->id);

        $updated = $checked ? Helper::checkTask($xml, $taskId) : Helper::uncheckTask($xml, $taskId);

        if ($updated !== $xml) {
            // As CommentPost::revise() records an edit, minus the parse.
            $oldContent = $post->content ?? '';

            $post->setParsedContentAttribute($updated);
            $post->edited_at = Carbon::now();
            $post->edited_user_id = $actor->id;
            $post->raise(new Revised($post, $actor, $oldContent));

            $post->save();

            $this->dispatchEventsFor($post, $actor);
        }

        return $this->api->withActor($actor)->withParentRequest($request)->get('/posts/'.$post->id);
    }

    private function throttle(int $userId): void
    {
        $key = 'fof-checklist.toggles.'.$userId.'.'.intdiv(time(), 60);

        $this->cache->add($key, 0, 60);

        if ($this->cache->increment($key) > self::PER_MINUTE) {
            throw new FloodingException();
        }
    }

    /**
     * The ids of the post's tasks, matched as Helper::setTaskState() finds them.
     *
     * @return list<string>
     */
    private static function taskIds(string $xml): array
    {
        preg_match_all('((?<=<)TASK(?: [^=]++="[^"]*+")*? id="\K[^"]++)', $xml, $m);

        return $m[0];
    }
}
