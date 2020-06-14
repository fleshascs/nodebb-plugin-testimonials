const async = require('async');
const sockets = require('./sockets');
const controller = require('./controller');

(function (Plugin) {
  Plugin.hooks = {
    statics: {
      load: function (params, callback) {
        async.series([async.apply(sockets.init)], callback);
      },
      userDelete: function (params, callback) {
        controller.deleteUserTestimonials(params.uid, callback);
      }
    }
  };
})(module.exports);
