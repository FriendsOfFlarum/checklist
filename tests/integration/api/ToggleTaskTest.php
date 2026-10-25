<?php

/*
 * This file is part of fof/checklist
 *
 *  Copyright (c) FriendsOfFlarum.
 *
 *  For detailed copyright and license information, please view the
 *  LICENSE file that was distributed with this source code.
 */

namespace FoF\Checklist\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

class ToggleTaskTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /**
     * The list from issue #2 (two spaces after a marker), plus a fence that a
     * closer with a trailing space does not close, so its "- [ ]" lines are
     * code, not tasks.
     */
    private const SOURCE = "1. [x] Configure Flarum\n"
        ." 1.  [x] Test a sign-up\n"
        ." -  [ ] RSS plugin\n"
        ."- [ ] Become cool\n"
        ."\n"
        ."```\n"
        ."code\n"
        ."``` \n"
        ."- [ ] still code\n"
        ."```\n"
        ."\n"
        ."+ [X] After the code";

    private int $postId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-markdown', 'fof-checklist');

        $this->prepareDatabase([
            User::class => [$this->normalUser(), ['id' => 3, 'username' => 'other', 'email' => 'other@machine.local', 'is_email_confirmed' => 1]],
            Discussion::class => [
                ['id' => 1, 'title' => 'Checklist', 'user_id' => 2, 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'number' => 1, 'content' => '<t><p>Opener.</p></t>', 'created_at' => Carbon::now()->subDay()],
            ],
        ]);
    }

    /**
     * Post the list through the API, so it is parsed with TaskLists, and return
     * the post's task ids in order.
     *
     * @return list<string>
     */
    private function createPostWithTasks(): array
    {
        $response = $this->send($this->request('POST', '/api/posts', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['attributes' => ['content' => self::SOURCE], 'relationships' => ['discussion' => ['data' => ['type' => 'discussions', 'id' => '1']]]]],
        ]));

        $this->assertSame(201, $response->getStatusCode(), (string) $response->getBody());

        $this->postId = (int) json_decode((string) $response->getBody(), true)['data']['id'];

        preg_match_all('(<TASK id="([^"]+)")', CommentPost::find($this->postId)->parsed_content, $m);

        return $m[1];
    }

    private function toggle(string $taskId, bool $checked, ?int $as = 2): ResponseInterface
    {
        return $this->send($this->request('POST', '/api/fof/checklist/tasks', [
            'authenticatedAs' => $as,
            'json' => ['postId' => $this->postId, 'taskId' => $taskId, 'checked' => $checked],
        ]));
    }

    private function content(): string
    {
        return CommentPost::find($this->postId)->content;
    }

    #[Test]
    public function each_task_toggles_its_own_line()
    {
        // A post per task, so core's post flood limit is lifted for this test.
        $this->extend((new Extend\ThrottleApi())->remove('postTimeout'));

        $expected = [
            [false, '1. [ ] Configure Flarum'],
            [false, ' 1.  [ ] Test a sign-up'],
            [true, ' -  [x] RSS plugin'],
            [true, '- [x] Become cool'],
            [false, '+ [ ] After the code'],
        ];

        foreach ($expected as $index => [$checked, $line]) {
            $ids = $this->createPostWithTasks();

            // The two lines in the unclosed fence are code, not tasks.
            $this->assertCount(5, $ids);

            $before = explode("\n", $this->content());

            $response = $this->toggle($ids[$index], $checked);
            $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());

            $after = explode("\n", $this->content());
            $changed = array_keys(array_diff_assoc($after, $before));

            $this->assertCount(1, $changed, "Task {$index} changed more or less than one line.");
            $this->assertSame($line, $after[$changed[0]]);
        }
    }

    #[Test]
    public function a_member_can_tick_several_boxes_in_a_row()
    {
        // Core's post flood limit stays on: toggles are not new posts.
        $ids = $this->createPostWithTasks();

        foreach ([2, 3, 0] as $index) {
            $response = $this->toggle($ids[$index], $index !== 0);
            $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
        }

        $content = $this->content();
        $this->assertStringContainsString(' -  [x] RSS plugin', $content);
        $this->assertStringContainsString('- [x] Become cool', $content);
        $this->assertStringContainsString('1. [ ] Configure Flarum', $content);

        // Saved without parsing again, so every task kept its id.
        preg_match_all('(<TASK id="([^"]+)")', CommentPost::find($this->postId)->parsed_content, $m);
        $this->assertSame($ids, $m[1]);
    }

    #[Test]
    public function a_toggle_is_recorded_as_an_edit_and_returns_the_post()
    {
        $ids = $this->createPostWithTasks();

        $response = $this->toggle($ids[3], true);
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());

        $body = json_decode((string) $response->getBody(), true);
        $this->assertSame('posts', $body['data']['type']);
        $this->assertSame((string) $this->postId, $body['data']['id']);
        $this->assertStringContainsString('- [x] Become cool', $body['data']['attributes']['content']);

        $post = CommentPost::find($this->postId);
        $this->assertNotNull($post->edited_at);
        $this->assertSame(2, $post->edited_user_id);
    }

    #[Test]
    public function a_moderator_can_toggle_another_users_tasks()
    {
        $ids = $this->createPostWithTasks();

        $this->assertSame(200, $this->toggle($ids[3], true, 1)->getStatusCode());
        $this->assertSame(1, CommentPost::find($this->postId)->edited_user_id);
    }

    #[Test]
    public function a_user_who_cannot_edit_the_post_cannot_toggle_its_tasks()
    {
        $ids = $this->createPostWithTasks();

        $this->assertSame(403, $this->toggle($ids[3], true, 3)->getStatusCode());
        $this->assertSame(self::SOURCE, $this->content());
    }

    #[Test]
    public function the_author_cannot_toggle_once_editing_has_closed()
    {
        $this->setting('allow_post_editing', 'reply');

        $ids = $this->createPostWithTasks();

        // Someone replies, which closes editing under the "until reply" setting.
        $this->send($this->request('POST', '/api/posts', [
            'authenticatedAs' => 3,
            'json' => ['data' => ['attributes' => ['content' => 'A reply'], 'relationships' => ['discussion' => ['data' => ['type' => 'discussions', 'id' => '1']]]]],
        ]));

        $this->assertSame(403, $this->toggle($ids[3], true)->getStatusCode());
        $this->assertSame(self::SOURCE, $this->content());
    }

    #[Test]
    public function a_guest_cannot_toggle_tasks()
    {
        $ids = $this->createPostWithTasks();

        // A guest has no session, so core's CSRF check refuses it first.
        $this->assertContains($this->toggle($ids[3], true, null)->getStatusCode(), [400, 401, 403]);
        $this->assertSame(self::SOURCE, $this->content());
    }

    #[Test]
    public function a_task_removed_by_an_edit_is_refused()
    {
        // The edit below follows the post at once, which core's flood limit refuses.
        $this->extend((new Extend\ThrottleApi())->remove('postTimeout'));

        $ids = $this->createPostWithTasks();

        // An edit parses the post again, giving every task a new id.
        $response = $this->send($this->request('PATCH', '/api/posts/'.$this->postId, [
            'authenticatedAs' => 2,
            'json' => ['data' => ['attributes' => ['content' => self::SOURCE."\n- [ ] One more"]]],
        ]));
        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
        $edited = $this->content();

        $this->assertSame(422, $this->toggle($ids[3], true)->getStatusCode());
        $this->assertSame($edited, $this->content());
    }

    #[Test]
    public function an_unknown_task_is_refused()
    {
        $this->createPostWithTasks();

        $this->assertSame(422, $this->toggle('notatask', true)->getStatusCode());
        $this->assertSame(self::SOURCE, $this->content());
    }

    #[Test]
    public function a_malformed_request_is_refused()
    {
        $ids = $this->createPostWithTasks();

        foreach ([
            ['postId' => $this->postId, 'taskId' => $ids[0], 'checked' => 'yes'],
            ['postId' => '1e3', 'taskId' => $ids[0], 'checked' => true],
            ['postId' => $this->postId, 'taskId' => ['x'], 'checked' => true],
        ] as $body) {
            $response = $this->send($this->request('POST', '/api/fof/checklist/tasks', ['authenticatedAs' => 2, 'json' => $body]));

            $this->assertSame(422, $response->getStatusCode(), json_encode($body));
        }

        $this->assertSame(self::SOURCE, $this->content());
    }

    #[Test]
    public function a_post_the_user_cannot_see_is_not_found()
    {
        $ids = $this->createPostWithTasks();

        CommentPost::find($this->postId)->hide()->save();

        // Without the visibility scope this would be a 403, not a 404.
        $this->assertSame(404, $this->toggle($ids[0], false, 3)->getStatusCode());
    }
}
