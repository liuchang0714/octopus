/**
 * @file
 * webapp通用组件结构文件
 * 定义模块管理
 * @require lib/class.js
 * @require lib/util.js
 * @require lib/dom.js
 * @require lib/event.js
 * @author oupeng-fe
 * @version 0.1
 */
;(function(o, undefined) {

    "use strict";

    o.app = (function() {

        var app = null;

        /**
         * @private
         * @method registerModule
         * @param id
         * @param func
         * @param immediate
         */
        function registerModule(id, func, immediate) {
            initialize(undefined).registerModule(id, func, immediate);
        }

        /**
         * @private
         * @method registerInterface
         * @param id
         * @param func
         */
        function registerInterface(id, func) {
            initialize(undefined).registerInterface(id, func);
        }

        /**
         * @private
         * @method initialize
         * @param options
         */
        function initialize(options) {
            return !app ? (app = new o.App(options), app) : (!!options ? (console.log("The app has already exist! Failure to set up the config"), app) : app);
        }

        return {
            /**
             * @public
             * @method octopus.app.registerModule
             * @param id
             * @param func
             * @param immediate
             * @desc 注册一个模块
             */
            registerModule: registerModule,

            /**
             * @public
             * @method octopus.app.registerInterface
             * @param id
             * @param func
             * @desc 注册一个通用Api模块
             */
            registerInterface: registerInterface,

            /**
             * @public
             * @property octopus.app.initialize
             * @param options
             * @desc 初始化app对象 如果不被调用则按照默认属性初始化
             * @returns {octopus.App|app}
             */
            initialize: initialize
        };
    })();

    o.App = o.define({

        /**
         * @private
         * @property id
         * @type {String}
         */
        id: null,

        /**
         * @private
         * @property el
         * @type {DOMElement}
         * @desc app的根节点
         */
        el: null,

        /**
         * @private
         * @property viewEl
         * @type {DOMElement}
         * @desc 可视节点
         */
        viewEl: null,

        /**
         * @private
         * @property layers
         * @type {Array}
         * @desc 管理的模块
         */
        layers: null,

        /**
         * @private
         * @property currentLayer
         * @type {o.Layer}
         */
        currentLayer: null,

        /**
         * @private
         * @property cmds
         * @type {Array <octopus.Cmd>}
         */
        cmds: null,

        /**
         * @private
         * @property cacheCreator
         * @desc 生成器 包括模块、interface
         */
        cacheCreator: null,

        /**
         * @private
         * @property events
         * @type {o.Events}
         */
        events: null,

        /**
         * @private
         * @property eventListeners
         * @type {Object}
         */
        eventListeners: null,

        /**
         * @private
         * @property cmdManager
         * @type {o.CmdManager}
         */
        cmdManager: null,

        /**
         * @private
         * @property eventCaches
         * @desc 事件缓存 主要防止 一些模块未就位时的事件分发
         * @type {Array}
         */
        eventCaches: null,

        /**
         * @private
         * @property isLoad
         * @type {Boolean}
         */
        isLoad: false,

        /**
         * @private
         * @property config
         * @desc 配置项
         */
        config: null,

        /**
         * @private
         * @property isResize
         * @type {Boolean}
         */
        isResize: false,

        /**
         * @private
         * @property widgets
         */
        widgets: null,

        /**
         * @private
         * constructor
         */
        initialize: function(options) {
            var config = this.config = o.extend({}, options);
            this.cacheCreator = {"module": {}, "interface": {}};
            this.eventCaches = [];
            this.id = config.id || o.util.createUniqueID(this.CLASS_NAME + "_");

            //监听window事件 启动模块
            o.event.on(window, "DOMContentLoaded", o.util.bind(this.onWindowLoad, this));
            o.event.on(window, "resize", o.util.bind(this.onWindowResize, this));
            if("orientationchange" in window) {
                o.event.on(window, "orientationchange", o.util.bind(this.onOrientationChanged, this));
            }
            this.events = new o.Events(this);
            if(config.eventListeners && o.util.isObject(config.eventListeners)) {
                this.eventListeners = config.eventListeners;
                this.events.register(this.eventListeners);
            }
            //命令搞上去
            this.cmdManager = new o.CmdManager({
                app: this
            });
            if(config.cmds) {
                this.cmds = config.cmds;
                o.util.each(this.cmds, o.util.bind(this.registerCmd, this));
                this.cmds.length = 0;
            }
        },

        /**
         * @public
         * @method octopus.App.registerCmd
         * @param cmd {octopus.Cmd}
         */
        registerCmd: function(cmd) {
            this.cmdManager.register(cmd);
        },

        /**
         * @public
         * @method octopus.App.executeCmd
         * @param name {String}
         * @param ops {Object}
         * @desc 执行指定命令
         */
        executeCmd: function(name, ops) {
            this.cmdManager.executeCommand(name, ops);
        },

        /**
         * @public
         * @method octopus.App.unregisterCmd
         * @param name {String}
         */
        unregisterCmd: function(name) {
            this.cmdManager.unregister(name);
        },

        /**
         * @public
         * @method octopus.App.registerModule
         * @param id {String}
         * @param module {Object | octopus.Module}
         * @param immediate {Boolean}
         */
        registerModule: function(id, module, immediate) {
            this.register2CacheCreator(id, "module", module);
            return (this.isLoad || !!immediate) ? (this.startCreator(id, "module"), true) : false;
        },

        /**
         * @private
         * @method register2CacheCreator
         * @param id {String} 注册的id
         * @param type {String} 注册的类型 "module" | "interface"
         * @param creator {Object | Function} 构造器
         */
        register2CacheCreator: function(id, type, creator) {
            return this.cacheCreator[type][id] = {
                creator: creator,
                instance: null
            };
        },

        /**
         * @private
         * @method startCreator
         * @param id {String}
         * @param type {String}
         */
        startCreator: function(id, type) {
            var creator = this.cacheCreator[type][id];
            if(creator.instance)   return;
            creator.instance = creator.creator(this);
            creator.instance.initialize && creator.instance.initialize();
        },

        /**
         * @public
         * @method octopus.App.registerInterface
         * @param id {String}
         * @param inter {Function}
         */
        registerInterface: function(id, inter) {
            var instance = this.register2CacheCreator(id, "interface", inter);
            this.startCreator(id, "interface");
        },

        /**
         * @private
         * @method octopus.App.getInterface
         * @param id {String}
         */
        getInterface: function(id) {
            return this.getBy("interface", id);
        },

        /**
         * @private
         * @method octopus.App.getModule
         * @param id {String}
         */
        getModule: function(id) {
            return this.getBy("module", id);
        },

        /**
         * @private
         * @method octopus.getBy
         * @param type
         * @param id
         */
        getBy: function(type, id) {
            return this.cacheCreator[type][id].instance;
        },

        /**
         * @public
         * @method octopus.App.on
         * @param type {String} 事件名
         * @param func {Function} 回调
         */
        on: function(type, func) {
            this.events.on(type, func);
        },

        /**
         * @public
         * @method octopus.App.un
         * @param type {String} 事件名
         * @param func {Function} 回调
         */
        un: function(type, func) {
            this.events.un(type, func);
        },

        /**
         * @public
         * @method octopus.App.notify
         * @desc 触发某自定义事件
         * @param type {String}
         * @param evt {Object}
         */
        notify: function(type, evt) {
            if(!this.isLoad) {
                this.eventCaches.push([type, evt]);
                return;
            }
            this.events.triggerEvent(type, evt);
        },

        /**
         * @private
         * @method onWindowLoad
         * @desc 监听onload事件
         */
        onWindowLoad: function() {
            if(this.config.el) {
                this.initDomMode();
            }
            o.util.each(this.cacheCreator["module"], o.util.bind(this.startModule, this))
            this.isLoad = true;
            if(this.eventCaches) {
                var item;
                while(item = this.eventCaches.shift()) {
                    this.notify(item[0], item[1]);
                }
            }
            this.notify("Global-OctopusApp-ModuleCompleted", {});
        },

        /**
         * @private
         * @method initDomMode
         */
        initDomMode: function() {
            //节点模式
            var config = this.config,
                node = o.g(config.el),
                id = this.id + "_Octopus_ViewPort";
            this.el = o.dom.cloneNode(node, true);
            this.viewEl = o.dom.createDom("div", {
                id: id
            }, {
                width: "100%",
                height: "100%",
                position: "relative",
                "z-index": 300,
                overflow: "hidden"
            });
            this.el.appendChild(this.viewEl);
            //如果是节点模式且拥有图层
            this.layers = [];
            if(config.layers) {
                o.util.each(config.layers, o.util.bind(this.addLayer, this));
            }
            //如果是节点模式且初始化widget控件
            if(config.widgets) {
                this.widgets = [];
                o.util.each(config.widgets, o.util.bind(this.addWidget, this));
            }
            //把被搞得面目全非的el加入文档流
            if(node) {
                node.parentNode.replaceChild(this.el, node);
                this.notify("Global-OctopusApp-AppCompleted");
            }
        },

        /**
         * @private
         * @method onOrientationChanged
         * @desc 监听横竖屏切换事件
         */
        onOrientationChanged: function() {
            this.notify("Global-OctopusApp-OnOrientationChanged");
        },

        /**
         * @private
         * @method onWindowResize
         */
        onWindowResize: function() {
            if(!this.isResize) {
                o.util.requestAnimation(o.util.bind(this.checkSize, this));
                this.isResize = true;
            }
        },

        /**
         * @private
         * @method checkSize
         */
        checkSize: function() {
            this.isResize = false;
            this.notify("Global-OctopusApp-OnWindowResize");
        },

        /**
         * @private
         * @method startModule
         */
        startModule: function(creator, id) {
            this.startCreator(id, "module");
        },

        /**
         * @public
         * @method octopus.App.addLayer
         * @desc 给当前dom上增加图层 如果不存在this.el 则此方法没实际效果
         * @param layer {octopus.Layer}
         */
        addLayer: function(layer) {
            if(this.layers.indexOf(layer) != -1)  return;
            var el = layer.getEl();
            o.dom.addClass(el, "octopus-app-layer");
            this.setLayerZIndex(layer, this.layers.length);
            if(layer.isBaseLayer) {
                this.el.appendChild(el);
            } else {
                this.viewEl.appendChild(el);
            }
            if(layer.isCurrent) {
                this.setCurrentLayer(layer);
            }
            this.layers.push(layer);
            layer.setApp(this);
            this.notify("Global-OctopusApp-LayerAdd", {layer: layer});
            layer.afterAdd();
        },

        /**
         * @public
         * @method octopus.App.setCurrentLayer
         * @param layer
         */
        setCurrentLayer: function(layer) {
            if(this.currentLayer) {
                this.currentLayer.setCurrent(false);
            }
            this.currentLayer = layer;
            layer.setCurrent(true);
            this.notify("Global-OctopusApp-CurrentLayerChanged", {layer: layer});
        },

        /**
         * @private
         * @method setLayerZIndex
         * @desc 设置图层的index
         * @param layer {octopus.Layer}
         * @param zIdx {Number}
         */
        setLayerZIndex: function(layer, zIdx) {
            layer.setZIndex(this.Z_INDEX_BASE[layer.isBaseLayer ? "BaseLayer" : "Layer"] + zIdx * 5);
        },

        /**
         * @private
         * @method octopus.App.resetLayersZIndex
         * @desc reset图层zindex
         */
        resetLayersZIndex: function() {
            var that = this;
            o.util.each(this.layers, function(layer, i) {
                that.setLayerZIndex(layer, i);
            })
        },

        /**
         * @private
         * @method getTopZIndex
         */
        getTopZIndex: function() {
            var topIndex = {
                zindex: 0,
                index: 0
            };
            o.util.each(this.layers, function(layer, i) {
                var _zindex = layer.getEl().style.zIndex || 0;
                if(_zindex > topIndex.zindex) {
                    topIndex = {
                        zindex: _zindex,
                        index: i
                    }
                }
            });
            return topIndex;
        },

        /**
         * @public
         * @method octopus.App.topLayer
         */
        topLayer: function(layer) {
            var topIndex = this.getTopZindex(),
                index = layer.div.style.zIndex;
            if(topIndex == index)	return;
            layer.div.style.zIndex = topIndex.zindex;
            this.layers[topIndex.index].div.style.zIndex = index;
        },

        /**
         * @public
         * @method octopus.App.getLayer
         * @param id {String}
         * @desc 靠id获取图层
         */
        getLayer: function(id) {
            var layer = null;
            o.util.each(this.layers, function(_layer) {
                if(id == _layer.id) {
                    layer = _layer;
                    return true;
                }
            });
            return layer;
        },

        /**
         * @public
         * @method octopus.App.removeLayer
         * @param layer
         * @desc 删掉图层
         */
        removeLayer: function(layer) {
            layer.getEl().parentNode.removeChild(layer.getEl());
            o.util.removeItem(this.layers, layer);
            layer.removeApp(this);
            layer.app = null;
            this.resetLayersZIndex();
            this.notify("Global-OctopusApp-LayerRemove", {layer: layer});
        },

        /**
         * @public
         * @method octopus.App.addWidget
         * @param widget {octopus.Widget}
         * @desc 添加widget到app里
         */
        addWidget: function(widget) {
            var i = 0,
                len = this.widgets.length;
            for(; i < len; i++) {
                if (this.widgets[i] == widget) {
                    return false;
                }
            }
            widget.setApp(this);
            widget.container = widget.outsideViewport ? this.el : this.viewEl;
            widget.render();
        },

        /**
         * @public
         * @method octopus.App.getWidget
         * @param id
         */
        getWidget: function(id) {
            var widget = null,
                i = 0,
                len = this.widgets.length;
            o.util.each(this.widgets, function(_widget) {
                if(_widget.id == id) {
                    widget = _widget;
                    return true;
                }
            });
            return widget;
        },

        /**
         * @public
         * @method octopus.App.removeWidget
         * @param widget {octopus.Widget}
         */
        removeWidget: function(widget) {
            if ((widget) && (widget == this.getWidget(widget.id))) {
                widget.el.parentNode.removeChild(widget.el);
                o.util.removeItem(this.widgets, widget);
            }
        },

        Z_INDEX_BASE: {
            BaseLayer: 0,
            Layer: 350,
            Popup: 750,
            Widget: 1000
        },

        CLASS_NAME: "octopus.App"
    });
})(octopus);