import { TrackerOptions } from '../types/tracker';
/**
 * Core tracker class
 * @class Tracker
 */
export declare class Tracker {
    /**
     * 服务端接口地址
     * @type {string}
     */
    url: string;
    /**
     * 服务端接口地址(奔溃日志)
     * @type {string}
     */
    crashUrl?: string;
    /**
     * 项目名称
     * @type {string}
     */
    appName: string;
    /**
     * 项目版本
     * @type {string}
     */
    appVersion: string;
    /**
     * 客户端用户
     * @type {Object}
     */
    user?: string | number;
    /**
     * 是否是debug模式
     * @type {boolean}
     */
    debug: boolean;
    /**
     * 是否自动捕获错误
     * @type {boolean}
     */
    autoCatchError: boolean;
    /**
     * 是否自动捕获未处理的Promise错误
     * @type {boolean}
     */
    autoCatchRejection: boolean;
    /**
     * 是否自动记录网络请求(XHR)
     * @type {boolean}
     */
    autoRecordXHR: boolean;
    /**
     * 数据发送间隔时间
     * @type {number}
     */
    interval: number;
    /**
     * 定时器
     */
    timer: ReturnType<typeof setInterval>;
    /**
     * 发送队列数据到服务器的请求
     */
    request: XMLHttpRequest | null;
    xhrOpen: {
        (method: string, url: string | URL): void;
        (method: string, url: string | URL, async: boolean, username?: string | null | undefined, password?: string | null | undefined): void;
    };
    xhrSend: (body?: Document | XMLHttpRequestBodyInit | null | undefined) => void;
    /**
     * 数据发送失败做多重试次数
     * @type {number}
     */
    maxRetry: number;
    /**
     * 重试次数
     * @type {number}
     */
    retryCount: number;
    /**
     * 等待发送的记录集合
     * @type {Array}
     */
    private queue;
    /**
     * 请求中的XMLHttpRequest
     * @type {Array}
     */
    private pendingQueue;
    /**
     * 请求内容记录的最大长度
     * @type {number}
     */
    maxBodyLength: number;
    /**
     * 请求响应的最大长度
     * @type {number}
     */
    maxResponseTextLength: number;
    /**
     * 是否可以使用持久化
     */
    isCanPersisted: boolean;
    /**
     * @constructor
     * @param {Object} options - Tracker options
     */
    constructor(options: TrackerOptions);
    /**
     * 配置user
     * @param user
     */
    private setUser;
    /**
     * 添加自定义日志
     */
    private info;
    /**
     * 添加错误日志
     * @param err
     */
    private error;
    /**
     * 检查配置是否完整
     * @param {Object} options - Tracker options
     */
    private static checkConfig;
    /**
     * 初始化配置
     * @param {Object} options - Tracker options
     */
    private initConfig;
    /**
     * 初始化localforage
     */
    private initLocalforage;
    /**
     * 处理localforage上次储存的数据
     */
    private sendFromLocalforage;
    /**
     * 绑定事件
     */
    private initRecordEventByConfig;
    /**
     * 监听网页性能关键事件
     */
    private initWebVitalsEvent;
    /**
     * 网页性能
     */
    private recordResourceLoadState;
    /**
     * 页面卸载前要做的清理工作
     */
    private registerBeforeUnloadEvent;
    /**
     * 获取基础消息
     * @param type 消息类型
     * @returns
     */
    private getBasicMessage;
    /**
     * 捕获全局错误
     */
    private catchError;
    /**
     * 捕获未处理的Promise错误
     */
    private catchRejection;
    /**
     * 删除请求中的消息记录
     * @param message 要删除的请求中的消息
     */
    private removePendingMessage;
    /**
     * 记录XHR请求
     */
    private recordXHR;
    /**
     * 替换password
     */
    private static replacePassword;
    /**
     * 格式化队列数据,对敏感数据和超长内容做处理
     * @param error 错误信息
     */
    private formatQueueData;
    /**
     * 向队列添加错误
     * @param error 错误信息
     */
    private add2Queue;
    /**
     * 发送队列数据到服务器
     */
    private send2Server;
    /**
     * 检查是否到达最大重试次数
     */
    private checkCrashState;
    /**
     * 发送奔溃日志
     */
    private sendCrash2Server;
}
