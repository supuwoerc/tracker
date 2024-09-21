import localforage from 'localforage'
import { onFCP, onLCP, onCLS, onINP } from 'web-vitals'
import { TMessage, TrackerOptions } from '@/types/tracker'
import { get, isNumber, isObject, isString, uniqueId } from 'lodash-es'
import isIOS from '@/utils/isIOS'
import { TMessageType, TRequestType, TVitalsType } from './constant'

const getProxyArray = () => {
    return new Proxy([], {
        get: (target, key, rec) => {
            return Reflect.get(target, key, rec)
        },
        set: (target, key, value, rec) => {
            const result = Reflect.set(target, key, value, rec)
            // eslint-disable-next-line no-console
            console.log(target)
            return result
        },
    })
}

const defaultStorageKey = 'localforage_tracker'

/**
 * Core tracker class
 * @class Tracker
 */
export class Tracker {
    /**
     * 服务端接口地址
     * @type {string}
     */
    url: string

    /**
     * 服务端接口地址(奔溃日志)
     * @type {string}
     */
    crashUrl?: string

    /**
     * 项目名称
     * @type {string}
     */
    appName: string

    /**
     * 项目版本
     * @type {string}
     */
    appVersion: string

    /**
     * 客户端用户
     * @type {Object}
     */
    user?: string | number

    /**
     * 是否是debug模式
     * @type {boolean}
     */
    debug = false

    /**
     * 是否自动捕获错误
     * @type {boolean}
     */
    autoCatchError = true

    /**
     * 是否自动捕获未处理的Promise错误
     * @type {boolean}
     */
    autoCatchRejection = true

    /**
     * 是否自动记录网络请求(XHR)
     * @type {boolean}
     */
    autoRecordXHR = false

    /**
     * 数据发送间隔时间
     * @type {number}
     */
    interval = 10000

    /**
     * 定时器
     */
    timer: ReturnType<typeof setInterval>

    /**
     * 发送队列数据到服务器的请求
     */
    request: XMLHttpRequest | null = null

    xhrOpen = XMLHttpRequest.prototype.open

    xhrSend = XMLHttpRequest.prototype.send

    /**
     * 数据发送失败做多重试次数
     * @type {number}
     */
    maxRetry = 5

    /**
     * 重试次数
     * @type {number}
     */
    retryCount = 0

    /**
     * 等待发送的记录集合
     * @type {Array}
     */
    private queue: Array<TMessage> = []

    /**
     * 请求中的XMLHttpRequest
     * @type {Array}
     */
    private pendingQueue: Array<TMessage> = []

    /**
     * 请求内容记录的最大长度
     * @type {number}
     */
    maxBodyLength = 500

    /**
     * 请求响应的最大长度
     * @type {number}
     */
    maxResponseTextLength = 500

    /**
     * 是否可以使用持久化
     */
    isCanPersisted = true

    /**
     * @constructor
     * @param {Object} options - Tracker options
     */
    constructor(options: TrackerOptions) {
        Tracker.checkConfig(options)
        this.initConfig(options)
        this.initLocalforage(options.localForageOptions).then(() => {
            this.sendFromLocalforage()
            this.initWebVitalsEvent()
            this.recordResourceLoadState()
            this.initRecordEventByConfig()
            this.registerBeforeUnloadEvent()
            this.timer = setInterval(() => {
                this.send2Server()
            }, this.interval)
        })
    }

    /**
     * 配置user
     * @param user
     */
    public setUser(user: string | number) {
        const callback = (item: TMessage) => {
            item.user = user
        }
        this.user = user
        this.queue.forEach(callback)
        this.pendingQueue.forEach(callback)
    }

    /**
     * 添加自定义日志
     */
    public info(...args: string[]) {
        if (args.length > 0 && args.length < 5) {
            const info: TMessage['info'] = {}
            args.forEach((item, index) => {
                const key = `param${index + 1}` as keyof typeof info
                info[key] = item
            })
            this.queue.push({
                ...this.getBasicMessage(TMessageType.customer),
                info,
            })
        }
    }

    /**
     * 添加错误日志
     * @param err
     */
    public error(err: Error) {
        this.queue.push({
            ...this.getBasicMessage(TMessageType.error),
            message: err.message,
            stack: err.stack,
            name: err.name,
        })
    }

    /**
     * 检查配置是否完整
     * @param {Object} options - Tracker options
     */
    private static checkConfig(options: TrackerOptions) {
        const requiredKeys = ['app.name', 'app.version', 'url.base']
        requiredKeys.forEach((key) => {
            if (!get(options, key)) {
                throw new Error(`tracker config ${key} is required`)
            }
        })
        const mustGtZero = ['interval', 'maxRetry', 'maxBodyLength', 'maxResponseTextLength']
        mustGtZero.forEach((key) => {
            const val = get(options, key)
            if (val) {
                if (!(isNumber(val) && val > 0)) {
                    throw new Error(`tracker config ${key} must be a number greater than 0`)
                }
            }
        })
    }

    /**
     * 初始化配置
     * @param {Object} options - Tracker options
     */
    private initConfig(options: TrackerOptions) {
        const {
            app,
            url,
            debug = false,
            user,
            autoCatchError = true,
            autoCatchRejection = true,
            autoRecordXHR = false,
            interval = 10000,
            maxRetry = 5,
            maxBodyLength = 500,
            maxResponseTextLength = 500,
        } = options
        this.url = url.base
        this.appName = app.name
        this.appVersion = app.version
        this.debug = Boolean(debug)
        this.user = user
        this.autoCatchError = Boolean(autoCatchError)
        this.autoCatchRejection = Boolean(autoCatchRejection)
        this.autoRecordXHR = Boolean(autoRecordXHR)
        if (url.crash) {
            this.crashUrl = url.crash
        }
        if (this.debug) {
            this.queue = getProxyArray()
            this.pendingQueue = getProxyArray()
        }
        if (isNumber(interval)) {
            this.interval = interval
        }
        if (isNumber(maxRetry)) {
            this.maxRetry = maxRetry
        }
        if (isNumber(maxBodyLength)) {
            this.maxBodyLength = maxBodyLength
        }
        if (isNumber(maxResponseTextLength)) {
            this.maxResponseTextLength = maxResponseTextLength
        }
    }

    /**
     * 初始化localforage
     */
    private async initLocalforage(config: LocalForageOptions = {}) {
        localforage.config({
            name: defaultStorageKey,
            ...config,
        })
        return localforage.ready().catch(() => {
            this.isCanPersisted = false
        })
    }

    /**
     * 处理localforage上次储存的数据
     */
    private async sendFromLocalforage() {
        localforage
            .getItem<Array<TMessage>>('queue')
            .then((value) => {
                this.queue = value ?? []
                this.send2Server()
            })
            .then(() => {
                localforage.setItem('queue', null)
            })
    }

    /**
     * 绑定事件
     */
    private initRecordEventByConfig() {
        if (this.autoCatchError) {
            this.catchError()
        }
        if (this.autoCatchRejection) {
            this.catchRejection()
        }
        if (this.autoRecordXHR) {
            this.recordXHR()
        }
    }

    /**
     * 监听网页性能关键事件
     */
    private initWebVitalsEvent() {
        const callback = (type: TVitalsType, value: number): TMessage => {
            return {
                ...this.getBasicMessage(TMessageType.performance),
                vitals: {
                    type,
                    value,
                },
            }
        }
        onFCP((entry) => {
            this.add2Queue(callback(TVitalsType.fcp, entry.value))
        })
        onLCP((entry) => {
            this.add2Queue(callback(TVitalsType.lcp, entry.value))
        })
        onCLS((entry) => {
            this.add2Queue(callback(TVitalsType.cls, entry.value))
        })
        onINP((entry) => {
            this.add2Queue(callback(TVitalsType.inp, entry.value))
        })
    }

    /**
     * 网页性能
     */
    private recordResourceLoadState() {
        const callback = () => {
            setTimeout(() => {
                if (window.performance && performance.getEntriesByType) {
                    const message = this.getBasicMessage(TMessageType.performance)
                    const entries = performance.getEntriesByType('resource')
                    message.resource = message.resource ?? []
                    entries.forEach((item) => {
                        message.resource!.push({
                            // @ts-ignore
                            type: item.initiatorType,
                            name: item.name,
                            // @ts-ignore
                            size: `${(item.transferSize / 1024).toFixed(0)}kb`, // 资源大小
                            duration: `${(item.duration / 1000).toFixed(3)}s`,
                        })
                    })
                    this.add2Queue(message)
                }
            }, 0)
        }
        if (document.readyState === 'complete') {
            callback()
        } else {
            window.addEventListener('load', () => {
                callback()
            })
        }
    }

    /**
     * 页面卸载前要做的清理工作
     */
    private registerBeforeUnloadEvent() {
        window.addEventListener('beforeunload', () => {
            const persisted = () => {
                localforage.setItem('queue', this.queue)
            }
            if (!(this.pendingQueue.length === 0 && this.queue.length === 0)) {
                this.queue = [...this.queue, ...this.pendingQueue]
                this.pendingQueue = []
                if (this.retryCount >= this.maxRetry) {
                    if (this.isCanPersisted) {
                        persisted()
                    } else {
                        this.send2Server()
                    }
                } else {
                    if (!isIOS && 'sendBeacon' in navigator && navigator.sendBeacon(this.url, JSON.stringify(this.queue))) {
                        this.queue = []
                    } else if (this.isCanPersisted) {
                        persisted()
                    } else {
                        this.send2Server()
                    }
                }
            }
        })
    }

    /**
     * 获取基础消息
     * @param type 消息类型
     * @returns
     */
    private getBasicMessage(type: TMessage['type']): TMessage {
        return {
            type,
            appName: this.appName,
            appVersion: this.appVersion,
            time: new Date().toLocaleString(),
            user: this.user,
            pathname: window.location.pathname,
            href: window.location.href,
            ua: navigator.userAgent,
            referrer: document.referrer,
        }
    }

    /**
     * 捕获全局错误
     */
    private catchError() {
        window.addEventListener('error', (event) => {
            if (!/chrome-extension:\/\//.test(event.filename)) {
                const temp: TMessage = {
                    ...this.getBasicMessage(TMessageType.error),
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    message: event.message ?? event.error?.message,
                    stack: event.error?.stack,
                    name: event.error?.name,
                }
                this.add2Queue(temp)
            }
        })
    }

    /**
     * 捕获未处理的Promise错误
     */
    private catchRejection() {
        window.addEventListener('unhandledrejection', (event) => {
            const temp: TMessage = {
                message: event.reason?.message,
                stack: event.reason?.stack,
                name: event.reason?.name,
                ...this.getBasicMessage(TMessageType.error),
            }
            this.add2Queue(temp)
        })
    }

    /**
     * 删除请求中的消息记录
     * @param message 要删除的请求中的消息
     */
    private removePendingMessage(id: string) {
        const index = this.pendingQueue.findIndex((item) => item.request?.id === id)
        if (index > -1) {
            this.pendingQueue.splice(index, 1)
        }
    }

    /**
     * 记录XHR请求
     */
    private recordXHR() {
        const self = this
        XMLHttpRequest.prototype.open = function (...args: any) {
            const id = uniqueId(new Date().valueOf().toString())
            let url: URL
            try {
                if (isString(args[1])) {
                    url = new URL(args[1])
                } else {
                    url = args[1]
                }
                this.requestMessage = {
                    request: {
                        type: TRequestType.XMLHttpRequest,
                        id,
                        method: args[0],
                        host: url?.hostname,
                        pathname: url?.pathname,
                        search: url?.search,
                        hash: url?.hash,
                        protocol: url?.protocol,
                    },
                }
            } catch (error) {
                this.requestMessage = {
                    request: { type: TRequestType.XMLHttpRequest, id, method: args[0] },
                }
            }
            self.xhrOpen.apply(this, args)
        }
        XMLHttpRequest.prototype.send = function (body) {
            if (this.requestMessage) {
                this.requestMessage.request.sendTime = new Date().valueOf()
                if (body) {
                    this.requestMessage.request.body = isString(body) ? body : JSON.stringify(body)
                }
                const message: TMessage = {
                    ...this.requestMessage,
                    ...self.getBasicMessage(TMessageType.request),
                }
                self.pendingQueue.push(message)
                this.ontimeout = function () {
                    message.request!.responseTime = new Date().valueOf()
                    message.request!.timeout = true
                    self.removePendingMessage(message.request!.id)
                    self.add2Queue(message)
                }
                this.onreadystatechange = function () {
                    if (this.readyState === XMLHttpRequest.DONE) {
                        message.request!.responseTime = new Date().valueOf()
                        message.request!.timeout = false
                        message.request!.responseText = this.responseType === '' || this.responseType === 'text' ? this.responseText : ''
                        message.request!.statusCode = this.status
                        self.removePendingMessage(message.request!.id)
                        self.add2Queue(message)
                    }
                }
            }
            self.xhrSend.call(this, body)
        }
    }

    /**
     * 替换password
     */
    private static replacePassword(str: string) {
        const reg = /(password['"]*[:=]?)[\s\S]{5}/g
        return str.replace(reg, '$1*')
    }

    /**
     * 格式化队列数据,对敏感数据和超长内容做处理
     * @param error 错误信息
     */
    private formatQueueData(item: TMessage) {
        if (!isObject(item) || Object.keys(item).length === 0) {
            return null
        }
        if (item.type === TMessageType.request) {
            if (item.request) {
                let { body, responseText } = item.request
                if (body) {
                    body = Tracker.replacePassword(body)
                }
                if (responseText) {
                    responseText = Tracker.replacePassword(responseText)
                }
                if (body && body.length > this.maxBodyLength) {
                    body = body.substring(0, this.maxBodyLength)
                }
                if (responseText && responseText.length > this.maxResponseTextLength) {
                    responseText = responseText.substring(0, this.maxResponseTextLength)
                }
                item.request.body = body
                item.request.responseText = responseText
            }
        }
        return item
    }

    /**
     * 向队列添加错误
     * @param error 错误信息
     */
    private add2Queue(item: TMessage) {
        const temp = this.formatQueueData(item)
        if (temp) {
            this.queue.push(item)
        }
    }

    /**
     * 发送队列数据到服务器
     */
    private send2Server() {
        const queueLength = this.queue.length
        if (queueLength > 0) {
            if (this.request !== null) {
                // 上次的请求还未完成
                this.request.onreadystatechange = null
                this.request.abort()
            }
            try {
                this.request = new XMLHttpRequest()
                this.xhrOpen.call(this.request, 'POST', this.url, true)
                this.request.timeout = 10000
                this.request.onreadystatechange = () => {
                    if (this.request?.readyState === XMLHttpRequest.DONE) {
                        if (this.request.status >= 200 && this.request.status < 400) {
                            this.request = null
                            this.queue.splice(0, queueLength) // 发送过程中可能有新的内容加入数组,不能清空数组
                            this.retryCount = 0
                        } else {
                            this.request = null
                            this.checkCrashState()
                        }
                    }
                }
                this.request.ontimeout = () => {
                    this.request = null
                    this.checkCrashState()
                }
                this.xhrSend.call(this.request, JSON.stringify(this.queue))
            } catch (error) {
                this.request = null
                this.checkCrashState()
            }
        }
    }

    /**
     * 检查是否到达最大重试次数
     */
    private checkCrashState() {
        this.retryCount += 1
        if (this.retryCount >= this.maxRetry) {
            clearInterval(this.timer)
            this.sendCrash2Server()
        }
    }

    /**
     * 发送奔溃日志
     */
    private sendCrash2Server() {
        if (this.crashUrl) {
            if (this.request !== null) {
                // 上次的请求还未完成
                this.request.onreadystatechange = null
                this.request.abort()
            }
            try {
                this.request = new XMLHttpRequest()
                this.xhrOpen.call(this.request, 'POST', this.crashUrl, true)
                this.request.timeout = 10000
                this.request.onreadystatechange = () => {
                    if (this.request?.readyState === XMLHttpRequest.DONE) {
                        this.request = null
                    }
                }
                this.request.ontimeout = () => {
                    this.request = null
                }
                const crashLog: TMessage = {
                    ...this.getBasicMessage(TMessageType.crash),
                }
                this.xhrSend.call(this.request, JSON.stringify(crashLog))
            } catch (error) {
                this.request = null
            }
        }
    }
}
