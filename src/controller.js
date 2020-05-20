(function (Controller) {
  'use strict';

  const async = require('async');

  const sockets = require('./sockets');
  const database = require('./database');
  const nodebb = require('./nodebb');

  const notifications = nodebb.notifications;
  const user = nodebb.user;
  const plugins = nodebb.plugins;

  Controller.getUserTestimonials = async function (uid, callerUID, done) {
    const response = {};
    const isAdmin = callerUID ? await user.isAdministrator(callerUID) : false;
    const maxGive = Controller.getMaxGive(isAdmin);
    async.waterfall(
      [
        function (callback) {
          Controller.getUserTestimonialsRaw(uid, function (error, testimonials) {
            if (error) {
              return callback(error);
            }

            callback(null, testimonials);
          });
        },
        function (testimonials, callback) {
          async.map(
            testimonials,
            function (grant, next) {
              Controller.augmentTestimonial(grant, next);
            },
            function (error, testimonials) {
              if (error) {
                return callback(error);
              }
              response.testimonials = testimonials;
              callback();
            }
          );
        },
        function (callback) {
          if (callerUID) {
            user.getUserData(callerUID).then((userData) => {
              response.notEnoughPosts = userData.postcount < 15;
              callback();
            });
            return;
          }
          callback();
        },
        function (callback) {
          if (callerUID) {
            const howManyTimesGave = response.testimonials.reduce((counter, testimonial) => {
              if (testimonial.fromuid === callerUID) {
                counter++;
              }
              return counter;
            }, 0);
            response.howManyCanGive = maxGive - howManyTimesGave;
            response.alreadyGave = howManyTimesGave >= maxGive;
            response.canGive =
              !response.alreadyGave && !response.notEnoughPosts && callerUID !== uid;
          }
          callback(null, response);
        }
      ],
      done
    );
  };

  Controller.deleteUserTestimonials = function (uid, done) {
    async.waterfall(
      [
        async.apply(database.getTestimonialIdsByUser, uid),
        function (testimonialIds, callback) {
          async.each(
            testimonialIds,
            function (tid, next) {
              database.deleteTestimonial(tid, next);
            },
            callback
          );
        }
      ],
      done
    );
  };

  Controller.augmentTestimonial = function (grant, done) {
    async.parallel(
      {
        reason: async.apply(plugins.fireHook, 'filter:parse.raw', grant.reason),
        fromuser: async.apply(Controller.getUser, grant.fromuid)
      },
      function (error, results) {
        if (error) {
          return done(error);
        }

        done(null, Object.assign(grant, results));
      }
    );
  };

  Controller.getMaxGive = function (isAdmin) {
    return isAdmin ? 50 : 1;
  };

  Controller.getUserTestimonialsRaw = function (uid, done) {
    async.waterfall(
      [
        async.apply(database.getTestimonialIdsByUser, uid),
        function (grantIds, callback) {
          if (!grantIds) {
            return callback(null, []);
          }

          database.getTestimonialsByIds(grantIds, callback);
        }
      ],
      done
    );
  };

  Controller.getUser = function (uid, done) {
    user.getUserFields(uid, ['uid', 'picture', 'username', 'userslug'], done);
  };

  Controller.howManyTimesGave = function (testimonials, uid, done) {
    const howManyTimesGave = testimonials.reduce((counter, testimonial) => {
      if (testimonial.fromuid === uid) {
        counter++;
      }
      return counter;
    }, 0);
    done(null, howManyTimesGave);
  };

  Controller.typeToNumber = function typeToNumber(type) {
    switch (type) {
      case 0:
        return -1;
      case 1:
        return 1;
      case 2:
        return 2;
    }
  };

  Controller.buildClientPath = function (UserSlug) {
    return `/user/${UserSlug}/reputation`;
  };

  Controller.giveReputation = function (fromUid, toUid, reasonText, type, token, done) {
    const repToAdd = Controller.typeToNumber(type);
    async.waterfall(
      [
        function (callback) {
          if (!fromUid || !toUid) {
            callback(new Error('All fields must be filled'));
            return;
          }
          if (fromUid === toUid) {
            callback(new Error('cant give reputation to your self.'));
            return;
          }
          if (!repToAdd) {
            callback(new Error('type does not exists.'));
            return;
          }
          if (!reasonText) {
            callback(new Error('reason text can not be empty.'));
            return;
          }
          callback();
        },
        function (callback) {
          user.getUserData(fromUid).then((userData) => {
            if (userData.postcount < 15) {
              callback(new Error('not enouth posts.'));
              return;
            }
            callback();
          });
        },
        async.apply(Controller.getUserTestimonialsRaw, fromUid),
        function (testimonials, callback) {
          Controller.howManyTimesGave(testimonials, fromUid, async (e, howManyTimesGave) => {
            if (e) {
              callback(e);
              return;
            }
            const isAdmin = await user.isAdministrator(fromUid);
            const maxGive = Controller.getMaxGive(isAdmin);
            if (howManyTimesGave >= maxGive) {
              callback(new Error("You can't give more reputation"));
            } else {
              callback();
            }
          });
        },
        async.apply(database.createGrant, toUid, reasonText, type, fromUid, token),
        async.apply(Controller.augmentTestimonial),
        function (testimonial, callback) {
          sockets.emitReceivedTestimonial(fromUid, testimonial);
          user.incrementUserReputationBy(toUid, repToAdd).then(() => {
            callback();
          });
        },
        async.apply(Controller.getUser, toUid),
        function (userData, callback) {
          notifications.create(
            {
              bodyShort: 'You have gained reuptation.',
              nid: 'fromUid:' + fromUid + ':uid:' + toUid,
              from: fromUid,
              path: Controller.buildClientPath(userData.userslug)
            },
            callback
          );
        },
        function (notification, callback) {
          if (notification) {
            notifications.push(notification, toUid, callback);
          }
        }
      ],
      done
    );
  };
})(module.exports);
