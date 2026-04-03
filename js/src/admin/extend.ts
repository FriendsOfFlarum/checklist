import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin() //
    .setting(() => ({
      setting: 'fof-checklist.cross_out_completed_items',
      label: app.translator.trans('fof-checklist.admin.settings.cross_out_completed_items'),
      type: 'boolean',
    })),
];
