import { fs, path } from '@graphql-mesh/cross-helpers';
import { MeshInstance } from '@graphql-mesh/runtime';
import { Logger, YamlConfig } from '@graphql-mesh/types';
import { DefaultLogger, pathExists } from '@graphql-mesh/utils';
import { createServerAdapter, ServerAdapter } from '@whatwg-node/server';
import { Router } from 'itty-router';
import { withCookies } from 'itty-router-extras';
import { graphqlHandler } from './graphqlHandler';
import { Response } from '@whatwg-node/fetch';
import landingPageHtml from './landing-page-html';

export type MeshHTTPHandler<TServerContext> = ServerAdapter<TServerContext, Router<Request>>;

export function createMeshHTTPHandler<TServerContext>({
  baseDir,
  getBuiltMesh,
  rawServeConfig = {},
  playgroundTitle,
}: {
  baseDir: string;
  getBuiltMesh: () => Promise<MeshInstance>;
  rawServeConfig?: YamlConfig.Config['serve'];
  playgroundTitle?: string;
}): MeshHTTPHandler<TServerContext> {
  let readyFlag = false;
  let logger: Logger = new DefaultLogger('Mesh HTTP');
  const mesh$ = getBuiltMesh().then(mesh => {
    readyFlag = true;
    logger = mesh.logger.child('HTTP');
    return mesh;
  });

  const {
    cors: corsConfig,
    staticFiles,
    playground: playgroundEnabled,
    endpoint: graphqlPath = '/graphql',
    // TODO
    // trustProxy = 'loopback',
  } = rawServeConfig;

  const serverAdapter = createServerAdapter(Router());

  serverAdapter.all(
    '/healthcheck',
    () =>
      new Response(null, {
        status: 200,
      })
  );
  serverAdapter.all(
    '/readiness',
    () =>
      new Response(null, {
        status: readyFlag ? 204 : 503,
      })
  );

  serverAdapter.post('*', async (request: Request) => {
    if (readyFlag) {
      const { pubsub } = await mesh$;
      for (const eventName of pubsub.getEventNames()) {
        const { pathname } = new URL(request.url);
        if (eventName === `webhook:${request.method.toLowerCase()}:${pathname}`) {
          const body = await request.text();
          logger.debug(`Received webhook request for ${pathname}`, body);
          pubsub.publish(
            eventName,
            request.headers.get('content-type') === 'application/json' ? JSON.parse(body) : body
          );
          return new Response(null, {
            status: 204,
            statusText: 'OK',
          });
        }
      }
    }
    return undefined;
  });

  if (staticFiles) {
    const indexPath = path.join(baseDir, staticFiles, 'index.html');
    serverAdapter.get('*', async request => {
      const url = new URL(request.url);
      if (graphqlPath !== '/' && url.pathname === '/' && (await pathExists(indexPath))) {
        const indexFileStream = fs.createReadStream(indexPath);
        return new Response(indexFileStream as any, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        });
      }
      const filePath = path.join(baseDir, staticFiles, url.pathname);
      if (await pathExists(filePath)) {
        const fileStream = fs.createReadStream(filePath);
        return new Response(fileStream as any, {
          status: 200,
        });
      }
      return undefined;
    });
  }

  serverAdapter.all(
    '*',
    withCookies,
    graphqlHandler(mesh$, playgroundTitle, playgroundEnabled, graphqlPath, corsConfig)
  );

  serverAdapter.all('*', (request: Request) => {
    const acceptType = request.headers.get('accept');
    if (acceptType.includes('text/html')) {
      return new Response(landingPageHtml.replace('__GRAPHIQL_LINK__', graphqlPath), {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
    return new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  });

  return serverAdapter;
}
