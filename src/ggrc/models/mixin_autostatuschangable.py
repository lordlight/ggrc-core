# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: urban@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com

import datetime

from sqlalchemy import inspect

from ggrc import db
from ggrc.models import relationship
from ggrc.models import object_document
from ggrc.services import common
from ggrc.services import signals


class AutoStatusChangable(object):
  __lazy_init__ = True
  _tracked_attrs = set()

  @staticmethod
  def _date_has_changes(attr):
    """Date fields are always interpreted as changed because incoming data is
      of type datetime.datetime, while database field has type datetime.date.
      This function normalises this and performs the correct check.
    """
    if not attr.history.added or not attr.history.deleted:
      return False
    added, deleted = attr.history.added[0], attr.history.deleted[0]
    if isinstance(added, datetime.datetime):
      added = added.date()
    return added != deleted

  @classmethod
  def _has_changes(cls, obj, attr):
    attr = getattr(inspect(obj).attrs, attr)
    if (isinstance(attr.value, datetime.date) or
       isinstance(attr.value, datetime.datetime)):
      return cls._date_has_changes(attr)
    return attr.history.has_changes()

  @classmethod
  def _get_object_from_relationship(cls, model, rel):
    if rel.source.type == model.__name__:
      return rel.source
    return rel.destination

  @classmethod
  def init(cls, model):
    AutoStatusChangable.set_handlers(model)

  @staticmethod
  def adjust_status(model, obj):
    obj.status = tuple(model.PROGRESS_STATE)[0]
    db.session.add(obj)

  @classmethod
  def handle_first_class_edit(cls, model, obj, rel=None):
    if obj.status in model.FIRST_CLASS_EDIT:
      cls.adjust_status(model, obj)

  @classmethod
  def handle_person_edit(cls, model, obj, rel):
    history = inspect(rel).attrs.relationship_attrs.history
    if (history.has_changes() and
       obj.status in model.ASSIGNABLE_EDIT):
      cls.adjust_status(model, obj)

  @classmethod
  def set_handlers(cls, model):
    @common.Resource.model_put.connect_via(model)
    def handle_object_put(sender, obj=None, src=None, service=None):
      if (any(cls._has_changes(obj, attr) for attr in model._tracked_attrs) and
         model.FIRST_CLASS_EDIT):
        cls.handle_first_class_edit(model, obj)

    @signals.Signals.custom_attribute_changed.connect_via(model)
    def handle_custom_attribute_save(sender, obj=None, src=None, service=None):
      cls.handle_first_class_edit(model, obj)

    @common.Resource.model_posted.connect_via(relationship.Relationship)
    @common.Resource.model_put.connect_via(relationship.Relationship)
    def handle_relationship_post(sender, obj=None, src=None, service=None):
      endpoints = {obj.source.type, obj.destination.type}
      if model.__name__ in endpoints:
        target_object = cls._get_object_from_relationship(model, obj)

        handlers = {
            "Document": cls.handle_first_class_edit,
            "Person": cls.handle_person_edit
        }
        for k in handlers.keys():
          if k in endpoints:
            handlers[k](model, target_object, obj)

    @common.Resource.model_posted.connect_via(
        object_document.ObjectDocument)
    def handle_objectdocument_post(sender, obj=None, src=None, service=None):
      if obj.documentable.type == model.__name__:
        cls.handle_first_class_edit(model, obj.documentable)
