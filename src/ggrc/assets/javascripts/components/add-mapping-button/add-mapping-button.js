/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, GGRC, CMS) {
  'use strict';

  GGRC.Components('addMappingButton', {
    tag: 'add-mapping-button',
    template: can.view(
      GGRC.mustache_path +
      '/components/add-mapping-button/add-mapping-button.mustache'
    ),
    viewModel: {
      parentInstance: null
    },
    events: {
      click: function () {
        this.viewModel.dispatch('');
      }
    }
  });
})(window.can, window.GGRC, window.CMS);
