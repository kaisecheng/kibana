/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import {
  CoreSetup,
  CoreStart,
  ILegacyCustomClusterClient,
  Logger,
  Plugin,
  PluginInitializerContext,
} from 'src/core/server';
import { LicensingPluginSetup } from '../../licensing/server';
import { PluginSetupContract as FeaturesPluginSetup } from '../../features/server';
import { SecurityPluginSetup } from '../../security/server';
import { LegacyApiPipelineFetcher, SystemIndicesApiPipelineFetcher } from './models/fetcher';

import { registerRoutes } from './routes';
import {LegacyPipeline, SystemIndicesPipeline} from "./models/pipeline";

interface SetupDeps {
  licensing: LicensingPluginSetup;
  security?: SecurityPluginSetup;
  features: FeaturesPluginSetup;
}

export class LogstashPlugin implements Plugin {
  private readonly logger: Logger;
  private esClient?: ILegacyCustomClusterClient;
  private coreSetup?: CoreSetup;
  private isLegacyApi: boolean;
  constructor(context: PluginInitializerContext) {
    this.logger = context.logger.get();
  }

  async setup(core: CoreSetup, deps: SetupDeps) {
    this.logger.debug('Setting up Logstash plugin');

    this.coreSetup = core;
    registerRoutes(core.http.createRouter(), deps.security, this.logger);

    this.esClient = core.elasticsearch.legacy.createClient('logstash');
    this.isLegacyApi = !this.isSystemIndices();

    deps.features.registerElasticsearchFeature({
      id: 'pipelines',
      management: {
        ingest: ['pipelines'],
      },
      privileges: [
        this.isLegacyApi
          ? {
              requiredClusterPrivileges: [],
              requiredIndexPrivileges: {
                ['.logstash']: ['read'],
              },
              ui: [],
            }
          : {
              requiredClusterPrivileges: [],
              requiredIndexPrivileges: {
                ['.logstash']: ['read'],
              },
              ui: [],
            },
      ],
    });
  }

  start(core: CoreStart) {
    this.coreSetup!.http.registerRouteHandlerContext('logstash', async (context, request) => {
      return this.contextBuilder(request);
    });
  }

  stop() {
    if (this.esClient) {
      this.esClient.close();
    }
  }

  private async isSystemIndices(): boolean {
    const esVersion = (
      await this.esClient.callAsInternalUser('transport.request', {
        method: 'GET',
        path: '/',
      })
    ).version.number;
    const [major, minor] = esVersion.split('.');
    return Number(major) >= 8 || (Number(major) === 7 && Number(minor) >= 9);
  }

  private contextBuilder(request) {
    if (this.isLegacyApi) {
      return {
        esClient: this.esClient.asScoped(request),
        pipelineFetcher: new LegacyApiPipelineFetcher(this.esClient.asScoped(request), this.logger),
        modelClassRef: LegacyPipeline.prototype.constructor,
      };
    } else {
      return {
        esClient: this.esClient.asScoped(request),
        pipelineFetcher: new SystemIndicesApiPipelineFetcher(
          this.esClient.asScoped(request),
          this.logger
        ),
        modelClassRef: SystemIndicesPipeline.prototype.constructor,
      };
    }
  }
}
