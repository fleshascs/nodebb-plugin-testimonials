(function (Module, NodeBB) {
  'use strict';

  Module.exports = {
    db: NodeBB.require('./src/database'),
    notifications: NodeBB.require('./src/notifications'),
    pluginSockets: NodeBB.require('./src/socket.io/plugins'),
    plugins: NodeBB.require('./src/plugins'),
    user: NodeBB.require('./src/user'),
    websockets: NodeBB.require('./src/socket.io')
  };
})(module, require.main);
