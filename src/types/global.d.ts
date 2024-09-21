export {}
declare global {
    interface XMLHttpRequest {
        requestMessage?: {
            request: {
                type: TRequestType
                id: string
                method?: string
                host?: string
                pathname?: string
                search?: string
                hash?: string
                protocol?: string
                body?: string
                sendTime?: number
                responseTime?: number
                timeout?: boolean
                statusCode?: number
                responseText?: string
            }
        }
    }
}
