/**
 * @file
 * webapp通用组件基础库文件
 * 模板引擎部分
 * @require lib/class.js
 * @require lib/util.js
 * @author oupeng-fe
 * @version 1.1
 */
;(function(o, undefined) {

    "use strict";

    /**
     * @namespace octopus.template
     */
    o.template = o.template || {};

    o.extend(o.template, {

        /**
         * @private
         * @property caches
         * @type {Object}
         */
        caches: {},

        /**
         * @private
         * @method templateText
         * @param element
         */
        templateText: function(element) {
            if(!o.util.isNode(element)) return "";
            if(/^(input|textarea)$/i.test(element.tagName)) return element.value;
            return o.util.decodeHtml(element.innerHTML);
        },

        /**
         * @private
         * @method register
         * @param id {String}
         * @param target {DOMElement}
         */
        register: function(id, target) {
            if(!id) return;
            if(this.caches[id]) {
                return this.caches[id];
            }
            return this.caches[id] = this.parse(o.util.isString(target) ? target : this.templateText(o.g(target)));
        },

        /**
         * @private
         * @method parse
         * @param template {String}
         */
        parse: function(template) {
            var body = [];
            body.push("with(this){");
            body.push(template
                .replace(/[\r\n]+/g, "\n") // 去掉多余的换行，并且去掉IE中困扰人的\r
                .replace(/^\n+|\s+$/mg, "") // 去掉空行，首部空行，尾部空白
                .replace(/((^\s*[<>!#^&\u0000-\u0008\u007F-\uffff].*$|^.*[<>]\s*$|^(?!\s*(else|do|try|finally)\s*$)[^'":;,\[\]{}()\n\/]+$|^(\s*(([\w-]+\s*=\s*"[^"]*")|([\w-]+\s*=\s*'[^']*')))+\s*$|^\s*([.#][\w\-.]+(:\w+)?(\s*|,))*(?!(else|do|while|try|return)\b)[.#]?[\w\-\.*]+(:\w+)?\s*\{.*$)\s?)+/mg, function(expression) { // 输出原文
                    expression = ['"', expression
                        .replace(/&none;/g, "") // 空字符
                        .replace(/["'\\]/g, "\\$&") // 处理转义符
                        .replace(/\n/g, "\\n") // 处理回车转义符
                        .replace(/(!?#)\{(.*?)\}/g, function (all, flag, template) { // 变量替换
                            template = template.replace(/\\n/g, "\n").replace(/\\([\\'"])/g, "$1"); // 还原转义
                            var identifier = /^[a-z$][\w+$]+$/i.test(template) &&
                                !(/^(true|false|NaN|null|this)$/.test(template)); // 单纯变量，加一个未定义保护
                            return ['",',
                                identifier ? ['typeof ', template, '=="undefined"?"":'].join("") : "",
                                (flag == "#" ? '_encode_' : ""),
                                '(', template, '),"'].join("");
                        }), '"'].join("").replace(/^"",|,""$/g, "");
                    if (expression)
                        return ['_output_.push(', expression, ');'].join("");
                    else return "";
                }));
            body.push("}");
            var result = new Function("_output_", "_encode_", "helper", body.join(""));
            return result;
        },

        /**
         * @public
         * @method octopus.template.format
         */
        format: function(id, data, helper) {
            if (!id) return "";
            var reader, element;
            if (o.util.isNode(id)) { // 如果是Dom对象
                element = id;
                id = element.getAttribute("id");
            }
            helper = helper || this;
            reader = this.caches[id];
            if(!reader) {
                if(!/[^\w-]/.test(id)) {
                    if(!element) {
                        element = o.g(id);
                    }
                    reader = this.register(id, element);
                } else {
                    reader = this.parse(id);
                }
            }
            var output = [];
            reader.call(data || "", output, o.util.encodeHtml, helper);
            return output.join("");
        }
    });
})(octopus);