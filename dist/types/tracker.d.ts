import { TMessageType, TRequestType, TVitalsType } from '../core/constant';
export interface App {
    name: string;
    version: string;
}
export interface Endpoint {
    base: string;
    crash?: string;
}
export interface TrackerOptions {
    url: Endpoint;
    app: App;
    user?: string | number;
    autoCatchError?: boolean;
    autoCatchRejection?: boolean;
    autoRecordXHR?: boolean;
    interval?: number;
    maxRetry?: number;
    debug?: boolean;
    maxBodyLength?: number;
    maxResponseTextLength?: number;
    localForageOptions?: LocalForageOptions;
}
export interface TMessage {
    type: TMessageType;
    appName: string;
    appVersion: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    message?: string;
    stack?: string;
    name?: string;
    time: string;
    user?: TrackerOptions['user'];
    pathname: string;
    href: string;
    ua: string;
    referrer: string;
    request?: {
        type: TRequestType;
        id: string;
        method?: string;
        host?: string;
        pathname?: string;
        search?: string;
        hash?: string;
        protocol?: string;
        body?: string;
        sendTime?: number;
        responseTime?: number;
        timeout?: boolean;
        statusCode?: number;
        responseText?: string;
    };
    resource?: Array<{
        type: string;
        name: string;
        size: string;
        duration: string;
    }>;
    vitals?: {
        type: TVitalsType;
        value: number;
    };
    info?: {
        param1?: string;
        param2?: string;
        param3?: string;
        param4?: string;
        param5?: string;
    };
}
