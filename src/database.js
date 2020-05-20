(function (Database) {
  'use strict';

  var async = require('async');

  var constants = require('./constants'),
    nodebb = require('./nodebb');

  var db = nodebb.db,
    namespace = constants.NAMESPACE,
    nextGrantId = constants.GLOBAL_GRANT_COUNTER;

  Database.getTestimonialIdsByUser = function (uid, done) {
    db.getSortedSetRevRange(namespace + ':user:' + uid, 0, -1, done);
  };

  Database.getTestimonialsByIds = function (ids, done) {
    db.getObjects(
      ids.map(function (gid, index) {
        return namespace + ':testimonial:' + gid;
      }),
      done
    );
  };

  Database.deleteTestimonial = function (gid, done) {
    db.getObject(namespace + ':testimonial:' + gid, function (error, grant) {
      if (error) {
        return done(error);
      } else if (!grant) {
        return done(new Error('Grant Object can not be found'));
      }

      async.parallel(
        [
          async.apply(db.delete, namespace + ':testimonial:' + grant.gid),
          async.apply(db.sortedSetRemove, namespace + ':user:' + grant.uid, gid)
        ],
        done
      );
    });
  };

  Database.createGrant = function (uid, reason, type, initiatorUid, token, done) {
    async.waterfall(
      [
        async.apply(db.incrObjectField, 'global', nextGrantId),
        function (gid, next) {
          var createTime = Date.now();
          var grant = {
            uid: uid,
            fromuid: initiatorUid,
            gid: gid,
            type: type,
            createtime: createTime,
            reason: reason,
            token: token
          };
          async.parallel(
            [
              async.apply(db.sortedSetAdd, namespace + ':user:' + uid, createTime, gid),
              async.apply(db.setObject, namespace + ':testimonial:' + gid, grant)
            ],
            function (error) {
              if (error) {
                return next(error);
              }
              next(null, grant);
            }
          );
        }
      ],
      done
    );
  };
})(module.exports);
