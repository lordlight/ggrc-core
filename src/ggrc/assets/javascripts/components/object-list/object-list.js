/*!
 Copyright (C) 2017 Google Inc., authors, and contributors
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, GGRC) {
  'use strict';

  var tag = 'object-list';
  var tpl = can.view(GGRC.mustache_path +
    '/components/object-list/object-list.mustache');
  /**
   * Object List component
   */
  GGRC.Components('objectList', {
    tag: tag,
    template: tpl,
    viewModel: {
      define: {
        itemSelector: {
          type: 'string',
          value: ''
        },
        isLoading: {
          type: 'boolean',
          value: false
        },
        showSpinner: {
          get: function () {
            return this.attr('isLoading');
          }
        },
        items: {
          value: function () {
            return [];
          }
        },
        selectedItem: {
          value: function () {
            return {
              el: null,
              data: null
            };
          }
        },
        isInnerClick: {
          type: 'boolean',
          value: false
        },
        emptyMessage: {
          type: 'string',
          value: 'None'
        }
      },
      spinnerCss: '@',
      /**
       *
       * @param {can.Map} ctx - current item context
       * @param {jQuery.Event} ev - click event
       * @param {jQuery} el - selected element
       */
      modifySelection: function (ctx, ev, el) {
        var selectionFilter = this.attr('itemSelector');
        var isSelected = selectionFilter ?
          can.$(ev.target).closest(selectionFilter, el).length :
          true;
        this.clearSelection();
        // Select Item only in case required HTML item was clicked
        if (isSelected) {
          this.attr('selectedItem.el', el);
          this.attr('selectedItem.data', ctx.instance);
          ctx.attr('isSelected', true);
        }
      },
      /**
       * Deselect all items and clear selected item Object
       */
      clearSelection: function () {
        this.attr('items').forEach(function (item) {
          item.attr('isSelected', false);
        });
        this.attr('selectedItem.el', null);
        this.attr('selectedItem.data', null);
      },
      /**
       * Event Handler executed on each viewport click
       */
      onOuterClick: function () {
        var isInnerClick = this.attr('isInnerClick');
        if (!isInnerClick) {
          this.clearSelection();
        }
        this.attr('isInnerClick', false);
      }
    },
    events: {
      '.object-list-item click': function () {
        this.viewModel.attr('isInnerClick', true);
      },
      '{window} click': function () {
        this.viewModel.onOuterClick();
      }
    }
  });
})(window.can, window.GGRC);
