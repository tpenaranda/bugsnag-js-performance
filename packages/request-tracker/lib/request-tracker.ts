export interface RequestStartContext {
  url: string
  method: string
  startTime: number
  type: 'fetch' | 'xmlhttprequest'
}

export interface RequestEndContextSuccess {
  endTime: number
  status: number
  state: 'success'
}

export interface RequestEndContextError {
  endTime: number
  state: 'error'
  error?: Error
}

export type RequestEndContext = RequestEndContextSuccess | RequestEndContextError

export type RequestStartCallback = (context: RequestStartContext) => RequestEndCallback | undefined

export type RequestEndCallback = (context: RequestEndContext) => void

export class RequestTracker {
  private callbacks: RequestStartCallback[] = []

  onStart (startCallback: RequestStartCallback) {
    this.callbacks.push(startCallback)
  }

  start (context: RequestStartContext) {
    const endCallbacks: RequestEndCallback[] = []
    for (const startCallback of this.callbacks) {
      const endCallback = startCallback(context)
      if (endCallback) endCallbacks.push(endCallback)
    }

    return (endContext: RequestEndContext) => {
      for (const endCallback of endCallbacks) {
        endCallback(endContext)
      }
    }
  }
}