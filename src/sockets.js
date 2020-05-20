const constants = require('./constants'),
  controller = require('./controller'),
  nodebb = require('./nodebb');

const sockets = nodebb.pluginSockets;
const websockets = nodebb.websockets;

(function (Sockets) {
  Sockets.init = function (callback) {
    sockets[constants.SOCKET_NAMESPACE] = {};
    sockets[constants.SOCKET_NAMESPACE].giveReputation = Sockets.giveReputation;
    sockets[constants.SOCKET_NAMESPACE].getUserTestimonials = Sockets.getUserTestimonials;
    callback();
  };

  Sockets.emitReceivedTestimonial = function (uid, testimonial) {
    websockets
      .in('uid_' + uid)
      .emit(`event:${constants.SOCKET_NAMESPACE}.receivedTestimonial`, testimonial);
  };

  Sockets.giveReputation = function (socket, payload, callback) {
    var userId = parseInt(payload.userId);
    controller.giveReputation(
      socket.uid,
      userId,
      payload.reason,
      payload.type,
      undefined,
      callback
    );
  };

  Sockets.getUserTestimonials = function (socket, payload, callback) {
    var userId = parseInt(payload.uid);
    controller.getUserTestimonials(userId, socket.uid, function (error, testimonials) {
      if (error) {
        return callback(error);
      }
      callback(null, testimonials);
    });
  };
})(module.exports);
