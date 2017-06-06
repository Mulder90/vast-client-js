(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DMVAST = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTAd;

VASTAd = (function() {
  function VASTAd() {
    this.id = null;
    this.sequence = null;
    this.system = null;
    this.title = null;
    this.description = null;
    this.advertiser = null;
    this.pricing = null;
    this.survey = null;
    this.errorURLTemplates = [];
    this.impressionURLTemplates = [];
    this.creatives = [];
  }

  return VASTAd;

})();

module.exports = VASTAd;

},{}],3:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var UndefinedError, VASTClient, VASTParser, VASTUtil;

VASTParser = require('./parser');

VASTUtil = require('./util');

UndefinedError = require('./error').UndefinedError;

VASTClient = (function() {
  function VASTClient() {}

  VASTClient.cappingFreeLunch = 0;

  VASTClient.cappingMinimumTimeInterval = 0;

  VASTClient.options = {
    withCredentials: false,
    timeout: 0
  };

  VASTClient.get = function(url, opts, cb) {
    var extend, now, options, parser, timeSinceLastCall;
    now = +new Date();
    extend = exports.extend = function(object, properties) {
      var key, val;
      for (key in properties) {
        val = properties[key];
        object[key] = val;
      }
      return object;
    };
    if (!cb) {
      if (typeof opts === 'function') {
        cb = opts;
      }
      options = {};
    }
    options = extend(this.options, opts);
    if (this.totalCallsTimeout < now) {
      this.totalCalls = 1;
      this.totalCallsTimeout = now + (60 * 60 * 1000);
    } else {
      this.totalCalls++;
    }
    if (this.cappingFreeLunch >= this.totalCalls) {
      cb(null, new UndefinedError());
      return;
    }
    timeSinceLastCall = now - this.lastSuccessfullAd;
    if (timeSinceLastCall < 0) {
      this.lastSuccessfullAd = 0;
    } else if (timeSinceLastCall < this.cappingMinimumTimeInterval) {
      cb(null, new UndefinedError());
      return;
    }
    parser = new VASTParser();
    return parser.parse(url, options, (function(_this) {
      return function(response, err) {
        return cb(response, err);
      };
    })(this));
  };

  (function() {
    var defineProperty, storage;
    storage = VASTUtil.storage;
    defineProperty = Object.defineProperty;
    ['lastSuccessfullAd', 'totalCalls', 'totalCallsTimeout'].forEach(function(property) {
      defineProperty(VASTClient, property, {
        get: function() {
          return storage.getItem(property);
        },
        set: function(value) {
          return storage.setItem(property, value);
        },
        configurable: false,
        enumerable: true
      });
    });
    if (VASTClient.lastSuccessfullAd == null) {
      VASTClient.lastSuccessfullAd = 0;
    }
    if (VASTClient.totalCalls == null) {
      VASTClient.totalCalls = 0;
    }
    if (VASTClient.totalCallsTimeout == null) {
      VASTClient.totalCallsTimeout = 0;
    }
  })();

  return VASTClient;

})();

module.exports = VASTClient;

},{"./error":6,"./parser":9,"./util":15}],4:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTCompanionAd;

VASTCompanionAd = (function() {
  function VASTCompanionAd() {
    this.id = null;
    this.width = 0;
    this.height = 0;
    this.type = null;
    this.staticResource = null;
    this.htmlResource = null;
    this.iframeResource = null;
    this.companionClickThroughURLTemplate = null;
    this.trackingEvents = {};
  }

  return VASTCompanionAd;

})();

module.exports = VASTCompanionAd;

},{}],5:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTCreative, VASTCreativeCompanion, VASTCreativeLinear, VASTCreativeNonLinear,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

VASTCreative = (function() {
  function VASTCreative() {
    this.trackingEvents = {};
  }

  return VASTCreative;

})();

VASTCreativeLinear = (function(_super) {
  __extends(VASTCreativeLinear, _super);

  function VASTCreativeLinear() {
    VASTCreativeLinear.__super__.constructor.apply(this, arguments);
    this.type = "linear";
    this.duration = 0;
    this.skipDelay = null;
    this.mediaFiles = [];
    this.videoClickThroughURLTemplate = null;
    this.videoClickTrackingURLTemplates = [];
    this.videoCustomClickURLTemplates = [];
    this.adParameters = null;
  }

  return VASTCreativeLinear;

})(VASTCreative);

VASTCreativeNonLinear = (function(_super) {
  __extends(VASTCreativeNonLinear, _super);

  function VASTCreativeNonLinear() {
    return VASTCreativeNonLinear.__super__.constructor.apply(this, arguments);
  }

  return VASTCreativeNonLinear;

})(VASTCreative);

VASTCreativeCompanion = (function(_super) {
  __extends(VASTCreativeCompanion, _super);

  function VASTCreativeCompanion() {
    this.type = "companion";
    this.variations = [];
    this.videoClickTrackingURLTemplates = [];
  }

  return VASTCreativeCompanion;

})(VASTCreative);

module.exports = {
  VASTCreativeLinear: VASTCreativeLinear,
  VASTCreativeNonLinear: VASTCreativeNonLinear,
  VASTCreativeCompanion: VASTCreativeCompanion
};

},{}],6:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var NoAdsResponseAfterWrapper, SchemaValidationError, TimeoutVastUri, UndefinedError, VASTError, VastVersionNotSupported, WrapperLimitReached, XMLParsingError,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

VASTError = (function() {
  function VASTError(message, code) {
    this.message = message;
    this.code = code;
  }

  return VASTError;

})();

XMLParsingError = (function(_super) {
  __extends(XMLParsingError, _super);

  function XMLParsingError() {
    XMLParsingError.__super__.constructor.call(this, "XML parsing error.", 100);
  }

  return XMLParsingError;

})(VASTError);

SchemaValidationError = (function(_super) {
  __extends(SchemaValidationError, _super);

  function SchemaValidationError() {
    SchemaValidationError.__super__.constructor.call(this, "VAST schema validation error.", 101);
  }

  return SchemaValidationError;

})(VASTError);

VastVersionNotSupported = (function(_super) {
  __extends(VastVersionNotSupported, _super);

  function VastVersionNotSupported() {
    VastVersionNotSupported.__super__.constructor.call(this, "VAST version of response not supported.", 102);
  }

  return VastVersionNotSupported;

})(VASTError);

TimeoutVastUri = (function(_super) {
  __extends(TimeoutVastUri, _super);

  function TimeoutVastUri() {
    TimeoutVastUri.__super__.constructor.call(this, "Timeout of VAST URI.", 301);
  }

  return TimeoutVastUri;

})(VASTError);

WrapperLimitReached = (function(_super) {
  __extends(WrapperLimitReached, _super);

  function WrapperLimitReached() {
    WrapperLimitReached.__super__.constructor.call(this, "Wrapper limit reached.", 302);
  }

  return WrapperLimitReached;

})(VASTError);

NoAdsResponseAfterWrapper = (function(_super) {
  __extends(NoAdsResponseAfterWrapper, _super);

  function NoAdsResponseAfterWrapper() {
    NoAdsResponseAfterWrapper.__super__.constructor.call(this, "No ads VAST response after one or more Wrappers.", 303);
  }

  return NoAdsResponseAfterWrapper;

})(VASTError);

UndefinedError = (function(_super) {
  __extends(UndefinedError, _super);

  function UndefinedError() {
    UndefinedError.__super__.constructor.call(this, "Undefined error.", 900);
  }

  return UndefinedError;

})(VASTError);

module.exports = {
  XMLParsingError: XMLParsingError,
  SchemaValidationError: SchemaValidationError,
  VastVersionNotSupported: VastVersionNotSupported,
  TimeoutVastUri: TimeoutVastUri,
  WrapperLimitReached: WrapperLimitReached,
  NoAdsResponseAfterWrapper: NoAdsResponseAfterWrapper,
  UndefinedError: UndefinedError
};

},{}],7:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
module.exports = {
  client: require('./client'),
  tracker: require('./tracker'),
  parser: require('./parser'),
  util: require('./util')
};

},{"./client":3,"./parser":9,"./tracker":11,"./util":15}],8:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTMediaFile;

VASTMediaFile = (function() {
  function VASTMediaFile() {
    this.id = null;
    this.fileURL = null;
    this.deliveryType = "progressive";
    this.mimeType = null;
    this.codec = null;
    this.bitrate = 0;
    this.minBitrate = 0;
    this.maxBitrate = 0;
    this.width = 0;
    this.height = 0;
    this.apiFramework = null;
    this.scalable = null;
    this.maintainAspectRatio = null;
  }

  return VASTMediaFile;

})();

module.exports = VASTMediaFile;

},{}],9:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var EventEmitter, NoAdsResponseAfterWrapper, SchemaValidationError, TimeoutVastUri, URLHandler, VASTAd, VASTCompanionAd, VASTCreativeCompanion, VASTCreativeLinear, VASTMediaFile, VASTParser, VASTResponse, VASTUtil, WrapperLimitReached,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

URLHandler = require('./urlhandler');

VASTResponse = require('./response');

VASTAd = require('./ad');

VASTUtil = require('./util');

VASTCreativeLinear = require('./creative').VASTCreativeLinear;

VASTCreativeCompanion = require('./creative').VASTCreativeCompanion;

VASTMediaFile = require('./mediafile');

VASTCompanionAd = require('./companionad');

SchemaValidationError = require('./error').SchemaValidationError;

NoAdsResponseAfterWrapper = require('./error').NoAdsResponseAfterWrapper;

WrapperLimitReached = require('./error').WrapperLimitReached;

TimeoutVastUri = require('./error').TimeoutVastUri;

EventEmitter = require('events').EventEmitter;

VASTParser = (function() {
  function VASTParser() {
    this.URLTemplateFilters = [];
    this.xmlLists = [];
    this.urlLists = [];
    this.trackingEvents = [];
    this.trackingClicks = [];
    this.extensionElements = [];
    this.impressions = [];
    this.vent = new EventEmitter();
    this.error = null;
  }

  VASTParser.prototype.addURLTemplateFilter = function(func) {
    if (typeof func === 'function') {
      this.URLTemplateFilters.push(func);
    }
  };

  VASTParser.prototype.removeURLTemplateFilter = function() {
    return this.URLTemplateFilters.pop();
  };

  VASTParser.prototype.countURLTemplateFilters = function() {
    return this.URLTemplateFilters.length;
  };

  VASTParser.prototype.clearUrlTemplateFilters = function() {
    return this.URLTemplateFilters = [];
  };

  VASTParser.prototype.parse = function(url, options, cb) {
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    return this._parse(url, null, options, function(err, response) {
      return cb(response, err);
    });
  };

  VASTParser.prototype.track = function(templates, errorCode) {
    this.vent.emit('VAST-error', errorCode);
    return VASTUtil.track(templates, errorCode);
  };

  VASTParser.prototype.on = function(eventName, cb) {
    return this.vent.on(eventName, cb);
  };

  VASTParser.prototype.once = function(eventName, cb) {
    return this.vent.once(eventName, cb);
  };

  VASTParser.prototype._parse = function(url, parentURLs, options, cb) {
    var filter, _i, _len, _ref;
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    _ref = this.URLTemplateFilters;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      filter = _ref[_i];
      url = filter(url);
    }
    if (parentURLs == null) {
      parentURLs = [];
    }
    parentURLs.push(url);
    return URLHandler.get(url, options, (function(_this) {
      return function(err, xml) {
        var ad, complete, loopIndex, node, response, _j, _k, _len1, _len2, _ref1, _ref2;
        if (err != null) {
          return cb(err);
        }
        response = new VASTResponse();
        if (!(((xml != null ? xml.documentElement : void 0) != null) && xml.documentElement.nodeName === "VAST")) {
          _this.error = new SchemaValidationError();
          return cb(_this.error, null);
        }
        _ref1 = xml.documentElement.childNodes;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          node = _ref1[_j];
          if (node.nodeName === 'Error') {
            response.errorURLTemplates.push(_this.parseNodeText(node));
          }
        }
        _ref2 = xml.documentElement.childNodes;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          node = _ref2[_k];
          if (node.nodeName === 'Ad') {
            ad = _this.parseAdElement(node);
            if (ad != null) {
              response.ads.push(ad);
            } else {
              _this.error = new SchemaValidationError();
              _this.track(response.errorURLTemplates, {
                ERRORCODE: _this.error.code
              });
            }
          }
        }
        complete = function(error, errorAlreadyRaised) {
          var noCreatives, _l, _len3, _ref3;
          if (error == null) {
            error = null;
          }
          if (errorAlreadyRaised == null) {
            errorAlreadyRaised = false;
          }
          if (!response) {
            return;
          }
          noCreatives = true;
          _ref3 = response.ads;
          for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
            ad = _ref3[_l];
            if (ad.nextWrapperURL != null) {
              return;
            }
            if (ad.creatives.length > 0) {
              noCreatives = false;
            }
          }
          if (noCreatives) {
            if (error == null) {
              _this.error = error = new NoAdsResponseAfterWrapper();
              if (!errorAlreadyRaised) {
                _this.track(response.errorURLTemplates, {
                  ERRORCODE: _this.error.code
                });
              }
              response.ads = [];
            }
          }
          if (response.ads.length === 0) {
            response = null;
          } else {
            _this.xmlLists.push(xml);
            _this.urlLists.push(url);
            response.docxml = _this.xmlLists[0];
            response.lasturl = _this.urlLists[0];
            response.impressions = _this.impressions;
            response.trackingClicks = _this.trackingClicks;
            response.trackingEvents = _this.trackingEvents;
            response.extensionElements = _this.extensionElements;
          }
          return cb(error, response);
        };
        loopIndex = response.ads.length;
        while (loopIndex--) {
          ad = response.ads[loopIndex];
          if (ad.nextWrapperURL == null) {
            continue;
          }
          (function(ad) {
            var baseURL, protocol, _ref3;
            if (parentURLs.length >= 10 || (_ref3 = ad.nextWrapperURL, __indexOf.call(parentURLs, _ref3) >= 0)) {
              _this.error = new WrapperLimitReached();
              _this.track(ad.errorURLTemplates, {
                ERRORCODE: _this.error.code
              });
              response.ads.splice(response.ads.indexOf(ad), 1);
              complete(_this.error);
              return;
            }
            if (ad.nextWrapperURL.indexOf('//') === 0) {
              protocol = location.protocol;
              ad.nextWrapperURL = "" + protocol + ad.nextWrapperURL;
            } else if (ad.nextWrapperURL.indexOf('://') === -1) {
              baseURL = url.slice(0, url.lastIndexOf('/'));
              ad.nextWrapperURL = "" + baseURL + "/" + ad.nextWrapperURL;
            }
            return _this._parse(ad.nextWrapperURL, parentURLs, options, function(err, wrappedResponse) {
              var creative, errorAlreadyRaised, eventName, index, wrappedAd, _base, _l, _len3, _len4, _len5, _len6, _m, _n, _o, _ref4, _ref5, _ref6, _ref7;
              errorAlreadyRaised = false;
              if (err != null) {
                _this.error = err || new TimeoutVastUri();
                _this.track(ad.errorURLTemplates, {
                  ERRORCODE: _this.error.code
                });
                response.ads.splice(response.ads.indexOf(ad), 1);
                errorAlreadyRaised = true;
              } else if (wrappedResponse == null) {
                _this.error = err || new NoAdsResponseAfterWrapper();
                _this.track(ad.errorURLTemplates, {
                  ERRORCODE: _this.error.code
                });
                response.ads.splice(response.ads.indexOf(ad), 1);
                errorAlreadyRaised = true;
              } else {
                response.errorURLTemplates = response.errorURLTemplates.concat(wrappedResponse.errorURLTemplates);
                index = response.ads.indexOf(ad);
                response.ads.splice(index, 1);
                _ref4 = wrappedResponse.ads;
                for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
                  wrappedAd = _ref4[_l];
                  wrappedAd.errorURLTemplates = ad.errorURLTemplates.concat(wrappedAd.errorURLTemplates);
                  wrappedAd.impressionURLTemplates = ad.impressionURLTemplates.concat(wrappedAd.impressionURLTemplates);
                  _this.impressions.push({
                    'url': url,
                    'obj': ad.impressionURLTemplates
                  });
                  if (ad.trackingEvents != null) {
                    _ref5 = wrappedAd.creatives;
                    for (_m = 0, _len4 = _ref5.length; _m < _len4; _m++) {
                      creative = _ref5[_m];
                      if (creative.type === 'linear') {
                        _ref6 = Object.keys(ad.trackingEvents);
                        for (_n = 0, _len5 = _ref6.length; _n < _len5; _n++) {
                          eventName = _ref6[_n];
                          (_base = creative.trackingEvents)[eventName] || (_base[eventName] = []);
                          creative.trackingEvents[eventName] = creative.trackingEvents[eventName].concat(ad.trackingEvents[eventName]);
                        }
                        _this.trackingEvents.push({
                          'url': url,
                          'obj': ad.trackingEvents
                        });
                      }
                    }
                  }
                  if (ad.videoClickTrackingURLTemplates != null) {
                    _ref7 = wrappedAd.creatives;
                    for (_o = 0, _len6 = _ref7.length; _o < _len6; _o++) {
                      creative = _ref7[_o];
                      if (creative.type === 'linear') {
                        creative.videoClickTrackingURLTemplates = creative.videoClickTrackingURLTemplates.concat(ad.videoClickTrackingURLTemplates);
                        _this.trackingClicks.push({
                          'url': url,
                          'obj': ad.videoClickTrackingURLTemplates
                        });
                      }
                    }
                  }
                  response.ads.splice(index, 0, wrappedAd);
                }
              }
              delete ad.nextWrapperURL;
              return complete(_this.error, errorAlreadyRaised);
            });
          })(ad);
        }
        return complete();
      };
    })(this));
  };

  VASTParser.prototype.childByName = function(node, name) {
    var child, _i, _len, _ref;
    _ref = node.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child.nodeName === name) {
        return child;
      }
    }
  };

  VASTParser.prototype.childsByName = function(node, name) {
    var child, childs, _i, _len, _ref;
    childs = [];
    _ref = node.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child.nodeName === name) {
        childs.push(child);
      }
    }
    return childs;
  };

  VASTParser.prototype.parseAdElement = function(adElement) {
    var adTypeElement, _i, _len, _ref, _ref1;
    _ref = adElement.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      adTypeElement = _ref[_i];
      if ((_ref1 = adTypeElement.nodeName) !== "Wrapper" && _ref1 !== "InLine") {
        continue;
      }
      this.copyNodeAttribute("id", adElement, adTypeElement);
      this.copyNodeAttribute("sequence", adElement, adTypeElement);
      if (adTypeElement.nodeName === "Wrapper") {
        return this.parseWrapperElement(adTypeElement);
      } else if (adTypeElement.nodeName === "InLine") {
        return this.parseInLineElement(adTypeElement);
      }
    }
  };

  VASTParser.prototype.parseWrapperElement = function(wrapperElement) {
    var ad, creative, wrapperCreativeElement, wrapperURLElement, _i, _len, _ref;
    ad = this.parseInLineElement(wrapperElement);
    wrapperURLElement = this.childByName(wrapperElement, "VASTAdTagURI");
    if (wrapperURLElement != null) {
      ad.nextWrapperURL = this.parseNodeText(wrapperURLElement);
    } else {
      wrapperURLElement = this.childByName(wrapperElement, "VASTAdTagURL");
      if (wrapperURLElement != null) {
        ad.nextWrapperURL = this.parseNodeText(this.childByName(wrapperURLElement, "URL"));
      }
    }
    wrapperCreativeElement = null;
    _ref = ad.creatives;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      creative = _ref[_i];
      if (creative.type === 'linear') {
        wrapperCreativeElement = creative;
        break;
      }
    }
    if (wrapperCreativeElement != null) {
      if (wrapperCreativeElement.trackingEvents != null) {
        ad.trackingEvents = wrapperCreativeElement.trackingEvents;
      }
      if (wrapperCreativeElement.videoClickTrackingURLTemplates != null) {
        ad.videoClickTrackingURLTemplates = wrapperCreativeElement.videoClickTrackingURLTemplates;
      }
    }
    if (ad.nextWrapperURL != null) {
      return ad;
    }
  };

  VASTParser.prototype.parseInLineElement = function(inLineElement) {
    var ad, creative, creativeElement, creativeTypeElement, e, node, nodeHtml, s, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    ad = new VASTAd();
    ad.id = inLineElement.getAttribute("id") || null;
    ad.sequence = inLineElement.getAttribute("sequence") || null;
    _ref = inLineElement.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      node = _ref[_i];
      switch (node.nodeName) {
        case "Error":
          ad.errorURLTemplates.push(this.parseNodeText(node));
          break;
        case "Impression":
          ad.impressionURLTemplates.push(this.parseNodeText(node));
          break;
        case "Extensions":
          if (node.innerHTML == null) {
            nodeHtml = "";
            try {
              s = new XMLSerializer();
              nodeHtml = s.serializeToString(node);
            } catch (_error) {
              e = _error;
              nodeHtml = node.xml;
            } finally {
              nodeHtml = nodeHtml.replace('<Extensions>', '').replace('</Extensions>', '').trim();
              this.extensionElements.push(nodeHtml);
            }
          } else {
            this.extensionElements.push(node.innerHTML);
          }
          break;
        case "AdSystem":
          ad.system = {
            value: this.parseNodeText(node),
            version: node.getAttribute("version") || null
          };
          break;
        case "AdTitle":
          ad.title = this.parseNodeText(node);
          break;
        case "Description":
          ad.description = this.parseNodeText(node);
          break;
        case "Advertiser":
          ad.advertiser = this.parseNodeText(node);
          break;
        case "Pricing":
          ad.pricing = {
            value: this.parseNodeText(node),
            model: node.getAttribute("model") || null,
            currency: node.getAttribute("currency") || null
          };
          break;
        case "Survey":
          ad.survey = this.parseNodeText(node);
          break;
        case "Creatives":
          _ref1 = this.childsByName(node, "Creative");
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            creativeElement = _ref1[_j];
            _ref2 = creativeElement.childNodes;
            for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
              creativeTypeElement = _ref2[_k];
              switch (creativeTypeElement.nodeName) {
                case "Linear":
                  creative = this.parseCreativeLinearElement(creativeTypeElement);
                  if (creative) {
                    ad.creatives.push(creative);
                  }
                  break;
                case "CompanionAds":
                  creative = this.parseCompanionAd(creativeTypeElement);
                  if (creative) {
                    ad.creatives.push(creative);
                  }
              }
            }
          }
      }
    }
    return ad;
  };

  VASTParser.prototype.parseCreativeLinearElement = function(creativeElement) {
    var adParamsElement, clickTrackingElement, creative, customClickElement, eventName, maintainAspectRatio, mediaFile, mediaFileElement, mediaFilesElement, offset, percent, scalable, skipOffset, trackingElement, trackingEventsElement, trackingURLTemplate, videoClicksElement, _base, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    creative = new VASTCreativeLinear();
    creative.duration = this.parseDuration(this.parseNodeText(this.childByName(creativeElement, "Duration")));
    if (creative.duration <= 0 && creativeElement.parentNode.parentNode.parentNode.nodeName !== 'Wrapper') {
      creative.duration = 1;
    }
    skipOffset = creativeElement.getAttribute("skipoffset");
    if (skipOffset == null) {
      creative.skipDelay = null;
    } else if (skipOffset.charAt(skipOffset.length - 1) === "%") {
      percent = parseInt(skipOffset, 10);
      creative.skipDelay = creative.duration * (percent / 100);
    } else {
      creative.skipDelay = this.parseDuration(skipOffset);
    }
    videoClicksElement = this.childByName(creativeElement, "VideoClicks");
    if (videoClicksElement != null) {
      creative.videoClickThroughURLTemplate = this.parseNodeText(this.childByName(videoClicksElement, "ClickThrough"));
      _ref = this.childsByName(videoClicksElement, "ClickTracking");
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        clickTrackingElement = _ref[_i];
        creative.videoClickTrackingURLTemplates.push(this.parseNodeText(clickTrackingElement));
      }
      _ref1 = this.childsByName(videoClicksElement, "CustomClick");
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        customClickElement = _ref1[_j];
        creative.videoCustomClickURLTemplates.push(this.parseNodeText(customClickElement));
      }
    }
    adParamsElement = this.childByName(creativeElement, "AdParameters");
    if (adParamsElement != null) {
      creative.adParameters = this.parseNodeText(adParamsElement);
    }
    _ref2 = this.childsByName(creativeElement, "TrackingEvents");
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      trackingEventsElement = _ref2[_k];
      _ref3 = this.childsByName(trackingEventsElement, "Tracking");
      for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
        trackingElement = _ref3[_l];
        eventName = trackingElement.getAttribute("event");
        trackingURLTemplate = this.parseNodeText(trackingElement);
        if ((eventName != null) && (trackingURLTemplate != null)) {
          if (eventName === "progress") {
            offset = trackingElement.getAttribute("offset");
            if (!offset) {
              continue;
            }
            if (offset.charAt(offset.length - 1) === '%') {
              eventName = "progress-" + offset;
            } else {
              eventName = "progress-" + (Math.round(this.parseDuration(offset)));
            }
          }
          if ((_base = creative.trackingEvents)[eventName] == null) {
            _base[eventName] = [];
          }
          creative.trackingEvents[eventName].push(trackingURLTemplate);
        }
      }
    }
    _ref4 = this.childsByName(creativeElement, "MediaFiles");
    for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
      mediaFilesElement = _ref4[_m];
      _ref5 = this.childsByName(mediaFilesElement, "MediaFile");
      for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
        mediaFileElement = _ref5[_n];
        mediaFile = new VASTMediaFile();
        mediaFile.id = mediaFileElement.getAttribute("id");
        mediaFile.fileURL = this.parseNodeText(mediaFileElement);
        mediaFile.deliveryType = mediaFileElement.getAttribute("delivery");
        mediaFile.codec = mediaFileElement.getAttribute("codec");
        mediaFile.mimeType = mediaFileElement.getAttribute("type");
        mediaFile.apiFramework = mediaFileElement.getAttribute("apiFramework");
        mediaFile.bitrate = parseInt(mediaFileElement.getAttribute("bitrate") || 0);
        mediaFile.minBitrate = parseInt(mediaFileElement.getAttribute("minBitrate") || 0);
        mediaFile.maxBitrate = parseInt(mediaFileElement.getAttribute("maxBitrate") || 0);
        mediaFile.width = parseInt(mediaFileElement.getAttribute("width") || 0);
        mediaFile.height = parseInt(mediaFileElement.getAttribute("height") || 0);
        scalable = mediaFileElement.getAttribute("scalable");
        if (scalable && typeof scalable === "string") {
          scalable = scalable.toLowerCase();
          if (scalable === "true") {
            mediaFile.scalable = true;
          } else if (scalable === "false") {
            mediaFile.scalable = false;
          }
        }
        maintainAspectRatio = mediaFileElement.getAttribute("maintainAspectRatio");
        if (maintainAspectRatio && typeof maintainAspectRatio === "string") {
          maintainAspectRatio = maintainAspectRatio.toLowerCase();
          if (maintainAspectRatio === "true") {
            mediaFile.maintainAspectRatio = true;
          } else if (maintainAspectRatio === "false") {
            mediaFile.maintainAspectRatio = false;
          }
        }
        creative.mediaFiles.push(mediaFile);
      }
    }
    return creative;
  };

  VASTParser.prototype.parseCompanionAd = function(creativeElement) {
    var companionAd, companionResource, creative, eventName, htmlElement, iframeElement, staticElement, trackingElement, trackingEventsElement, trackingURLTemplate, _base, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    creative = new VASTCreativeCompanion();
    _ref = this.childsByName(creativeElement, "Companion");
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      companionResource = _ref[_i];
      companionAd = new VASTCompanionAd();
      companionAd.id = companionResource.getAttribute("id") || null;
      companionAd.width = companionResource.getAttribute("width");
      companionAd.height = companionResource.getAttribute("height");
      _ref1 = this.childsByName(companionResource, "HTMLResource");
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        htmlElement = _ref1[_j];
        companionAd.type = htmlElement.getAttribute("creativeType") || 'text/html';
        companionAd.htmlResource = this.parseNodeText(htmlElement);
      }
      _ref2 = this.childsByName(companionResource, "IFrameResource");
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        iframeElement = _ref2[_k];
        companionAd.type = iframeElement.getAttribute("creativeType") || 0;
        companionAd.iframeResource = this.parseNodeText(iframeElement);
      }
      _ref3 = this.childsByName(companionResource, "StaticResource");
      for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
        staticElement = _ref3[_l];
        companionAd.type = staticElement.getAttribute("creativeType") || 0;
        companionAd.staticResource = this.parseNodeText(staticElement);
      }
      _ref4 = this.childsByName(companionResource, "TrackingEvents");
      for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
        trackingEventsElement = _ref4[_m];
        _ref5 = this.childsByName(trackingEventsElement, "Tracking");
        for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
          trackingElement = _ref5[_n];
          eventName = trackingElement.getAttribute("event");
          trackingURLTemplate = this.parseNodeText(trackingElement);
          if ((eventName != null) && (trackingURLTemplate != null)) {
            if ((_base = companionAd.trackingEvents)[eventName] == null) {
              _base[eventName] = [];
            }
            companionAd.trackingEvents[eventName].push(trackingURLTemplate);
          }
        }
      }
      companionAd.companionClickThroughURLTemplate = this.parseNodeText(this.childByName(companionResource, "CompanionClickThrough"));
      companionAd.companionClickTrackingURLTemplate = this.parseNodeText(this.childByName(companionResource, "CompanionClickTracking"));
      creative.variations.push(companionAd);
    }
    return creative;
  };

  VASTParser.prototype.parseDuration = function(durationString) {
    var durationComponents, hours, minutes, seconds, secondsAndMS;
    if (!(durationString != null)) {
      return -1;
    }
    durationComponents = durationString.split(":");
    if (durationComponents.length !== 3) {
      return -1;
    }
    secondsAndMS = durationComponents[2].split(".");
    seconds = parseInt(secondsAndMS[0]);
    if (secondsAndMS.length === 2) {
      seconds += parseFloat("0." + secondsAndMS[1]);
    }
    minutes = parseInt(durationComponents[1] * 60);
    hours = parseInt(durationComponents[0] * 60 * 60);
    if (isNaN(hours || isNaN(minutes || isNaN(seconds || minutes > 60 * 60 || seconds > 60)))) {
      return -1;
    }
    return hours + minutes + seconds;
  };

  VASTParser.prototype.parseNodeText = function(node) {
    return node && (node.textContent || node.text || '').trim();
  };

  VASTParser.prototype.copyNodeAttribute = function(attributeName, nodeSource, nodeDestination) {
    var attributeValue;
    attributeValue = nodeSource.getAttribute(attributeName);
    if (attributeValue) {
      return nodeDestination.setAttribute(attributeName, attributeValue);
    }
  };

  return VASTParser;

})();

module.exports = VASTParser;

},{"./ad":2,"./companionad":4,"./creative":5,"./error":6,"./mediafile":8,"./response":10,"./urlhandler":12,"./util":15,"events":1}],10:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTResponse;

VASTResponse = (function() {
  function VASTResponse() {
    this.ads = [];
    this.errorURLTemplates = [];
    this.docxml = "";
  }

  return VASTResponse;

})();

module.exports = VASTResponse;

},{}],11:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var EventEmitter, VASTClient, VASTCreativeLinear, VASTTracker, VASTUtil,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

VASTClient = require('./client');

VASTUtil = require('./util');

VASTCreativeLinear = require('./creative').VASTCreativeLinear;

EventEmitter = require('events').EventEmitter;

VASTTracker = (function(_super) {
  __extends(VASTTracker, _super);

  function VASTTracker(ad, creative) {
    var eventName, events, _ref;
    this.ad = ad;
    this.creative = creative;
    this.muted = false;
    this.impressed = false;
    this.skipable = false;
    this.skipDelayDefault = -1;
    this.trackingEvents = {};
    this.emitAlwaysEvents = ['creativeView', 'start', 'firstQuartile', 'midpoint', 'thirdQuartile', 'complete', 'resume', 'pause', 'rewind', 'skip', 'closeLinear', 'close'];
    _ref = this.creative.trackingEvents;
    for (eventName in _ref) {
      events = _ref[eventName];
      this.trackingEvents[eventName] = events.slice(0);
    }
    if (this.creative instanceof VASTCreativeLinear) {
      this.setDuration(this.creative.duration);
      this.skipDelay = this.creative.skipDelay;
      this.linear = true;
      this.clickThroughURLTemplate = this.creative.videoClickThroughURLTemplate;
      this.clickTrackingURLTemplates = this.creative.videoClickTrackingURLTemplates;
    } else {
      this.skipDelay = -1;
      this.linear = false;
    }
    this.on('start', function() {
      VASTClient.lastSuccessfullAd = +new Date();
    });
  }

  VASTTracker.prototype.setDuration = function(duration) {
    this.assetDuration = duration;
    return this.quartiles = {
      'firstQuartile': Math.round(25 * this.assetDuration) / 100,
      'midpoint': Math.round(50 * this.assetDuration) / 100,
      'thirdQuartile': Math.round(75 * this.assetDuration) / 100
    };
  };

  VASTTracker.prototype.setProgress = function(progress) {
    var eventName, events, percent, quartile, skipDelay, time, _i, _len, _ref;
    skipDelay = this.skipDelay === null ? this.skipDelayDefault : this.skipDelay;
    if (skipDelay !== -1 && !this.skipable) {
      if (skipDelay > progress) {
        this.emit('skip-countdown', skipDelay - progress);
      } else {
        this.skipable = true;
        this.emit('skip-countdown', 0);
      }
    }
    if (this.linear && this.assetDuration > 0) {
      events = [];
      if (progress > 0) {
        events.push("start");
        percent = Math.round(progress / this.assetDuration * 100);
        events.push("progress-" + percent + "%");
        events.push("progress-" + (Math.round(progress)));
        _ref = this.quartiles;
        for (quartile in _ref) {
          time = _ref[quartile];
          if ((time <= progress && progress <= (time + 1))) {
            events.push(quartile);
          }
        }
      }
      for (_i = 0, _len = events.length; _i < _len; _i++) {
        eventName = events[_i];
        this.track(eventName, true);
      }
      if (progress < this.progress) {
        this.track("rewind");
      }
    }
    return this.progress = progress;
  };

  VASTTracker.prototype.setMuted = function(muted) {
    if (this.muted !== muted) {
      this.track(muted ? "mute" : "unmute");
    }
    return this.muted = muted;
  };

  VASTTracker.prototype.setPaused = function(paused) {
    if (this.paused !== paused) {
      this.track(paused ? "pause" : "resume");
    }
    return this.paused = paused;
  };

  VASTTracker.prototype.setFullscreen = function(fullscreen) {
    if (this.fullscreen !== fullscreen) {
      this.track(fullscreen ? "fullscreen" : "exitFullscreen");
    }
    return this.fullscreen = fullscreen;
  };

  VASTTracker.prototype.setSkipDelay = function(duration) {
    if (typeof duration === 'number') {
      return this.skipDelay = duration;
    }
  };

  VASTTracker.prototype.load = function() {
    if (!this.impressed) {
      this.impressed = true;
      this.trackURLs(this.ad.impressionURLTemplates);
      return this.track("creativeView");
    }
  };

  VASTTracker.prototype.errorWithCode = function(errorCode) {
    return this.trackURLs(this.ad.errorURLTemplates, {
      ERRORCODE: errorCode
    });
  };

  VASTTracker.prototype.complete = function() {
    return this.track("complete");
  };

  VASTTracker.prototype.close = function() {
    return this.track(this.linear ? "closeLinear" : "close");
  };

  VASTTracker.prototype.stop = function() {};

  VASTTracker.prototype.skip = function() {
    this.track("skip");
    return this.trackingEvents = [];
  };

  VASTTracker.prototype.click = function() {
    var clickThroughURL, variables, _ref;
    if ((_ref = this.clickTrackingURLTemplates) != null ? _ref.length : void 0) {
      this.trackURLs(this.clickTrackingURLTemplates);
    }
    if (this.clickThroughURLTemplate != null) {
      if (this.linear) {
        variables = {
          CONTENTPLAYHEAD: this.progressFormated()
        };
      }
      clickThroughURL = VASTUtil.resolveURLTemplates([this.clickThroughURLTemplate], variables)[0];
      return this.emit("clickthrough", clickThroughURL);
    }
  };

  VASTTracker.prototype.track = function(eventName, once) {
    var idx, trackingURLTemplates;
    if (once == null) {
      once = false;
    }
    if (eventName === 'closeLinear' && ((this.trackingEvents[eventName] == null) && (this.trackingEvents['close'] != null))) {
      eventName = 'close';
    }
    trackingURLTemplates = this.trackingEvents[eventName];
    idx = this.emitAlwaysEvents.indexOf(eventName);
    if (trackingURLTemplates != null) {
      this.emit(eventName, '');
      this.trackURLs(trackingURLTemplates);
    } else if (idx !== -1) {
      this.emit(eventName, '');
    }
    if (once === true) {
      delete this.trackingEvents[eventName];
      if (idx > -1) {
        this.emitAlwaysEvents.splice(idx, 1);
      }
    }
  };

  VASTTracker.prototype.trackURLs = function(URLTemplates, variables) {
    if (variables == null) {
      variables = {};
    }
    if (this.linear) {
      variables["CONTENTPLAYHEAD"] = this.progressFormated();
    }
    return VASTUtil.track(URLTemplates, variables);
  };

  VASTTracker.prototype.progressFormated = function() {
    var h, m, ms, s, seconds;
    seconds = parseInt(this.progress);
    h = seconds / (60 * 60);
    if (h.length < 2) {
      h = "0" + h;
    }
    m = seconds / 60 % 60;
    if (m.length < 2) {
      m = "0" + m;
    }
    s = seconds % 60;
    if (s.length < 2) {
      s = "0" + m;
    }
    ms = parseInt((this.progress - seconds) * 100);
    return "" + h + ":" + m + ":" + s + "." + ms;
  };

  return VASTTracker;

})(EventEmitter);

module.exports = VASTTracker;

},{"./client":3,"./creative":5,"./util":15,"events":1}],12:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var URLHandler, UndefinedError, flash, xhr;

xhr = require('./urlhandlers/xmlhttprequest');

flash = require('./urlhandlers/flash');

UndefinedError = require('./error').UndefinedError;

URLHandler = (function() {
  function URLHandler() {}

  URLHandler.get = function(url, options, cb) {
    var _ref;
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    if (options.response != null) {
      return cb(null, options.response);
    } else if ((_ref = options.urlhandler) != null ? _ref.supported() : void 0) {
      return options.urlhandler.get(url, options, cb);
    } else if (typeof window === "undefined" || window === null) {
      return require('./urlhandlers/' + 'node').get(url, options, cb);
    } else if (xhr.supported()) {
      return xhr.get(url, options, cb);
    } else if (flash.supported()) {
      return flash.get(url, options, cb);
    } else {
      return cb(new UndefinedError());
    }
  };

  return URLHandler;

})();

module.exports = URLHandler;

},{"./error":6,"./urlhandlers/flash":13,"./urlhandlers/xmlhttprequest":14}],13:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var FlashURLHandler;

FlashURLHandler = (function() {
  function FlashURLHandler() {}

  FlashURLHandler.xdr = function() {
    var xdr;
    if (window.XDomainRequest) {
      xdr = new XDomainRequest();
    }
    return xdr;
  };

  FlashURLHandler.supported = function() {
    return !!this.xdr();
  };

  FlashURLHandler.get = function(url, options, cb) {
    var xdr, xmlDocument;
    if (xmlDocument = typeof window.ActiveXObject === "function" ? new window.ActiveXObject("Microsoft.XMLDOM") : void 0) {
      xmlDocument.async = false;
    } else {
      return cb();
    }
    xdr = this.xdr();
    xdr.open('GET', url);
    xdr.timeout = options.timeout || 0;
    xdr.withCredentials = options.withCredentials || false;
    xdr.send();
    xdr.onprogress = function() {};
    return xdr.onload = function() {
      xmlDocument.loadXML(xdr.responseText);
      return cb(null, xmlDocument);
    };
  };

  return FlashURLHandler;

})();

module.exports = FlashURLHandler;

},{}],14:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var UndefinedError, XHRURLHandler,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

UndefinedError = require('../error').UndefinedError;

XHRURLHandler = (function() {
  function XHRURLHandler() {}

  XHRURLHandler.acceptedStatusCode = [200, 201, 202, 204, 206, 304, 1223];

  XHRURLHandler.xhr = function() {
    var xhr;
    xhr = new window.XMLHttpRequest();
    if ('withCredentials' in xhr) {
      return xhr;
    }
  };

  XHRURLHandler.supported = function() {
    return !!this.xhr();
  };

  XHRURLHandler.get = function(url, options, cb) {
    var xhr;
    if (window.location.protocol === 'https:' && url.indexOf('http://') === 0) {
      return cb(new UndefinedError());
    }
    try {
      xhr = this.xhr();
      xhr.open('GET', url);
      xhr.timeout = options.timeout || 0;
      xhr.withCredentials = options.withCredentials || false;
      xhr.overrideMimeType && xhr.overrideMimeType('text/xml');
      if (options.retryOnFail != null) {
        xhr.retryOnFail = options.retryOnFail;
      } else {
        xhr.retryOnFail = true;
      }
      xhr.onreadystatechange = (function(_this) {
        return function() {
          var opt, _ref;
          if (xhr.readyState === 4) {
            if (_ref = xhr.status, __indexOf.call(_this.acceptedStatusCode, _ref) >= 0) {
              return cb(null, xhr.responseXML);
            } else {
              if (xhr.retryOnFail) {
                opt = {
                  timeout: options.timeout,
                  withCredentials: false,
                  retryOnFail: false
                };
                return _this.get(url, opt, cb);
              } else {
                return cb(null, xhr.responseXML);
              }
            }
          }
        };
      })(this);
      return xhr.send();
    } catch (_error) {
      return cb(new UndefinedError());
    }
  };

  return XHRURLHandler;

})();

module.exports = XHRURLHandler;

},{"../error":6}],15:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var VASTUtil;

VASTUtil = (function() {
  function VASTUtil() {}

  VASTUtil.track = function(URLTemplates, variables) {
    var URL, URLs, i, _i, _len, _results;
    URLs = this.resolveURLTemplates(URLTemplates, variables);
    _results = [];
    for (_i = 0, _len = URLs.length; _i < _len; _i++) {
      URL = URLs[_i];
      if (typeof window !== "undefined" && window !== null) {
        i = new Image();
        _results.push(i.src = URL);
      } else {

      }
    }
    return _results;
  };

  VASTUtil.resolveURLTemplates = function(URLTemplates, variables) {
    var URLTemplate, URLs, key, macro1, macro2, resolveURL, value, _i, _len;
    URLs = [];
    if (variables == null) {
      variables = {};
    }
    if (!("CACHEBUSTING" in variables)) {
      variables["CACHEBUSTING"] = Math.round(Math.random() * 1.0e+10);
    }
    variables["random"] = variables["CACHEBUSTING"];
    for (_i = 0, _len = URLTemplates.length; _i < _len; _i++) {
      URLTemplate = URLTemplates[_i];
      resolveURL = URLTemplate;
      if (!resolveURL) {
        continue;
      }
      for (key in variables) {
        value = variables[key];
        macro1 = "[" + key + "]";
        macro2 = "%%" + key + "%%";
        resolveURL = resolveURL.replace(macro1, value);
        resolveURL = resolveURL.replace(macro2, value);
      }
      URLs.push(resolveURL);
    }
    return URLs;
  };

  VASTUtil.storage = (function() {
    var data, isDisabled, storage, storageError;
    try {
      storage = typeof window !== "undefined" && window !== null ? window.localStorage || window.sessionStorage : null;
    } catch (_error) {
      storageError = _error;
      storage = null;
    }
    isDisabled = function(store) {
      var e, testValue;
      try {
        testValue = '__VASTUtil__';
        store.setItem(testValue, testValue);
        if (store.getItem(testValue) !== testValue) {
          return true;
        }
      } catch (_error) {
        e = _error;
        return true;
      }
      return false;
    };
    if ((storage == null) || isDisabled(storage)) {
      data = {};
      storage = {
        length: 0,
        getItem: function(key) {
          return data[key];
        },
        setItem: function(key, value) {
          data[key] = value;
          this.length = Object.keys(data).length;
        },
        removeItem: function(key) {
          delete data[key];
          this.length = Object.keys(data).length;
        },
        clear: function() {
          data = {};
          this.length = 0;
        }
      };
    }
    return storage;
  })();

  return VASTUtil;

})();

module.exports = VASTUtil;

},{}]},{},[7])(7)
});