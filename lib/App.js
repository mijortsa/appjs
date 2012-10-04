var EventEmitter   = require('events').EventEmitter,
    Router         = require('./router').Router,
    Window         = require('./window'),
    _App           = require('./bindings').App,
    NativeWindow   = require('./bindings').NativeWindow,
    WindowSettings = require('./settings').WindowSettings,
    AppSettings    = require('./settings').AppSettings;

var _init          = require('./bindings').init,
    decorate       = require('./utils').decorate,
    inherit        = require('./utils').inherit,
    isObject       = require('./utils').isObject,
    staticRouter   = require('./router').staticRouter;

var concat         = Array.prototype.concat;

var pipedEvents    = ['create', 'minimize', 'maximize', 'fullscreen', 'restore', 'move', 'resize'];


module.exports = App;

function App(){
  var self = this;

  process.on('appjs-exit', function(){
    self.exit();
  });

  process.on('appjs-request', function(request, callback){
    self.emit('request', request, callback);
  });

  this.windows = {};
  this.router = new Router(this);
}

inherit(App, EventEmitter, [
  function createWindow(url, options){
    if (!this.settings) {
      this.init();
    }

    options = new WindowSettings(url, options);

    var self = this,
        nativeWindow = new NativeWindow(options),
        window = new Window(nativeWindow, options);

    nativeWindow.name = options.name;
    this.windows[options.name] = window;

    nativeWindow.on('close', function(){
      window.emit('close');
      delete self.windows[options.name];
    });

    pipedEvents.forEach(function(event){
      nativeWindow.pipe(event, window);
    });

    this.emit('create-window', window);

    return window;
  },
  function exit(){
    this.emit('exit');

    Object.keys(this.windows).forEach(function(name){
      var window = this.windows[name];
      if (window && window.close) {
        window.close();
      }
    }, this);

    process.nextTick(function(){
      process.kill(process.pid);
    });
  },
  function serveFilesFrom(root){
    this.router.use(staticRouter(root));
    return this;
  },
  function init(settings){
    if (!this.settings) {
      decorate(this, true, {
        settings: Object.freeze(new AppSettings(settings))
      });
      _init(this.settings);
      this.emit('init', settings);
    }
    return this;
  },
  _App.screenHeight,
  _App.screenWidth,
]);



NativeWindow.prototype.__proto__ = process.EventEmitter.prototype;

decorate(NativeWindow.prototype, [
  function pipe(event, target){
    var emit = target.emit;
    this.on(event, function(){
      emit.apply(target, concat.apply(event, arguments));
    });
  }
]);
