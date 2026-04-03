import app from 'flarum/admin/app';
import configureRichText from '../common/configureRichText';

app.initializers.add('fof/checklist', () => {
  app.extensionData.for('fof-checklist').registerSetting({
    setting: 'fof-checklist.cross_out_completed_items',
    label: app.translator.trans('fof-checklist.admin.settings.cross_out_completed_items'),
    type: 'boolean',
  });

  if ('fof-rich-text' in flarum.extensions) configureRichText();
});
