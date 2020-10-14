/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { schema } from '@kbn/config-schema';
import { IRouter, Logger } from 'src/core/server';

import { INDEX_NAMES } from '../../../common/constants';
import { LegacyPipeline, OldPipeline } from '../../models/pipeline';
import { wrapRouteWithLicenseCheck } from '../../../../licensing/server';
import { checkLicense } from '../../lib/check_license';

export function registerPipelineLoadRoute(router: IRouter, logger: Logger) {
  router.get(
    {
      path: '/api/logstash/pipeline/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
    },
    wrapRouteWithLicenseCheck(
      checkLicense,
      router.handleLegacyErrors(async (context, request, response) => {
        const pipelineFetcher = context.logstash!.pipelineFetcher;
        const result = await pipelineFetcher.get(request.params.id);
        // todo remove
        // const client = context.logstash!.esClient;
        // const result = await client.callAsCurrentUser('get', {
        //   index: INDEX_NAMES.PIPELINES,
        //   id: request.params.id,
        //   _source: ['description', 'username', 'pipeline', 'pipeline_settings'],
        //   ignore: [404],after
        // });

        if (
          (result._id && !result.found) ||
          (result._id === undefined && result[request.params.id] === undefined)
        ) {
          logger.debug(`pipeline ${request.params.id} not found`);
          return response.notFound();
        }

        return response.ok({
          body: context.logstash!.modelClassRef.fromUpstreamJSON(result, request.params.id),
          // todo remove
          // body: new OldPipeline().fromUpstreamJSON(result).downstreamJSON,
        });
      })
    )
  );
}
