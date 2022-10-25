import { minify } from 'html-minifier-terser';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const minified = await minify(fs.readFileSync(path.join(__dirname, '..', 'src', 'landing-page.html'), 'utf-8'), {
    minifyJS: true,
    useShortDoctype: false,
    removeAttributeQuotes: true,
    collapseWhitespace: true,
    minifyCSS: true,
  });

  fs.writeFileSync(path.join(__dirname, '../src/landing-page-html.ts'), `export default ${JSON.stringify(minified)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
