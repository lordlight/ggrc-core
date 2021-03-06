/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  /*
   * Assessment template main component
   *
   * It collects fields data and it transforms them into appropriate
   * format for saving
   */
  GGRC.Components('templateAttributes', {
    tag: 'assessment-template-attributes',
    template: '<content></content>',
    scope: {
      fields: new can.List(),
      types: new can.List([{
        type: 'Text',
        name: 'Text',
        text: 'Enter description'
      }, {
        type: 'Rich Text',
        name: 'Rich Text',
        text: 'Enter description'
      }, {
        type: 'Date',
        name: 'Date',
        text: 'MM/DD/YYYY'
      }, {
        type: 'Checkbox',
        name: 'Checkbox',
        text: ''
      }, {
        type: 'Dropdown',
        name: 'Dropdown',
        text: 'Enter values separated by comma'
      }, {
        type: 'Map:Person',
        name: 'Person',
        text: ''
      }]),

      /**
       * A handler for when a user removes a Custom Attribute Definition.
       *
       * It removes the corresponding CA definition object from the list to
       * keep it in sync with the definitions listed in DOM.
       *
       * @param {CMS.Models.CustomAttributeDefinition} instance -
       *   the definition that was removed
       * @param {jQuery.Element} $el - the source of the event `ev`
       * @param {jQuery.Event} ev - the onRemove event object
       */
      fieldRemoved: function (instance, $el, ev) {
        var idx = _.findIndex(this.fields, {title: instance.title});
        if (idx >= 0) {
          this.fields.splice(idx, 1);
        } else {
          console.warn('The list of CAD doesn\'t contain item with "' +
            instance.title + '" title');
        }
      }
    },
    events: {
      inserted: function () {
        var el = $(this.element);
        var list = el.find('.sortable-list');
        list.sortable({
          items: 'li.sortable-item',
          placeholder: 'sortable-placeholder'
        });
        list.find('.sortable-item').disableSelection();
      },
      '.sortable-list sortstop': function () {
        var el = $(this.element);
        var sortables = el.find('li.sortable-item');
        // It's not nice way to rely on DOM for sorting,
        // but it was easiest for implementation
        this.scope.fields.replace(_.map(sortables,
           function (item) {
             return $(item).data('field');
           }
        ));
      }
    }
  });
  /*
   * Template field
   *
   * Represents each `field` passed from assessment-template-attributes `fields`
   */
  GGRC.Components('templateAttributesField', {
    tag: 'template-field',
    template: can.view(GGRC.mustache_path +
      '/assessment_templates/attribute_field.mustache'),
    scope: function (attrs, parentScope, element) {
      return {
        types: parentScope.attr('types'),
        pads: {
          COMMENT: 0,
          ATTACHMENT: 1
        },

        _EV_FIELD_REMOVED: 'on-remove',

        /*
         * Removes `field` from `fields`
         */
        removeField: function (scope, el, ev) {
          ev.preventDefault();

          // CAUTION: In order for the event to not get lost, triggering it
          // must happen before changing any of the scope attributes that
          // cause changes in the template.
          this.$rootEl.triggerHandler({
            type: this._EV_FIELD_REMOVED
          });

          scope.attr('_pending_delete', true);
        },
        /*
         * Denormalize field.multi_choice_mandatory into opts
         * "0, 1, 2" is normalized into
         * [
         * {value: 0, attachment: false, comment: false},
         * {value: 1, attachment: false, comment: true},
         * {value: 2, attachment: true, comment: false},
         * ]
         */
        denormalize_mandatory: function (field, pads) {
          var options = _.splitTrim(field.attr('multi_choice_options'));
          var vals = _.splitTrim(field.attr('multi_choice_mandatory'));
          var isEqualLength = options.length === vals.length;
          var range;

          if (!isEqualLength && options.length < vals.length) {
            vals.length = options.length;
          } else if (!isEqualLength && options.length > vals.length) {
            range = _.range(options.length - vals.length);
            range = range.map(function () {
              return '0';
            });
            vals = vals.concat(range);
          }

          return _.zip(options, vals).map(function (zip) {
            var attr = new can.Map();
            var val = zip[1];
            var attachment = !!(val & 1 << pads.ATTACHMENT);
            var comment = !!(val & 1 << pads.COMMENT);
            attr.attr('value', zip[0]);
            attr.attr('attachment', attachment);
            attr.attr('comment', comment);
            return attr;
          });
        },
        /*
         * Normalize opts into field.multi_choice_mandatory
         * [
         * {value: 0, attachment: true, comment: false},
         * {value: 1, attachment: true, comment: true},
         * ]
         * is normalized into "2, 3" (10b, 11b).
         */
        normalize_mandatory: function (attrs, pads) {
          return can.map(attrs, function (attr) {
            var attach = attr.attr('attachment') << pads.ATTACHMENT;
            var comment = attr.attr('comment') << pads.COMMENT;
            return attach | comment;
          }).join(',');
        }
      };
    },
    events: {
      /**
       * The component's entry point.
       *
       * @param {Object} element - the (unwrapped) DOM element that triggered
       *   creating the component instance
       * @param {Object} options - the component instantiation options
       */
      init: function (element, options) {
        var field = this.scope.attr('field');
        var pads = this.scope.attr('pads');
        var denormalized = this.scope.denormalize_mandatory(field, pads);
        var types = this.scope.attr('types');
        var item = _.find(types, function (obj) {
          return obj.type === field.attr('attribute_type');
        });
        this.scope.field.attr('attribute_name', item.name);
        this.scope.attr('attrs', denormalized);

        this.scope.attr('$rootEl', $(element));
      },
      '{attrs} change': function () {
        var attrs = this.scope.attr('attrs');
        var pads = this.scope.attr('pads');
        var normalized = this.scope.normalize_mandatory(attrs, pads);
        this.scope.field.attr('multi_choice_mandatory', normalized);
      }
    }
  });

  GGRC.Components('addTemplateField', {
    tag: 'add-template-field',
    template: can.view(GGRC.mustache_path +
      '/assessment_templates/attribute_add_field.mustache'),
    scope: function (attrs, parentScope) {
      return new can.Map({
        selected: new can.Map(),
        fields: parentScope.attr('fields'),
        types: parentScope.attr('types'),
        // the field types that require a list of possible values to be defined
        valueAttrs: ['Dropdown'],
        /*
         * Create a new field.
         *
         * Field must contain value title, type, values.
         * Opts are populated, once we start changing checkbox values
         *
         * @param {can.Map} scope - the current (add-template-field) scope
         * @param {jQuery.Object} el - the clicked DOM element
         * @param {Object} ev - the event object
         */
        addField: function (scope, el, ev) {
          var fields = scope.attr('fields');
          var selected = scope.attr('selected');
          var title = _.trim(selected.title);
          var type = _.trim(selected.type);
          var invalidInput = false;
          var values = _.splitTrim(selected.values, {
            unique: true
          }).join(',');
          ev.preventDefault();
          scope.attr('selected.invalidTitle', false);
          scope.attr('selected.emptyTitle', false);
          scope.attr('selected.dublicateTitle', false);
          scope.attr('selected.invalidValues', false);

          if (this.isEmptyTitle(title)) {
            this.attr('selected.invalidTitle', true);
            this.attr('selected.emptyTitle', true);
            invalidInput = true;
          } else if (this.isDublicateTitle(fields, title)) {
            this.attr('selected.invalidTitle', true);
            this.attr('selected.dublicateTitle', true);
            invalidInput = true;
          }
          if (this.isInvalidValues(scope.valueAttrs, type, values)) {
            scope.attr('selected.invalidValues', true);
            invalidInput = true;
          }
          if (invalidInput) {
            return;
          }
          // We need to defer adding in modal since validation is preventing
          // on adding the first item
          _.defer(function () {
            fields.push({
              id: scope.attr('id'),
              title: title,
              attribute_type: type,
              multi_choice_options: values
            });
            _.each(['title', 'values', 'multi_choice_options'],
              function (type) {
                selected.attr(type, '');
              });
          });
        },
        isInvalidValues: function (valueAttrs, type, values) {
          return _.contains(valueAttrs, type) && !values;
        },
        isDublicateTitle: function (fields, selectedTitle) {
          var duplicateField = _.some(fields, function (item) {
            return item.title === selectedTitle && !item._pending_delete;
          });
          return fields.length && duplicateField;
        },
        isEmptyTitle: function (selectedTitle) {
          return !selectedTitle;
        }
      });
    },
    events: {
      /*
       * Set default dropdown type on init
       */
      init: function () {
        var types = this.scope.attr('types');
        if (!this.scope.attr('selected.type')) {
          this.scope.attr('selected.type', _.first(types).attr('type'));
        }
      }
    },
    helpers: {
      /*
       * Get input placeholder value depended on type
       *
       * @param {Object} options - Mustache options
       */
      placeholder: function (options) {
        var types = this.attr('types');
        var item = _.findWhere(types, {
          type: this.attr('selected.type')
        });
        if (item) {
          return item.text;
        }
      }
    }
  });
})(window.can, window.can.$);
