import { createYoga, createSchema } from 'graphql-yoga';
import { createServer } from 'http';
import sharp from 'sharp';

export default function startServer() {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          resizeImage(image: String, width: Int, height: Int): String
        }
      `,
      resolvers: {
        Query: {
          resizeImage: async (_, { image, width, height }) => {
            try {
              const inputBuffer = Buffer.from(image, 'base64');
              const temp1 = await sharp(inputBuffer);
              const temp2 = await temp1.resize(width, height);
              const buffer = await temp2.toBuffer();
              // const buffer = .resize(width, height).toBuffer(); //TODO,GIL: this is currently failing
              const base64 = buffer.toString('base64');
              return base64;
            } catch (e) {
              console.error(`Error resizing image`, e);
              return null;
            }
          },
        },
      },
    }),
    maskedErrors: false,
    logging: false,
  });
  const server = createServer(yoga);
  return new Promise(resolve => {
    server.listen(3002, () => {
      resolve(
        () =>
          new Promise(resolve => {
            server.close(resolve);
          })
      );
    });
  });
}
