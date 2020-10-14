/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { ILegacyCustomClusterClient } from 'kibana/server';
import { Logger } from 'kibana/server';
import {INDEX_NAMES} from "../../../common/constants";

interface PipelineFetcher {
  info();
  get(pipelineId: string);
  getAll();
  save(pipelineId: string, pipelineJson: Record<string, any>);
  delete(pipelineId: string);
  checkExist();
  upgradeMapping();
}

export class LegacyApiPipelineFetcher implements PipelineFetcher {
  private readonly esClient: ILegacyCustomClusterClient;
  private readonly logger: Logger;
  constructor(esClient: ILegacyCustomClusterClient, logger: Logger) {
    this.esClient = esClient;
    this.logger = logger;
  }

  async info() {
    return this.esClient.callAsCurrentUser('info');
  }

  async delete(pipelineId: string) {
    return this.esClient.callAsCurrentUser('delete', {
      index: INDEX_NAMES.PIPELINES,
      id: pipelineId,
      refresh: 'wait_for',
    });
  }

  async get(pipelineId: string) {
    return this.esClient.callAsCurrentUser('get', {
      index: INDEX_NAMES.PIPELINES,
      id: pipelineId,
      _source: ['description', 'username', 'pipeline', 'pipeline_settings'],
      ignore: [404],
    });
  }

  async save(pipelineId: string, pipelineJson: Record<string, any>) {
    return this.esClient.callAsCurrentUser('index', {
      index: INDEX_NAMES.PIPELINES,
      id: pipelineId,
      body: pipelineJson,
      refresh: 'wait_for',
    });
  }
}

export class SystemIndicesApiPipelineFetcher implements PipelineFetcher {
  private static readonly API_PATH = '/_logstash/pipeline';
  private readonly esClient: ILegacyCustomClusterClient;
  private readonly logger: Logger;
  constructor(esClient: ILegacyCustomClusterClient, logger: Logger) {
    this.esClient = esClient;
    this.logger = logger;
  }

  async info() {
    return this.esClient.callAsCurrentUser('info');
  }

  async delete(pipelineId) {
    return this.esClient.callAsCurrentUser('transport.request', {
      method: 'DELETE',
      path: `${SystemIndicesApiPipelineFetcher.API_PATH}/${encodeURIComponent(pipelineId)}`,
      refresh: 'wait_for',
    });
  }

  async get(pipelineId: string) {
    return this.esClient.callAsCurrentUser('transport.request', {
      method: 'GET',
      path: `${SystemIndicesApiPipelineFetcher.API_PATH}/${encodeURIComponent(pipelineId)}`,
      ignore: [404],
    });
  }

  async save(pipelineId: string, pipelineJson: Record<string, any>) {
    return this.esClient.callAsCurrentUser('transport.request', {
      method: 'PUT',
      path: `${SystemIndicesApiPipelineFetcher.API_PATH}/${encodeURIComponent(pipelineId)}`,
      body: pipelineJson,
      refresh: 'wait_for',
    });
  }
}
