import { findAndParseConfig } from '@graphql-mesh/cli';
import { getMesh, MeshInstance } from '@graphql-mesh/runtime';
import { readFileSync } from 'fs';
import { join } from 'path';

import accountsService from '../services/accounts';
import inventoryService from '../services/inventory';
import productsService from '../services/products';
import reviewsService from '../services/reviews';

const exampleQuery = readFileSync(join(__dirname, '../gateway/example-query.graphql'), 'utf8');

describe('Federation Example', () => {
  let mesh: MeshInstance;
  const services = [accountsService, inventoryService, productsService, reviewsService];
  beforeAll(async () => {
    const [config] = await Promise.all([
      findAndParseConfig({
        dir: join(__dirname, '../gateway'),
      }),
      ...services.map(service => service.start()),
    ]);
    mesh = await getMesh(config);
  });
  afterAll(async () => {
    await Promise.all(services.map(service => service.stop()));
    mesh?.destroy();
  });
  it('should give correct response for example queries', async () => {
    const result = await mesh?.execute(exampleQuery, undefined);
    expect(result?.errors).toBeFalsy();
    expect(result?.data).toMatchSnapshot();
  });
});
