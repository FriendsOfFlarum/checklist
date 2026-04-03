<?php

/*
 * This file is part of fof/checklist
 *
 *  Copyright (c) FriendsOfFlarum.
 *
 *  For detailed copyright and license information, please view the
 *  LICENSE file that was distributed with this source code.
 */

namespace FoF\Checklist;

use Flarum\Extend;
use s9e\TextFormatter\Configurator;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Formatter())
        ->configure(function (Configurator $config) {
            $config->plugins->load('TaskLists');
        }),

    (new Extend\Settings())
        ->default('fof-checklist.cross_out_completed_items', false)
        ->serializeToForum('fof-checklist.cross_out_completed_items', 'fof-checklist.cross_out_completed_items', 'boolval'),
];
