import { Deferred } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc/lib/common/connection';

import { ProtocolRepository } from '../protocol-repository';
import { ProxyJSONRPC, NOTREGISTERMETHOD, ProxyClient, ProxySumi } from '../proxy';
import { TSumiProtocol } from '../sumi-rpc';
import { BinaryConnection } from '../sumi-rpc/connection';
import { IBench, ILogger, IRPCServiceMap, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';

export interface IRPCServiceCenterOptions {
  logger?: ILogger;
  name?: string;
}

export class RPCServiceCenter {
  public uid: string;

  private protocolRepository = new ProtocolRepository();

  private proxyClients: ProxyClient<ProxyJSONRPC>[] = [];
  // jsonrpc proxy start
  private messageConnections: Array<MessageConnection> = [];
  private serviceMethodMap = { client: undefined } as unknown as IRPCServiceMap;
  // jsonrpc proxy end

  // protocol proxy start
  private binaryConnections: Array<BinaryConnection> = [];
  private protocolProxyClients: ProxyClient<ProxySumi>[] = [];
  private protocolServiceMethodMap = { client: undefined } as unknown as IRPCServiceMap;
  // protocol proxy end

  private createService: string[] = [];
  private getService: string[] = [];

  private connectionPromise = new Deferred<void>();
  private binaryConnectionPromise = new Deferred<void>();

  public logger: ILogger;

  get LOG_TAG() {
    return `[RPCServiceCenter] [uid:${this.uid}]`;
  }

  constructor(private bench?: IBench, options: IRPCServiceCenterOptions = {}) {
    let { name } = options;
    if (!name) {
      if (typeof process !== 'undefined' && process.pid) {
        name = 'pid-' + process.pid;
      }
    }
    this.uid = 'RPCServiceCenter:' + name;
    this.logger = options.logger || console;
  }

  registerService(serviceName: string, type: ServiceType): void {
    if (type === ServiceType.Service) {
      this.createService.push(serviceName);
      if (this.bench) {
        this.bench.registerService(serviceName);
      }
    } else if (type === ServiceType.Stub) {
      this.getService.push(serviceName);
    }
  }

  async when() {
    await Promise.all([this.connectionPromise.promise, this.binaryConnectionPromise.promise]);
  }

  setConnection(connection: MessageConnection, binaryConnection: BinaryConnection) {
    if (this.messageConnections.length === 0) {
      this.connectionPromise.resolve();
    }

    this.messageConnections.push(connection);

    const rpcProxy = new ProxyJSONRPC(this.serviceMethodMap, this.logger);
    rpcProxy.listen(connection);
    this.proxyClients.push(rpcProxy.createProxyClient());

    this.setBinaryConnection(binaryConnection);
  }

  removeConnection(connection: MessageConnection, binaryConnection: BinaryConnection) {
    const removeIndex = this.messageConnections.indexOf(connection);
    if (removeIndex !== -1) {
      this.messageConnections.splice(removeIndex, 1);
      this.proxyClients.splice(removeIndex, 1);
    }

    const result1 = removeIndex !== -1;
    return result1 && this.removeBinaryConnection(binaryConnection);
  }

  private setBinaryConnection(connection: BinaryConnection) {
    if (this.binaryConnections.length === 0) {
      this.binaryConnectionPromise.resolve();
    }

    this.binaryConnections.push(connection);

    const rpcProxy = new ProxySumi(this.protocolServiceMethodMap, this.logger);
    rpcProxy.setProtocolRepository(this.protocolRepository);
    rpcProxy.listen(connection);

    this.protocolProxyClients.push(rpcProxy.createProxyClient());
  }

  private removeBinaryConnection(connection: BinaryConnection) {
    connection.dispose();

    const removeIndex = this.binaryConnections.indexOf(connection);
    if (removeIndex !== -1) {
      this.binaryConnections.splice(removeIndex, 1);
      this.protocolProxyClients.splice(removeIndex, 1);
    }

    return removeIndex !== -1;
  }

  onRequest(tag: string, _name: string, method: RPCServiceMethod) {
    const methodName = getMethodName(tag, _name);
    if (this.messageConnections.length === 0) {
      this.serviceMethodMap[methodName] = method;
    } else {
      this.proxyClients.forEach((proxy) => {
        proxy.getOriginal().listenService({ [methodName]: method });
      });
    }
  }

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRepository.loadProtocol(protocol);
  }

  onProtocolRequest(tag: string, _method: string, methodFn: RPCServiceMethod) {
    const methodName = getMethodName(tag, _method);

    if (this.binaryConnections.length === 0) {
      this.protocolServiceMethodMap[methodName] = methodFn;
    } else {
      this.protocolProxyClients.forEach((proxy) => {
        proxy.getOriginal().listenService({ [methodName]: methodFn });
      });
    }
  }

  async broadcast(tag: string, name: string, ...args: any[]): Promise<any> {
    const methodName = getMethodName(tag, name);

    const clients = [] as ProxyClient<any>[];
    if (this.protocolRepository.has(methodName)) {
      clients.push(...this.protocolProxyClients);
    } else {
      clients.push(...this.proxyClients);
    }

    const broadcastResult = await Promise.all(clients.map((client) => client.getProxy()[methodName](...args)));

    if (!broadcastResult || broadcastResult.length === 0) {
      throw new Error(`${this.LOG_TAG} broadcast rpc \`${methodName}\` error: no remote service found`);
    }

    const doubtfulResult = [] as any[];
    const result = [] as any[];
    for (const i of broadcastResult) {
      if (i === NOTREGISTERMETHOD) {
        doubtfulResult.push(i);
      } else {
        result.push(i);
      }
    }

    if (doubtfulResult.length > 0) {
      this.logger.warn(`broadcast rpc \`${methodName}\` getting doubtful responses: ${doubtfulResult.join(',')}`);
    }

    if (result.length === 0) {
      throw new Error(`${this.LOG_TAG} broadcast rpc \`${methodName}\` error: no remote service can handle this call`);
    }

    // FIXME: this is an unreasonable design, if remote service only returned doubtful result, we will return an empty array.
    //        but actually we should throw an error to tell user that no remote service can handle this call.
    //        or just return `undefined`.
    return result.length === 1 ? result[0] : result;
  }
}